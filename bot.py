import asyncio
import logging
import os
import signal
import tempfile
from pathlib import Path

import edge_tts
import httpx
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED_USER_IDS = {
    int(x.strip())
    for x in os.environ["ALLOWED_USER_IDS"].split(",")
    if x.strip()
}
WORK_DIR = Path(os.environ.get("CLAUDE_WORK_DIR", ".")).resolve()
CLAUDE_CMD = os.environ.get("CLAUDE_CMD", "claude")
TIMEOUT_SECONDS = int(os.environ.get("CLAUDE_TIMEOUT", "300"))

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_STT_MODEL = os.environ.get("GROQ_STT_MODEL", "whisper-large-v3-turbo")
TTS_VOICE = os.environ.get("TTS_VOICE", "en-US-AriaNeural")
VOICE_PROMPT_PREFIX = os.environ.get(
    "VOICE_PROMPT_PREFIX",
    (
        "You are being asked this question by a user who is driving and "
        "listening to your reply via text-to-speech. Reply in 2 to 4 short, "
        "conversational sentences. No lists, no markdown, no code blocks. "
        "Question: "
    ),
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("bot")


def is_allowed(update: Update) -> bool:
    user = update.effective_user
    if user is None or user.id not in ALLOWED_USER_IDS:
        log.warning(
            "Rejected update from user_id=%s username=%s",
            user.id if user else None,
            user.username if user else None,
        )
        return False
    return True


async def run_claude(prompt: str) -> str:
    proc = await asyncio.create_subprocess_exec(
        CLAUDE_CMD,
        "-p",
        prompt,
        cwd=str(WORK_DIR),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return "[Claude took longer than the timeout, aborted.]"

    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        return f"[Claude error]\n{err or '(no stderr)'}"

    return stdout.decode("utf-8", errors="replace").strip() or "[empty response]"


async def reply_chunked(update: Update, text: str) -> None:
    chunk_size = 4000
    for i in range(0, len(text), chunk_size):
        await update.message.reply_text(text[i : i + chunk_size])


async def transcribe_with_groq(audio_path: Path) -> str:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set")
    async with httpx.AsyncClient(timeout=120) as client:
        with open(audio_path, "rb") as f:
            files = {"file": (audio_path.name, f, "audio/ogg")}
            data = {"model": GROQ_STT_MODEL}
            headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
            r = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers=headers,
                data=data,
                files=files,
            )
            r.raise_for_status()
            return (r.json().get("text") or "").strip()


async def synthesize_voice_ogg(text: str, out_ogg: Path) -> None:
    mp3_path = out_ogg.with_suffix(".mp3")
    communicate = edge_tts.Communicate(text, TTS_VOICE)
    await communicate.save(str(mp3_path))
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-y",
        "-i",
        str(mp3_path),
        "-c:a",
        "libopus",
        "-b:a",
        "32k",
        str(out_ogg),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()
    mp3_path.unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError("ffmpeg conversion failed (is ffmpeg installed?)")


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_allowed(update):
        return
    prompt = (update.message.text or "").strip()
    if not prompt:
        return

    log.info("Prompt from %s: %s", update.effective_user.id, prompt[:200])
    await update.message.chat.send_action("typing")

    reply = await run_claude(prompt)
    log.info("Claude replied with %d chars", len(reply))
    await reply_chunked(update, reply)


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_allowed(update):
        return

    voice = update.message.voice or update.message.audio
    if voice is None:
        return

    tg_file = await voice.get_file()

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        audio_in = tmp / "in.ogg"
        await tg_file.download_to_drive(str(audio_in))

        await update.message.chat.send_action("typing")
        try:
            transcript = await transcribe_with_groq(audio_in)
        except Exception as e:
            log.exception("STT failed")
            await update.message.reply_text(f"[STT error] {e}")
            return

        if not transcript:
            await update.message.reply_text("[empty transcript]")
            return

        log.info("Transcript from %s: %s", update.effective_user.id, transcript[:200])
        await update.message.reply_text(f"✍️ {transcript}")

        prompt = VOICE_PROMPT_PREFIX + transcript
        reply = await run_claude(prompt)
        log.info("Claude replied with %d chars", len(reply))
        await reply_chunked(update, reply)

        try:
            await update.message.chat.send_action("record_voice")
            audio_out = tmp / "out.ogg"
            await synthesize_voice_ogg(reply, audio_out)
            with open(audio_out, "rb") as vf:
                await update.message.reply_voice(voice=vf)
        except Exception as e:
            log.exception("TTS failed")
            await update.message.reply_text(f"[TTS error, text reply above] {e}")


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_allowed(update):
        return
    await update.message.reply_text(
        "Bot is up. Send a text message or a voice note and I'll forward it to "
        "Claude Code.\n"
        f"Workspace: {WORK_DIR}"
    )


async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_allowed(update):
        return
    await update.message.reply_text("Shutting down.")
    log.info("Shutdown requested by user %s", update.effective_user.id)
    os.kill(os.getpid(), signal.SIGINT)


def main() -> None:
    log.info("Allowed user IDs: %s", ALLOWED_USER_IDS)
    log.info("Workspace: %s", WORK_DIR)
    log.info("Claude command: %s", CLAUDE_CMD)
    log.info("TTS voice: %s", TTS_VOICE)
    log.info("Groq STT model: %s", GROQ_STT_MODEL)

    if not WORK_DIR.exists():
        log.warning("Workspace does not exist yet: %s", WORK_DIR)
    if not GROQ_API_KEY:
        log.warning("GROQ_API_KEY is not set; voice messages will fail.")

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("stop", cmd_stop))
    app.add_handler(MessageHandler(filters.VOICE | filters.AUDIO, handle_voice))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()

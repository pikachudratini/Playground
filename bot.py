import asyncio
import logging
import os
import signal
from pathlib import Path

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


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not is_allowed(update):
        return
    await update.message.reply_text(
        "Bot is up. Send any message and I'll forward it to Claude Code.\n"
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

    if not WORK_DIR.exists():
        log.warning("Workspace does not exist yet: %s", WORK_DIR)

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("stop", cmd_stop))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()

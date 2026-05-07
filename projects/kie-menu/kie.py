"""Kie.ai multi-model menu tool.

Lets you call several different AI models on kie.ai through one script:
  - text   -> Gemini 3 Flash       (chat / Q&A / summaries)         [sync]
  - image  -> GPT Image 2          (text-to-image generation)       [async]
  - video  -> Wan 2.7              (text-to-video generation)       [async]
  - music  -> Suno V5              (music generation)               [async]

Usage:
    python kie.py list
    python kie.py text  "Explain photosynthesis in three sentences"
    python kie.py image "A cat playing piano in a jazz club"
    python kie.py video "A drone flying over a coastal city at sunset"
    python kie.py music "A relaxing lo-fi beat for studying"

Output files land in projects/kie-menu/outputs/<category>/.

Requires KIE_API_KEY in .env (copy .env.example and fill it in).
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

BASE = "https://api.kie.ai"
OUTPUTS = Path(__file__).with_name("outputs")
POLL_INTERVAL = 5
POLL_TIMEOUT = 900  # 15 minutes (video can be slow)


# -------- helpers --------

def auth(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def post(path: str, body: dict, api_key: str) -> dict:
    url = f"{BASE}{path}"
    print(f"POST {url}")
    r = requests.post(url, headers=auth(api_key), json=body, timeout=60)
    if not r.ok:
        print(f"HTTP {r.status_code}: {r.text}", file=sys.stderr)
        r.raise_for_status()
    return r.json()


def get(path: str, params: dict, api_key: str) -> dict:
    url = f"{BASE}{path}"
    r = requests.get(url, headers=auth(api_key), params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def poll(task_id: str, api_key: str) -> dict:
    print(f"Polling task {task_id} (this can take 30s-several minutes)...")
    start = time.time()
    while time.time() - start < POLL_TIMEOUT:
        info = get("/api/v1/jobs/recordInfo", {"taskId": task_id}, api_key)
        data = info.get("data", {}) or {}
        state = (data.get("state") or "").lower()
        if state == "success":
            print("OK: task complete")
            # kie.ai stores the actual results as a JSON string in
            # `resultJson`. Parse it so callers can read it normally.
            raw = data.get("resultJson")
            if isinstance(raw, str):
                try:
                    data["result"] = json.loads(raw)
                except json.JSONDecodeError:
                    data["result"] = {}
            return data
        if state in ("fail", "failed", "error"):
            raise RuntimeError(f"Task failed: {info}")
        elapsed = int(time.time() - start)
        print(f"  still working (state={state or 'pending'}, {elapsed}s)")
        time.sleep(POLL_INTERVAL)
    raise TimeoutError(f"Task {task_id} did not finish in {POLL_TIMEOUT}s")


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:40] or "out"


def output_path(category: str, prompt: str, ext: str) -> Path:
    folder = OUTPUTS / category
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    return folder / f"{stamp}-{slugify(prompt)}.{ext}"


def extract_urls(data: dict, *field_names: str) -> list:
    """Pull URLs out of a kie.ai task result. Different models put them in
    different fields; we look in the parsed `result` dict (from resultJson)
    plus a few common fallback locations."""
    candidates = []
    sources = [data, data.get("result") or {}, data.get("info") or {},
               data.get("response") or {}]
    for src in sources:
        if not isinstance(src, dict):
            continue
        for f in (*field_names, "resultUrls", "outputs", "urls"):
            v = src.get(f)
            if isinstance(v, list):
                candidates.extend(v)
            elif isinstance(v, str):
                candidates.append(v)
    return [c for c in candidates if isinstance(c, str) and c.startswith("http")]


def download(url: str, dest: Path, label: str = "file") -> None:
    print(f"Downloading {label}: {url}")
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    dest.write_bytes(r.content)
    print(f"  saved to: {dest}")


def submit_market_task(model: str, input_obj: dict, api_key: str) -> dict:
    """Submit a job to the unified Market createTask endpoint and poll until done."""
    body = {"model": model, "input": input_obj}
    created = post("/api/v1/jobs/createTask", body, api_key)
    task_id = (created.get("data") or {}).get("taskId") or created.get("taskId")
    if not task_id:
        raise RuntimeError(f"No taskId in response: {created}")
    return poll(task_id, api_key)


# -------- model handlers --------

def cmd_list(args, api_key):
    print("Available models:")
    print("  text   - Gemini 3 Flash    (chat / Q&A / summaries)")
    print("  image  - GPT Image 2       (text-to-image generation)")
    print("  video  - Wan 2.7           (text-to-video generation)")
    print("  music  - Suno V5           (music generation)")


def cmd_text(args, api_key):
    body = {
        "model": "gemini-3-flash",
        "messages": [{"role": "user", "content": args.prompt}],
    }
    result = post("/gemini-3-flash/v1/chat/completions", body, api_key)
    text = result["choices"][0]["message"]["content"]
    md_out = output_path("text", args.prompt, "md")
    md_out.write_text(f"# Prompt\n\n{args.prompt}\n\n# Response\n\n{text}\n")
    # Also save a plain-text version (response only) so other commands
    # can feed it in via --from-file without markdown headers.
    txt_out = md_out.with_suffix(".txt")
    txt_out.write_text(text)
    print("\n--- response ---")
    print(text)
    print(f"\nSaved to: {md_out}")
    print(f"Plain text:  {txt_out}")


def cmd_image(args, api_key):
    result = submit_market_task(
        model="gpt-image-2-text-to-image",
        input_obj={"prompt": args.prompt, "aspect_ratio": args.aspect},
        api_key=api_key,
    )
    urls = extract_urls(result, "imageUrls", "images", "imageUrl", "image")
    if not urls:
        print("Couldn't find image URLs. Full payload:")
        print(json.dumps(result, indent=2))
        return
    for i, url in enumerate(urls, start=1):
        suffix = f"-{i}" if len(urls) > 1 else ""
        out = output_path("images", f"{args.prompt}{suffix}", "png")
        download(url, out, label=f"image {i}")


def cmd_video(args, api_key):
    result = submit_market_task(
        model="wan/2-7-text-to-video",
        input_obj={
            "prompt": args.prompt,
            "resolution": args.resolution,
            "duration": args.duration,
        },
        api_key=api_key,
    )
    urls = extract_urls(result, "videoUrls", "videos", "videoUrl", "video")
    if not urls:
        print("Couldn't find video URLs. Full payload:")
        print(json.dumps(result, indent=2))
        return
    for i, url in enumerate(urls, start=1):
        suffix = f"-{i}" if len(urls) > 1 else ""
        out = output_path("videos", f"{args.prompt}{suffix}", "mp4")
        download(url, out, label=f"video {i}")


def cmd_music(args, api_key):
    # Resolve the prompt -- either from --from-file or the positional arg.
    prompt = args.prompt
    if args.from_file:
        prompt = Path(args.from_file).read_text().strip()
    if not prompt:
        print("Error: give a prompt or --from-file <path>", file=sys.stderr)
        sys.exit(1)

    body = {
        "prompt": prompt,
        "model": "V5",
        "customMode": bool(args.custom),
        "instrumental": bool(args.instrumental),
    }
    if args.custom:
        if not args.style:
            print("Error: --custom mode requires --style \"...\"", file=sys.stderr)
            sys.exit(1)
        body["style"] = args.style
        if args.title:
            body["title"] = args.title

    created = post("/api/v1/generate", body, api_key)
    task_id = (created.get("data") or {}).get("taskId") or created.get("taskId")
    if not task_id:
        raise RuntimeError(f"No taskId in Suno response: {created}")
    result = poll(task_id, api_key)
    urls = extract_urls(result, "audioUrls", "audios", "audioUrl", "audio")
    if not urls:
        print("Couldn't find audio URLs. Full payload:")
        print(json.dumps(result, indent=2))
        return
    label_prompt = args.title or prompt[:40]
    for i, url in enumerate(urls, start=1):
        out = output_path("music", f"{label_prompt}-{i}", "mp3")
        download(url, out, label=f"track {i}")


# -------- entry point --------

def main():
    load_dotenv(Path(__file__).with_name(".env"))
    api_key = os.environ.get("KIE_API_KEY")

    parser = argparse.ArgumentParser(description="Kie.ai multi-model menu tool.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="Show available models")
    p_list.set_defaults(func=cmd_list)

    p_text = sub.add_parser("text", help="Generate text with Gemini 3 Flash")
    p_text.add_argument("prompt")
    p_text.set_defaults(func=cmd_text)

    p_image = sub.add_parser("image", help="Generate an image with GPT Image 2")
    p_image.add_argument("prompt")
    p_image.add_argument("--aspect", default="auto",
                         help="aspect ratio: auto, 1:1, 16:9, 9:16, etc.")
    p_image.set_defaults(func=cmd_image)

    p_video = sub.add_parser("video", help="Generate a video with Wan 2.7")
    p_video.add_argument("prompt")
    p_video.add_argument("--resolution", default="720p",
                         help="video resolution, e.g. 720p, 1080p")
    p_video.add_argument("--duration", type=int, default=5,
                         help="video duration in seconds")
    p_video.set_defaults(func=cmd_video)

    p_music = sub.add_parser("music", help="Generate music with Suno V5")
    p_music.add_argument("prompt", nargs="?", default=None,
                         help="Description (default) or lyrics (--custom)")
    p_music.add_argument("--from-file", dest="from_file", default=None,
                         help="Read prompt/lyrics from this file instead")
    p_music.add_argument("--custom", action="store_true",
                         help="Custom mode: prompt becomes literal lyrics; "
                              "requires --style")
    p_music.add_argument("--style", default=None,
                         help="Musical style (custom mode only)")
    p_music.add_argument("--title", default=None,
                         help="Song title (custom mode, optional)")
    p_music.add_argument("--instrumental", action="store_true",
                         help="No vocals")
    p_music.set_defaults(func=cmd_music)

    args = parser.parse_args()

    if args.cmd != "list" and not api_key:
        print(
            "Error: KIE_API_KEY not set. Copy .env.example to .env and fill it in.",
            file=sys.stderr,
        )
        sys.exit(1)

    args.func(args, api_key)


if __name__ == "__main__":
    main()

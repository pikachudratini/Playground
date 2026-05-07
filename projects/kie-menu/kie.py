"""Kie.ai multi-model menu tool.

Lets you call several different AI models on kie.ai through one script:
  - text   → Gemini 3 Flash (chat / Q&A / summaries)
  - image  → Flux Kontext Pro (image generation)
  - music  → Suno V4 (music generation)

Usage:
    python kie.py list
    python kie.py text "Explain photosynthesis in three sentences"
    python kie.py image "A cat playing piano in a jazz club"
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
POLL_TIMEOUT = 600  # 10 minutes


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
    print(f"Polling task {task_id} (this can take 30s-3min)...")
    start = time.time()
    while time.time() - start < POLL_TIMEOUT:
        info = get("/api/v1/jobs/recordInfo", {"taskId": task_id}, api_key)
        data = info.get("data", {}) or {}
        flag = data.get("successFlag")
        if flag == 1:
            print("OK: task complete")
            return data
        if flag in (-1, 2, 3):
            raise RuntimeError(f"Task failed: {info}")
        elapsed = int(time.time() - start)
        print(f"  still working... ({elapsed}s)")
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


# -------- model handlers --------

def cmd_list(args, api_key):
    print("Available models:")
    print("  text   - Gemini 3 Flash       (chat / Q&A / summaries)")
    print("  image  - Flux Kontext Pro     (image generation)")
    print("  music  - Suno V4              (music generation)")


def cmd_text(args, api_key):
    body = {
        "model": "gemini-3-flash",
        "messages": [{"role": "user", "content": args.prompt}],
    }
    result = post("/gemini-3-flash/v1/chat/completions", body, api_key)
    text = result["choices"][0]["message"]["content"]
    out = output_path("text", args.prompt, "md")
    out.write_text(f"# Prompt\n\n{args.prompt}\n\n# Response\n\n{text}\n")
    print("\n--- response ---")
    print(text)
    print(f"\nSaved to: {out}")


def cmd_image(args, api_key):
    body = {
        "prompt": args.prompt,
        "model": "flux-kontext-pro",
        "aspectRatio": args.aspect,
        "outputFormat": "jpeg",
    }
    created = post("/api/v1/flux/kontext/generate", body, api_key)
    task_id = created["data"]["taskId"]
    result = poll(task_id, api_key)
    info = result.get("info") or result.get("response") or {}
    urls = info.get("resultUrls") or info.get("imageUrls") or []
    url = urls[0] if urls else (info.get("imageUrl") or info.get("url"))
    if not url:
        print("Couldn't find an output URL. Full payload:")
        print(json.dumps(result, indent=2))
        return
    print(f"Image URL: {url}")
    img = requests.get(url, timeout=120).content
    out = output_path("images", args.prompt, "jpg")
    out.write_bytes(img)
    print(f"Saved to: {out}")


def cmd_music(args, api_key):
    body = {
        "prompt": args.prompt,
        "model": "V4",
        "customMode": False,
        "instrumental": False,
    }
    created = post("/api/v1/generate", body, api_key)
    task_id = created["data"]["taskId"]
    result = poll(task_id, api_key)
    info = result.get("info") or result.get("response") or {}
    audio_urls = info.get("audioUrls") or info.get("resultUrls") or []
    if not audio_urls:
        print("Couldn't find audio URLs. Full payload:")
        print(json.dumps(result, indent=2))
        return
    for i, url in enumerate(audio_urls, start=1):
        print(f"Track {i}: {url}")
        audio = requests.get(url, timeout=180).content
        out = output_path("music", f"{args.prompt}-{i}", "mp3")
        out.write_bytes(audio)
        print(f"  saved to: {out}")


# -------- entry point --------

def main():
    load_dotenv(Path(__file__).with_name(".env"))
    api_key = os.environ.get("KIE_API_KEY")

    parser = argparse.ArgumentParser(description="Kie.ai multi-model menu tool.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="Show available models")
    p_list.set_defaults(func=cmd_list)

    p_text = sub.add_parser("text", help="Generate text with Gemini")
    p_text.add_argument("prompt")
    p_text.set_defaults(func=cmd_text)

    p_image = sub.add_parser("image", help="Generate an image with Flux Kontext")
    p_image.add_argument("prompt")
    p_image.add_argument("--aspect", default="1:1",
                         help="aspect ratio, e.g. 1:1, 16:9, 9:16")
    p_image.set_defaults(func=cmd_image)

    p_music = sub.add_parser("music", help="Generate music with Suno")
    p_music.add_argument("prompt")
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

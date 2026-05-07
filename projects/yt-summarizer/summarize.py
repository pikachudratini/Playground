"""Summarize a YouTube video with Gemini 3.1 Flash Lite.

Usage:
    python summarize.py "https://www.youtube.com/watch?v=..."

Requires a GEMINI_API_KEY in .env (copy .env.example and fill it in).
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

MODEL = "gemini-2.5-flash-lite"

SUMMARY_PROMPT = """Watch this video carefully and produce a DETAILED summary.

Structure your response in markdown as:

## Overview
A 2-3 sentence overview of what the video is about.

## Key Points
A bulleted list of the most important points, in the order they appear.

## Notable Quotes or Moments
2-5 specific moments worth remembering, with rough timestamps where possible.

## Takeaways
What should a viewer walk away knowing or being able to do?

Be thorough — don't skip details just to be brief."""


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:50] or "video"


def video_id(url: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/|/shorts/)([\w-]{6,})", url)
    return m.group(1) if m else "video"


def summarize(url: str, api_key: str) -> str:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=MODEL,
        contents=types.Content(
            parts=[
                types.Part(file_data=types.FileData(file_uri=url)),
                types.Part(text=SUMMARY_PROMPT),
            ]
        ),
    )
    return response.text


def save_summary(url: str, summary: str) -> Path:
    summaries_dir = Path(__file__).with_name("summaries")
    summaries_dir.mkdir(exist_ok=True)

    date = datetime.now().strftime("%Y-%m-%d")
    slug = slugify(video_id(url))
    path = summaries_dir / f"{date}-{slug}.md"

    header = (
        f"# Summary of {url}\n\n"
        f"_Generated {datetime.now().isoformat(timespec='seconds')}_\n\n"
        "---\n\n"
    )
    path.write_text(header + summary)
    return path


def main() -> None:
    load_dotenv(Path(__file__).with_name(".env"))
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(
            "Error: GEMINI_API_KEY not set. "
            "Copy .env.example to .env and fill it in.",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(sys.argv) != 2:
        print("Usage: python summarize.py <youtube-url>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    print(f"Watching: {url}")
    print(f"Model: {MODEL}\n")

    summary = summarize(url, api_key)
    saved = save_summary(url, summary)

    print(summary)
    print(f"\n---\nSaved to: {saved}")


if __name__ == "__main__":
    main()

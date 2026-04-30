#!/usr/bin/env bash
# One-time setup for the Telegram <-> Claude Code bot on Linux.
# Run from the repo root:  ./setup.sh

set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ffmpeg not found. Install it first:"
    echo "  Debian/Ubuntu:  sudo apt update && sudo apt install -y ffmpeg"
    echo "  Fedora/RHEL:    sudo dnf install -y ffmpeg"
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 not found. Install python3 and python3-venv first." >&2
    exit 1
fi

echo "Creating virtual environment in .venv ..."
python3 -m venv .venv

echo "Upgrading pip and installing dependencies ..."
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

if [ ! -f .env ]; then
    cp .env.example .env
    echo
    echo "Created .env from template. Edit it and fill in your secrets:"
    echo "  - TELEGRAM_BOT_TOKEN"
    echo "  - ALLOWED_USER_IDS"
    echo "  - CLAUDE_WORK_DIR (must be an existing folder)"
    echo "  - GROQ_API_KEY"
fi

echo
echo "Setup complete."
echo "Next steps:"
echo "  1. Edit .env with your secrets."
echo "  2. Make sure 'claude' CLI is installed and logged in (run 'claude' once interactively)."
echo "  3. Start the bot:  ./run.sh"

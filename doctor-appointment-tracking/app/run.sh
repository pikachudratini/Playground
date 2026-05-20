#!/usr/bin/env bash
# One-command local run for the appointment tracking app.
#
#   ./run.sh           start the app (loads demo data on first run)
#   ./run.sh --seed    reload demo data, then start
#
# Optional: install the "tesseract-ocr" system package to enable local OCR.
set -e
cd "$(dirname "$0")"

FIRST_RUN=0
[ ! -f db.sqlite3 ] && FIRST_RUN=1

if [ ! -d .venv ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

echo "Installing dependencies..."
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

echo "Applying database migrations..."
.venv/bin/python manage.py migrate --noinput

if [ "$1" = "--seed" ] || [ "$FIRST_RUN" = "1" ]; then
  echo "Loading demonstration data..."
  .venv/bin/python manage.py seed_demo
fi

echo ""
echo "Ready. Open http://127.0.0.1:8000/  (press Ctrl+C to stop)"
.venv/bin/python manage.py runserver

# One-time setup for the Telegram <-> Claude Code bot on Windows.
# Run from PowerShell in the repo root:  .\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "Creating virtual environment in .venv ..."
python -m venv .venv

Write-Host "Upgrading pip and installing dependencies ..."
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ""
    Write-Host "Created .env from template. Open it and fill in your secrets:"
    Write-Host "  - TELEGRAM_BOT_TOKEN"
    Write-Host "  - ALLOWED_USER_IDS"
    Write-Host "  - CLAUDE_WORK_DIR (must be an existing folder)"
}

Write-Host ""
Write-Host "Setup complete."
Write-Host "Next steps:"
Write-Host "  1. Edit .env with your secrets."
Write-Host "  2. Make sure 'claude' CLI is installed and logged in (run 'claude' once interactively)."
Write-Host "  3. Start the bot:  .\run.ps1"

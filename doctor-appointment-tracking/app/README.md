# Appointment Tracking — Application

Django implementation of the system planned in the `../*.md` documents. It
tracks each appointment from check-in through exam, claim, payment, and QA,
and runs the deterministic reconciliation engine that flags underpayments
and drafts dispute emails.

> This is working software for review. It is **not** yet production-hardened
> or HIPAA-validated — see "Before real use" below and `../04-hipaa-compliance.md`.

## What is built

| Area | Status |
|------|--------|
| Data model (patients → appointments → exams → claims → payments → disputes) | Done |
| Check-in station: webcam photo + on-screen signature + consent | Done |
| Exam logging: wait time, duration, DBQ/IMO line items | Done |
| Fee schedule + claim recording | Done |
| Reconciliation engine: matched / underpaid / unpaid / no-show-downcoded / mismatch / unmatched | Done |
| Patient-number fuzzy matching (transposition + single edit) | Done |
| Automatic dispute-email drafting | Done |
| Scheduled jobs: 4-month overdue check, QA deadline reminders | Done |
| Append-only audit log of every change | Done |
| Dashboard, appointment/dispute screens, Django admin | Done |
| Records intake **OCR** (Phase 2) | Model only — OCR not wired up |

## Run it locally

```bash
cd app
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo      # demo data + logins
.venv/bin/python manage.py runserver
```

Open http://127.0.0.1:8000/ and sign in. `seed_demo` prints the demo
logins (`admin`, `frontdesk`, `examiner`, `doctor`) and their shared demo
password — change these before any real use.

## Tests

```bash
.venv/bin/python manage.py test
```

## Scheduled jobs (run daily from cron in production)

```bash
.venv/bin/python manage.py run_overdue_check   # flags claims past the overdue window
.venv/bin/python manage.py run_qa_reminders    # QA worklist by deadline
```

## Configuration (environment variables)

Nothing secret is committed. Production reads:

| Variable | Purpose |
|----------|---------|
| `DJANGO_SECRET_KEY` | Required in production |
| `DJANGO_DEBUG` | `false` in production |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Use PostgreSQL; if unset, SQLite is used for local dev |
| `OVERDUE_CLAIM_DAYS` | Overdue window (default 120) |
| `SESSION_TIMEOUT_SECONDS` | Idle auto-logoff (default 1800) |

## Before real use

- Set `DJANGO_DEBUG=false`, a real `DJANGO_SECRET_KEY`, and `DJANGO_ALLOWED_HOSTS`.
- Use PostgreSQL; put the database and `media/` on encrypted storage.
- Serve over HTTPS; create one unique login per staff member.
- Complete the HIPAA risk analysis (`../06-hipaa-risk-analysis-draft.md`).
- `media/` holds patient photos and records — it is PHI and is never committed.

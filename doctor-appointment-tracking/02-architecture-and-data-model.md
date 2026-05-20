# 2. Architecture & Data Model

## 2.1 Design principles

1. **As little AI as possible.** Every step that can be plain code *is* plain code.
   The reconciliation engine, the 4-month checker, the email drafter, and the
   patient-number matcher are all deterministic. AI is used in exactly one place —
   reading scanned paper records — and even there the default is a local,
   non-cloud OCR engine.
2. **One office, modest volume.** This is built for a single practice, not a hospital
   network. Keep it simple, boring, and maintainable.
3. **Evidence-first.** Every record exists to back up a payment dispute. Timestamps,
   photos, counts, and an immutable audit log are the point.
4. **PHI stays contained.** Patient data lives in one encrypted database in one place.
   It does not get copied into spreadsheets, GitHub, or chat tools.

## 2.2 Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Web app (in-office)                       │
│   Staff: check-in, records upload, exam logging               │
│   Doctor: QA worklist, dispute review queue, dashboard        │
└───────────────┬───────────────────────────────────────────────┘
                │
        ┌───────┴────────┬──────────────┬───────────────┐
        ▼                ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────────┐
│  Database    │ │ File/photo   │ │ OCR /     │ │  Scheduler   │
│ (encrypted)  │ │ store        │ │ extraction│ │ (cron jobs)  │
│              │ │ (encrypted)  │ │ (local)   │ │              │
└──────────────┘ └──────────────┘ └───────────┘ └──────┬───────┘
        ▲                                              │
        │                                              ▼
┌───────┴────────────────┐                  ┌──────────────────────┐
│ Reconciliation engine  │◀─────────────────│ 4-month auto-checker  │
│ (expected vs paid)     │                  │ + QA deadline checker │
└───────────┬────────────┘                  └──────────────────────┘
            │
            ▼
┌────────────────────────┐
│ Dispute email drafter  │──▶ Doctor's review queue ──▶ secure send
│ (templates, no AI)     │
└────────────────────────┘
```

| Component | Job | AI? |
|-----------|-----|-----|
| Web app | Screens for staff and doctor | No |
| Database | Single source of truth, encrypted at rest | No |
| File/photo store | Arrival photos, records, EFT files | No |
| OCR / extraction | Turn scanned paper into text/fields | **Local OCR**; cloud/GPT optional |
| Scheduler | Run the 4-month checks and QA reminders | No |
| Reconciliation engine | Compare expected vs paid, classify results | No |
| Email drafter | Fill dispute templates with evidence | No |
| Audit log | Immutable record of every change | No |

## 2.3 Recommended tech stack

This is a **recommendation**, not a requirement — see doc 5 for the decisions to
confirm. It favors mature, boring, well-documented tools that one part-time developer
can maintain.

| Layer | Recommendation | Why |
|-------|---------------|-----|
| Application | **Python + Django** | Built-in admin UI, authentication, roles, ORM, and audit hooks — large parts of this come "for free" |
| Database | **PostgreSQL** | Robust, supports encryption, good backups; SQLite is acceptable only for a tiny single-user pilot |
| File/photo storage | Encrypted folder on the same server | Keeps PHI local; backed up with the database |
| OCR (local) | **Tesseract** (open source) | Runs on-premises, no data leaves the building, no BAA needed, deterministic |
| OCR (optional, harder docs) | A cloud document-AI service **with a signed BAA**, *or* the OpenAI product your BAA covers | Only if local OCR is not good enough; see doc 4 |
| Scheduler | `cron` + Django management commands (or Celery if volume grows) | Simple, reliable, easy to reason about |
| Email | Templates rendered in-app; saved as drafts; sent via a **HIPAA-compliant secure email service with a BAA** | Dispute emails contain PHI — they must go over a secure channel |
| Hosting | On-premises always-on mini-server (see doc 5) | Keeps live PHI in the building |
| Version control | Private GitHub repo — **code only, never data** | See doc 4 and doc 5 |

## 2.4 Data model

Core entities and their key fields. "PHI" marks fields that are protected health
information and must be encrypted and access-controlled.

### Patient
- `id` (internal)
- `full_name` *(PHI)*, `date_of_birth` *(PHI)*, `contact_info` *(PHI)*
- `ssn_last4` *(PHI — store only last 4 if needed at all)*
- `canonical_patient_number` — the office's official number for this patient
- `created_at`, `updated_at`

### Appointment
- `id`, `patient_id` → Patient
- `scheduled_datetime`, `exam_type`, `payer`
- `status` — `Scheduled → Arrived → InExam → Completed → ClaimSubmitted`
  (or `NoShow` / `Cancelled`)
- `arrived_at`, `exam_started_at`, `exam_ended_at`, `checked_out_at`
- `wait_minutes` (computed: `exam_started_at − arrived_at`)
- `exam_duration_minutes` (computed)
- `follow_up_type`, `follow_up_date`

### CheckIn
- `id`, `appointment_id` → Appointment
- `arrival_timestamp`, `arrival_photo_file` *(PHI)*
- `photo_consent` (boolean + timestamp)
- `checked_in_by` (staff user)

### RecordsIntake
- `id`, `appointment_id` → Appointment
- `source` — `EHR export` / `Paper scan`
- `files` *(PHI)*, `ocr_text` *(PHI)*, `extraction_status`

### ExamRecord
- `id`, `appointment_id` → Appointment
- `conditions_examined` (list)
- `examiner` (user)
- `notes`

### ExamItem  *(one row per DBQ or IMO performed)*
- `id`, `exam_record_id` → ExamRecord
- `item_type` — `DBQ` / `IMO`
- `description`
- `expected_fee` (looked up from the fee schedule)

### Claim
- `id`, `appointment_id` → Appointment
- `submitted_date`
- `submitted_patient_number` — **the number as keyed onto the submission**
  (compared against `Patient.canonical_patient_number` to catch typos)
- `services_claimed` (list)
- `expected_amount` (sum of `ExamItem.expected_fee`)

### QAQuestionnaire
- `id`, `appointment_id` → Appointment (or `claim_id`)
- `received_date`, `deadline`, `completed_date`
- `status` — `Open → InProgress → Completed`
- `time_spent_minutes`

### Remittance  *(one EFT / payment statement)*
- `id`, `payer`, `received_date`, `total_amount`
- `source_file` (the EFT advice / ERA / spreadsheet, if any)

### RemittanceLine  *(one line item inside a Remittance)*
- `id`, `remittance_id` → Remittance
- `patient_number_on_eft`
- `amount_paid`
- `service_description` (often blank — that is the core problem)
- `matched_appointment_id` → Appointment (nullable until reconciled)

### Reconciliation  *(result of comparing one appointment to its payment)*
- `id`, `appointment_id` → Appointment
- `expected_amount`, `paid_amount`
- `result` — `Matched` / `Underpaid` / `Unpaid` / `NoShowDowncoded` /
  `PatientNumberMismatch` / `Unmatched`
- `variance` (`expected − paid`)
- `checked_at`

### Dispute
- `id`, `reconciliation_id` → Reconciliation
- `draft_email_body`, `evidence_refs` (links to photo, timestamps, ExamItems)
- `status` — `Drafted → Sent → Resolved` / `Escalated`
- `sent_date`, `response_due_date`, `amount_recovered`

### AuditLog
- `id`, `user`, `action`, `entity_type`, `entity_id`, `timestamp`, `before/after`
- Append-only. Required for HIPAA *and* doubles as dispute evidence.

### FeeSchedule
- `payer`, `item_type` (DBQ / IMO / full exam / **no-show**), `fee`
- The no-show fee (~$75) lives here — it is the number the engine compares against
  to detect downcoding.

### User  *(staff and doctor accounts)*
- `id`, `name`, `unique_login`, `role` (front-desk / examiner / doctor / admin)
- Unique per person — **no shared accounts** (see doc 4).

## 2.5 How the entities connect

```
Patient ──1:N──▶ Appointment ──1:1──▶ CheckIn
                      │
                      ├──1:1──▶ RecordsIntake
                      ├──1:1──▶ ExamRecord ──1:N──▶ ExamItem (DBQ/IMO)
                      ├──1:1──▶ Claim
                      ├──1:N──▶ QAQuestionnaire
                      └──1:1──▶ Reconciliation ──1:1──▶ Dispute

Remittance ──1:N──▶ RemittanceLine ──(matched to)──▶ Appointment
FeeSchedule ──(looked up by)──▶ ExamItem, Reconciliation
AuditLog ──(records changes to)──▶ everything
```

The reconciliation logic that ties `RemittanceLine` to `Appointment` is described in
detail in doc 3.

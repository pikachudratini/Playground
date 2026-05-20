# Doctor Appointment → Check-In → Exam → Claim → Payment & QA Tracking System

**Status:** Planning phase (no code written yet)
**Purpose of this folder:** A complete, decision-ready plan for a system that tracks
every patient appointment end-to-end so the doctor's office can prove what was done,
get paid correctly, and dispute underpayments automatically.

---

## The problem in one paragraph

The office does medical exams (DBQs and IMOs) but is paid by an insurer/contractor
that takes up to ~4 months to pay, sometimes underpays (paying a ~$75 "no-show" fee
when a full exam happened), sometimes never pays, and sends payment (EFT) without
saying *what* it is paying for. The doctor is too busy to track this manually. Today
the office tracks "they showed up" on a Google Sheet and keeps no records on hand
(everything lives in the EHR). An audit of last year found **~$40,000 unpaid**. The
goal is a system that captures hard evidence at every step, reconciles payments
against that evidence automatically, and drafts dispute emails so the doctor doesn't
have to think about it.

---

## Read these in order

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [01-overview-and-workflow.md](01-overview-and-workflow.md) | Goals, success metrics, and the full step-by-step workflow |
| 2 | [02-architecture-and-data-model.md](02-architecture-and-data-model.md) | System components, the data model, recommended tech stack |
| 3 | [03-reconciliation-and-automation.md](03-reconciliation-and-automation.md) | The payment-matching engine, no-show detection, the 4-month auto-check, dispute emails |
| 4 | [04-hipaa-compliance.md](04-hipaa-compliance.md) | HIPAA, BAAs, encryption, the OpenAI BAA caveat, de-identification |
| 5 | [05-hosting-and-roadmap.md](05-hosting-and-roadmap.md) | Where it runs, GitHub's role, the phased build plan, decisions needed |

---

## Executive summary — the 5 things that matter most

1. **The highest-value, lowest-risk first step is killing the Google Sheet.** A proper
   check-in + exam tracker (arrival photo + timestamp, wait time, DBQ/IMO counts) is
   what creates the evidence trail. That alone is what made the $40k recoverable.

2. **The money logic needs almost no AI.** Matching EFTs to appointments, spotting
   no-show downcoding, and catching patient-number typos are all plain, deterministic
   code. AI is only useful for reading scanned paper records — and even that can be
   done locally without sending anything to ChatGPT.

3. **A BAA does not cover every OpenAI product.** Consumer ChatGPT and consumer
   "custom GPTs" are generally **not** covered by a Business Associate Agreement. A
   BAA typically covers the **OpenAI API** and **ChatGPT Enterprise**. Confirm exactly
   which product your signed BAA covers, and only send patient information to that one.
   (See doc 4.)

4. **Never put patient data in GitHub — not even the "de-identified" version.** GitHub
   is for *source code only*. What you described (tokenizing names with a key that can
   reverse it) is **pseudonymization**, not HIPAA "de-identification" — that data is
   still legally PHI and still needs a BAA wherever it goes. (See doc 4.)

5. **This plan is not legal advice.** A HIPAA Security Risk Analysis is legally
   required and should be done with a HIPAA compliance professional or healthcare
   attorney before go-live. This plan is built to make that review easy and short.

---

## What "done" looks like

- No manual spreadsheet. Staff check patients in on a screen; the system timestamps
  everything.
- Every 4 months, the system flags any appointment that was completed but not paid,
  or paid less than expected.
- The doctor opens one screen, sees "here are 6 disputes ready to send," reviews the
  pre-written emails, and clicks send.
- Every dispute email comes with the evidence already attached: arrival photo,
  wait/exam timestamps, DBQ/IMO counts, records-on-file.
- QA questionnaires show up on a worklist with deadlines and reminders so the doctor
  never falls behind and never loses referral volume.

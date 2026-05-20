# 3. Reconciliation & Automation

This is the financial core of the system — and it needs **no AI at all**. Everything
here is deterministic, rule-based code.

## 3.1 The fee schedule (the "expected" side)

The system stores a fee schedule per payer:

| Item type | Example fee |
|-----------|-------------|
| DBQ | (per the payer's contract) |
| IMO | (per the payer's contract) |
| Full exam | (per the payer's contract) |
| **No-show** | **~$75** |

When the exam is logged (Stage D), each DBQ/IMO becomes an `ExamItem` and the system
sums their fees into `Claim.expected_amount`. This is the number every payment is
checked against.

> **Decision needed:** the real fee values must come from the payer contract. Until
> they are entered, the engine can still flag *non*-payment and *no-show* payments;
> it just cannot quantify partial underpayment precisely.

## 3.2 Ingesting the EFT / remittance (the "paid" side)

When a payment arrives it is entered as a `Remittance` with one `RemittanceLine` per
patient number + amount.

**Critical first question for the payer:** does a *remittance advice* accompany the
EFT? In US healthcare billing this is often an **835 ERA** (a structured electronic
file) or an EOB. That document usually *does* itemize what was paid — including
service codes that reveal a no-show vs a full exam. If it exists:

- The system can ingest it directly and reconciliation becomes near-automatic.
- **Action item:** ask the payer / your bank to send the 835 ERA or remittance
  detail. Many payers send it but practices never collect it.

If the payer genuinely sends only a bare EFT (patient number + amount, no
description) — which fits what you described — the engine falls back to
**amount-based inference** using the fee schedule (next section).

EFT entry options, lowest-AI first:
1. **Structured file (835/CSV):** parsed directly by code. Best case.
2. **PDF statement:** parsed by code if the layout is consistent; local OCR if scanned.
3. **Manual entry:** a staff member types the lines in. Always available as a fallback.

## 3.3 The reconciliation engine

For each `RemittanceLine`, the engine runs this logic:

```
1. MATCH the line to an appointment
   a. Exact match: line.patient_number_on_eft == an appointment's
      submitted_patient_number, and the dates are consistent.
   b. If no exact match → fuzzy match (see 3.5) → flag PatientNumberMismatch.
   c. If still nothing → result = Unmatched (needs human review).

2. COMPARE amounts on the matched appointment:
   expected = Claim.expected_amount
   paid     = RemittanceLine.amount_paid

   - paid == expected ............................ result = Matched
   - paid == 0 or no line at all ................. result = Unpaid
   - paid ≈ no-show fee, but exam WAS completed ... result = NoShowDowncoded
   - 0 < paid < expected ......................... result = Underpaid
   - paid > expected ............................. result = Matched + overpaid flag

3. RECORD a Reconciliation row with result, variance, and checked_at.

4. If result != Matched → create a Dispute draft (see 3.6).
```

### 3.4 No-show downcoding detection (the main money leak)

This is the specific problem you described: the insurer pays ~$75 claiming "no-show"
when a real, multi-DBQ exam happened.

The system catches it because it has **independent proof the patient showed up**:

- `CheckIn.arrival_timestamp` and `arrival_photo` — the patient was physically here.
- `Appointment.exam_started_at` / `exam_ended_at` — an exam of real duration occurred.
- `ExamItem` rows — N DBQs and M IMOs were actually performed.

So when `paid_amount ≈ no-show fee` **and** `Appointment.status == Completed` with
ExamItems present, the engine flags `NoShowDowncoded` — and the dispute it drafts
already contains every piece of that proof.

### 3.5 Patient-number mismatch detection

About 1% of EFT lines carry a patient number that does not match — either a payer
error or a staff typo when the claim was submitted.

The engine handles this without AI, using deterministic fuzzy matching:

- **Digit transposition** (e.g. `48217` vs `42817`).
- **Off-by-one / single-digit difference.**
- **Cross-check by date + amount:** if a line's number matches nothing but its amount
  and date line up cleanly with exactly one unpaid appointment, that is a strong
  candidate.

The result is **never auto-applied**. The engine flags `PatientNumberMismatch` and
presents the candidate(s) to a staff member: *"EFT line 48217 / $X on 2026-02-03 has
no exact match. Closest appointment: patient #42817 (digits transposed), same date,
same amount. Confirm?"* A human confirms or rejects; the audit log records who and
when.

This also surfaces the reverse problem you mentioned — staff keying the wrong number
onto a claim — because `Claim.submitted_patient_number` is stored separately from
`Patient.canonical_patient_number`, so the engine can show when the office's own
submission disagrees with its records.

## 3.6 Automated dispute email drafting (no AI)

For every non-`Matched` reconciliation, the system fills a **template** — plain
mail-merge, not AI — and puts the draft on the doctor's review queue.

A draft includes:
- Patient/claim number and appointment date.
- What was performed (DBQ/IMO list) and the expected amount.
- What was paid and the variance.
- The **evidence package**: arrival timestamp, arrival photo reference, wait time,
  exam duration, records-on-file confirmation.
- A clear ask: "We have not been paid correctly for this date; please review."

Template sketch (one per result type — `Unpaid`, `Underpaid`, `NoShowDowncoded`):

```
Subject: Payment discrepancy — claim #{claim_number}, DOS {appointment_date}

To {payer},

On {appointment_date}, patient #{claim_number} attended a scheduled exam at our
office. Our records show:
  • Arrival confirmed at {arrival_time} (photo on file)
  • Exam conducted {exam_start}–{exam_end} ({exam_duration} min)
  • Procedures performed: {dbq_count} DBQ(s), {imo_count} IMO(s)
  • Expected reimbursement: ${expected_amount}

Remittance dated {remittance_date} shows a payment of ${paid_amount}
({result_explanation}). This leaves ${variance} unpaid.

We request review and correction. Supporting documentation is available on request.

{office_signature}
```

**The doctor always reviews before sending.** The system never sends on its own. And
because dispute emails contain PHI, they go out through a **secure email channel with
a BAA** (see doc 4), or the payer's portal.

## 3.7 The 4-month automatic checker

A scheduled job (cron) runs daily and looks at every appointment where:

- `status == ClaimSubmitted`, **and**
- `submitted_date` is more than the configured window old (default ~120 days), **and**
- there is no `Reconciliation` row with `result == Matched`.

Each one is flagged `Unpaid` and gets a dispute draft. Because it runs daily on a
rolling window, nothing has to be "remembered" — an appointment submitted today is
automatically re-examined ~4 months from today.

> **Tip:** also run a *30-day* early-warning pass. If a payment is clearly overdue
> well before 4 months, surface it sooner — there is no reason to wait the full
> window once the pattern is obvious.

## 3.8 QA questionnaire tracking

When a QA questionnaire arrives it is logged with a `deadline`. A daily scheduled job:

- Puts every open QA on a **worklist sorted by deadline**.
- Sends the doctor reminders (e.g. at 7 days, 3 days, 1 day before the deadline).
- Attaches the relevant exam data to each QA so the administrative parts are
  pre-filled and the doctor only supplies clinical judgment.

This directly addresses the income spiral you described: staying ahead of QAs keeps
referral volume — and income — from dropping. The system **does not** answer the
clinical questions; that stays with the doctor (and keeps AI out of it).

## 3.9 What is automated vs what stays human

| Automated (code) | Stays human |
|------------------|-------------|
| Matching EFT lines to appointments | Confirming a fuzzy patient-number match |
| Computing expected vs paid | Sending the dispute email |
| Classifying every result | Answering QA clinical questions |
| Drafting dispute emails | Final review of every draft |
| 4-month + 30-day re-checks | Deciding to escalate a dispute |
| QA deadline reminders | The medical exam itself |

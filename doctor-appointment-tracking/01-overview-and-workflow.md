# 1. Overview, Goals & Workflow

## 1.1 Background

The office performs medical exams — **DBQs** (Disability Benefits Questionnaires) and
**IMOs** (Independent Medical Opinions). These terms, plus the "QA questionnaire" and
"no-show fee" pattern, indicate the payer is a disability-exam contractor / insurer
that pays per exam. The plan below works whether the payer is a VA-style exam
contractor (VES, QTC, LHI/Optum, MSLA, etc.) or a traditional insurer — the mechanics
are the same.

**Today's process and its gaps:**

| Step today | Gap it creates |
|------------|----------------|
| Staff do "pre-paperwork" by hand (many hours) | Labor cost; effort is thrown away after the visit |
| Patient arrives; staff note "showed up" on a Google Sheet | No proof of arrival; a spreadsheet with patient info is likely a HIPAA exposure |
| Records live only in the EHR, nothing kept on hand | No local evidence package to back a payment dispute |
| Exam happens | Wait time, conditions, and DBQ/IMO counts not recorded as data |
| Claim goes to insurer | No tracking of *what* was claimed vs *what* was paid |
| Insurer sends a QA questionnaire | Doctor falls behind (up to 5 hrs each) → referrals/income drop |
| Insurer sends an EFT (patient numbers + amounts, no description) | Cannot tell what was paid for; underpayments invisible |
| ~4 months later, nobody re-checks | ~$40,000 went unpaid last year and was only caught by a manual audit |

## 1.2 Goals

1. **Capture hard evidence at every step** — arrival photo + timestamp, wait time,
   exam duration, conditions examined, DBQ/IMO counts, records on file.
2. **Reconcile every payment** against what was actually done.
3. **Detect underpayment and non-payment automatically** — especially "no-show"
   downcoding and patient-number mismatches.
4. **Re-check every appointment ~4 months out** without anyone remembering to.
5. **Draft dispute emails automatically**, with evidence attached, for one-click
   review-and-send by the doctor.
6. **Track QA questionnaires with deadlines and reminders** so the doctor never falls
   behind.
7. **Cut the pre-paperwork hours** by reusing captured patient data across visits.
8. **Stay HIPAA-compliant** and use **as little AI as possible** — plain code wherever
   it works.

## 1.3 Non-goals (explicitly out of scope)

- **Not** replacing the EHR. This system links to EHR records; it does not become the
  medical record of truth.
- **Not** auto-answering the clinical parts of QA questionnaires — that is the
  doctor's medical judgment. The system only surfaces, tracks, and pre-fills the
  administrative parts.
- **Not** auto-*sending* dispute emails. It drafts; the doctor reviews and sends.
- **Not** a billing/clearinghouse replacement — it audits payments, it does not submit
  claims to a clearinghouse.

## 1.4 Success metrics

- **$ recovered** from disputes that the system surfaced.
- **# of underpayments / non-payments caught** that would otherwise have been missed.
- **Detection lag** dropped from "found at a yearly audit" to "flagged automatically
  at ~4 months."
- **QA on-time completion rate** (target: 100% before deadline).
- **Pre-paperwork hours per appointment** reduced.

---

## 1.5 The end-to-end workflow

Each stage lists **what happens**, **what the system records**, and **what is
automated**.

### Stage A — Pre-appointment
- *Happens:* Appointment is booked; staff prepare paperwork.
- *System records:* Patient (existing or new), scheduled date/time, exam type,
  expected DBQs/IMOs, payer, and the **claim/patient number**.
- *Automated:* If the patient has visited before, the system pre-fills their details
  and generates the pre-appointment packet — cutting the manual hours.

### Stage B — Check-in / Arrival
- *Happens:* Patient signs in; a photo is taken to verify they physically arrived.
- *System records:* Arrival timestamp, **arrival photo** (treated as PHI — see doc 4),
  and a one-line patient consent for the photo, captured on the check-in screen.
- *Automated:* Appointment status flips `Scheduled → Arrived`. The "wait clock" starts.

### Stage C — Medical records intake
- *Happens:* A copy of the patient's records is brought in — electronic file, or
  paper that gets photographed.
- *System records:* The uploaded file(s), source (EHR export / paper scan), and
  extracted text/fields.
- *Automated:* **OCR / document extraction.** Recommended: run OCR **locally** so the
  records never leave the building (see doc 2). The custom GPT is an optional
  fallback only for messy documents, and only if your BAA covers that exact product.

### Stage D — Exam
- *Happens:* The doctor performs the exam.
- *System records:* Exam start time (→ **wait time** = start − arrival), exam end
  time (→ **exam duration**), the condition(s)/chief complaint, and **each DBQ and IMO
  performed** as its own line item, plus the examiner's name.
- *Automated:* From the DBQ/IMO line items and the fee schedule, the system computes
  the **expected payment** for this appointment (see doc 3).

### Stage E — Check-out
- *Happens:* Visit ends; any follow-up is decided.
- *System records:* Checkout timestamp, follow-up type if any (in-person /
  telehealth / phone call / none) and follow-up date.
- *Automated:* Status flips to `Completed`. A follow-up appointment shell is created
  if one was ordered.

### Stage F — Claim submission
- *Happens:* The claim/exam report goes to the insurer.
- *System records:* Date submitted, the **patient/claim number used on the
  submission** (stored separately from the office's canonical number — this is how
  mismatches get caught), the services claimed, and the expected amount.
- *Automated:* Status flips to `Claim submitted`. The ~4-month reconciliation timer
  starts for this appointment.

### Stage G — QA questionnaire
- *Happens:* The insurer sends a QA questionnaire the doctor must answer.
- *System records:* QA received date, **deadline**, status, and time spent.
- *Automated:* The QA appears on a worklist sorted by deadline, with reminders. The
  system attaches the relevant exam data so the doctor answers faster. (It does not
  answer the clinical questions.)

### Stage H — Payment (EFT / remittance)
- *Happens:* The insurer sends an EFT listing patient numbers and amounts.
- *System records:* Each EFT line item — patient number, amount, date, and any
  description if present.
- *Automated:* The reconciliation engine runs (see doc 3). **Important:** ask the
  payer whether a *remittance advice / EOB / 835 ERA* accompanies the EFT — that
  document usually itemizes what was paid and makes reconciliation far easier. If the
  payer truly never itemizes, the engine reconciles against the bare amount using the
  fee schedule.

### Stage I — Reconciliation & dispute
- *Happens:* The system compares expected vs paid.
- *System records:* A reconciliation result per appointment — `Matched`, `Underpaid`,
  `Unpaid`, `No-show downcoded`, `Patient-number mismatch`, or `Unmatched`.
- *Automated:* For every non-`Matched` result, the system **drafts a dispute email**
  with the evidence package attached, and puts it on the doctor's review queue.

### Stage J — Resolution & follow-up
- *Happens:* Doctor reviews and sends the dispute; insurer responds.
- *System records:* Dispute status (`Drafted → Sent → Resolved/Escalated`), dates,
  and the outcome (amount recovered).
- *Automated:* If a sent dispute gets no response within a set window, it is
  re-surfaced for follow-up.

---

## 1.6 Workflow at a glance

```
  Pre-appt ─▶ Check-in ─▶ Records ─▶ Exam ─▶ Check-out ─▶ Claim ─▶ QA
   (A)         (B)         (C)        (D)       (E)         (F)      (G)
                │                      │                    │
          arrival photo          wait time +           expected $ +
          + timestamp            DBQ/IMO counts        4-month timer
                                                             │
                                                             ▼
                                       Payment (H) ─▶ Reconcile (I) ─▶ Resolve (J)
                                       EFT in        expected vs paid   draft email,
                                                     → flag issues       doctor sends
```

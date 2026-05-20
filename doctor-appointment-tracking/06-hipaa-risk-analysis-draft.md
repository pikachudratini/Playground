# 6. HIPAA Security Risk Analysis — Draft & How to Get One Done

> **DRAFT — for review and validation by a qualified HIPAA professional.**
> This is not legal advice and is not a finished risk analysis. It is a starting
> document written to save the compliance professional time (and the practice money).
> It must be validated against the practice's *actual* environment before it counts.

## 6.1 What it is and why it matters

A **Security Risk Analysis** is **required** by the HIPAA Security Rule
(45 CFR 164.308(a)(1)(ii)(A)): an *accurate and thorough* assessment of the risks and
vulnerabilities to electronic PHI. Key facts:

- It is **mandatory**, not optional — and it is the item OCR most often cites in
  enforcement actions against small practices.
- It is **not one-time** — it must be reviewed and updated periodically and whenever
  something significant changes (like adding this new system).
- It must cover the practice's **whole ePHI footprint** — the EHR, email, staff
  devices, the Google Sheet, *and* this new system — not just one app.

## 6.2 How to get one done — finding a compliance professional

**Who can do it:**
- A **HIPAA compliance consultant or firm** (the most common route for a small
  practice).
- A **healthcare attorney** with HIPAA experience.
- A **healthcare-focused managed IT provider (MSP)** — many offer risk assessments.
- Sometimes the **EHR vendor** offers, or can refer, this service.

**What to look for:** ask for relevant credentials and references — e.g. **CHPC**
(Certified in Healthcare Privacy Compliance), **CHPS**, or **HCISPP** — and a track
record of doing HIPAA assessments for practices of similar size.

**A free official tool:** the U.S. government publishes the **Security Risk
Assessment (SRA) Tool** — a free, downloadable application from **HealthIT.gov**
(produced by ONC with the HHS Office for Civil Rights), designed specifically for
small/medium practices. The practice can use it to *perform and document* the
analysis; a professional can then validate the result. Search "HHS SRA Tool."

**Other referral sources:** the practice's **malpractice insurer**, the **state
medical association**, or a regional health IT extension center.

**Recommended engagement model (what you asked about):**
1. You and I produce the draft below, tailored to this system.
2. The practice designates a **Security Official** (HIPAA requires one named person).
3. The compliance professional **reviews, corrects, and completes** it against the
   real environment — including the parts of the practice this draft does not cover.
4. The Security Official and the professional **document and date** the final version.

> **One honest caveat on "just sign off."** The professional should genuinely review
> and validate the analysis — not rubber-stamp it. A risk analysis that does not
> reflect reality protects no one and can make things worse in an audit. The value of
> drafting it for them is that it makes their review *faster and cheaper*, not that it
> replaces their judgment. Frame it to them as "here is our draft, please validate and
> complete it," not "please sign this."

---

## 6.3 Draft Security Risk Analysis

*Scope below is the new appointment-tracking system. The professional should expand
the scope to the whole practice.*

### 6.3.1 Scope

| Item | Detail |
|------|--------|
| System assessed | Doctor appointment / check-in / payment & QA tracking system |
| ePHI handled | Patient identifiers, arrival photos, medical records + OCR text, claim/exam data, EFT line items |
| Users | Front-desk staff, examiners, doctor, admin |
| Hosting | *To be confirmed* — see doc 5 (recommended: on-premises Option A) |
| External services | Cloud backup vendor; secure email vendor; OpenAI (if used for OCR); EHR (existing) |
| Out of scope here | The EHR itself, practice email, billing system — *the professional must add these* |

### 6.3.2 Data-flow inventory — where ePHI is created, received, maintained, transmitted

1. **Created** at check-in (photo, signature, arrival time) and at the exam
   (conditions, DBQ/IMO data).
2. **Received** from the EHR (record exports) and from the payer (EFT line items).
3. **Maintained** in the encrypted on-premises database and file store.
4. **Transmitted** to: encrypted off-site backup; the secure email channel (dispute
   letters); optionally OpenAI (OCR, *only* under a confirmed BAA).

### 6.3.3 Risk register

Likelihood / Impact rated **Low / Med / High**; Risk = combination of the two.

| # | Threat / vulnerability | Likelihood | Impact | Risk | Current + planned controls |
|---|------------------------|-----------|--------|------|---------------------------|
| 1 | Unauthorized access via weak/shared logins | Med | High | **High** | Unique logins, role-based access, strong passwords, 2FA, audit logging |
| 2 | Theft or loss of the on-prem server | Low | High | **Med** | Full-disk encryption, locked room, encrypted off-site backups |
| 3 | Lost/stolen check-in tablet or laptop | Med | High | **High** | Device encryption, kiosk mode, auto-logoff, remote wipe, screen auto-clears between patients |
| 4 | Arrival photos exposed | Low | High | **Med** | Encrypted storage, role-based access, audit logging |
| 5 | PHI sent to OpenAI beyond BAA scope | Med | High | **High** | Confirm BAA product (doc 4), route only to the covered product, send minimum-necessary/pseudonymized data |
| 6 | PHI accidentally committed to GitHub | Med | High | **High** | Strict `.gitignore`, secret scanning, no data in repo, staff training |
| 7 | Ransomware / malware | Med | High | **High** | Patching, endpoint protection, network segmentation, tested backups |
| 8 | Backup failure / untested restore | Med | High | **High** | Encrypted off-site backups + scheduled restore drills |
| 9 | Insider misuse of access | Low | High | **Med** | Audit logging, minimum-necessary roles, sanction policy |
| 10 | Dispute letters emailed insecurely | Med | High | **High** | Secure email service with a BAA, or the payer's portal |
| 11 | Vendor used without a BAA | Med | High | **High** | BAA inventory; procurement check before any vendor touches PHI |
| 12 | Wrong-patient disclosure from a number mismatch | Low | Med | **Low–Med** | Human confirmation of fuzzy matches, audit logging |
| 13 | No data-at-rest encryption | Low | High | **Med** | Full-disk + database encryption verified before go-live |
| 14 | Unpatched software / OS | Med | Med | **Med** | Patch schedule, supported OS, dependency updates |

### 6.3.4 Risk-management / remediation plan

Most controls above map onto the build phases in doc 5:

- **Phase 0:** confirm hosting; confirm OpenAI BAA scope; build BAA inventory; choose
  secure email vendor; designate the Security Official. (Addresses #5, #10, #11.)
- **Phase 1:** unique logins, roles, 2FA, audit logging. (Addresses #1, #9.)
- **All phases:** encryption at rest/in transit; strict `.gitignore` + secret
  scanning. (Addresses #2, #4, #6, #13.)
- **Phase 6:** patching schedule, endpoint protection, tested restore drills.
  (Addresses #7, #8, #14.)
- **Check-in station:** device encryption, kiosk mode, auto-clear/auto-logoff.
  (Addresses #3.)

### 6.3.5 Review cadence

Review at least **annually** and whenever a significant change occurs (new system,
new vendor, hosting change, after any incident).

### 6.3.6 Sign-off block

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Practice Security Official | | | |
| HIPAA compliance professional (reviewer) | | | |
| Practice owner / physician | | | |
| Next scheduled review date | | | |

---

## 6.4 What to do with this document

1. Designate the Security Official.
2. Engage a compliance professional (6.2) — hand them this draft early.
3. Have them expand the scope to the whole practice and validate every rating.
4. Keep the signed final version on file; calendar the next review.

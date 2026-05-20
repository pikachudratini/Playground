# 4. HIPAA & Compliance

> **This document is not legal advice.** A HIPAA **Security Risk Analysis** is
> legally required under the HIPAA Security Rule, and the program should be reviewed
> by a qualified HIPAA compliance professional or a healthcare attorney **before
> go-live**. This plan is written to make that review short and cheap by getting the
> design right up front.

## 4.1 What counts as PHI in this system

Protected Health Information is anything that identifies a patient and relates to
their health, care, or payment. In this system that includes:

- Patient name, date of birth, contact info, SSN.
- **The arrival photo** — a photograph of the patient is PHI, and a full-face image
  is one of the 18 HIPAA identifiers (biometric/photographic).
- Medical records and their OCR'd text.
- Claim/patient numbers, exam details, conditions, DBQ/IMO data.
- The EFT line items (a payment record tied to a patient).

Treat every one of these as PHI: encrypt it, restrict access, and log access.

## 4.2 Business Associate Agreements (BAAs)

A **BAA** is required with any outside company that creates, receives, maintains, or
transmits PHI on the office's behalf. Build and maintain a **BAA inventory** — every
vendor that touches PHI, with the BAA on file.

Likely vendors needing a BAA:

| Vendor / service | Needs a BAA? |
|------------------|-------------|
| OpenAI (if used for OCR/extraction) | Yes — **see the caveat below** |
| Cloud host, if hosted in the cloud | Yes |
| Cloud backup storage | Yes |
| Secure email service (for dispute emails) | Yes |
| Cloud OCR / document-AI service, if used | Yes |
| EHR platform | Yes (likely already in place) |
| GitHub | **No — because no PHI goes to GitHub.** See 4.6 |

### ⚠️ The OpenAI BAA caveat — read this carefully

You said you "already have a BAA with OpenAI" and want to use custom GPTs.
**A BAA covers specific OpenAI products, not all of them.** As a rule:

- The **OpenAI API** and **ChatGPT Enterprise** *can* be covered by a BAA.
- **Consumer ChatGPT** (Free / Plus / Team) and the **consumer "custom GPTs"** built
  in that product are generally **not** covered by a BAA.

**Before sending any patient information to OpenAI, confirm in writing exactly which
OpenAI product/plan your signed BAA covers, and only send PHI to that product.** If
your BAA covers the API, the "custom GPT" should be built on the API, not on the
consumer GPT Store. If it only covers ChatGPT Enterprise, use that. If you cannot
confirm coverage, do **not** send PHI to OpenAI — use local OCR (Tesseract) instead,
which needs no BAA because the data never leaves the building.

This is the single most important compliance check in the whole project.

## 4.3 Encryption

- **At rest:** full-disk encryption on the server; the database and the file/photo
  store encrypted. Backups encrypted before they leave the building.
- **In transit:** TLS/HTTPS for the web app; secure (encrypted) email for disputes.
- **Keys:** stored separately from the data they protect; never in GitHub, never in
  the codebase.

## 4.4 Access control, accounts, and audit logging

- **Unique login per person.** Every staff member and the doctor get their own
  account. **No shared accounts** — this is both a HIPAA requirement and what makes
  the audit log meaningful.
- **Role-based access** (front-desk / examiner / doctor / admin) on the principle of
  **minimum necessary** — each role sees only what it needs.
- **Audit logging:** every view and change of PHI is logged with user + timestamp.
  This log is append-only. It satisfies HIPAA *and* doubles as dispute evidence.
- **Automatic logoff** on idle workstations.

## 4.5 Pseudonymization vs. de-identification — an important distinction

You described tokenizing patient identifiers when data is stored "in certain places,"
with a key that can reverse it. That is a **good security control**, but the
terminology matters legally:

- **Pseudonymization / tokenization:** identifiers are replaced with tokens, but a
  key exists that can reverse it. **The data is still legally PHI** — because it can
  be re-identified, all HIPAA rules (and BAAs) still apply.
- **De-identification** (HIPAA term): data that meets either the **Safe Harbor**
  standard (all 18 identifiers removed) or **Expert Determination**. Truly
  de-identified data is *not* PHI and falls outside HIPAA.

**What this means for you:** tokenizing before sending data to a tool is excellent
defense-in-depth and reduces exposure if something leaks — **do it** — but it does
**not** remove the need for a BAA, and it does **not** make it safe to put the data
somewhere uncontrolled. If you hold the re-identification key, it is still PHI.

**Recommended design for the token/key crosswalk:**
- The crosswalk table (token ↔ real identity) lives **only** in the encrypted
  on-premises database, never copied anywhere.
- When data must go to an external tool, send the tokenized form **and** rely on the
  BAA — both layers, not one instead of the other.
- Access to the crosswalk is itself logged and restricted to the minimum roles.
- Send the **minimum necessary** — if a tool only needs the OCR text of a record, it
  does not need the name, DOB, and SSN attached.

## 4.6 GitHub — code only, never data

GitHub is for **source code and version history**. It must **never** contain:

- Patient data, in any form — not even pseudonymized/tokenized data (it is still PHI).
- The database or its backups.
- Arrival photos or medical records.
- Secrets: passwords, API keys, the encryption keys, the OpenAI key, `.env` files.

Use a **private** repository, add a strict `.gitignore` (database files, `.env`,
photo/record folders, backup files), and keep all real configuration and credentials
out of the repo entirely. Putting PHI in GitHub — even a private repo, even
tokenized — would be a reportable breach.

## 4.7 Secure email for disputes

The dispute emails in doc 3 contain PHI (patient number, exam details). They must be
sent through a **HIPAA-compliant secure email service with a BAA**, or through the
payer's secure portal. Standard consumer email (Gmail, etc.) is not acceptable for
PHI unless under an appropriate agreement and configuration.

## 4.8 The current Google Sheet is likely a gap

If today's "they showed up" Google Sheet contains patient names or numbers, it is PHI
sitting in a consumer tool, probably without a BAA and without proper access logging.
Migrating off it into this system is itself a compliance improvement — flag it to
your compliance reviewer and retire it once the new system's check-in is live.

## 4.9 Other Security Rule items to cover with your compliance reviewer

- **Security Risk Analysis** — required; do it before go-live and repeat periodically.
- **Written policies & procedures**, and **workforce training**.
- **Backup & disaster recovery** — tested, not just configured (see doc 5).
- **Breach notification readiness** — a written plan for if something goes wrong.
- **Physical security** — if the server is on-premises, it must be in a locked space.
- **Patient consent for the arrival photo** — a short consent line on the check-in
  screen, stored with the check-in record.
- **Sanction policy** for staff who misuse access; **media disposal** policy for old
  drives.

## 4.10 Compliance checklist (hand this to your reviewer)

- [ ] HIPAA Security Risk Analysis completed
- [ ] BAA inventory built; BAA on file for every vendor touching PHI
- [ ] **OpenAI BAA scope confirmed in writing** — which product is covered
- [ ] Encryption at rest + in transit verified
- [ ] Unique logins, role-based access, audit logging in place
- [ ] Token/key crosswalk kept on-prem only; access logged
- [ ] GitHub repo private; `.gitignore` blocks all data and secrets
- [ ] Secure email channel (with BAA) chosen for disputes
- [ ] Google Sheet retired after check-in goes live
- [ ] Backup + disaster-recovery plan tested
- [ ] Written policies, staff training, breach-notification plan in place
- [ ] Arrival-photo consent wording approved

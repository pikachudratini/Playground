# 7. Build vs. Buy, Reusable Modules & Getting Started

You asked whether existing software or repositories could save you from building
everything. Short answer: **you should not build most of this from scratch — but no
single product does the whole niche.** The right approach is to assemble proven,
trusted modules and write only the small, specific part that is genuinely custom.

## 7.1 Check the practice's existing tools first

Before building or buying anything, ask the **EHR / billing vendor** two questions:

1. *"Can your system import and post 835 ERA / electronic remittance advice?"*
2. *"Do you have a denials / underpayment report?"*

Many EHR and practice-management systems already have ERA posting and denial
tracking — the practice may simply not be using it. If it does, part of Phase 4
(doc 5) is already paid for. **Do not rebuild what you already own.**

## 7.2 Off-the-shelf full software — the honest assessment

- **No single product** matches this exact workflow (DBQ/IMO evidence capture +
  insurer reconciliation + no-show-downcoding detection + auto-drafted disputes).
- Overlapping commercial categories that exist and are trusted: **medical billing /
  revenue-cycle-management (RCM)** software, **denial-management** software, and
  **claims-reconciliation** tools. These are worth a look, but they are
  general-purpose — they typically will not capture the granular *evidence* (arrival
  photo, wait time, DBQ/IMO counts) or specifically catch the $75 no-show downcoding.
- **Open-source full platforms:** **OpenEMR** is a mature, widely deployed,
  ONC-certified open-source EHR + practice-management system; **OpenMRS** and
  **LibreHealth** are other open health platforms. They are trusted — but adopting a
  whole EHR **duplicates the EHR the practice already has** and is far more than this
  job needs.

**Verdict:** build a *lightweight reconciliation-and-evidence layer* that sits beside
the existing EHR — not a new EHR.

## 7.3 Reusable modules — do NOT build these from scratch

Each row below is a mature, widely trusted component. The custom code is only what is
in the last section of the table.

| Need | Proven module to reuse | Why it is trusted |
|------|-----------------------|-------------------|
| App framework + auth + roles + admin UI | **Django** (Python) | Used by thousands of production apps; auth, roles, and an admin UI come built in |
| Audit logging | **django-auditlog** / **django-simple-history** | Standard, maintained Django packages |
| Two-factor authentication | **django-otp** / **django-allauth** | Widely used auth hardening |
| OCR of scanned records | **Tesseract** / **OCRmyPDF** | Long-established open-source OCR; runs locally, no BAA needed |
| 835 ERA / X12 parsing | Open-source **X12 / 835 parser** libraries | Avoids hand-writing an EDI parser |
| Webcam photo capture | Browser **`getUserMedia`** API (built into every modern browser) | No library required; native and standard |
| Patient signature capture | **`signature_pad`** (JS) | The de-facto open-source signature-pad library |
| Fuzzy matching (patient numbers) | **RapidFuzz** (Python) | Fast, well-maintained string-matching library |
| PDF evidence packages | **WeasyPrint** / **ReportLab** | Standard Python PDF generation |
| Scheduled jobs (4-month / QA checks) | **cron** / **Celery** / **APScheduler** | Standard scheduling tools |
| **Genuinely custom (must be built)** | The reconciliation engine, the dispute drafter, the workflow screens | Specific to this practice's payer workflow — but small and well-defined |

So the build is mostly *assembly*. The only original code is the reconciliation
engine, the dispute drafter, and the screens — exactly the parts described in docs
2 and 3.

## 7.4 The check-in station — webcam photo + signature

Yes — exactly what you described is straightforward, with **no AI**:

- **The setup:** a laptop or tablet at the front desk runs the check-in web page. A
  **tablet in kiosk mode** is more comfortable than a turned-around laptop, but a
  laptop with the screen facing the patient works fine.
- **The photo:** the page uses the browser's built-in camera API to show a live
  preview; a **"Capture" button** grabs a still frame and saves it to the patient's
  CheckIn record.
- **The signature:** an on-screen **signature pad** lets the patient sign with a
  finger, stylus, or mouse; it saves as an image.
- **The consent:** the screen displays the arrival-photo consent wording; signing
  covers it. The arrival timestamp is recorded automatically.

**HIPAA notes for the check-in device** (these map to risk #3 in doc 6):

- The device must be **encrypted** and ideally locked into **kiosk mode** (only the
  check-in page, nothing else reachable).
- The screen must **auto-clear back to a blank check-in** after each patient, so the
  next patient cannot see the previous patient's name or photo.
- **Auto-logoff** on idle; position the screen/camera so the waiting room cannot see
  it; enable **remote wipe** in case the device is lost.

## 7.5 How to actually get this built — the workflow

**Can you build it via Claude Code on mobile?** Yes. These sessions run in a cloud
container; the phone or web app is just the control surface. Building from mobile is
fine. The workflow:

1. **I write the application code** in Claude Code sessions, phase by phase (doc 5).
2. Code is **committed to the private GitHub repo** — *code only, never PHI* (doc 4).
3. When a phase is ready, the code is **deployed onto the chosen host** (the on-prem
   mini-PC or a cloud VM) by you or an IT contractor. I will write setup and
   deployment instructions to make this as turnkey as possible.
4. The system is **tested on the real check-in hardware on-site** before going live.

**What I can do:** write all the application code, wire up the modules above, and
produce setup/deployment docs.

**What I cannot do** (these need real-world people — you, the doctor, the compliance
professional, possibly an IT contractor):

- Sign BAAs or make compliance decisions.
- Perform or sign off the HIPAA risk analysis.
- Physically set up the server or the check-in tablet.
- Confirm the OpenAI BAA product scope with OpenAI.

## 7.6 Recommended sequence to get going

1. **Present docs 1–7 to the doctor.** Get decisions on hosting (doc 5), the OpenAI
   BAA product, and engaging a compliance professional.
2. **In parallel, I scaffold Phase 1** (check-in + exam tracking) so there is
   something concrete to look at and react to.
3. **Engage the compliance professional early** — hand them the doc 6 draft.
4. **Ask the EHR vendor** the ERA questions in 7.1 before Phase 4 is built.
5. **Build phases 2–6** in order, deploying to the chosen host as each is ready.

The single best next step is still: **say the word and I will scaffold Phase 1.** It
needs none of the open decisions resolved and it immediately starts capturing the
evidence every dispute depends on.

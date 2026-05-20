# 5. Hosting, Roadmap & Decisions

## 5.1 Hosting — the options

You asked: local server at the office, cloud, or GitHub? Here is the honest comparison.

| Option | Pros | Cons |
|--------|------|------|
| **On-premises** mini-server at the office | PHI never leaves the building; no monthly cloud bill; simplest BAA story | The office owns patching, security, and uptime; a disk failure or theft loses data unless backups are solid |
| **Cloud** (AWS / Azure / GCP — all offer BAAs) | Professional backups, uptime, physical security | Monthly cost; requires a signed BAA *and* correct configuration; PHI lives off-site |
| **GitHub** | — | **Not a hosting option, and not a data store.** GitHub holds *code only* (see doc 4) |

### Recommendation: on-prem app + encrypted off-site backups

For a single small practice that wants minimal AI, minimal cost, and the cleanest
HIPAA story:

1. **Run the app on a small always-on mini-server at the office** (a mini-PC running
   Linux with full-disk encryption, on its own network segment, in a locked room).
   The live PHI stays in the building. The scheduler needs an always-on machine
   anyway — this is it.
2. **Encrypted off-site backups, nightly**, to **HIPAA-eligible cloud storage with a
   signed BAA**. Backups are encrypted *before* they leave the building. This is what
   protects you from disk failure, fire, or theft — the gap that "keep nothing on
   hand" leaves today.
3. **Code lives in a private GitHub repo.** That is GitHub's only role: version
   control and a backup *of the code*. No data, no secrets.
4. **Test a restore.** A backup you have never restored is not a backup. Do a restore
   drill before go-live and periodically after.

If the office later prefers not to maintain hardware, the same application can move
to a cloud VM with a BAA with no redesign — so this choice is not a one-way door.

```
   ┌─────────────── Office (locked room) ───────────────┐
   │  Mini-server: web app + PostgreSQL + files          │
   │  Full-disk encryption · own network segment         │
   └───────────────────────┬─────────────────────────────┘
                            │ nightly, encrypted
                            ▼
              HIPAA-eligible cloud backup (BAA on file)

   Private GitHub repo  ◀── code only, pushed by the developer
                            (never any patient data)
```

## 5.2 Phased roadmap

Built so that **value lands early**. Phase 1 alone replaces the Google Sheet and
starts building the evidence trail — the thing that made $40k recoverable.

### Phase 0 — Compliance & setup foundation
- Engage a HIPAA compliance professional; start the Security Risk Analysis.
- **Confirm the OpenAI BAA scope in writing** (doc 4).
- Build the BAA inventory; choose the secure email vendor.
- Decide hosting (recommendation above); acquire the server.
- Create the private GitHub repo with a strict `.gitignore`.
*Outcome: a legal and technical foundation to build on.*

### Phase 1 — Core tracking (replace the Google Sheet)
- Patient, Appointment, User, AuditLog entities.
- Check-in screen: arrival timestamp, arrival photo + consent.
- Exam logging: wait time, exam duration, conditions, **DBQ/IMO line items**.
- Unique logins, roles, audit logging.
*Outcome: every visit now produces hard evidence. The spreadsheet is retired.*

### Phase 2 — Records intake
- Upload EHR exports; photograph + upload paper records.
- **Local OCR (Tesseract)** for scanned documents.
*Outcome: an evidence package — including records-on-file — exists per appointment.*

### Phase 3 — Claims & QA tracking
- Claim entity: submission date, submitted patient number, services, expected amount.
- Fee schedule entered (from the payer contract).
- QA questionnaire worklist with deadlines and reminders.
*Outcome: the doctor stops falling behind on QAs; expected payment is known per claim.*

### Phase 4 — EFT ingestion & reconciliation engine
- Remittance / EFT entry (structured file, PDF, or manual).
- The reconciliation engine: matching, no-show detection, patient-number fuzzy match.
*Outcome: every payment is checked against what was actually done.*

### Phase 5 — Automation: 4-month checker & dispute drafting
- Daily scheduled 4-month (and 30-day early-warning) checks.
- Dispute email templates + the doctor's review queue.
- Integration with the secure email channel for sending.
*Outcome: underpayments surface automatically; disputes draft themselves.*

### Phase 6 — Reporting & hardening
- Dashboard: $ outstanding, $ recovered, disputes by status, QA on-time rate.
- Backup/restore drills; final security review; staff training.
*Outcome: a measurable, audited, hands-off system.*

## 5.3 Decisions needed from the doctor / office

These shape the build. None block writing code for Phase 1, but they should be
answered before the phase that depends on them.

| # | Decision | Needed by | Notes |
|---|----------|-----------|-------|
| 1 | **Hosting:** confirm on-prem (recommended) vs cloud | Phase 0 | See 5.1 |
| 2 | **OpenAI BAA scope** — which product is covered? | Phase 0 | Critical; doc 4.2 |
| 3 | **Secure email vendor** for dispute emails | Phase 0 | Needs a BAA |
| 4 | **Fee schedule values** per payer (DBQ, IMO, exam, no-show) | Phase 3 | From the payer contract |
| 5 | **Does the payer send a remittance advice / 835 ERA?** | Phase 4 | If yes, ask for it — reconciliation gets far easier (doc 3.2) |
| 6 | **Volume & staff count** — appointments/month, # of staff | Phase 1 | Confirms PostgreSQL vs SQLite and server sizing |
| 7 | **Who maintains the system** — in-house, the developer, a contractor? | Phase 0 | Affects on-prem vs cloud |
| 8 | **The 4-month window** — exact number of days to wait | Phase 5 | Default ~120 days; tune to the payer |
| 9 | **Is the payer a VA-style exam contractor or a traditional insurer?** | Phase 3 | Terminology + remittance format; the design works either way |

## 5.4 Recommended immediate next step

**Start Phase 1.** It needs none of the open decisions resolved, it retires the
risky Google Sheet, and it immediately begins capturing the arrival photos,
timestamps, and DBQ/IMO counts that every future dispute depends on. Phase 0's
compliance work (the Risk Analysis, the OpenAI BAA confirmation) can run in parallel.

Once you have reviewed this plan, the next move is to scaffold the Phase 1
application — say the word and that build can begin.

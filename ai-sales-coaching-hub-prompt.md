# Build Prompt: AI Sales Coaching & Call-Grading Hub

This is a **reusable build prompt**. It generates a web app that automatically grades
every sales call against a rubric, coaches each rep with specific next-step feedback,
and gives owners a live view of team performance — i.e. an "AI sales manager."

## How to use this prompt

1. Fill in **Section 0 — Business Configuration** with the details of the company
   you're building this for. Every other section reads from it, so this is the only
   part you edit per client.
2. Paste the **entire file** (Sections 0–10) into Claude Code at the root of an empty repo.
3. Let it run the phased build plan in Section 8. Review at each phase gate.
4. To re-target a different business, change only Section 0 and re-run.

> Keep this file in the repo as `PROJECT_SPEC.md` so the config and intent stay
> versioned alongside the code.

---

## Section 0 — Business Configuration (FILL THIS IN)

> Anything in `<<...>>` is a placeholder. Replace it. If you don't know a value,
> write `<<UNKNOWN — ask client>>` so it surfaces instead of being silently guessed.

```yaml
business:
  name: "<<Company name>>"
  industry: "<<e.g. self-publishing, solar, insurance, agency, SaaS>>"
  what_they_sell: "<<one-sentence description of the offer>>"
  avg_deal_size: "<<$ amount>>"
  sales_cycle: "<<single-call close | multi-touch | both>>"

team:
  num_reps: "<<count>>"
  num_managers_today: "<<count>>"
  call_volume_per_week: "<<approx number of calls across the team>>"
  roles_to_grade: ["sales calls"]   # add "customer calls", "coaching calls", "BD calls" if relevant

call_types:
  # Each call type gets its own script + rubric. Add/remove as needed.
  - id: "discovery"
    label: "Discovery / First Call"
    desired_outcome: "<<what a successful call of this type produces>>"
  - id: "closing"
    label: "Closing Call"
    desired_outcome: "<<...>>"

integrations:
  crm: "<<HubSpot | Salesforce | Close | none — store calls locally>>"
  call_recording_source: "<<Gong | Fathom | Zoom | phone system | manual upload>>"
  transcript_format: "<<has speaker labels? timestamps? diarized?>>"
  chat_for_librarian: "<<Slack | Teams | none>>"

rubric_philosophy: |
  <<2–4 sentences describing what a GREAT call looks like for THIS business.
  This is the single most important input — the grader is only as good as this.
  Example: "A great call earns trust in the first two minutes, sets a clear frame
  for how the call will go, uses a relevant customer story, surfaces the real
  objection, and ends with an explicit, low-friction next step.">>

knowledge_base_for_librarian: |
  <<What corpus should the "librarian" search? e.g. "7,000+ published books with
  category, review count, and avg rating" or "case studies by vertical" or
  "objection-handling playbook". Describe the data and where it lives.>>

access_roles:
  - owner            # sees everything, edits rubrics/scripts, sees $ impact
  - manager          # sees their team, edits drafts of rubrics/scripts
  - rep              # sees their own calls + team leaderboard, can suggest rubric changes
```

---

## Section 1 — Role & Objective

You are a senior full-stack engineer. Build a production-quality web app called the
**Sales Hub** for the business defined in Section 0.

The hub replaces the *management* layer of sales (the repeatable quality-control work:
reviewing calls against a standard, scoring them, and giving feedback) so human leaders
can focus on coaching, motivation, and recruiting. It must:

- Grade **every** call automatically, not a sample — that is the entire point.
- Give feedback that is **specific and actionable**, not a number. Every score must
  come with "here is the exact thing to do/say to move up one level."
- Be **adaptable**: rubrics, scripts, and call types are data, not hardcoded.
- **Prove its own ROI** so performance lift is measurable (see Section 7).

Build for clarity over cleverness. A non-technical ops manager must be able to operate
and extend this. Match the config in Section 0 exactly — do not invent business facts.

---

## Section 2 — What We're Building (Product Overview)

A web app with five surfaces:

1. **Team Dashboard** — live view of all calls coming in, team-wide score trends,
   leaderboard, per-rubric-dimension averages, and a "needs attention" list.
2. **Rep Detail** — one salesperson: their calls over time, score trend per rubric
   dimension, strengths, recurring weaknesses, and current coaching focus.
3. **Call Detail** — one call: overall score (e.g. 83/100), per-dimension scores
   (e.g. "First Two Minutes 9/10"), a human-readable summary, the transcript, and
   the **"How to make this better"** coaching block.
4. **Scripts & Rubrics** — view (everyone) and edit (owners/managers) the script and
   rubric for every call type, with **draft → review → publish** versioning.
5. **Librarian** — on-demand retrieval of relevant knowledge (stories, case studies,
   data) by category, usable mid-call. Accessible in-app and via chat if configured.

Plus the ingestion pipeline that pulls/accepts transcripts and runs the grader.

---

## Section 3 — Tech Stack

Use a stack the client's team can maintain. Default recommendation:

- **Frontend:** React + TypeScript + Vite, Tailwind, shadcn/ui.
- **Backend:** Node/TypeScript (or Next.js app router if you prefer one repo).
- **DB:** Postgres (Supabase is fine — gives auth + DB + row-level security fast).
- **Auth:** email magic link or SSO; enforce the three roles from Section 0.
- **LLM:** Claude (use the latest Claude model available) for grading and the librarian.
- **Jobs:** a simple queue/worker for grading (don't grade inline on the request).

Constraints:
- Keep secrets in env vars; commit `.env.example`.
- No vendor lock-in for the grading logic — the rubric engine must be plain code +
  data so it can be ported.
- Everything that varies per business lives in the DB or Section 0, never hardcoded.

---

## Section 4 — Data Model

Implement at least these entities:

- **users** — id, name, email, role (`owner|manager|rep`), team_id.
- **call_types** — id, label, desired_outcome (seeded from Section 0).
- **scripts** — id, call_type_id, version, status (`draft|published`), body, author, timestamps.
- **rubrics** — id, call_type_id, version, status (`draft|published`), author, timestamps.
- **rubric_dimensions** — id, rubric_id, name, description, weight, max_score,
  and **level descriptors** (what a 3/10 vs 7/10 vs 10/10 looks like — this is what
  makes scoring consistent).
- **calls** — id, rep_id, call_type_id, prospect_name, occurred_at, source,
  transcript, audio_url (optional), crm_record_id (optional), status
  (`ingested|grading|graded|failed`).
- **call_scores** — id, call_id, rubric_version, overall_score, summary,
  created_at.
- **dimension_scores** — id, call_score_id, rubric_dimension_id, score, evidence
  (quote/timestamp from transcript), coaching (the specific "to reach the next level,
  do X" note).
- **rubric_change_suggestions** — id, suggested_by, rubric_id, body, status — so reps
  can push improvements (closes the "how am I being graded?" loop from the transcript).
- **librarian_queries** — id, user_id, category, query, results, created_at.
- **performance_snapshots** — see Section 7.

Add indexes for the obvious dashboard queries (calls by rep, by date, by call_type).

---

## Section 5 — The Grading Engine (most important section)

This is the core. Get this right; everything else is UI around it.

### 5.1 Pipeline

1. **Ingest** a transcript (from CRM/recording integration, or manual upload).
   Normalize speaker labels and timestamps. Detect/confirm the `call_type`.
2. **Enqueue** a grading job. Never block the UI on grading.
3. **Grade**: load the *published* rubric + script for that call type. Send the
   transcript + rubric to Claude with a structured prompt (see 5.2).
4. **Persist** the structured result into `call_scores` / `dimension_scores`.
5. **Surface** it on Call Detail and roll it up into dashboards.
6. On failure, mark `failed` with a reason and make it retryable.

### 5.2 Grader prompt contract

The grader call must be a structured, deterministic-as-possible prompt that:

- Receives: the rubric (dimensions + weights + **level descriptors**), the script for
  that call type, the `rubric_philosophy` from Section 0, and the full transcript.
- For **each rubric dimension**, returns:
  - `score` (integer, 0..max_score)
  - `evidence` — a direct quote or timestamp range from the transcript justifying it
  - `coaching` — the specific change to reach the **next** level up, phrased as
    something the rep can do or literally say next time. (Mirror the transcript's
    example: *"To reach an 8, add a phrase like '…and if all that makes sense, we can
    get you started…' directly into the opening frame."*)
- Returns an **overall summary**: a short, human, narrative recap of how the call went
  (what worked, what the prospect's state was, what the next step is).
- Computes `overall_score` as the weighted sum, normalized to 0–100.
- Must cite evidence for every score — no ungrounded numbers. If the transcript lacks
  evidence for a dimension, score conservatively and say so.
- Output strict JSON matching the data model. Validate it; retry once on invalid JSON.

### 5.3 Example rubric shape (replace with the client's real one)

This mirrors the interview as a starting template — the real dimensions come from
`rubric_philosophy` in Section 0:

| Dimension | Weight | What 10/10 looks like |
|---|---|---|
| Strong First Two Minutes | 15% | Builds genuine rapport, personal not transactional, earns the right to lead |
| Framing & Expectation Setting | 15% | Clearly sets the agenda and the call's intended outcome up front |
| Excitement & Enthusiasm | 10% | Energy matches the opportunity; prospect leans in |
| Discovery & Real Objection | 20% | Surfaces the actual blocker, not the surface-level one |
| Storytelling / Social Proof | 15% | Uses a *relevant* customer story that maps to this prospect |
| Handling Objections | 15% | Addresses concerns directly without getting defensive |
| Clear Next Step / Close | 10% | Ends with an explicit, low-friction, scheduled next action |

Each dimension stores **level descriptors** so a 6 vs a 9 is defined, not vibes.

### 5.4 Consistency

- Same transcript + same rubric version → near-identical scores. Pin the model,
  keep temperature low, version the prompt.
- Store the `rubric_version` on every score so historical scores stay interpretable
  when rubrics change.

---

## Section 6 — Pages / UI

### 6.1 Team Dashboard
- Live feed of calls as they're graded (most recent first).
- Team average score over time; average per rubric dimension (shows *what the team
  is collectively weak at*).
- Leaderboard of reps.
- "Needs attention" list: reps trending down, or calls that scored low.
- Filters: date range, call type, team.

### 6.2 Rep Detail
- Score trend over time, overall and per dimension.
- Top 2 strengths, top 2 recurring weaknesses (computed from dimension_scores).
- "Current coaching focus" — the dimension with the most upside.
- List of their calls → click through to Call Detail.

### 6.3 Call Detail
- Header: rep, prospect name, call type, date, **overall score /100**.
- Per-dimension scorecard: each dimension with its score, the evidence quote, and
  the coaching note.
- Narrative summary.
- Full transcript (collapsible), with evidence quotes linked/scrolled-to.
- The script used and the rubric version used (for transparency).
- Optional: link to the CRM record and order-processing tools the rep needs.

### 6.4 Scripts & Rubrics
- One page listing every call type with its current published script + rubric.
- Everyone can **view**. Owners/managers can **edit** → creates a `draft`.
- Draft → (optional review) → **publish**. Publishing a rubric does **not**
  retroactively rescore old calls; new calls use the new version.
- Reps can submit `rubric_change_suggestions` ("I think grading should change because…")
  — surfaced to owners. This is what stops the single-builder bottleneck.
- Show version history and who changed what.

### 6.5 Librarian
- Input: a category (+ optional free-text need).
- Output: the top 5–10 most relevant items from `knowledge_base_for_librarian`
  (Section 0), with whatever metadata matters (e.g. for books: review count, avg
  rating; for case studies: vertical, result).
- Fast — it's used live on calls.
- If `chat_for_librarian` is set, expose it there too (e.g. `@librarian <category>`
  posts results in-thread).

---

## Section 7 — Performance / ROI Tracking

The hub must **prove it works** — both for the client and for a royalty/performance
arrangement where payment is tied to measurable lift.

- On first deploy, capture a **baseline**: per-rep and team average scores over the
  trailing period of available data (or the first 2 weeks if no history).
- Write weekly `performance_snapshots`: avg score, score-per-dimension, call volume,
  and — if CRM provides it — close rate and revenue per rep/team.
- A **ROI view** (owner-only) showing: baseline vs current, score lift, close-rate
  lift, and estimated revenue impact. Make the methodology explicit and conservative
  so the numbers are defensible.
- Export the ROI view (PDF/CSV) — this is the artifact for client reporting.

---

## Section 8 — Build Plan (phased — stop at each gate for review)

**Phase 1 — Foundation.** Repo, stack, auth + 3 roles, data model + migrations,
seed `call_types` / `scripts` / `rubrics` from Section 0. `.env.example`. README.

**Phase 2 — Grading engine.** Ingestion (start with manual transcript upload),
job queue, the grader prompt + JSON validation, persist scores. CLI/test that grades
a sample transcript end to end. *Gate: scores are sane and evidence-grounded.*

**Phase 3 — Call Detail + Rep Detail.** The pages that show grading output. This is
where the client first feels the value.

**Phase 4 — Team Dashboard + leaderboard + live feed.**

**Phase 5 — Scripts & Rubrics** with draft/publish/versioning + rep suggestions.

**Phase 6 — Librarian.**

**Phase 7 — Integrations.** Wire the real `crm` and `call_recording_source` from
Section 0 so transcripts flow in automatically. Chat integration for the librarian.

**Phase 8 — Performance/ROI tracking** (Section 7) + export.

After each phase: working software, no TODOs in the committed path, a note on what to
verify. Don't start the next phase until the current one runs.

---

## Section 9 — Acceptance Criteria / Quality Bar

- I can upload (or sync) a real transcript and get a graded Call Detail page with an
  overall score, per-dimension scores, evidence quotes, coaching notes, and a summary.
- Every score has evidence from the transcript. No ungrounded numbers.
- Every score has a concrete "do this to level up" coaching note.
- An owner can edit a rubric, publish v2, and new calls grade on v2 while old calls
  still show their v1 scores correctly.
- A rep sees only their own calls + the leaderboard; a manager sees their team; an
  owner sees everything including the ROI view.
- Re-grading the same transcript on the same rubric version gives materially the
  same scores.
- Nothing about the *business* is hardcoded — re-pointing to a new Section 0 produces
  a working hub for a different company with no code changes to the engine.
- `README.md` explains setup, env vars, how to run the grader, and how to adapt
  Section 0 for a new client.

---

## Section 10 — Guardrails

- **Don't invent business facts.** If Section 0 has `<<UNKNOWN>>`, stop and ask, or
  clearly mark assumptions in the README.
- **Don't over-build.** No features beyond Sections 2–7. No speculative abstraction.
- **Grading is advisory.** The app coaches; it does not auto-fire or auto-discipline.
  Keep a human in the loop — surface scores to leaders, don't act on them.
- **Privacy.** Transcripts and CRM data are sensitive. Scope access by role, keep
  secrets out of the repo, and don't log full transcripts to third parties beyond the
  LLM call needed to grade.
- **Be honest about limits.** If a transcript is low quality or missing speaker
  labels, the grader should say so rather than confidently guessing.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "fig.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS funnels (
  id         TEXT PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  goal       TEXT NOT NULL DEFAULT '',
  audience   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id         TEXT PRIMARY KEY,
  funnel_id  TEXT NOT NULL,
  slug       TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  kind       TEXT NOT NULL DEFAULT 'landing',
  template   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personas (
  id          TEXT PRIMARY KEY,
  funnel_id   TEXT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  traits      TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS visitors (
  id         TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  signals    TEXT NOT NULL,
  profile    TEXT,
  visits     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS events (
  id         TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  funnel_id  TEXT NOT NULL,
  page_id    TEXT,
  type       TEXT NOT NULL,
  meta       TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id            TEXT PRIMARY KEY,
  visitor_id    TEXT,
  funnel_id     TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL,
  fields        TEXT NOT NULL DEFAULT '{}',
  persona_id    TEXT,
  lead_score    INTEGER NOT NULL DEFAULT 0,
  stage         TEXT NOT NULL DEFAULT 'new',
  qualification TEXT NOT NULL DEFAULT '',
  next_step     TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_funnel  ON events(funnel_id);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_pages_funnel   ON pages(funnel_id);
CREATE INDEX IF NOT EXISTS idx_personas_funnel ON personas(funnel_id);
CREATE INDEX IF NOT EXISTS idx_contacts_funnel ON contacts(funnel_id);
`;

function initDb(): Database.Database {
  mkdirSync(DATA_DIR, { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.exec(SCHEMA);
  seed(conn);
  return conn;
}

// Demo data so the OS is explorable on first run.
function seed(conn: Database.Database): void {
  const count = conn.prepare("SELECT COUNT(*) AS n FROM funnels").get() as {
    n: number;
  };
  if (count.n > 0) return;

  const now = Date.now();
  const day = 86_400_000;

  const insFunnel = conn.prepare(
    `INSERT INTO funnels (id, slug, name, goal, audience, status, created_at)
     VALUES (@id, @slug, @name, @goal, @audience, @status, @created_at)`,
  );
  const insPage = conn.prepare(
    `INSERT INTO pages (id, funnel_id, slug, step_order, kind, template)
     VALUES (@id, @funnel_id, @slug, @step_order, @kind, @template)`,
  );
  const insPersona = conn.prepare(
    `INSERT INTO personas (id, funnel_id, name, description, traits, created_at)
     VALUES (@id, @funnel_id, @name, @description, @traits, @created_at)`,
  );
  const insVisitor = conn.prepare(
    `INSERT INTO visitors (id, first_seen, last_seen, signals, profile, visits)
     VALUES (@id, @first_seen, @last_seen, @signals, @profile, @visits)`,
  );
  const insEvent = conn.prepare(
    `INSERT INTO events (id, visitor_id, funnel_id, page_id, type, meta, created_at)
     VALUES (@id, @visitor_id, @funnel_id, @page_id, @type, @meta, @created_at)`,
  );
  const insContact = conn.prepare(
    `INSERT INTO contacts (id, visitor_id, funnel_id, name, email, fields,
       persona_id, lead_score, stage, qualification, next_step, created_at)
     VALUES (@id, @visitor_id, @funnel_id, @name, @email, @fields,
       @persona_id, @lead_score, @stage, @qualification, @next_step, @created_at)`,
  );

  conn.transaction(() => {
    // --- Funnel A: SaaS free trial ---
    insFunnel.run({
      id: "fnl_saas",
      slug: "saas-analytics",
      name: "Pulse Analytics — Free Trial",
      goal: "Convert visitors into free-trial signups for a product analytics SaaS.",
      audience: "B2B software teams who want product insight without a data team.",
      status: "live",
      created_at: now - 21 * day,
    });
    insPage.run({
      id: "pg_saas_landing",
      funnel_id: "fnl_saas",
      slug: "start",
      step_order: 0,
      kind: "capture",
      template: JSON.stringify({
        headline: "Ship faster with analytics your whole team actually uses",
        subhead:
          "Pulse turns raw product data into clear answers — no SQL, no data team required.",
        body: "Most analytics tools were built for analysts. Pulse was built for everyone who ships product. Connect your app in minutes and get funnels, retention, and cohort insight out of the box.",
        bullets: [
          "Set up in under 10 minutes",
          "No SQL or data team needed",
          "Funnels, retention & cohorts built in",
          "Free for up to 1M events / month",
        ],
        ctaText: "Start free trial",
      }),
    });
    for (const p of [
      {
        id: "per_founder",
        name: "Startup Founder",
        description:
          "Early-stage founder wearing every hat, deciding what to build next.",
        traits: {
          pains: [
            "flying blind on what users actually do",
            "no time to wire up tooling",
            "limited budget",
          ],
          goals: ["reach product-market fit", "lift activation"],
          tone: "direct, ambitious, ROI-focused",
          channel: "email",
        },
      },
      {
        id: "per_growth",
        name: "Growth Marketer",
        description:
          "Owns acquisition and conversion, fights for data access from engineering.",
        traits: {
          pains: [
            "can't prove campaign impact",
            "data locked inside engineering",
          ],
          goals: ["lift conversion rate", "attribute revenue to channels"],
          tone: "metrics-driven, energetic",
          channel: "paid ads",
        },
      },
      {
        id: "per_pm",
        name: "Product Manager",
        description:
          "Prioritizes the roadmap and needs evidence before committing the team.",
        traits: {
          pains: ["guessing at roadmap priorities", "data scattered everywhere"],
          goals: ["validate features", "reduce churn"],
          tone: "thoughtful, evidence-based",
          channel: "content",
        },
      },
    ]) {
      insPersona.run({
        id: p.id,
        funnel_id: "fnl_saas",
        name: p.name,
        description: p.description,
        traits: JSON.stringify(p.traits),
        created_at: now - 21 * day,
      });
    }

    // --- Funnel B: Fitness coaching consult ---
    insFunnel.run({
      id: "fnl_coach",
      slug: "fitness-coaching",
      name: "1:1 Fitness Coaching — Free Consult",
      goal: "Book free consultation calls for an online 1:1 fitness coaching program.",
      audience: "Working professionals aged 30-50 short on time.",
      status: "live",
      created_at: now - 14 * day,
    });
    insPage.run({
      id: "pg_coach_landing",
      funnel_id: "fnl_coach",
      slug: "start",
      step_order: 0,
      kind: "capture",
      template: JSON.stringify({
        headline: "Get in the best shape of your life — without living in the gym",
        subhead:
          "Personalized 1:1 coaching that fits around your job, your family, and your life.",
        body: "No cookie-cutter plans. Your coach builds your training and nutrition around your real schedule, then adjusts every week based on results.",
        bullets: [
          "Workouts that fit a 30-minute window",
          "Weekly check-ins with a real coach",
          "Nutrition guidance, not crash diets",
          "Cancel anytime — no lock-in",
        ],
        ctaText: "Book my free consult",
      }),
    });
    for (const p of [
      {
        id: "per_busy",
        name: "Busy Professional",
        description:
          "Long hours at a desk job, has started and quit fitness plans before.",
        traits: {
          pains: ["zero spare time", "quit past plans", "desk-job fatigue"],
          goals: ["more energy", "look good", "a habit that sticks"],
          tone: "no-nonsense, motivating",
          channel: "email",
        },
      },
      {
        id: "per_parent",
        name: "New Parent",
        description:
          "Sleep-deprived parent who lost their old routine after a baby.",
        traits: {
          pains: ["sleep-deprived", "no childcare for the gym", "lost routine"],
          goals: ["rebuild strength", "short workouts at home"],
          tone: "empathetic, encouraging",
          channel: "social",
        },
      },
    ]) {
      insPersona.run({
        id: p.id,
        funnel_id: "fnl_coach",
        name: p.name,
        description: p.description,
        traits: JSON.stringify(p.traits),
        created_at: now - 14 * day,
      });
    }

    // --- Sample visitors + events so the dashboard has data ---
    const visitors = [
      {
        id: "vis_seed_1",
        signals: {
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "analytics-no-sql",
          device: "desktop",
          country: "US",
        },
        profile: {
          matchedPersonaId: "per_growth",
          matchedPersonaName: "Growth Marketer",
          intentScore: 71,
          summary: "Paid-search visitor comparing analytics tools.",
        },
        funnel: "fnl_saas",
        page: "pg_saas_landing",
        ageDays: 3,
      },
      {
        id: "vis_seed_2",
        signals: {
          utmSource: "instagram",
          utmMedium: "social",
          device: "mobile",
          country: "GB",
        },
        profile: {
          matchedPersonaId: "per_parent",
          matchedPersonaName: "New Parent",
          intentScore: 58,
          summary: "Mobile social visitor, browsing on a phone after hours.",
        },
        funnel: "fnl_coach",
        page: "pg_coach_landing",
        ageDays: 2,
      },
      {
        id: "vis_seed_3",
        signals: { referrer: "news.ycombinator.com", device: "desktop", country: "CA" },
        profile: {
          matchedPersonaId: "per_founder",
          matchedPersonaName: "Startup Founder",
          intentScore: 84,
          summary: "Founder from a HN thread, high intent, returning visitor.",
        },
        funnel: "fnl_saas",
        page: "pg_saas_landing",
        ageDays: 1,
      },
    ];
    let evt = 0;
    for (const v of visitors) {
      const seen = now - v.ageDays * day;
      insVisitor.run({
        id: v.id,
        first_seen: seen,
        last_seen: seen + 600_000,
        signals: JSON.stringify(v.signals),
        profile: JSON.stringify(v.profile),
        visits: v.id === "vis_seed_3" ? 2 : 1,
      });
      for (const type of ["view", "personalized", "scroll", "cta_click"]) {
        insEvent.run({
          id: `evt_seed_${evt++}`,
          visitor_id: v.id,
          funnel_id: v.funnel,
          page_id: v.page,
          type,
          meta: "{}",
          created_at: seen + evt * 1000,
        });
      }
    }

    // --- Sample contacts (CRM) ---
    insContact.run({
      id: "con_seed_1",
      visitor_id: "vis_seed_3",
      funnel_id: "fnl_saas",
      name: "Jordan Lee",
      email: "jordan@launchpad.io",
      fields: JSON.stringify({ company: "Launchpad", team_size: "8" }),
      persona_id: "per_founder",
      lead_score: 84,
      stage: "qualified",
      qualification:
        "High intent — returning visitor from HN, clicked the CTA, team of 8 fits the ICP well.",
      next_step: "Send a trial extension offer and book an onboarding call this week.",
      created_at: now - day,
    });
    insContact.run({
      id: "con_seed_2",
      visitor_id: "vis_seed_2",
      funnel_id: "fnl_coach",
      name: "Sam Brooks",
      email: "sam.brooks@gmail.com",
      fields: JSON.stringify({ goal: "rebuild strength after baby" }),
      persona_id: "per_parent",
      lead_score: 58,
      stage: "nurture",
      qualification:
        "Moderate intent — browsing on mobile after hours, no CTA click yet.",
      next_step: "Send the 'short home workouts' nurture email and a consult reminder.",
      created_at: now - 2 * day,
    });
    insContact.run({
      id: "con_seed_3",
      visitor_id: null,
      funnel_id: "fnl_saas",
      name: "Alex Romano",
      email: "alex@growthlab.co",
      fields: JSON.stringify({ company: "GrowthLab" }),
      persona_id: "per_growth",
      lead_score: 66,
      stage: "new",
      qualification: "New lead from paid search — not yet contacted.",
      next_step: "Route to sales for a quick discovery call.",
      created_at: now - 4 * day,
    });
  })();
}

const globalForDb = globalThis as unknown as { __figDb?: Database.Database };
export const db: Database.Database = globalForDb.__figDb ?? initDb();
if (!globalForDb.__figDb) globalForDb.__figDb = db;

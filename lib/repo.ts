import { nanoid } from "nanoid";
import { db } from "./db";
import type {
  Contact,
  ContactStage,
  Funnel,
  FunnelEvent,
  FunnelStatus,
  Page,
  PageKind,
  PageTemplate,
  Persona,
  PersonaTraits,
  Visitor,
  VisitorProfile,
  VisitorSignals,
} from "./types";

export function newId(prefix: string): string {
  return `${prefix}_${nanoid(12)}`;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "funnel"
  );
}

/* ---------------------------------- funnels --------------------------------- */

type FunnelRow = {
  id: string;
  slug: string;
  name: string;
  goal: string;
  audience: string;
  status: string;
  created_at: number;
};

function toFunnel(r: FunnelRow): Funnel {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    goal: r.goal,
    audience: r.audience,
    status: r.status as FunnelStatus,
    createdAt: r.created_at,
  };
}

export function listFunnels(): Funnel[] {
  return (
    db.prepare("SELECT * FROM funnels ORDER BY created_at DESC").all() as FunnelRow[]
  ).map(toFunnel);
}

export function getFunnel(id: string): Funnel | null {
  const r = db.prepare("SELECT * FROM funnels WHERE id = ?").get(id) as
    | FunnelRow
    | undefined;
  return r ? toFunnel(r) : null;
}

export function getFunnelBySlug(slug: string): Funnel | null {
  const r = db.prepare("SELECT * FROM funnels WHERE slug = ?").get(slug) as
    | FunnelRow
    | undefined;
  return r ? toFunnel(r) : null;
}

export function createFunnel(input: {
  name: string;
  goal: string;
  audience: string;
}): Funnel {
  let slug = slugify(input.name);
  if (getFunnelBySlug(slug)) slug = `${slug}-${nanoid(4).toLowerCase()}`;
  const funnel: Funnel = {
    id: newId("fnl"),
    slug,
    name: input.name.trim() || "Untitled funnel",
    goal: input.goal.trim(),
    audience: input.audience.trim(),
    status: "draft",
    createdAt: Date.now(),
  };
  db.prepare(
    `INSERT INTO funnels (id, slug, name, goal, audience, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    funnel.id,
    funnel.slug,
    funnel.name,
    funnel.goal,
    funnel.audience,
    funnel.status,
    funnel.createdAt,
  );
  // Every funnel ships with a usable starter page the agent can personalize.
  createPage({
    funnelId: funnel.id,
    kind: "capture",
    template: {
      headline: funnel.name,
      subhead:
        funnel.goal || "A funnel built with Fig and personalized per visitor.",
      body: "This is the starter page. Edit the template, then the agent rewrites it for each individual visitor based on who they are and how they arrived.",
      bullets: [
        "Tailored to every visitor in real time",
        "Built for: " + (funnel.audience || "your audience"),
        "Leads are auto-qualified into the CRM",
      ],
      ctaText: "Get started",
    },
  });
  return funnel;
}

export function setFunnelStatus(id: string, status: FunnelStatus): void {
  db.prepare("UPDATE funnels SET status = ? WHERE id = ?").run(status, id);
}

/* ----------------------------------- pages ---------------------------------- */

type PageRow = {
  id: string;
  funnel_id: string;
  slug: string;
  step_order: number;
  kind: string;
  template: string;
};

function toPage(r: PageRow): Page {
  return {
    id: r.id,
    funnelId: r.funnel_id,
    slug: r.slug,
    stepOrder: r.step_order,
    kind: r.kind as PageKind,
    template: JSON.parse(r.template) as PageTemplate,
  };
}

export function listPages(funnelId: string): Page[] {
  return (
    db
      .prepare("SELECT * FROM pages WHERE funnel_id = ? ORDER BY step_order")
      .all(funnelId) as PageRow[]
  ).map(toPage);
}

export function getLandingPage(funnelId: string): Page | null {
  const r = db
    .prepare("SELECT * FROM pages WHERE funnel_id = ? ORDER BY step_order LIMIT 1")
    .get(funnelId) as PageRow | undefined;
  return r ? toPage(r) : null;
}

export function createPage(input: {
  funnelId: string;
  kind: PageKind;
  template: PageTemplate;
}): Page {
  const existing = listPages(input.funnelId);
  const page: Page = {
    id: newId("pg"),
    funnelId: input.funnelId,
    slug: input.kind,
    stepOrder: existing.length,
    kind: input.kind,
    template: input.template,
  };
  db.prepare(
    `INSERT INTO pages (id, funnel_id, slug, step_order, kind, template)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    page.id,
    page.funnelId,
    page.slug,
    page.stepOrder,
    page.kind,
    JSON.stringify(page.template),
  );
  return page;
}

/* --------------------------------- personas --------------------------------- */

type PersonaRow = {
  id: string;
  funnel_id: string | null;
  name: string;
  description: string;
  traits: string;
  created_at: number;
};

function toPersona(r: PersonaRow): Persona {
  return {
    id: r.id,
    funnelId: r.funnel_id,
    name: r.name,
    description: r.description,
    traits: JSON.parse(r.traits) as PersonaTraits,
    createdAt: r.created_at,
  };
}

export function listPersonas(): Persona[] {
  return (
    db.prepare("SELECT * FROM personas ORDER BY created_at DESC").all() as PersonaRow[]
  ).map(toPersona);
}

// Personas usable on a funnel: its own plus any global (unscoped) personas.
export function listPersonasForFunnel(funnelId: string): Persona[] {
  return (
    db
      .prepare(
        "SELECT * FROM personas WHERE funnel_id = ? OR funnel_id IS NULL ORDER BY created_at",
      )
      .all(funnelId) as PersonaRow[]
  ).map(toPersona);
}

export function getPersona(id: string): Persona | null {
  const r = db.prepare("SELECT * FROM personas WHERE id = ?").get(id) as
    | PersonaRow
    | undefined;
  return r ? toPersona(r) : null;
}

export function createPersona(input: {
  funnelId: string | null;
  name: string;
  description: string;
  traits: PersonaTraits;
}): Persona {
  const persona: Persona = {
    id: newId("per"),
    funnelId: input.funnelId,
    name: input.name.trim() || "Untitled persona",
    description: input.description.trim(),
    traits: input.traits,
    createdAt: Date.now(),
  };
  db.prepare(
    `INSERT INTO personas (id, funnel_id, name, description, traits, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    persona.id,
    persona.funnelId,
    persona.name,
    persona.description,
    JSON.stringify(persona.traits),
    persona.createdAt,
  );
  return persona;
}

/* --------------------------------- visitors --------------------------------- */

type VisitorRow = {
  id: string;
  first_seen: number;
  last_seen: number;
  signals: string;
  profile: string | null;
  visits: number;
};

function toVisitor(r: VisitorRow): Visitor {
  return {
    id: r.id,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    signals: JSON.parse(r.signals) as VisitorSignals,
    profile: r.profile ? (JSON.parse(r.profile) as VisitorProfile) : null,
    visits: r.visits,
  };
}

export function getVisitor(id: string): Visitor | null {
  const r = db.prepare("SELECT * FROM visitors WHERE id = ?").get(id) as
    | VisitorRow
    | undefined;
  return r ? toVisitor(r) : null;
}

// Create the visitor on first sight, or bump last_seen + visit count on return.
export function upsertVisitor(id: string, signals: VisitorSignals): Visitor {
  const now = Date.now();
  const existing = getVisitor(id);
  if (existing) {
    db.prepare(
      "UPDATE visitors SET last_seen = ?, visits = visits + 1, signals = ? WHERE id = ?",
    ).run(now, JSON.stringify({ ...existing.signals, ...signals }), id);
    return getVisitor(id)!;
  }
  db.prepare(
    `INSERT INTO visitors (id, first_seen, last_seen, signals, profile, visits)
     VALUES (?, ?, ?, ?, NULL, 1)`,
  ).run(id, now, now, JSON.stringify(signals));
  return getVisitor(id)!;
}

export function saveVisitorProfile(id: string, profile: VisitorProfile): void {
  db.prepare("UPDATE visitors SET profile = ? WHERE id = ?").run(
    JSON.stringify(profile),
    id,
  );
}

export function recentVisitors(limit = 25): Visitor[] {
  return (
    db
      .prepare("SELECT * FROM visitors ORDER BY last_seen DESC LIMIT ?")
      .all(limit) as VisitorRow[]
  ).map(toVisitor);
}

/* ---------------------------------- events ---------------------------------- */

type EventRow = {
  id: string;
  visitor_id: string;
  funnel_id: string;
  page_id: string | null;
  type: string;
  meta: string;
  created_at: number;
};

function toEvent(r: EventRow): FunnelEvent {
  return {
    id: r.id,
    visitorId: r.visitor_id,
    funnelId: r.funnel_id,
    pageId: r.page_id,
    type: r.type as FunnelEvent["type"],
    meta: JSON.parse(r.meta) as Record<string, unknown>,
    createdAt: r.created_at,
  };
}

export function addEvent(input: {
  visitorId: string;
  funnelId: string;
  pageId: string | null;
  type: FunnelEvent["type"];
  meta?: Record<string, unknown>;
}): void {
  db.prepare(
    `INSERT INTO events (id, visitor_id, funnel_id, page_id, type, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId("evt"),
    input.visitorId,
    input.funnelId,
    input.pageId,
    input.type,
    JSON.stringify(input.meta ?? {}),
    Date.now(),
  );
}

export function eventsForVisitor(visitorId: string): FunnelEvent[] {
  return (
    db
      .prepare("SELECT * FROM events WHERE visitor_id = ? ORDER BY created_at")
      .all(visitorId) as EventRow[]
  ).map(toEvent);
}

export function eventsForFunnel(funnelId: string): FunnelEvent[] {
  return (
    db
      .prepare("SELECT * FROM events WHERE funnel_id = ? ORDER BY created_at DESC")
      .all(funnelId) as EventRow[]
  ).map(toEvent);
}

/* --------------------------------- contacts --------------------------------- */

type ContactRow = {
  id: string;
  visitor_id: string | null;
  funnel_id: string;
  name: string;
  email: string;
  fields: string;
  persona_id: string | null;
  lead_score: number;
  stage: string;
  qualification: string;
  next_step: string;
  created_at: number;
};

function toContact(r: ContactRow): Contact {
  return {
    id: r.id,
    visitorId: r.visitor_id,
    funnelId: r.funnel_id,
    name: r.name,
    email: r.email,
    fields: JSON.parse(r.fields) as Record<string, string>,
    personaId: r.persona_id,
    leadScore: r.lead_score,
    stage: r.stage as ContactStage,
    qualification: r.qualification,
    nextStep: r.next_step,
    createdAt: r.created_at,
  };
}

export function listContacts(): Contact[] {
  return (
    db.prepare("SELECT * FROM contacts ORDER BY created_at DESC").all() as ContactRow[]
  ).map(toContact);
}

export function getContact(id: string): Contact | null {
  const r = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as
    | ContactRow
    | undefined;
  return r ? toContact(r) : null;
}

export function createContact(input: {
  visitorId: string | null;
  funnelId: string;
  name: string;
  email: string;
  fields: Record<string, string>;
  personaId: string | null;
  leadScore: number;
  stage: ContactStage;
  qualification: string;
  nextStep: string;
}): Contact {
  const contact: Contact = {
    id: newId("con"),
    ...input,
    createdAt: Date.now(),
  };
  db.prepare(
    `INSERT INTO contacts (id, visitor_id, funnel_id, name, email, fields,
       persona_id, lead_score, stage, qualification, next_step, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    contact.id,
    contact.visitorId,
    contact.funnelId,
    contact.name,
    contact.email,
    JSON.stringify(contact.fields),
    contact.personaId,
    contact.leadScore,
    contact.stage,
    contact.qualification,
    contact.nextStep,
    contact.createdAt,
  );
  return contact;
}

export function setContactStage(id: string, stage: ContactStage): void {
  db.prepare("UPDATE contacts SET stage = ? WHERE id = ?").run(stage, id);
}

/* ----------------------------------- stats ---------------------------------- */

export interface DashboardStats {
  funnels: number;
  liveFunnels: number;
  visitors: number;
  personalizedViews: number;
  ctaClicks: number;
  contacts: number;
  qualified: number;
  conversionRate: number; // contacts / visitors, as a percentage
}

export function dashboardStats(): DashboardStats {
  const one = (sql: string): number =>
    (db.prepare(sql).get() as { n: number }).n;
  const visitors = one("SELECT COUNT(*) AS n FROM visitors");
  const contacts = one("SELECT COUNT(*) AS n FROM contacts");
  return {
    funnels: one("SELECT COUNT(*) AS n FROM funnels"),
    liveFunnels: one("SELECT COUNT(*) AS n FROM funnels WHERE status = 'live'"),
    visitors,
    personalizedViews: one(
      "SELECT COUNT(*) AS n FROM events WHERE type = 'personalized'",
    ),
    ctaClicks: one("SELECT COUNT(*) AS n FROM events WHERE type = 'cta_click'"),
    contacts,
    qualified: one("SELECT COUNT(*) AS n FROM contacts WHERE stage = 'qualified'"),
    conversionRate: visitors > 0 ? Math.round((contacts / visitors) * 1000) / 10 : 0,
  };
}

export interface FunnelStats {
  views: number;
  personalized: number;
  ctaClicks: number;
  contacts: number;
}

export function funnelStats(funnelId: string): FunnelStats {
  const one = (type: string): number =>
    (
      db
        .prepare("SELECT COUNT(*) AS n FROM events WHERE funnel_id = ? AND type = ?")
        .get(funnelId, type) as { n: number }
    ).n;
  return {
    views: one("view"),
    personalized: one("personalized"),
    ctaClicks: one("cta_click"),
    contacts: (
      db
        .prepare("SELECT COUNT(*) AS n FROM contacts WHERE funnel_id = ?")
        .get(funnelId) as { n: number }
    ).n,
  };
}

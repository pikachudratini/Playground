// Domain model for the Fig marketing OS.

export type FunnelStatus = "draft" | "live";
export type PageKind = "landing" | "offer" | "capture" | "thankyou";
export type EventType =
  | "view"
  | "personalized"
  | "scroll"
  | "cta_click"
  | "form_submit";
export type ContactStage = "new" | "qualified" | "nurture" | "won" | "lost";
export type Device = "mobile" | "tablet" | "desktop";

export interface PageTemplate {
  headline: string;
  subhead: string;
  body: string;
  bullets: string[];
  ctaText: string;
}

export interface Funnel {
  id: string;
  slug: string;
  name: string;
  goal: string;
  audience: string;
  status: FunnelStatus;
  createdAt: number;
}

export interface Page {
  id: string;
  funnelId: string;
  slug: string;
  stepOrder: number;
  kind: PageKind;
  template: PageTemplate;
}

export interface PersonaTraits {
  pains: string[];
  goals: string[];
  tone: string;
  channel: string;
}

export interface Persona {
  id: string;
  funnelId: string | null;
  name: string;
  description: string;
  traits: PersonaTraits;
  createdAt: number;
}

export interface VisitorSignals {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
  userAgent?: string;
  device: Device;
  language?: string;
  country?: string;
}

export interface VisitorProfile {
  matchedPersonaId: string | null;
  matchedPersonaName: string | null;
  intentScore: number; // 0-100
  summary: string;
}

export interface Visitor {
  id: string;
  firstSeen: number;
  lastSeen: number;
  signals: VisitorSignals;
  profile: VisitorProfile | null;
  visits: number;
}

export interface FunnelEvent {
  id: string;
  visitorId: string;
  funnelId: string;
  pageId: string | null;
  type: EventType;
  meta: Record<string, unknown>;
  createdAt: number;
}

export interface Contact {
  id: string;
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
  createdAt: number;
}

// What the personalization agent returns for one render.
export interface PersonalizedContent extends PageTemplate {
  matchedPersonaId: string | null;
  matchedPersonaName: string | null;
  intentScore: number;
  rationale: string;
  generatedByAI: boolean;
}

import Anthropic from "@anthropic-ai/sdk";
import { describeSignals } from "./signals";
import {
  createFunnel,
  createPersona,
  dashboardStats,
  funnelStats,
  listContacts,
  listFunnels,
} from "./repo";
import type {
  ContactStage,
  Funnel,
  FunnelEvent,
  Page,
  Persona,
  PersonalizedContent,
  Visitor,
} from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

// The agents need an API key. Without one the app still works on rule-based fallbacks.
export const agentEnabled = Boolean(API_KEY && API_KEY.trim());

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: API_KEY });
  return client;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.round(n)));

function summarizeEvents(events: FunnelEvent[]): string {
  if (events.length === 0) return "No prior on-site activity recorded.";
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return Object.entries(counts)
    .map(([type, n]) => `${n}x ${type}`)
    .join(", ");
}

/* ----------------------------- page personalization ----------------------------- */

const PERSONALIZE_SYSTEM = `You are the personalization agent inside Fig, an agentic marketing OS.
Your job: rewrite one funnel landing page so it speaks directly to the ONE specific
visitor described, as if a sharp conversion copywriter studied their profile.

Rules:
- Keep the offer, product and core promise identical to the base template. Never invent
  features, prices or claims that are not in the base template.
- Adapt angle, wording, emphasis and the lead bullet order to the visitor's likely
  persona, traffic source, device and intent.
- Mobile visitors get punchier, shorter copy. High-intent visitors get a more direct CTA.
- Pick the single best-matching persona, or "none" if nothing fits.
- Always answer by calling the render_personalized_page tool.`;

const PERSONALIZE_TOOL: Anthropic.Tool = {
  name: "render_personalized_page",
  description: "Return the personalized landing page content for this one visitor.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "Personalized H1, max ~12 words." },
      subhead: { type: "string", description: "Supporting line under the headline." },
      body: { type: "string", description: "One short persuasive paragraph." },
      bullets: {
        type: "array",
        items: { type: "string" },
        description: "3-5 benefit bullets, most relevant first.",
      },
      ctaText: { type: "string", description: "Call-to-action button label." },
      matchedPersonaId: {
        type: "string",
        description: "The id of the best-matching persona, or 'none'.",
      },
      intentScore: {
        type: "number",
        description: "0-100 estimate of how ready this visitor is to convert.",
      },
      rationale: {
        type: "string",
        description: "One sentence: why this version fits this visitor.",
      },
    },
    required: [
      "headline",
      "subhead",
      "body",
      "bullets",
      "ctaText",
      "matchedPersonaId",
      "intentScore",
      "rationale",
    ],
  },
};

interface PersonalizeToolInput {
  headline: string;
  subhead: string;
  body: string;
  bullets: string[];
  ctaText: string;
  matchedPersonaId: string;
  intentScore: number;
  rationale: string;
}

function personalizePrompt(args: {
  funnel: Funnel;
  page: Page;
  visitor: Visitor;
  personas: Persona[];
  events: FunnelEvent[];
}): string {
  const { funnel, page, visitor, personas, events } = args;
  const personaLines = personas
    .map(
      (p) =>
        `- id=${p.id} | ${p.name}: ${p.description} | pains: ${p.traits.pains.join(
          "; ",
        )} | goals: ${p.traits.goals.join("; ")} | tone: ${p.traits.tone} | usual channel: ${p.traits.channel}`,
    )
    .join("\n");

  return `FUNNEL
Name: ${funnel.name}
Goal: ${funnel.goal}
Intended audience: ${funnel.audience}

BASE TEMPLATE (the generic, un-personalized page)
Headline: ${page.template.headline}
Subhead: ${page.template.subhead}
Body: ${page.template.body}
Bullets:
${page.template.bullets.map((b) => `  - ${b}`).join("\n")}
CTA: ${page.template.ctaText}

AVAILABLE PERSONAS
${personaLines || "(none defined)"}

THIS VISITOR
Traffic & context: ${describeSignals(visitor.signals)}
Visit number: ${visitor.visits} ${visitor.visits > 1 ? "(returning visitor)" : "(first visit)"}
On-site activity: ${summarizeEvents(events)}
${visitor.profile ? `Earlier read: ${visitor.profile.summary}` : ""}

Rewrite the page for this visitor and call render_personalized_page.`;
}

function fallbackPersonalize(args: {
  page: Page;
  visitor: Visitor;
  personas: Persona[];
  events: FunnelEvent[];
}): PersonalizedContent {
  const { page, visitor, personas, events } = args;
  const s = visitor.signals;

  // Rule-based persona match on traffic channel.
  let matched: Persona | null = personas[0] ?? null;
  for (const p of personas) {
    const ch = p.traits.channel.toLowerCase();
    const paid = s.utmMedium === "cpc" || /ad|paid/.test(s.utmMedium ?? "");
    const social = /social|instagram|facebook|tiktok|linkedin/.test(
      `${s.utmMedium ?? ""} ${s.referrer ?? ""}`,
    );
    if (paid && /ad|paid/.test(ch)) matched = p;
    else if (social && /social/.test(ch)) matched = p;
  }

  const ctaClicks = events.filter((e) => e.type === "cta_click").length;
  const intentScore = clamp(
    35 + ctaClicks * 25 + (visitor.visits - 1) * 15 + events.length * 3,
    5,
    99,
  );

  return {
    ...page.template,
    matchedPersonaId: matched?.id ?? null,
    matchedPersonaName: matched?.name ?? null,
    intentScore,
    rationale:
      "Rule-based personalization (set ANTHROPIC_API_KEY to enable the AI agent).",
    generatedByAI: false,
  };
}

// Generate a landing page tailored to one specific visitor, live, per request.
export async function personalizeContent(args: {
  funnel: Funnel;
  page: Page;
  visitor: Visitor;
  personas: Persona[];
  events: FunnelEvent[];
}): Promise<PersonalizedContent> {
  if (!agentEnabled) return fallbackPersonalize(args);
  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: PERSONALIZE_SYSTEM,
      tools: [PERSONALIZE_TOOL],
      tool_choice: { type: "tool", name: "render_personalized_page" },
      messages: [{ role: "user", content: personalizePrompt(args) }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return fallbackPersonalize(args);
    const out = block.input as PersonalizeToolInput;

    const matched =
      args.personas.find((p) => p.id === out.matchedPersonaId) ?? null;
    const bullets =
      Array.isArray(out.bullets) && out.bullets.length > 0
        ? out.bullets.slice(0, 6)
        : args.page.template.bullets;

    return {
      headline: out.headline || args.page.template.headline,
      subhead: out.subhead || args.page.template.subhead,
      body: out.body || args.page.template.body,
      bullets,
      ctaText: out.ctaText || args.page.template.ctaText,
      matchedPersonaId: matched?.id ?? null,
      matchedPersonaName: matched?.name ?? null,
      intentScore: clamp(Number(out.intentScore) || 0, 0, 100),
      rationale: out.rationale || "Personalized for this visitor.",
      generatedByAI: true,
    };
  } catch (err) {
    console.error("[agent] personalizeContent failed:", err);
    return fallbackPersonalize(args);
  }
}

/* -------------------------------- lead qualification -------------------------------- */

export interface Qualification {
  leadScore: number;
  stage: ContactStage;
  qualification: string;
  nextStep: string;
}

const QUALIFY_TOOL: Anthropic.Tool = {
  name: "qualify_lead",
  description: "Score and qualify a captured lead, and set the recommended next step.",
  input_schema: {
    type: "object",
    properties: {
      leadScore: { type: "number", description: "0-100 lead quality score." },
      stage: {
        type: "string",
        enum: ["new", "qualified", "nurture", "won", "lost"],
        description: "CRM stage to place this lead in.",
      },
      qualification: {
        type: "string",
        description: "Two-sentence read on intent and fit.",
      },
      nextStep: {
        type: "string",
        description: "The single best next action for the marketing/sales team.",
      },
    },
    required: ["leadScore", "stage", "qualification", "nextStep"],
  },
};

function fallbackQualify(args: {
  visitor: Visitor | null;
  events: FunnelEvent[];
  email: string;
}): Qualification {
  const { visitor, events, email } = args;
  const ctaClicks = events.filter((e) => e.type === "cta_click").length;
  const freeMail = /@(gmail|yahoo|hotmail|outlook|icloud)\./i.test(email);
  const score = clamp(
    40 + ctaClicks * 20 + (visitor ? (visitor.visits - 1) * 10 : 0) + (freeMail ? 0 : 15),
    5,
    99,
  );
  const stage: ContactStage = score >= 70 ? "qualified" : score >= 45 ? "nurture" : "new";
  return {
    leadScore: score,
    stage,
    qualification: `Rule-based score ${score}. ${
      freeMail ? "Personal email domain" : "Business email domain"
    }, ${ctaClicks} CTA click(s). Set ANTHROPIC_API_KEY for an AI read.`,
    nextStep:
      stage === "qualified"
        ? "Route to sales for a fast follow-up."
        : "Add to a nurture sequence and re-score on next visit.",
  };
}

// Qualify a freshly captured lead.
export async function qualifyContact(args: {
  funnel: Funnel;
  name: string;
  email: string;
  fields: Record<string, string>;
  visitor: Visitor | null;
  events: FunnelEvent[];
  persona: Persona | null;
}): Promise<Qualification> {
  if (!agentEnabled) return fallbackQualify(args);
  try {
    const { funnel, name, email, fields, visitor, events, persona } = args;
    const prompt = `A lead just submitted the capture form on this funnel.

FUNNEL
Name: ${funnel.name}
Goal: ${funnel.goal}

LEAD
Name: ${name || "(not given)"}
Email: ${email}
Form fields: ${JSON.stringify(fields)}
Likely persona: ${persona ? `${persona.name} — ${persona.description}` : "unknown"}

BEHAVIOR
Traffic & context: ${visitor ? describeSignals(visitor.signals) : "unknown"}
Visits: ${visitor?.visits ?? 1}
On-site activity: ${summarizeEvents(events)}

Qualify this lead by calling qualify_lead.`;

    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 600,
      tools: [QUALIFY_TOOL],
      tool_choice: { type: "tool", name: "qualify_lead" },
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return fallbackQualify(args);
    const out = block.input as Qualification;
    const stages: ContactStage[] = ["new", "qualified", "nurture", "won", "lost"];
    return {
      leadScore: clamp(Number(out.leadScore) || 0, 0, 100),
      stage: stages.includes(out.stage) ? out.stage : "new",
      qualification: out.qualification || "Captured lead.",
      nextStep: out.nextStep || "Follow up.",
    };
  } catch (err) {
    console.error("[agent] qualifyContact failed:", err);
    return fallbackQualify(args);
  }
}

/* ----------------------------------- chat agent ----------------------------------- */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const CHAT_SYSTEM = `You are Fig, the agent inside an agentic marketing OS.
You help a marketer build and run funnels that are personalized per individual visitor.
You can inspect funnels, contacts and analytics, and you can create new funnels and personas.
Be concise, concrete and action-oriented. When the user asks you to build something,
use your tools to actually create it rather than only describing it.`;

const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_funnels",
    description: "List every funnel with its live status and key metrics.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_dashboard_stats",
    description: "Get account-wide metrics: visitors, conversions, contacts.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_contacts",
    description: "List captured CRM contacts with their stage and lead score.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_funnel",
    description: "Create a new funnel (it starts as a draft).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        goal: { type: "string", description: "What the funnel should achieve." },
        audience: { type: "string", description: "Who it targets." },
      },
      required: ["name", "goal", "audience"],
    },
  },
  {
    name: "create_persona",
    description: "Create an audience persona used to personalize funnels.",
    input_schema: {
      type: "object",
      properties: {
        funnelId: {
          type: "string",
          description: "Funnel id to scope the persona to, or '' for a global persona.",
        },
        name: { type: "string" },
        description: { type: "string" },
        pains: { type: "array", items: { type: "string" } },
        goals: { type: "array", items: { type: "string" } },
        tone: { type: "string" },
        channel: { type: "string" },
      },
      required: ["name", "description", "pains", "goals", "tone", "channel"],
    },
  },
];

function runChatTool(name: string, input: Record<string, unknown>): {
  result: string;
  action?: string;
} {
  switch (name) {
    case "list_funnels": {
      const funnels = listFunnels().map((f) => ({
        ...f,
        stats: funnelStats(f.id),
      }));
      return { result: JSON.stringify(funnels) };
    }
    case "get_dashboard_stats":
      return { result: JSON.stringify(dashboardStats()) };
    case "list_contacts":
      return { result: JSON.stringify(listContacts()) };
    case "create_funnel": {
      const f = createFunnel({
        name: String(input.name ?? ""),
        goal: String(input.goal ?? ""),
        audience: String(input.audience ?? ""),
      });
      return {
        result: JSON.stringify({ created: f }),
        action: `Created funnel "${f.name}" (draft) at /f/${f.slug}`,
      };
    }
    case "create_persona": {
      const fid = String(input.funnelId ?? "").trim();
      const p = createPersona({
        funnelId: fid || null,
        name: String(input.name ?? ""),
        description: String(input.description ?? ""),
        traits: {
          pains: Array.isArray(input.pains) ? input.pains.map(String) : [],
          goals: Array.isArray(input.goals) ? input.goals.map(String) : [],
          tone: String(input.tone ?? ""),
          channel: String(input.channel ?? ""),
        },
      });
      return {
        result: JSON.stringify({ created: p }),
        action: `Created persona "${p.name}"`,
      };
    }
    default:
      return { result: `Unknown tool: ${name}` };
  }
}

// Run the admin chat agent: a tool-use loop that can inspect and build.
export async function runAgentChat(
  history: ChatTurn[],
): Promise<{ reply: string; actions: string[] }> {
  if (!agentEnabled) {
    return {
      reply:
        "The agent is offline because no ANTHROPIC_API_KEY is set. Add a key to .env.local and restart to let me inspect data and build funnels for you.",
      actions: [],
    };
  }

  const messages: Anthropic.MessageParam[] = history.map((t) => ({
    role: t.role,
    content: t.content,
  }));
  const actions: string[] = [];

  try {
    for (let i = 0; i < 8; i++) {
      const res = await getClient().messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: CHAT_SYSTEM,
        tools: CHAT_TOOLS,
        messages,
      });

      const toolUses = res.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { reply: text || "(no response)", actions };
      }

      messages.push({ role: "assistant", content: res.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const { result, action } = runChatTool(
          tu.name,
          (tu.input ?? {}) as Record<string, unknown>,
        );
        if (action) actions.push(action);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      }
      messages.push({ role: "user", content: toolResults });
    }
    return { reply: "Stopped after too many steps. Try a narrower request.", actions };
  } catch (err) {
    console.error("[agent] runAgentChat failed:", err);
    return {
      reply: `The agent hit an error: ${
        err instanceof Error ? err.message : "unknown"
      }`,
      actions,
    };
  }
}

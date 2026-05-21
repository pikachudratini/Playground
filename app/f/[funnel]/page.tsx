import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { personalizeContent } from "@/lib/agent";
import {
  addEvent,
  eventsForVisitor,
  getFunnelBySlug,
  getLandingPage,
  getVisitor,
  listPersonasForFunnel,
  saveVisitorProfile,
  upsertVisitor,
} from "@/lib/repo";
import { extractSignals } from "@/lib/signals";
import type { Funnel, Page } from "@/lib/types";
import FunnelTracker from "@/components/FunnelTracker";
import LeadForm from "@/components/LeadForm";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function FunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ funnel: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { funnel: slug } = await params;
  const sp = await searchParams;
  const h = await headers();

  const funnel = getFunnelBySlug(slug);
  if (!funnel) notFound();

  const page = getLandingPage(funnel.id);
  if (!page) {
    return (
      <main className="grid min-h-screen place-items-center p-8 text-center">
        <p className="text-slate-500">This funnel has no page yet.</p>
      </main>
    );
  }

  const visitorId = h.get("x-fig-visitor") ?? "vis_anonymous";
  const signals = extractSignals(h, sp);
  upsertVisitor(visitorId, signals);
  addEvent({
    visitorId,
    funnelId: funnel.id,
    pageId: page.id,
    type: "view",
  });

  return (
    <main className="min-h-screen bg-white">
      <FunnelTracker
        visitorId={visitorId}
        funnelId={funnel.id}
        pageId={page.id}
      />
      <div className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="grid h-6 w-6 place-items-center rounded bg-violet-600 text-xs text-white">
              F
            </span>
            {funnel.name}
          </span>
          <span className="text-xs font-medium text-slate-400">
            Personalized for you by Fig
          </span>
        </div>
      </div>

      <Suspense fallback={<HeroSkeleton template={page.template} />}>
        <PersonalizedHero
          funnel={funnel}
          page={page}
          visitorId={visitorId}
        />
      </Suspense>
    </main>
  );
}

async function PersonalizedHero({
  funnel,
  page,
  visitorId,
}: {
  funnel: Funnel;
  page: Page;
  visitorId: string;
}) {
  const visitor = getVisitor(visitorId);
  const events = eventsForVisitor(visitorId);
  const personas = listPersonasForFunnel(funnel.id);

  const content = visitor
    ? await personalizeContent({ funnel, page, visitor, personas, events })
    : { ...page.template, matchedPersonaId: null, matchedPersonaName: null, intentScore: 0, rationale: "", generatedByAI: false };

  if (visitor) {
    addEvent({
      visitorId,
      funnelId: funnel.id,
      pageId: page.id,
      type: "personalized",
    });
    saveVisitorProfile(visitorId, {
      matchedPersonaId: content.matchedPersonaId,
      matchedPersonaName: content.matchedPersonaName,
      intentScore: content.intentScore,
      summary: content.rationale || "Personalized visit.",
    });
  }

  return (
    <>
      <section className="bg-gradient-to-b from-violet-50 to-white">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              {content.headline}
            </h1>
            <p className="mt-4 text-lg text-slate-600">{content.subhead}</p>
            <p className="mt-4 text-slate-600">{content.body}</p>
            <ul className="mt-6 space-y-2.5">
              {content.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-slate-700">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:pt-4">
            <LeadForm
              visitorId={visitorId}
              funnelId={funnel.id}
              pageId={page.id}
              ctaText={content.ctaText}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-bold text-white">
              {content.generatedByAI ? "AI agent" : "Rule-based"}
            </span>
            <h2 className="text-sm font-semibold text-slate-700">
              How this page was personalized for you
            </h2>
          </div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Matched persona
              </p>
              <p className="text-slate-700">
                {content.matchedPersonaName ?? "No clear match"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Intent score
              </p>
              <p className="text-slate-700">{content.intentScore} / 100</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Agent rationale
              </p>
              <p className="text-slate-700">{content.rationale || "—"}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function HeroSkeleton({
  template,
}: {
  template: Page["template"];
}) {
  return (
    <section className="bg-gradient-to-b from-violet-50 to-white">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 lg:grid-cols-[1.3fr_1fr]">
        <div className="animate-pulse">
          <div className="h-12 w-3/4 rounded bg-slate-200" />
          <div className="mt-4 h-5 w-full rounded bg-slate-200" />
          <div className="mt-2 h-5 w-2/3 rounded bg-slate-200" />
          <div className="mt-6 space-y-3">
            {template.bullets.map((b) => (
              <div key={b} className="h-4 w-1/2 rounded bg-slate-200" />
            ))}
          </div>
          <p className="mt-6 text-sm text-violet-500">
            The agent is writing this page for you…
          </p>
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </section>
  );
}

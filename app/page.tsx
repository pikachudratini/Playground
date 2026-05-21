import Link from "next/link";
import { listFunnels } from "@/lib/repo";
import { agentEnabled } from "@/lib/agent";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Define funnels & personas",
    body: "Describe the goal and the audiences. Personas tell the agent who it is writing for.",
  },
  {
    title: "Agent reads each visitor",
    body: "On every visit it fuses traffic source, device, geo and on-site behavior into a profile.",
  },
  {
    title: "Page is rewritten live",
    body: "The landing page headline, copy, bullets and CTA are generated for that one person.",
  },
  {
    title: "Leads are qualified",
    body: "Captured leads flow into the CRM scored, staged and with a recommended next step.",
  },
];

export default function HomePage() {
  const funnels = listFunnels().filter((f) => f.status === "live");

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-white">
            F
          </span>
          Fig
        </div>
        <Link
          href="/admin"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Open the OS
        </Link>
      </header>

      <section className="mt-20 text-center">
        <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
          Agentic Marketing OS
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight">
          Funnels personalized for{" "}
          <span className="text-violet-600">every individual</span> visitor.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Fig is a workspace for building marketing funnels. An AI agent reads each
          visitor in real time and rewrites the page so it speaks to that one person —
          then qualifies the leads it captures.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/admin"
            className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Explore the dashboard
          </Link>
          {funnels[0] && (
            <Link
              href={`/f/${funnels[0].slug}`}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
            >
              See a live funnel
            </Link>
          )}
        </div>
        {!agentEnabled && (
          <p className="mt-4 text-xs text-amber-600">
            Running in rule-based mode — set ANTHROPIC_API_KEY in .env.local to turn on
            the AI agent.
          </p>
        )}
      </section>

      <section className="mt-24">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
          How it works
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">
                {i + 1}
              </div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
          Live funnels — open one as a different visitor
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {funnels.map((f) => (
            <div
              key={f.id}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <h3 className="text-lg font-bold">{f.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.goal}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <Link
                  className="rounded-md bg-slate-100 px-2.5 py-1.5 hover:bg-slate-200"
                  href={`/f/${f.slug}`}
                >
                  Direct visit
                </Link>
                <Link
                  className="rounded-md bg-slate-100 px-2.5 py-1.5 hover:bg-slate-200"
                  href={`/f/${f.slug}?utm_source=google&utm_medium=cpc&utm_campaign=search`}
                >
                  As paid-search lead
                </Link>
                <Link
                  className="rounded-md bg-slate-100 px-2.5 py-1.5 hover:bg-slate-200"
                  href={`/f/${f.slug}?utm_source=instagram&utm_medium=social`}
                >
                  As social visitor
                </Link>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Each link arrives with different signals — the agent writes a different page
          for each.
        </p>
      </section>

      <footer className="mt-24 border-t border-slate-200 pt-8 text-center text-sm text-slate-400">
        Fig — an agentic marketing OS demo.
      </footer>
    </main>
  );
}

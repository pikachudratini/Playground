import Link from "next/link";
import { notFound } from "next/navigation";
import {
  funnelStats,
  getFunnel,
  getLandingPage,
  listContacts,
  listPersonasForFunnel,
} from "@/lib/repo";
import { setFunnelStatusAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function FunnelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const funnel = getFunnel(id);
  if (!funnel) notFound();

  const page = getLandingPage(funnel.id);
  const personas = listPersonasForFunnel(funnel.id);
  const stats = funnelStats(funnel.id);
  const contacts = listContacts().filter((c) => c.funnelId === funnel.id);
  const nextStatus = funnel.status === "live" ? "draft" : "live";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/funnels"
        className="text-sm font-semibold text-violet-600 hover:underline"
      >
        ← All funnels
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{funnel.name}</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">{funnel.goal}</p>
          <p className="mt-1 text-xs text-slate-400">
            Audience: {funnel.audience || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              funnel.status === "live"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {funnel.status}
          </span>
          <form action={setFunnelStatusAction}>
            <input type="hidden" name="id" value={funnel.id} />
            <input type="hidden" name="status" value={nextStatus} />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
            >
              {nextStatus === "live" ? "Set live" : "Unpublish"}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm">
        <span className="font-semibold text-violet-800">Public page:</span>{" "}
        <Link href={`/f/${funnel.slug}`} className="font-mono text-violet-700 hover:underline">
          /f/{funnel.slug}
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Views", value: stats.views },
          { label: "Personalized", value: stats.personalized },
          { label: "CTA clicks", value: stats.ctaClicks },
          { label: "Contacts", value: stats.contacts },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs font-semibold uppercase text-slate-500">
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Landing page template</h2>
          <p className="text-xs text-slate-400">
            The base copy. The agent rewrites it for each visitor.
          </p>
          {page ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Headline
                </dt>
                <dd>{page.template.headline}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Subhead
                </dt>
                <dd className="text-slate-600">{page.template.subhead}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  Bullets
                </dt>
                <dd>
                  <ul className="list-disc pl-5 text-slate-600">
                    {page.template.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">
                  CTA
                </dt>
                <dd>{page.template.ctaText}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No page yet.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Personas ({personas.length})</h2>
            <Link
              href="/admin/personas"
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              Manage →
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {personas.map((p) => (
              <div key={p.id} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-slate-500">{p.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Tone: {p.traits.tone} · Channel: {p.traits.channel}
                </p>
              </div>
            ))}
            {personas.length === 0 && (
              <p className="text-sm text-slate-400">
                No personas — the agent personalizes from raw signals only.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Contacts from this funnel</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium">{c.name || c.email}</p>
                <p className="text-xs text-slate-400">{c.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">score {c.leadScore}</p>
                <p className="text-xs capitalize text-slate-400">{c.stage}</p>
              </div>
            </div>
          ))}
          {contacts.length === 0 && (
            <p className="py-2.5 text-sm text-slate-400">No contacts yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

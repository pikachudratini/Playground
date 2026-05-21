import Link from "next/link";
import { funnelStats, listFunnels } from "@/lib/repo";
import { createFunnelAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default function FunnelsPage() {
  const funnels = listFunnels();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Funnels</h1>
      <p className="mt-1 text-sm text-slate-500">
        Each funnel has a public page the agent personalizes per visitor.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {funnels.map((f) => {
            const fs = funnelStats(f.id);
            return (
              <div
                key={f.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/admin/funnels/${f.id}`}
                      className="text-lg font-bold hover:text-violet-600"
                    >
                      {f.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">{f.goal}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      f.status === "live"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                  <span>{fs.views} views</span>
                  <span>{fs.personalized} personalized</span>
                  <span>{fs.ctaClicks} CTA clicks</span>
                  <span>{fs.contacts} contacts</span>
                </div>
                <div className="mt-4 flex gap-3 text-sm font-semibold">
                  <Link
                    href={`/admin/funnels/${f.id}`}
                    className="text-violet-600 hover:underline"
                  >
                    Open
                  </Link>
                  <Link
                    href={`/f/${f.slug}`}
                    className="text-slate-500 hover:underline"
                  >
                    View public page →
                  </Link>
                </div>
              </div>
            );
          })}
          {funnels.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No funnels yet — create your first one.
            </p>
          )}
        </div>

        <form
          action={createFunnelAction}
          className="h-fit rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold">New funnel</h2>
          <p className="mt-1 text-xs text-slate-500">
            Starts as a draft. A starter landing page is added automatically.
          </p>
          <label className="mt-4 block text-xs font-semibold text-slate-600">
            Name
            <input
              name="name"
              required
              placeholder="Webinar registration"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Goal
            <textarea
              name="goal"
              rows={2}
              placeholder="Get sign-ups for the live product webinar."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Audience
            <textarea
              name="audience"
              rows={2}
              placeholder="Ops leaders at mid-market companies."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Create funnel
          </button>
        </form>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  dashboardStats,
  funnelStats,
  listFunnels,
  recentVisitors,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function intentColor(score: number): string {
  if (score >= 70) return "bg-emerald-100 text-emerald-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function DashboardPage() {
  const stats = dashboardStats();
  const visitors = recentVisitors(8);
  const funnels = listFunnels();

  const cards = [
    { label: "Funnels", value: stats.funnels, sub: `${stats.liveFunnels} live` },
    { label: "Visitors", value: stats.visitors, sub: "all time" },
    {
      label: "Personalized views",
      value: stats.personalizedViews,
      sub: "agent renders",
    },
    { label: "CTA clicks", value: stats.ctaClicks, sub: "engagement" },
    { label: "Contacts", value: stats.contacts, sub: `${stats.qualified} qualified` },
    {
      label: "Conversion rate",
      value: `${stats.conversionRate}%`,
      sub: "visitor → contact",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Everything the agent is doing across your funnels.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {c.label}
            </p>
            <p className="mt-2 text-3xl font-bold">{c.value}</p>
            <p className="mt-1 text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Funnels</h2>
            <Link
              href="/admin/funnels"
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              Manage →
            </Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {funnels.map((f) => {
              const fs = funnelStats(f.id);
              return (
                <Link
                  key={f.id}
                  href={`/admin/funnels/${f.id}`}
                  className="flex items-center justify-between py-3 hover:opacity-70"
                >
                  <div>
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-slate-400">
                      {fs.personalized} personalized · {fs.contacts} contacts
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      f.status === "live"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {f.status}
                  </span>
                </Link>
              );
            })}
            {funnels.length === 0 && (
              <p className="py-3 text-sm text-slate-400">No funnels yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Recent visitors</h2>
          <p className="text-xs text-slate-400">
            Each profile is built by the agent at render time.
          </p>
          <div className="mt-3 divide-y divide-slate-100">
            {visitors.map((v) => (
              <div key={v.id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {v.profile?.matchedPersonaName ?? "Unclassified visitor"}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${intentColor(
                      v.profile?.intentScore ?? 0,
                    )}`}
                  >
                    intent {v.profile?.intentScore ?? "—"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {v.signals.utmSource
                    ? `${v.signals.utmMedium ?? "campaign"} · ${v.signals.utmSource}`
                    : v.signals.referrer ?? "direct"}{" "}
                  · {v.signals.device}
                  {v.signals.country ? ` · ${v.signals.country}` : ""} ·{" "}
                  {timeAgo(v.lastSeen)}
                </p>
              </div>
            ))}
            {visitors.length === 0 && (
              <p className="py-3 text-sm text-slate-400">No visitors yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

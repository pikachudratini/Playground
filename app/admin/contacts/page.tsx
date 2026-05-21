import { getFunnel, getPersona, listContacts } from "@/lib/repo";
import ContactStageSelect from "@/components/ContactStageSelect";

export const dynamic = "force-dynamic";

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 45) return "text-amber-600";
  return "text-slate-500";
}

export default function ContactsPage() {
  const contacts = listContacts();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Contacts (CRM)</h1>
      <p className="mt-1 text-sm text-slate-500">
        Leads captured by funnels — each one scored and qualified by the agent.
      </p>

      <div className="mt-6 space-y-4">
        {contacts.map((c) => {
          const funnel = getFunnel(c.funnelId);
          const persona = c.personaId ? getPersona(c.personaId) : null;
          return (
            <div
              key={c.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{c.name || "Unnamed lead"}</p>
                  <p className="text-sm text-slate-500">{c.email}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {funnel?.name ?? "Unknown funnel"}
                    {persona ? ` · persona: ${persona.name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${scoreColor(c.leadScore)}`}>
                      {c.leadScore}
                    </p>
                    <p className="text-xs text-slate-400">lead score</p>
                  </div>
                  <ContactStageSelect id={c.id} stage={c.stage} />
                </div>
              </div>
              {c.qualification && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">
                    Agent read:
                  </span>{" "}
                  {c.qualification}
                </p>
              )}
              {c.nextStep && (
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-violet-700">
                    Next step:
                  </span>{" "}
                  <span className="text-slate-600">{c.nextStep}</span>
                </p>
              )}
              {Object.keys(c.fields).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(c.fields).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {contacts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            No contacts yet — submit a funnel form to capture one.
          </p>
        )}
      </div>
    </div>
  );
}

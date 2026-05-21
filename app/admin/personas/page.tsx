import { getFunnel, listFunnels, listPersonas } from "@/lib/repo";
import { createPersonaAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default function PersonasPage() {
  const personas = listPersonas();
  const funnels = listFunnels();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Personas</h1>
      <p className="mt-1 text-sm text-slate-500">
        Audience definitions the agent uses to decide who it is writing for.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {personas.map((p) => {
            const funnel = p.funnelId ? getFunnel(p.funnelId) : null;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">{p.name}</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {funnel ? funnel.name : "Global"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-semibold uppercase text-slate-400">Pains</p>
                    <ul className="mt-1 list-disc pl-4 text-slate-600">
                      {p.traits.pains.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold uppercase text-slate-400">Goals</p>
                    <ul className="mt-1 list-disc pl-4 text-slate-600">
                      {p.traits.goals.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Tone: {p.traits.tone || "—"} · Channel: {p.traits.channel || "—"}
                </p>
              </div>
            );
          })}
          {personas.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              No personas yet.
            </p>
          )}
        </div>

        <form
          action={createPersonaAction}
          className="h-fit rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold">New persona</h2>
          <label className="mt-4 block text-xs font-semibold text-slate-600">
            Funnel
            <select
              name="funnelId"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            >
              <option value="">Global (all funnels)</option>
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Name
            <input
              name="name"
              required
              placeholder="Budget-conscious buyer"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Description
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Pains (one per line)
            <textarea
              name="pains"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-600">
            Goals (one per line)
            <textarea
              name="goals"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-600">
              Tone
              <input
                name="tone"
                placeholder="friendly, direct"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Channel
              <input
                name="channel"
                placeholder="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Create persona
          </button>
        </form>
      </div>
    </div>
  );
}

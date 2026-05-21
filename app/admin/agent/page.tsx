import AgentChat from "@/components/AgentChat";
import { agentEnabled } from "@/lib/agent";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Agent</h1>
      <p className="mt-1 text-sm text-slate-500">
        The marketing agent can inspect your data and build funnels and personas for
        you.
      </p>
      {!agentEnabled && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          The agent is offline. Add ANTHROPIC_API_KEY to .env.local and restart to
          enable it.
        </p>
      )}
      <div className="mt-6">
        <AgentChat />
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import AdminNav from "@/components/AdminNav";
import { agentEnabled } from "@/lib/agent";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 p-4 text-white">
        <Link href="/" className="flex items-center gap-2 px-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600">
            F
          </span>
          Fig
        </Link>
        <p className="mb-6 px-2 text-xs text-slate-500">Agentic Marketing OS</p>
        <AdminNav />
        <div className="mt-auto rounded-lg bg-slate-800 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                agentEnabled ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span className="font-semibold">
              Agent {agentEnabled ? "online" : "rule-based"}
            </span>
          </div>
          <p className="mt-1 text-slate-400">
            {agentEnabled
              ? "Claude is powering personalization."
              : "Set ANTHROPIC_API_KEY to enable AI."}
          </p>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden bg-slate-50 p-8">{children}</main>
    </div>
  );
}

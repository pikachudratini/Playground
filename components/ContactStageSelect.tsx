"use client";

import { useTransition } from "react";
import { setContactStageAction } from "@/app/admin/actions";
import type { ContactStage } from "@/lib/types";

const STAGES: ContactStage[] = ["new", "qualified", "nurture", "won", "lost"];

export default function ContactStageSelect({
  id,
  stage,
}: {
  id: string;
  stage: ContactStage;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={stage}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as ContactStage;
        startTransition(async () => {
          await setContactStageAction(id, next);
        });
      }}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold capitalize disabled:opacity-50"
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

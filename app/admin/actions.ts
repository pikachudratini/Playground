"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createFunnel,
  createPersona,
  setContactStage,
  setFunnelStatus,
} from "@/lib/repo";
import type { ContactStage } from "@/lib/types";

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createFunnelAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const funnel = createFunnel({
    name,
    goal: String(formData.get("goal") ?? ""),
    audience: String(formData.get("audience") ?? ""),
  });
  revalidatePath("/admin");
  revalidatePath("/admin/funnels");
  redirect(`/admin/funnels/${funnel.id}`);
}

export async function createPersonaAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const funnelId = String(formData.get("funnelId") ?? "").trim();
  createPersona({
    funnelId: funnelId || null,
    name,
    description: String(formData.get("description") ?? ""),
    traits: {
      pains: splitList(String(formData.get("pains") ?? "")),
      goals: splitList(String(formData.get("goals") ?? "")),
      tone: String(formData.get("tone") ?? "").trim(),
      channel: String(formData.get("channel") ?? "").trim(),
    },
  });
  revalidatePath("/admin/personas");
  redirect("/admin/personas");
}

export async function setFunnelStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "draft" | "live";
  if (!id || (status !== "draft" && status !== "live")) return;
  setFunnelStatus(id, status);
  revalidatePath("/admin");
  revalidatePath("/admin/funnels");
  revalidatePath(`/admin/funnels/${id}`);
}

export async function setContactStageAction(
  id: string,
  stage: ContactStage,
): Promise<void> {
  setContactStage(id, stage);
  revalidatePath("/admin/contacts");
  revalidatePath("/admin");
}

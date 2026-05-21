import { addEvent } from "@/lib/repo";
import type { EventType } from "@/lib/types";

const ALLOWED: EventType[] = ["scroll", "cta_click"];

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      visitorId?: unknown;
      funnelId?: unknown;
      pageId?: unknown;
      type?: unknown;
    };
    const { visitorId, funnelId, pageId, type } = body;

    if (typeof visitorId !== "string" || typeof funnelId !== "string") {
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    if (typeof type !== "string" || !ALLOWED.includes(type as EventType)) {
      return Response.json({ error: "bad event type" }, { status: 400 });
    }

    addEvent({
      visitorId,
      funnelId,
      pageId: typeof pageId === "string" ? pageId : null,
      type: type as EventType,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "server error" }, { status: 500 });
  }
}

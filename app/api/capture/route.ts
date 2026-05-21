import { qualifyContact } from "@/lib/agent";
import {
  addEvent,
  createContact,
  eventsForVisitor,
  getFunnel,
  getPersona,
  getVisitor,
} from "@/lib/repo";

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      visitorId?: unknown;
      funnelId?: unknown;
      pageId?: unknown;
      name?: unknown;
      email?: unknown;
      fields?: unknown;
    };

    const funnelId = typeof body.funnelId === "string" ? body.funnelId : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!funnelId || !email.includes("@")) {
      return Response.json({ error: "bad request" }, { status: 400 });
    }

    const funnel = getFunnel(funnelId);
    if (!funnel) {
      return Response.json({ error: "unknown funnel" }, { status: 404 });
    }

    const visitorId =
      typeof body.visitorId === "string" ? body.visitorId : null;
    const pageId = typeof body.pageId === "string" ? body.pageId : null;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const fields =
      body.fields && typeof body.fields === "object"
        ? (body.fields as Record<string, string>)
        : {};

    const visitor = visitorId ? getVisitor(visitorId) : null;
    const events = visitorId ? eventsForVisitor(visitorId) : [];
    const personaId = visitor?.profile?.matchedPersonaId ?? null;
    const persona = personaId ? getPersona(personaId) : null;

    if (visitorId) {
      addEvent({ visitorId, funnelId, pageId, type: "form_submit" });
    }

    const qualification = await qualifyContact({
      funnel,
      name,
      email,
      fields,
      visitor,
      events,
      persona,
    });

    const contact = createContact({
      visitorId,
      funnelId,
      name,
      email,
      fields,
      personaId,
      leadScore: qualification.leadScore,
      stage: qualification.stage,
      qualification: qualification.qualification,
      nextStep: qualification.nextStep,
    });

    return Response.json({ ok: true, contactId: contact.id });
  } catch {
    return Response.json({ error: "server error" }, { status: 500 });
  }
}

import { runAgentChat, type ChatTurn } from "@/lib/agent";

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { history?: unknown };
    const raw = Array.isArray(body.history) ? body.history : [];

    const history: ChatTurn[] = raw
      .filter(
        (m): m is ChatTurn =>
          !!m &&
          typeof m === "object" &&
          (m as ChatTurn).role !== undefined &&
          ((m as ChatTurn).role === "user" ||
            (m as ChatTurn).role === "assistant") &&
          typeof (m as ChatTurn).content === "string",
      )
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-20);

    if (history.length === 0) {
      return Response.json({ reply: "Ask me something.", actions: [] });
    }

    const result = await runAgentChat(history);
    return Response.json(result);
  } catch {
    return Response.json(
      { reply: "The agent hit a server error.", actions: [] },
      { status: 500 },
    );
  }
}

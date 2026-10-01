import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import { agentAvailable } from "@/server/agent/config";
import { runAgentTurn, type AgentEvent } from "@/server/agent/run";

// Tool-heavy turns can take a while; streaming keeps the connection busy.
export const maxDuration = 300;

const bodySchema = z.object({
  threadId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(8000),
  context: z
    .object({
      path: z.string().max(300).optional(),
      record: z.object({ type: z.string().max(40), id: z.string().uuid(), title: z.string().max(300).optional() }).nullable().optional(),
    })
    .default({}),
});

/** Ask Lantana: one user message in, a stream of AgentEvents out (SSE). */
export async function POST(request: Request) {
  const session = await getSession();
  // Data-room guests never reach the agent, even though RLS would show it nothing.
  if (session.role === "external") return Response.json({ error: "Not found" }, { status: 404 });
  if (!agentAvailable()) {
    return Response.json({ error: "Ask Lantana needs an Anthropic API key. Add ANTHROPIC_API_KEY to the server environment." }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const db = await createClient();
  const { data: auth } = await db.auth.getSession();
  const accessToken = auth.session?.access_token ?? null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // client went away
        }
      };
      try {
        await runAgentTurn({
          db,
          session,
          accessToken,
          threadId: parsed.data.threadId ?? null,
          text: parsed.data.message,
          context: parsed.data.context,
          emit,
          signal: request.signal,
        });
      } catch (e) {
        console.error("agent turn failed", e);
        emit({ type: "error", message: "Something went wrong. Your message was saved; try again." });
        emit({ type: "done" });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

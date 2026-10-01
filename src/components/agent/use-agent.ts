"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentEvent } from "@/server/agent/run";
import type { ChatItem, Part, ProposalView } from "@/server/agent/view-types";
import { getThreadAction } from "@/server/actions/agent";

export type AgentContext = { path?: string; record?: { type: string; id: string; title?: string } | null };

/**
 * Client state for one conversation: sends a message to /api/agent and folds
 * the streamed events into the assistant's reply as they arrive.
 */
export function useAgent(onThread?: (id: string, title: string) => void) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const patchLast = useCallback((fn: (parts: Part[]) => Part[]) => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { role: "assistant", parts: fn(last.parts) }];
    });
  }, []);

  const apply = useCallback(
    (e: AgentEvent) => {
      switch (e.type) {
        case "thread":
          setThreadId(e.id);
          onThread?.(e.id, e.title);
          break;
        case "text":
          patchLast((parts) => {
            const last = parts[parts.length - 1];
            if (last?.kind === "text") return [...parts.slice(0, -1), { kind: "text", text: last.text + e.delta }];
            return [...parts, { kind: "text", text: e.delta }];
          });
          break;
        case "tool":
          patchLast((parts) => {
            const i = parts.findIndex((p) => p.kind === "tool" && p.id === e.id);
            const part: Part = { kind: "tool", id: e.id, name: e.name, label: e.label, status: e.status, detail: e.detail };
            return i >= 0 ? parts.map((p, j) => (j === i ? part : p)) : [...parts, part];
          });
          break;
        case "proposal":
          patchLast((parts) => [...parts, { kind: "proposal", action: e.action as ProposalView }]);
          break;
        case "draft":
          patchLast((parts) => [...parts, { kind: "draft", to: e.to, subject: e.subject, body: e.body }]);
          break;
        case "error":
          setError(e.message);
          break;
      }
    },
    [onThread, patchLast],
  );

  const send = useCallback(
    async (text: string, context: AgentContext) => {
      const message = text.trim();
      if (!message || streaming) return;
      setError(null);
      setStreaming(true);
      setItems((prev) => [...prev, { role: "user", text: message }, { role: "assistant", parts: [] }]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, message, context }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => null);
          setError(j?.error ?? "Ask Lantana is unavailable right now.");
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buf.indexOf("\n\n")) >= 0) {
            const line = buf.slice(0, cut).trim();
            buf = buf.slice(cut + 2);
            if (line.startsWith("data: ")) apply(JSON.parse(line.slice(6)) as AgentEvent);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Lost the connection. Your message was saved; try again.");
      } finally {
        setStreaming(false);
        abort.current = null;
        // Drop an assistant bubble that never got content (e.g. an immediate error).
        setItems((prev) => {
          const last = prev[prev.length - 1];
          return last?.role === "assistant" && last.parts.length === 0 ? prev.slice(0, -1) : prev;
        });
      }
    },
    [apply, streaming, threadId],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const load = useCallback(async (id: string | null) => {
    abort.current?.abort();
    setError(null);
    if (!id) {
      setThreadId(null);
      setItems([]);
      return;
    }
    const view = await getThreadAction(id);
    if (!view) {
      setError("That conversation isn't available.");
      return;
    }
    setThreadId(view.thread.id);
    setItems(view.items);
  }, []);

  const updateAction = useCallback((action: ProposalView) => {
    setItems((prev) =>
      prev.map((it) => (it.role === "assistant" ? { ...it, parts: it.parts.map((p) => (p.kind === "proposal" && p.action.id === action.id ? { ...p, action } : p)) } : it)),
    );
  }, []);

  return { threadId, items, streaming, error, send, stop, load, updateAction, setError };
}

/** What the agent should know about the page the user is on. */
export function contextFrom(pathname: string, search: URLSearchParams): AgentContext {
  const m = pathname.match(/^\/(deals|partners|contracts|documents)\/([0-9a-f-]{36})$/);
  const typeOf = { deals: "deal", partners: "organization", contracts: "contract", documents: "document" } as const;
  let record: AgentContext["record"] = m ? { type: typeOf[m[1] as keyof typeof typeOf], id: m[2] } : null;
  const rec = search.get("record")?.match(/^([a-z_]+):([0-9a-f-]{36})$/);
  if (rec) record = { type: rec[1], id: rec[2] };
  const task = search.get("task");
  if (task && /^[0-9a-f-]{36}$/.test(task)) record = { type: "task", id: task };
  return { path: pathname, record };
}

// Shapes shared by the agent UI (client) and the server that builds them.

export type ProposalView = {
  id: string;
  tool_use_id: string | null;
  tool: string;
  summary: string;
  preview: Record<string, unknown>;
  status: "proposed" | "executed" | "rejected" | "failed" | "expired";
  result: { href?: string; message?: string } | null;
  error: string | null;
  created_at: string;
};

export type Part =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; label: string; status: "running" | "done" | "error"; detail?: string }
  | { kind: "proposal"; action: ProposalView }
  | { kind: "draft"; to: string; subject: string; body: string };

export type ChatItem = { role: "user"; text: string } | { role: "assistant"; parts: Part[] };

export type ThreadSummary = {
  id: string;
  title: string;
  pinned: boolean;
  entity_type: string | null;
  entity_id: string | null;
  updated_at: string;
};

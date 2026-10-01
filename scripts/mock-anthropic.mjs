// A scripted stand-in for the Anthropic Messages API (streaming), for e2e tests
// that must run without an API key. Point the app at it with
//   ANTHROPIC_BASE_URL=http://127.0.0.1:4010 ANTHROPIC_API_KEY=test
// It picks a tool from keywords in the user's question, then answers from the
// tool result. GET /__requests returns what the app sent (headers + key fields).
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010);
const requests = [];
let n = 0;

const lastUserText = (messages) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
    const texts = blocks.filter((b) => b.type === "text" && !b.text.startsWith("<context>") && !b.text.startsWith("<decisions>"));
    if (texts.length) return texts[texts.length - 1].text;
  }
  return "";
};
const lastToolResults = (messages) => {
  const m = messages[messages.length - 1];
  if (!m || m.role !== "user" || typeof m.content === "string") return [];
  return m.content.filter((b) => b.type === "tool_result");
};

function plan(body) {
  const sys = JSON.stringify(body.system ?? "");
  // Clause review: structured JSON output.
  if (body.output_config?.format) {
    return {
      text: JSON.stringify({
        summary: "Two material departures. Fix the dispute forum first.",
        findings: [
          { clause: "8. Governing law", severity: "high", issue: "Names DIFC-LCIA arbitration, a centre abolished in 2021.", their_text: "DIFC-LCIA arbitration", lantana_standard: "DIAC arbitration seated in Dubai", suggestion: "Replace with DIAC." },
          { clause: "3. Fees", severity: "medium", issue: "Fee payable 60 days after close instead of 10 business days.", their_text: "within 60 days", lantana_standard: "within 10 business days", suggestion: "Ask for 10 business days." },
        ],
      }),
    };
  }
  if (sys.includes("morning briefing")) {
    return { text: "**Good morning.** Three things today:\n\n1. Give notice on the Faminas mandate before 13 Oct if you don't want it to renew.\n2. Two tasks are overdue.\n3. The Morogoro deal hasn't moved in 15 days." };
  }
  const results = lastToolResults(body.messages);
  if (results.length) {
    const first = results[0];
    const content = typeof first.content === "string" ? first.content : JSON.stringify(first.content);
    if (first.is_error) return { text: `That didn't work: ${content}` };
    if (content.includes("proposal_id")) return { text: "I've proposed that. Confirm it on the card below." };
    if (content.includes("The draft is shown")) return { text: "Here's a draft you can copy." };
    try {
      const data = JSON.parse(content);
      const rows = Array.isArray(data) ? data : (data.stages ?? data.results ?? []);
      const lines = rows.slice(0, 3).map((r) => (r.href ? `- [${r.title ?? r.name ?? r.stage}](${r.href})` : `- ${r.title ?? r.name ?? r.stage}: ${r.deals ?? ""}`));
      return { text: `Here's what I found:\n\n${lines.join("\n") || "Nothing matched."}` };
    } catch {
      return { text: "Done." };
    }
  }
  const q = lastUserText(body.messages).toLowerCase();
  if (q.includes("pipeline")) return { tool: { name: "pipeline_summary", input: {} } };
  if (q.includes("remind") || q.includes("create a task")) {
    const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    return { text: "I'll set that up.", tool: { name: "create_task", input: { title: "Call PJM Advisory about the fee agreement", due_date: due, priority: "high" } } };
  }
  if (q.includes("draft")) return { tool: { name: "draft_email", input: { to: "Patrick Muwowo <patrick@pjm.example>", subject: "Fee agreement for Morogoro", body: "Dear Patrick,\n\nFollowing our call, could we agree the fee for the Morogoro project this week?\n\nBest regards,\nMaimouna" } } };
  const find = q.match(/(?:find|search(?: for)?|look up)\s+(.+?)[?.]?$/);
  if (find) return { tool: { name: "search_records", input: { query: find[1] } } };
  if (q.includes("ignore previous")) return { text: "I can't do that." };
  return { text: "Hello from the test model. Ask me about the pipeline, to find something, to draft an email, or to remind you to do something." };
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function stream(res, body, p) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "request-id": `req_mock_${n}` });
  const id = `msg_mock_${++n}`;
  sse(res, "message_start", {
    type: "message_start",
    message: { id, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 } },
  });
  let index = 0;
  if (p.text) {
    sse(res, "content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } });
    for (const piece of p.text.match(/.{1,24}/gs) ?? []) {
      sse(res, "content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text: piece } });
      await new Promise((r) => setTimeout(r, 15));
    }
    sse(res, "content_block_stop", { type: "content_block_stop", index });
    index++;
  }
  if (p.tool) {
    sse(res, "content_block_start", { type: "content_block_start", index, content_block: { type: "tool_use", id: `toolu_mock_${n}`, name: p.tool.name, input: {} } });
    const json = JSON.stringify(p.tool.input);
    for (const piece of json.match(/.{1,20}/gs) ?? []) sse(res, "content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: piece } });
    sse(res, "content_block_stop", { type: "content_block_stop", index });
  }
  sse(res, "message_delta", { type: "message_delta", delta: { stop_reason: p.tool ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 80 } });
  sse(res, "message_stop", { type: "message_stop" });
  res.end();
}

createServer((req, res) => {
  if (req.method === "GET" && req.url?.startsWith("/__requests")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(requests));
  }
  if (req.method === "DELETE" && req.url?.startsWith("/__requests")) {
    requests.length = 0;
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== "POST" || !req.url?.includes("/v1/messages")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "mock: unknown route" } }));
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    requests.push({
      beta: req.headers["anthropic-beta"] ?? null,
      model: body.model,
      fallbacks: body.fallbacks ?? null,
      cache_control: body.cache_control ?? null,
      system_cached: Array.isArray(body.system) && Boolean(body.system[0]?.cache_control),
      tools: (body.tools ?? []).map((t) => t.name),
      messages: body.messages?.length ?? 0,
      structured: Boolean(body.output_config?.format),
    });
    stream(res, body, plan(body)).catch((e) => {
      console.error(e);
      res.end();
    });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`mock Anthropic API on http://127.0.0.1:${PORT}`));

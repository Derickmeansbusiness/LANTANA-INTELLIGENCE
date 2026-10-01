import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { echoable, mergeRoles, toolUsesOf } from "./run";
import { redact } from "./redact";
import { TOOLS, apiTools } from "./tools";
import type { SessionContext } from "@/server/session";

const session = (role: "principal" | "manager" | "staff"): SessionContext => ({
  userId: "u",
  email: "x@y",
  fullName: "Test",
  title: null,
  role,
  aal: "aal2",
  requirePrincipalMfa: true,
  isPrincipal: role === "principal",
  isManagerPlus: role !== "staff",
});

describe("fallback echo rule", () => {
  const content = [
    { type: "thinking", thinking: "x", signature: "s" },
    { type: "text", text: "partial " },
    { type: "tool_use", id: "t1", name: "search_records", input: {} },
    { type: "fallback" },
    { type: "text", text: "rest" },
    { type: "tool_use", id: "t2", name: "list_deals", input: {} },
  ] as unknown as Anthropic.Beta.BetaContentBlockParam[];

  it("keeps only text before the last fallback marker and everything after", () => {
    expect(echoable(content).map((b) => b.type)).toEqual(["text", "text", "tool_use"]);
  });
  it("runs only the tool calls made after the marker", () => {
    expect(toolUsesOf(content as unknown as Anthropic.Beta.BetaContentBlock[]).map((b) => b.id)).toEqual(["t2"]);
  });
  it("leaves ordinary turns untouched, thinking included", () => {
    const plain = content.slice(0, 3);
    expect(echoable(plain)).toBe(plain);
  });
});

describe("history", () => {
  it("merges consecutive turns from the same role", () => {
    const out = mergeRoles([
      { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "x" }] },
      { role: "user", content: "next question" },
      { role: "assistant", content: [{ type: "text", text: "ok" }] },
    ]);
    expect(out).toHaveLength(2);
    expect((out[0].content as unknown[]).length).toBe(2);
  });
});

describe("redaction", () => {
  const row = { name: "Emirates NBD", iban: "AE07…", nested: [{ salary: 1, title: "x" }] };
  it("strips sensitive fields for non-principals, at any depth", () => {
    expect(redact(row, false)).toEqual({ name: "Emirates NBD", nested: [{ title: "x" }] });
  });
  it("leaves principals' data alone", () => {
    expect(redact(row, true)).toBe(row);
  });
});

describe("tool registry", () => {
  it("has unique names and no delete tool", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((n) => /delete|remove|send/.test(n))).toBe(false);
  });
  it("produces object JSON schemas without a $schema key", () => {
    for (const t of apiTools(session("principal"))) {
      expect(t.input_schema.type).toBe("object");
      expect("$schema" in t.input_schema).toBe(false);
    }
  });
  it("hides manager-only tools from staff", () => {
    const staff = apiTools(session("staff")).map((t) => t.name);
    expect(staff).not.toContain("list_contracts");
    expect(staff).not.toContain("compare_contract_to_template");
    expect(apiTools(session("manager")).map((t) => t.name)).toContain("list_contracts");
  });
  it("keeps tool order stable so the prompt prefix caches", () => {
    expect(JSON.stringify(apiTools(session("manager")))).toBe(JSON.stringify(apiTools(session("manager"))));
  });
});

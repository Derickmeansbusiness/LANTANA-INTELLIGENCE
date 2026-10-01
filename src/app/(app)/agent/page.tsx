import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { agentAvailable } from "@/server/agent/config";
import { listThreads } from "@/server/agent/threads";
import { AgentWorkspace } from "@/components/agent/agent-workspace";

export const metadata: Metadata = { title: "Ask Lantana" };

export default async function AgentPage() {
  const threads = await listThreads(await createClient());
  return (
    <Suspense>
      <AgentWorkspace threads={threads} enabled={agentAvailable()} />
    </Suspense>
  );
}

import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getSession } from "@/server/session";
import { agentAvailable } from "@/server/agent/config";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const s = await getSession();
  // Data-room guests have their own portal and never see the internal app.
  if (s.role === "external") redirect("/portal");
  return (
    <AppShell
      agentEnabled={agentAvailable()}
      user={{
        id: s.userId,
        fullName: s.fullName,
        title: s.title,
        email: s.email,
        role: s.role,
        isPrincipal: s.isPrincipal,
        mfaPending: s.role === "principal" && !s.isPrincipal,
      }}
    >
      {children}
    </AppShell>
  );
}

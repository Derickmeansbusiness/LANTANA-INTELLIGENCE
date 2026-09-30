import { AppShell } from "@/components/shell/app-shell";
import { getSession } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const s = await getSession();
  return (
    <AppShell
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

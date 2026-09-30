import type { Metadata } from "next";
import { BrandMark, Wordmark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const devLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark className="size-9" />
          <Wordmark />
        </div>
        <div className="rounded-lg border bg-surface p-6">
          <h1 className="font-display text-2xl">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Access is by invitation from a principal.</p>
          {error === "link" && (
            <p role="alert" className="mb-4 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">
              That sign-in link has expired or was already used. Request a new one.
            </p>
          )}
          {error === "inactive" && (
            <p role="alert" className="mb-4 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">
              This account is deactivated. Ask a principal to restore access.
            </p>
          )}
          <LoginForm next={next} devLogin={devLogin} />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Lantana Vision FZ-LLC · Ras Al Khaimah, UAE</p>
      </div>
    </main>
  );
}

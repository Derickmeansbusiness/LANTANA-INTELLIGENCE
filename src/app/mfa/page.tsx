import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark, Wordmark } from "@/components/brand-mark";
import { getSessionAllowMfaPending, needsMfa } from "@/server/session";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-factor check" };

export default async function MfaPage() {
  const session = await getSessionAllowMfaPending();
  if (!needsMfa(session)) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark className="size-9" />
          <Wordmark />
        </div>
        <div className="rounded-lg border bg-surface p-6">
          <h1 className="font-display text-2xl">Two-factor check</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Principal accounts can see payroll and bank data, so they need an authenticator code on top of the email sign-in.
          </p>
          <MfaForm />
        </div>
      </div>
    </main>
  );
}

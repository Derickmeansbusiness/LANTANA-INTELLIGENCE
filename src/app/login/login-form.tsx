"use client";

import { useActionState, useState } from "react";
import { Loader2Icon, MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, signInWithPassword, type LoginState } from "./actions";

export function LoginForm({ next, devLogin }: { next: string; devLogin: boolean }) {
  const [mode, setMode] = useState<"link" | "password">(devLogin ? "password" : "link");
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(sendMagicLink, undefined);
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(signInWithPassword, undefined);

  if (mode === "link" && linkState?.sent) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <MailIcon className="size-4 text-gold" /> Check your inbox
        </div>
        <p className="text-muted-foreground">
          If <span className="text-foreground">{linkState.sent}</span> has access, a sign-in link is on its way. It expires in one hour.
        </p>
        <Button variant="link" className="h-auto p-0" onClick={() => location.reload()}>
          Use a different email
        </Button>
      </div>
    );
  }

  const state = mode === "link" ? linkState : pwState;
  const pending = mode === "link" ? linkPending : pwPending;

  return (
    <form action={mode === "link" ? linkAction : pwAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="you@lantanavision.com" />
      </div>
      {mode === "password" && (
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {mode === "link" ? "Email me a sign-in link" : "Sign in"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "link" ? "password" : "link")}
        className="w-full cursor-pointer text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {mode === "link" ? "Sign in with a password instead" : "Email me a link instead"}
      </button>
      {devLogin && (
        <p className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
          Local test accounts: maimouna@, fai@, manager@, staff@, guest@lantana.test · password <span className="num text-foreground">lantana-dev-2026</span>
        </p>
      )}
    </form>
  );
}

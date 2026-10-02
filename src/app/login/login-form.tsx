"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword, type LoginState } from "./actions";

/** Email and password only. Email sign-in links are switched off for now (no mail sender configured). */
export function LoginForm({ next, devLogin }: { next: string; devLogin: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithPassword, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus placeholder="you@lantanavision.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        Sign in
      </Button>
      {devLogin && (
        <p className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
          Local test accounts: maimouna@, fai@, manager@, staff@, guest@lantana.test · password <span className="num text-foreground">lantana-dev-2026</span>
        </p>
      )}
    </form>
  );
}

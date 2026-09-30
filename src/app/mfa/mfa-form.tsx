"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/app/login/actions";

type Stage =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "error"; message: string };

export function MfaForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setStage({ kind: "error", message: error.message });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setStage({ kind: "verify", factorId: verified.id });
      // Clear abandoned enrolments before starting a fresh one.
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Lantana Command ${Date.now()}` });
      if (enrolled.error) return setStage({ kind: "error", message: enrolled.error.message });
      setStage({ kind: "enroll", factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (stage.kind !== "enroll" && stage.kind !== "verify") return;
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: stage.factorId, code: code.trim() });
    setPending(false);
    if (error) return setError("That code didn't work. Codes change every 30 seconds; try the current one.");
    router.replace("/");
    router.refresh();
  }

  if (stage.kind === "loading") return <Skeleton className="h-40 w-full" />;
  if (stage.kind === "error") return <p className="text-sm text-danger">{stage.message}</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {stage.kind === "enroll" && (
        <div className="space-y-3 text-sm">
          <p>Scan this with Google Authenticator, 1Password, Authy or similar.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stage.qr} alt="TOTP QR code" className="mx-auto size-44 rounded-md bg-white p-2" />
          <p className="text-xs text-muted-foreground">
            Can&apos;t scan? Enter this key: <span className="num break-all text-foreground">{stage.secret}</span>
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="code">6-digit code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="num text-center text-lg tracking-[0.4em]"
          autoFocus
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
        {pending && <Loader2Icon className="animate-spin" />}
        Verify
      </Button>
      <button type="button" onClick={() => signOut()} className="w-full cursor-pointer text-center text-xs text-muted-foreground hover:text-foreground">
        Sign out
      </button>
    </form>
  );
}

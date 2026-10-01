"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { fmtDate } from "@/lib/dates";
import { createInviteAction, revokeInviteAction } from "@/server/actions/data-rooms";
import { setUserRoleAction } from "@/server/actions/settings";

type Role = "principal" | "manager" | "staff" | "external";
type Person = { id: string; full_name: string; email: string; title: string | null; role: Role; is_active: boolean };
type Invite = { id: string; email: string; role: string; full_name: string | null; note: string | null; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; by: { full_name: string } | null };

const ROLE_TONE = { principal: "gold", manager: "info", staff: "default", external: "outline" } as const;
const ROLE_HELP: Record<Role, string> = {
  principal: "Everything, including payroll and cash (with two-step sign-in).",
  manager: "Deals, contracts, finance, reports and data rooms. No payroll or cash.",
  staff: "Their deals, tasks, documents and the directory.",
  external: "Only the data rooms they're added to, through the guest portal.",
};

export function PeopleAccess({ people, me, canChangeRoles }: { people: Person[]; me: string; canChangeRoles: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y">
      {people.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate">{p.full_name}</span>
            <span className="block truncate text-xs text-muted-foreground">{p.title ?? p.email}</span>
          </span>
          {canChangeRoles && p.id !== me ? (
            <NativeSelect
              aria-label={`Role for ${p.full_name}`}
              value={p.role}
              disabled={pending}
              className="h-8 w-32 text-xs"
              onChange={(e) => {
                const role = e.target.value as Role;
                if (!confirm(`Make ${p.full_name} ${role === "external" ? "an external guest" : `a ${role}`}? ${ROLE_HELP[role]}`)) return;
                start(async () => {
                  const r = await setUserRoleAction(p.id, role);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Role changed");
                  router.refresh();
                });
              }}
            >
              {(["principal", "manager", "staff", "external"] as const).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Badge variant={ROLE_TONE[p.role]}>{p.role}</Badge>
          )}
          {!p.is_active && <Badge variant="danger">Deactivated</Badge>}
        </li>
      ))}
    </ul>
  );
}

export function Invites({ invites, isPrincipal }: { invites: Invite[]; isPrincipal: boolean }) {
  const router = useRouter();
  const roles: Role[] = isPrincipal ? ["staff", "manager", "principal", "external"] : ["external"];
  const [v, setV] = useState({ email: "", full_name: "", title: "", role: roles[0] as Role });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const now = new Date().toISOString();
  const open = invites.filter((i) => !i.accepted_at && !i.revoked_at && i.expires_at > now);
  const past = invites.filter((i) => !open.includes(i)).slice(0, 10);

  return (
    <div className="space-y-5">
      <form
        noValidate
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createInviteAction(v);
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              return void toast.error(r.error);
            }
            setErrors({});
            setV({ email: "", full_name: "", title: "", role: roles[0] });
            toast.success("Invite created. They can now sign in with a one-time email link.");
            router.refresh();
          });
        }}
      >
        <FormField label="Email" htmlFor="inv-email" error={errors.email}>
          <Input id="inv-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </FormField>
        <FormField label="Role" htmlFor="inv-role" error={errors.role} hint={ROLE_HELP[v.role]}>
          <NativeSelect id="inv-role" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Full name" htmlFor="inv-name">
          <Input id="inv-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
        </FormField>
        <FormField label="Job title" htmlFor="inv-title">
          <Input id="inv-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </FormField>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="text-xs text-muted-foreground">Invites last 14 days. Nothing is emailed by the app: tell them to sign in at the login page with this address.</p>
          <Button type="submit" size="sm" disabled={pending}>
            <MailPlusIcon /> Invite
          </Button>
        </div>
      </form>

      {open.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-muted-foreground uppercase">Waiting to sign in</h4>
          <ul className="divide-y">
            {open.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{i.full_name ?? i.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {i.email} · {i.note ?? `invited by ${i.by?.full_name ?? "—"}`} · <span className="num">until {fmtDate(i.expires_at.slice(0, 10))}</span>
                  </span>
                </span>
                <Badge variant={ROLE_TONE[i.role as Role] ?? "outline"}>{i.role}</Badge>
                {(isPrincipal || i.role === "external") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      start(async () => {
                        const r = await revokeInviteAction(i.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Invite revoked");
                        router.refresh();
                      })
                    }
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {past.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">Earlier invites</summary>
          <ul className="mt-1 divide-y">
            {past.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-1.5 text-xs text-muted-foreground">
                <span className="truncate">
                  {i.email} · {i.role}
                </span>
                <span>{i.accepted_at ? `joined ${fmtDate(i.accepted_at.slice(0, 10))}` : i.revoked_at ? "revoked" : "expired"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getRecordPreview } from "@/server/actions/records";
import type { RecordPreview } from "@/server/records-shared";

/**
 * Opens whenever the URL carries ?record=<type>:<uuid>, so any list, search
 * result or attention item can link to a record and the link is shareable.
 */
export function RecordSheet() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const param = sp.get("record");
  const [type, id] = param?.split(":") ?? [];
  // Keyed by the URL param so a new record shows the skeleton, not the old one.
  const [loaded, setLoaded] = useState<{ key: string; record: RecordPreview | "missing" } | null>(null);
  const record = loaded && loaded.key === param ? loaded.record : null;

  useEffect(() => {
    if (!type || !id || !param) return;
    let cancelled = false;
    getRecordPreview(type, id).then((r) => !cancelled && setLoaded({ key: param, record: r ?? "missing" }));
    return () => {
      cancelled = true;
    };
  }, [type, id, param]);

  function close() {
    const params = new URLSearchParams(sp.toString());
    params.delete("record");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <Sheet open={Boolean(param)} onOpenChange={(o) => !o && close()}>
      <SheetContent className="sm:max-w-lg">
        {record === null && (
          <div className="space-y-3 p-6">
            <SheetTitle className="sr-only">Loading record</SheetTitle>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {record === "missing" && (
          <div className="p-6">
            <SheetTitle>Not available</SheetTitle>
            <SheetDescription className="mt-2">This record doesn&apos;t exist or you don&apos;t have access to it.</SheetDescription>
          </div>
        )}
        {record && record !== "missing" && (
          <div className="flex-1 overflow-y-auto">
            <div className="border-b p-6 pr-12">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">{record.kicker}</p>
              <SheetTitle className="mt-1 text-xl">{record.title}</SheetTitle>
              <SheetDescription className="sr-only">Record details</SheetDescription>
              {record.badges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {record.badges.map((b) => (
                    <Badge key={b.label} variant={b.tone ?? "default"}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-6 sm:grid-cols-2">
              {record.fields.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="num mt-0.5 text-sm break-words">{f.value}</dd>
                </div>
              ))}
            </dl>
            {record.notes && (
              <div className="border-t px-6 py-4">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm leading-relaxed">{record.notes}</p>
              </div>
            )}
            {record.lists
              ?.filter((l) => l.items.length > 0)
              .map((l) => (
                <div key={l.heading} className="border-t px-6 py-4">
                  <p className="text-xs text-muted-foreground">{l.heading}</p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {l.items.map((it, i) => (
                      <li key={i} className="num">
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            <p className="border-t px-6 py-4 text-xs text-muted-foreground">
              Read-only preview. Editing and the full record page arrive in Phase {record.fullPagePhase}.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

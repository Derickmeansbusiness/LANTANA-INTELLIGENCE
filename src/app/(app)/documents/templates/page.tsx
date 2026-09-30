import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, FileSignatureIcon, LockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { TEMPLATES } from "@/lib/templates/catalog";
import { label } from "@/lib/schemas/common";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const session = await getSession();
  return (
    <div className="mx-auto max-w-[1100px]">
      <Link href="/documents" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Documents
      </Link>
      <PageHeader
        className="mt-2"
        title="Templates"
        description="Standard Lantana documents on letterhead, as PDF or Word. Each one is saved to the vault as a draft for counsel to review before signature."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const blocked = t.unavailable ?? (t.managerOnly && !session.isManagerPlus ? "Managers and principals only." : null);
          const body = (
            <Card className={blocked ? "h-full opacity-70" : "h-full transition-colors hover:border-gold/60"}>
              <CardContent className="flex h-full flex-col gap-2 pt-4">
                <div className="flex items-center gap-2">
                  {blocked ? <LockIcon className="size-4 text-muted-foreground" /> : <FileSignatureIcon className="size-4 text-gold" />}
                  <h2 className="font-medium">{t.name}</h2>
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{t.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{label(t.docType)}</Badge>
                  <Badge variant="outline">{label(t.confidentiality)}</Badge>
                </div>
                {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
              </CardContent>
            </Card>
          );
          return blocked ? (
            <div key={t.id}>{body}</div>
          ) : (
            <Link key={t.id} href={`/documents/templates/${t.id}`} aria-label={`Use the ${t.name} template`}>
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

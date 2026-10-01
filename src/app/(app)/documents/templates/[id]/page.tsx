import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { templateById } from "@/lib/templates/catalog";
import { getSession } from "@/server/session";
import { linkTargets } from "@/server/documents";
import { templateForm } from "@/server/templates/generate";
import { TemplateForm } from "@/components/documents/template-form";

export async function generateMetadata({ params }: PageProps<"/documents/templates/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: templateById(id)?.name ?? "Template" };
}

export default async function TemplatePage({ params, searchParams }: PageProps<"/documents/templates/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  const db = await createClient();
  const form = await templateForm(db, id, session);
  if (!form) notFound();
  const blocked = form.unavailable ?? (form.managerOnly && !session.isManagerPlus ? "Only a manager or principal can use this template." : null);
  const targets = blocked ? [] : await linkTargets(db);

  return (
    <div className="mx-auto max-w-[900px]">
      <Link href="/documents/templates" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Templates
      </Link>
      <PageHeader className="mt-2" title={form.name} description={form.description} />
      {blocked ? (
        <p className="rounded-lg border bg-surface p-4 text-sm text-muted-foreground">{blocked}</p>
      ) : (
        <TemplateForm
          templateId={form.id}
          // A link may preselect a choice (e.g. ?invoice_id=… from the invoice page), only among the allowed options.
          fields={form.fields.map((f) => {
            const want = typeof sp[f.name] === "string" ? (sp[f.name] as string) : null;
            return want && (!f.options || f.options.some((o) => o.value === want)) ? { ...f, default: want } : f;
          })}
          targets={targets}
        />
      )}
    </div>
  );
}

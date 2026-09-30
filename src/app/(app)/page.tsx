import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { KpiStrip } from "@/components/command-center/kpi-strip";
import { PipelineFunnel } from "@/components/command-center/pipeline-funnel";
import { AttentionQueue } from "@/components/command-center/attention-queue";
import { GeoMap } from "@/components/command-center/geo-map";
import { ActivityFeed } from "@/components/command-center/activity-feed";
import { WeekStrip } from "@/components/command-center/week-strip";
import { BriefingCard } from "@/components/command-center/briefing-card";
import { fmtDate, greeting, resolveRange, todayDubai } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { firstName, getSession } from "@/server/session";
import { getActivity, getAttention, getDealsByCountry, getKpis, getPipeline, getWeek, hasDemoData } from "@/server/command-center";

export const metadata: Metadata = { title: "Command Center" };

export default async function CommandCenterPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const today = todayDubai();
  const range = resolveRange({ from: str(sp.from), to: str(sp.to), range: str(sp.range) }, today);
  const session = await getSession();
  const supabase = await createClient();

  const [kpis, pipeline, attention, countries, activity, week, demo, { data: people }] = await Promise.all([
    getKpis(range.from, range.to),
    getPipeline(),
    getAttention(),
    getDealsByCountry(),
    getActivity(25),
    getWeek(today),
    hasDemoData(),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]));
  const staff = session.role === "staff";

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 sm:space-y-5">
      <PageHeader
        title={`${greeting()}, ${firstName(session.fullName)}`}
        description={
          <span className="num">
            {fmtDate(today, "EEEE d MMMM yyyy")} · Dubai time · figures for {fmtDate(range.from, "d MMM")} – {fmtDate(range.to, "d MMM yyyy")}
          </span>
        }
        actions={
          demo ? (
            <Badge variant="warning" title="Seed data is marked as demo. A principal can remove it under Settings.">
              Demo data
            </Badge>
          ) : null
        }
      />

      {kpis.missing_fx.length > 0 && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          No FX rate for {kpis.missing_fx.join(", ")}. Deals in those currencies are left out of USD totals until a rate is entered.
        </p>
      )}

      <BriefingCard attention={attention} activity={activity} kpis={kpis} week={week.entries} today={today} />

      <KpiStrip kpis={kpis} scopeNote={staff ? "your deals" : undefined} />

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-12 [&>*]:min-w-0">
        <Card className="animate-fade-up xl:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Attention queue</CardTitle>
              <CardDescription>Overdue, expiring, unsigned and unconfirmed, highest priority first.</CardDescription>
            </div>
            <span className="num text-xs text-muted-foreground">{attention.length}</span>
          </CardHeader>
          <CardContent className="max-h-[30rem] overflow-y-auto">
            <AttentionQueue items={attention} limit={50} />
          </CardContent>
        </Card>
        <Card className="animate-fade-up xl:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Pipeline by stage</CardTitle>
              <CardDescription>{staff ? "Deals you're assigned to, in USD." : "Open deals, converted to USD at stored rates."}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PipelineFunnel stages={pipeline} />
          </CardContent>
        </Card>
      </div>

      <Card className="animate-fade-up">
        <CardHeader>
          <div>
            <CardTitle>This week</CardTitle>
            <CardDescription>Meetings, task due dates and contract or compliance deadlines.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <WeekStrip days={week.days} entries={week.entries} today={today} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-12 [&>*]:min-w-0">
        <Card className="animate-fade-up xl:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Where the deals are</CardTitle>
              <CardDescription>Bubble area is proportional to open deal value.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <GeoMap rows={countries} />
          </CardContent>
        </Card>
        <Card className="animate-fade-up xl:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Live across everything you can see.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="max-h-[28rem] overflow-y-auto">
            <ActivityFeed initial={activity} names={names} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

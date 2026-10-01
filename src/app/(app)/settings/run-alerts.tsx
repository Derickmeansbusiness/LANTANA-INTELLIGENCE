"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRingIcon, Loader2Icon, ScanSearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runAlertsNowAction } from "@/server/actions/contracts";
import { runNightlyScanAction } from "@/server/actions/settings";

export function RunAlerts() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runAlertsNowAction();
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.data.sent === 0 ? "Checked. Nothing new is due, so no alerts went out." : `${r.data.sent} alert${r.data.sent === 1 ? "" : "s"} sent.`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <BellRingIcon />} Run expiry alerts now
    </Button>
  );
}

export function RunScan() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runNightlyScanAction();
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.sent === 0 ? "Checked. Nothing new to flag." : `${r.sent} item${r.sent === 1 ? "" : "s"} flagged.`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <ScanSearchIcon />} Run nightly scan now
    </Button>
  );
}

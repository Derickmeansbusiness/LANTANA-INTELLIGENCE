"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "./task-form-dialog";

export function ProjectTaskButton({ projectId, dealId }: { projectId: string; dealId?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Add task
      </Button>
      <TaskFormDialog open={open} onOpenChange={setOpen} initial={{ project_id: projectId, deal_id: dealId ?? "" }} onSaved={() => router.refresh()} />
    </>
  );
}

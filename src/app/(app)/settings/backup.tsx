"use client";

import { useState } from "react";
import { DatabaseBackupIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

export function Backup({ tables }: { tables: readonly string[] }) {
  const [table, setTable] = useState("deals");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button asChild>
        <a href="/settings/export?format=json" download>
          <DatabaseBackupIcon /> Full backup (JSON)
        </a>
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <NativeSelect aria-label="Table to export as CSV" value={table} onChange={(e) => setTable(e.target.value)} className="min-w-0 flex-1 sm:max-w-64">
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </NativeSelect>
        <Button asChild variant="outline">
          <a href={`/settings/export?format=csv&table=${table}`} download>
            <DownloadIcon /> CSV
          </a>
        </Button>
      </div>
    </div>
  );
}

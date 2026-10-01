"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, BookmarkIcon, Columns3Icon, DownloadIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteView, saveView } from "@/server/actions/views";
import { downloadCsv, toCsv } from "./csv";
import type { Facet, SavedView, ViewConfig } from "./types";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string;
    /** Value written to CSV; defaults to the accessor value. */
    csv?: (row: TData) => string | number | null | undefined;
    align?: "right";
    className?: string;
  }
}

/** Facet filter: matches a scalar or any element of an array value. */
const facetFilter: FilterFn<unknown> = (row, columnId, value) => {
  if (!value) return true;
  const v = row.getValue(columnId);
  return Array.isArray(v) ? v.includes(value) : v === value;
};

export function DataTable<T>({
  module,
  columns,
  data,
  facets = [],
  views: initialViews,
  searchPlaceholder = "Search…",
  csvName,
  rowHref,
  defaultSorting = [],
  defaultHidden = [],
  empty,
  toolbarExtra,
  initialSearch = "",
}: {
  module: "deals" | "partners" | "contacts" | "tasks" | "ledger" | "documents" | "contracts" | "finance_ledger" | "invoices" | "bills" | "employees" | "compliance";
  columns: ColumnDef<T, unknown>[];
  data: T[];
  facets?: Facet[];
  views: SavedView[];
  searchPlaceholder?: string;
  csvName: string;
  rowHref?: (row: T) => string;
  defaultSorting?: SortingState;
  defaultHidden?: string[];
  empty: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  initialSearch?: string;
}) {
  const router = useRouter();
  const defaults: ViewConfig = useMemo(
    () => ({ globalFilter: "", columnFilters: [], sorting: defaultSorting, columnVisibility: Object.fromEntries(defaultHidden.map((c) => [c, false])) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(defaults.columnFilters);
  const [sorting, setSorting] = useState<SortingState>(defaults.sorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaults.columnVisibility);
  const [views, setViews] = useState(initialViews);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  // TanStack Table v8 returns unmemoisable functions; fine because the React Compiler is off.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnFilters, sorting, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    filterFns: { facet: facetFilter },
    defaultColumn: { filterFn: facetFilter as FilterFn<T> },
    globalFilterFn: "includesString",
  });

  function apply(c: ViewConfig, id: string | null) {
    setGlobalFilter(c.globalFilter ?? "");
    setColumnFilters(c.columnFilters ?? []);
    setSorting(c.sorting ?? []);
    setColumnVisibility(c.columnVisibility ?? {});
    setActiveView(id);
  }

  function exportCsv() {
    const cols = table.getVisibleLeafColumns().filter((c) => c.id !== "actions");
    const headers = cols.map((c) => c.columnDef.meta?.label ?? c.id);
    const rows = table.getRowModel().rows.map((r) =>
      cols.map((c) => {
        const fn = c.columnDef.meta?.csv;
        const v = fn ? fn(r.original) : r.getValue(c.id);
        return Array.isArray(v) ? v.join("; ") : (v as string | number | null | undefined);
      }),
    );
    downloadCsv(`${csvName}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
  }

  const filtered = globalFilter !== "" || columnFilters.length > 0;
  const rows = table.getRowModel().rows;
  const current = views.find((v) => v.id === activeView);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
            aria-label="Filter rows"
          />
        </div>
        {facets.map((f) => {
          const col = table.getColumn(f.columnId);
          return (
            <NativeSelect
              key={f.columnId}
              aria-label={`Filter by ${f.label}`}
              className="w-auto min-w-32"
              value={(col?.getFilterValue() as string) ?? ""}
              onChange={(e) => col?.setFilterValue(e.target.value || undefined)}
            >
              <option value="">All {f.label.toLowerCase()}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          );
        })}
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => apply({ ...defaults, sorting, columnVisibility }, null)}>
            <XIcon /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {toolbarExtra}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Saved views">
                <BookmarkIcon />
                <span className="hidden max-w-32 truncate sm:inline">{current?.name ?? "Views"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={() => apply(defaults, null)}>Default view</DropdownMenuItem>
              {views.length > 0 && <DropdownMenuSeparator />}
              {views.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => apply(v.config, v.id)} className="justify-between">
                  <span className="truncate">
                    {v.name}
                    {v.shared && <span className="ml-1.5 text-[11px] text-muted-foreground">shared</span>}
                  </span>
                  {v.mine && (
                    <button
                      type="button"
                      aria-label={`Delete view ${v.name}`}
                      className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-danger"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const r = await deleteView(v.id);
                        if (!r.ok) return toast.error(r.error);
                        setViews((vs) => vs.filter((x) => x.id !== v.id));
                        if (activeView === v.id) setActiveView(null);
                      }}
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSaveOpen(true)}>Save current view…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Choose columns">
                <Columns3Icon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={(e) => (e.preventDefault(), c.toggleVisibility())}>
                    <Checkbox checked={c.getIsVisible()} tabIndex={-1} aria-hidden />
                    {c.columnDef.meta?.label ?? c.id}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon-sm" onClick={exportCsv} aria-label="Export CSV" title="Export the rows you see as CSV">
            <DownloadIcon />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-surface-2/60">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const align = h.column.columnDef.meta?.align;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn("px-3 py-2 text-left text-xs font-normal whitespace-nowrap text-muted-foreground", align === "right" && "text-right")}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn("inline-flex cursor-pointer items-center gap-1 hover:text-foreground", align === "right" && "flex-row-reverse")}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUpIcon className="size-3" /> : sorted === "desc" ? <ArrowDownIcon className="size-3" /> : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr
                key={r.id}
                className={cn("transition-colors", rowHref && "cursor-pointer hover:bg-surface-2/50")}
                onClick={(e) => {
                  if (!rowHref) return;
                  if ((e.target as HTMLElement).closest("a,button,input,select,[role=menuitem]")) return;
                  router.push(rowHref(r.original));
                }}
              >
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className={cn("px-3 py-2.5 align-middle", c.column.columnDef.meta?.align === "right" && "num text-right", c.column.columnDef.meta?.className)}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{data.length === 0 ? empty : "No rows match these filters."}</div>}
      </div>
      <p className="num text-xs text-muted-foreground">
        {rows.length} of {data.length} {data.length === 1 ? "row" : "rows"}
      </p>

      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onSave={async (name, shared) => {
          const r = await saveView({ module, name, shared, config: { globalFilter, columnFilters, sorting, columnVisibility } });
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          setViews((vs) => [...vs, r.data].sort((a, b) => a.name.localeCompare(b.name)));
          setActiveView(r.data.id);
          toast.success(`Saved view “${r.data.name}”`);
          return true;
        }}
      />
    </div>
  );
}

function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (name: string, shared: boolean) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && (setName(""), setShared(false)))}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Save view</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              if (await onSave(name, shared)) onOpenChange(false);
            });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tanzania, advanced stages" aria-label="View name" autoFocus maxLength={60} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={shared} onCheckedChange={(v) => setShared(v === true)} /> Share with the team
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

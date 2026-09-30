import type { ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";

export type ViewConfig = {
  globalFilter: string;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  columnVisibility: VisibilityState;
};

export type SavedView = { id: string; name: string; config: ViewConfig; shared: boolean; mine: boolean };

export type Facet = { columnId: string; label: string; options: { value: string; label: string }[] };

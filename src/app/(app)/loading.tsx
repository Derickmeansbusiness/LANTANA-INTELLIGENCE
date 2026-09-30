import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-5" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-80 xl:col-span-7" />
        <Skeleton className="h-80 xl:col-span-5" />
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="p-6 pb-20 md:pb-5 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Lista movil */}
      <div className="md:hidden rounded-lg border border-border divide-y divide-border overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-2 w-2 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>

      {/* Tabla escritorio */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-4 py-3 flex gap-8">
          {[80, 160, 80, 60, 60].map((w, i) => (
            <Skeleton key={i} className={`h-3 w-${w === 80 ? 20 : w === 160 ? 40 : w === 60 ? 16 : 20}`} />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-b border-border last:border-0 px-4 py-3.5 flex items-center gap-8"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex gap-1">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

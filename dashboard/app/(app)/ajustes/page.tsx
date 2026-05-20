import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Ajustes — Clinica Dental" }

export default function AjustesPage() {
  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Ajustes de la clinica</h1>
      <div className="rounded-lg border border-border p-6 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-28 mt-2" />
      </div>
    </div>
  )
}

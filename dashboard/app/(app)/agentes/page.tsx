import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Agentes — Clinica Dental" }

export default function AgentesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agentes</h1>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-4 py-3 grid grid-cols-4 gap-4">
          {["Nombre", "Email", "Rol", "Activo"].map((h) => (
            <Skeleton key={h} className="h-3.5 w-full max-w-[80px]" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-4 py-3 grid grid-cols-4 gap-4 border-b border-border last:border-0">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

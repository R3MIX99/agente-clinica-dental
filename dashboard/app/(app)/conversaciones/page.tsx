import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Conversaciones — Clinica Dental" }

export default function ConversacionesPage() {
  return (
    <div className="flex h-full">
      {/* Panel de lista (izquierdo) */}
      <div className="w-80 shrink-0 border-r border-border bg-background">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <h1 className="text-base font-semibold">Conversaciones</h1>
        </div>
        <div className="space-y-px p-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Panel de hilo (derecho) */}
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <p className="text-sm text-muted-foreground text-center pt-8">
            Selecciona una conversacion para ver el hilo de mensajes.
          </p>
        </div>
      </div>
    </div>
  )
}

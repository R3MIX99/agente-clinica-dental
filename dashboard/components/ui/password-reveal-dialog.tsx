"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Muestra una contraseña temporal recien generada en un campo copiable, una
// sola vez — como una API key. Al cerrar el dialogo ya no se puede volver a
// ver (el backend no la guarda en texto plano).
export function PasswordRevealDialog({
  password,
  onClose,
  email,
  titulo = "Contraseña temporal generada",
}: {
  password: string | null
  onClose: () => void
  email?: string
  titulo?: string
}) {
  return (
    <Dialog open={password !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Cópiala ahora — no se podrá volver a ver después de cerrar esta ventana. Vence en 3
            días si no se cambia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {email && (
            <p className="text-sm">
              <span className="text-muted-foreground">Correo: </span>
              {email}
            </p>
          )}
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
            <code className="flex-1 break-all font-mono text-sm font-medium">{password}</code>
            <button
              type="button"
              onClick={() => {
                if (password) navigator.clipboard.writeText(password)
                toast.success("Contraseña copiada")
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Copiar contraseña"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

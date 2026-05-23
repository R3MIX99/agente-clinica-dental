import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Iniciar sesion — Clinica Dental",
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex items-center justify-center bg-muted/30 px-4">
      {children}
    </div>
  )
}

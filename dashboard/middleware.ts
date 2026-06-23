import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Rutas que no requieren autenticacion
function esPublica(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  )
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refrescar la sesion — IMPORTANTE: no eliminar esta llamada
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Panel de superadmin: solo el correo autorizado entra. Sin sesion o con otro
  // correo, se redirige a /login para no exponer la existencia del panel.
  // El control real (verificado + proveedor Google) lo hace assertSuperadmin
  // en el servidor; esta capa solo bloquea la ruta de forma temprana.
  if (pathname.startsWith("/superadmin")) {
    const email = user?.email?.trim().toLowerCase()
    const permitido = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()
    if (!user || !permitido || email !== permitido) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return supabaseResponse
  }

  // Sin sesion y ruta privada → redirigir a /login
  if (!user && !esPublica(pathname) && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Con sesion y en /login → redirigir al dashboard segun rol
  if (user && pathname.startsWith("/login")) {
    const rol = user.user_metadata?.rol
    const destino = rol === "doctor" ? "/citas" : "/conversaciones"
    return NextResponse.redirect(new URL(destino, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

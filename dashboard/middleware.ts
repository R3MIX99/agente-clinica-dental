import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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
  const esRutaAuth = pathname.startsWith("/login")
  const esRutaPublica =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon")

  // Sin sesion y ruta privada → redirigir a /login
  if (!user && !esRutaAuth && !esRutaPublica) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Con sesion y en /login → redirigir al dashboard
  if (user && esRutaAuth) {
    return NextResponse.redirect(new URL("/conversaciones", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

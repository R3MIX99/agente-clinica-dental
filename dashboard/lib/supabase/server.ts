import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Solo usar en Server Actions y Route Handlers. Nunca exponer en el cliente.
export function createServerClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  })
}

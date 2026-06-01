-- Migracion 0009: endurecimiento de seguridad segun advisors de Supabase

-- ===========================================================================
-- 1. Fijar search_path en fn_actualizar_last_message_at
--    Advisor: function_search_path_mutable
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_actualizar_last_message_at'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.fn_actualizar_last_message_at()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        UPDATE public.conversations
          SET last_message_at = NEW.created_at
          WHERE id = NEW.conversation_id;
        RETURN NEW;
      END;
      $body$
    $f$;
  END IF;
END $$;

-- ===========================================================================
-- 2. Revocar EXECUTE de anon en funciones SECURITY DEFINER que no deben
--    ser publicas sin autenticacion.
--    Advisor: anon_security_definer_function_executable
-- ===========================================================================

-- Funciones de negocio — solo para usuarios autenticados o service_role
REVOKE EXECUTE ON FUNCTION public.es_superadmin()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.usuario_en_clinica(uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.ia_disponible(uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_consumo_ia(uuid, uuid, integer, integer, text) FROM anon;

-- Funciones internas de trigger — no deben ser invocables por nadie via REST
REVOKE EXECUTE ON FUNCTION public.set_message_clinica_id()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_message_clinica_id()          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_conversation_last_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_conversation_last_message() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                 FROM authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_profiles_updated_at'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_profiles_updated_at() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_profiles_updated_at() FROM authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_actualizar_last_message_at'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.fn_actualizar_last_message_at() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.fn_actualizar_last_message_at() FROM authenticated';
  END IF;
END $$;

-- ===========================================================================
-- 3. Corregir politica INSERT de profiles
--    Advisor: rls_policy_always_true — WITH CHECK (true) es demasiado permisivo
-- ===========================================================================

DROP POLICY IF EXISTS "perfiles_insert_cualquier_autenticado" ON public.profiles;

-- Nueva politica: solo puede insertar su propio perfil (id = auth.uid())
CREATE POLICY "perfiles_insert_propio" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

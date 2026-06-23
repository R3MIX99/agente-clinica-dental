-- Migracion 0011: Instalacion manual
--   1. Endurecer es_superadmin(): candado por correo verificado (no por metadato 'rol').
--   2. onboarding_paso en clinicas: permite reanudar el wizard donde se quedo.
--   3. Resolucion de clinica por secret_token de Telegram para n8n multi-tenant.
--      El bot_token y el secret_token viven en clinic_channels.config (jsonb), nunca en
--      los JSON de n8n. n8n los lee en runtime via RPC (service_role).

-- ===========================================================================
-- 1. Correo del superadmin (editable, no es un secreto)
-- ===========================================================================

INSERT INTO public.config_sistema (clave, valor, descripcion) VALUES
  ('superadmin_email', 'andrem.codeal.ai@gmail.com',
   'Unico correo (verificado, via Google) con acceso al panel de superadmin')
ON CONFLICT (clave) DO NOTHING;

-- ===========================================================================
-- 2. es_superadmin(): solo el correo permitido y verificado
--    Antes confiaba en raw_user_meta_data->>'rol' = 'superadmin', que el propio
--    usuario podia inyectar al registrarse. Ahora compara el correo real y exige
--    que este verificado (email_confirmed_at, que Google OAuth completa).
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.es_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = auth.uid()
          AND u.email_confirmed_at IS NOT NULL
          AND lower(u.email) = (
                SELECT lower(valor)
                FROM public.config_sistema
                WHERE clave = 'superadmin_email'
          )
    );
$$;

-- ===========================================================================
-- 3. onboarding_paso: paso actual del wizard (1..6). 6 = Telegram (obligatorio).
-- ===========================================================================

ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS onboarding_paso integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.clinicas.onboarding_paso IS
  'Paso del wizard de onboarding donde quedo la clinica (para reanudar). El paso final (Telegram) es obligatorio para completar.';

-- ===========================================================================
-- 4. Indice unico sobre el secret_token del canal (resolucion rapida y unicidad)
-- ===========================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_channels_secret_token
  ON public.clinic_channels ((config->>'secret_token'))
  WHERE config->>'secret_token' IS NOT NULL;

-- ===========================================================================
-- 5. RPCs para n8n (multi-tenant por token). SECURITY DEFINER: leen el bot_token
--    de clinic_channels sin exponerlo por RLS. Se invocan con service_role.
-- ===========================================================================

-- 5a. Inbound (WF02): resolver clinica + token a partir del secret_token del header
--     X-Telegram-Bot-Api-Secret-Token que Telegram envia en cada update.
CREATE OR REPLACE FUNCTION public.canal_telegram_por_secret_token(p_secret text)
RETURNS TABLE (clinica_id uuid, cuenta_id uuid, bot_token text, activo boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        cc.clinica_id,
        c.cuenta_id,
        cc.config->>'bot_token' AS bot_token,
        cc.activo
    FROM public.clinic_channels cc
    JOIN public.clinicas c ON c.id = cc.clinica_id
    WHERE cc.canal = 'telegram'
      AND cc.config->>'secret_token' = p_secret
    LIMIT 1;
$$;

-- 5b. Outbound y recordatorios (WF03 y WF01): obtener el token de una clinica concreta.
CREATE OR REPLACE FUNCTION public.canal_telegram_por_clinica(p_clinica_id uuid)
RETURNS TABLE (cuenta_id uuid, bot_token text, activo boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        c.cuenta_id,
        cc.config->>'bot_token' AS bot_token,
        cc.activo
    FROM public.clinic_channels cc
    JOIN public.clinicas c ON c.id = cc.clinica_id
    WHERE cc.canal = 'telegram'
      AND cc.clinica_id = p_clinica_id
    LIMIT 1;
$$;

-- Estas funciones exponen el bot_token: nunca deben ser accesibles por anon ni por
-- usuarios autenticados de las clinicas. Solo service_role (n8n) las ejecuta.
REVOKE EXECUTE ON FUNCTION public.canal_telegram_por_secret_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.canal_telegram_por_clinica(uuid)      FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.canal_telegram_por_secret_token(text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.canal_telegram_por_clinica(uuid)      TO service_role;

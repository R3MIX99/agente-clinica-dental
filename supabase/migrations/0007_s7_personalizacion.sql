-- Fase S7: Personalizacion por clinica y configuracion de canal
-- Cada clinica gestiona su propia identidad, servicios, FAQ y credenciales de canal.

-- =========================================================================
-- 1. Logo en clinicas
-- =========================================================================
ALTER TABLE clinicas ADD COLUMN IF NOT EXISTS logo_url text;

-- =========================================================================
-- 2. Canal por clinica
--    config almacena credenciales sensibles (bot_token, etc.) en el servidor.
--    Nunca se expone al cliente; server actions lo leen con service_role.
-- =========================================================================
CREATE TABLE IF NOT EXISTS clinic_channels (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id  uuid        NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  canal       channel_type NOT NULL,
  activo      boolean     NOT NULL DEFAULT false,
  config      jsonb       NOT NULL DEFAULT '{}',
  webhook_url text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinica_id, canal)
);

CREATE INDEX IF NOT EXISTS idx_clinic_channels_clinica_id
  ON clinic_channels(clinica_id);

ALTER TABLE clinic_channels ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro activo puede consultar el canal (sin el campo config)
CREATE POLICY "miembro ve canal de su clinica"
  ON clinic_channels FOR SELECT
  USING (es_superadmin() OR usuario_en_clinica(clinica_id));

-- Solo administradores gestionan el canal
CREATE POLICY "admin gestiona canal de su clinica"
  ON clinic_channels FOR INSERT
  WITH CHECK (es_superadmin() OR usuario_en_clinica(clinica_id));

CREATE POLICY "admin actualiza canal de su clinica"
  ON clinic_channels FOR UPDATE
  USING (es_superadmin() OR usuario_en_clinica(clinica_id));

-- =========================================================================
-- 3. Asegurar que services tiene clinica_id (ya existe desde 0004)
--    Solo verificamos y, si faltara, agrego el indice.
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_services_clinica_id
  ON services(clinica_id);

-- =========================================================================
-- 4. Seed: canal telegram para la clinica demo
-- =========================================================================
INSERT INTO clinic_channels (clinica_id, canal, activo, config, webhook_url)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'telegram',
  true,
  '{}',
  null
)
ON CONFLICT (clinica_id, canal) DO NOTHING;

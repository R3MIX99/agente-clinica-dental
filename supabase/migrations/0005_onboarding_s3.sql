-- S3: Onboarding tracking y zona horaria en clinicas
ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS zona_horaria text NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN IF NOT EXISTS onboarding_completado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clinicas.zona_horaria IS 'Zona horaria IANA, p.ej. America/Mexico_City';
COMMENT ON COLUMN clinicas.onboarding_completado IS 'true cuando la clinica completo el wizard de configuracion inicial';

-- La clinica demo ya esta configurada; marcarla como onboarding completado
UPDATE clinicas
SET onboarding_completado = true
WHERE id = '00000000-0000-0000-0000-000000000002';

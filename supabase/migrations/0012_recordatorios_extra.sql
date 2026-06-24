-- Migracion 0012: recordatorios adicionales otorgados por el superadmin.
-- El tope efectivo de una suscripcion pasa a ser:
--   plan.max_recordatorios_mes + suscripciones.recordatorios_extra

ALTER TABLE public.suscripciones
  ADD COLUMN IF NOT EXISTS recordatorios_extra integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.suscripciones.recordatorios_extra IS
  'Recordatorios adicionales sobre el tope del plan, otorgados manualmente por el superadmin (paquetes o cortesia).';

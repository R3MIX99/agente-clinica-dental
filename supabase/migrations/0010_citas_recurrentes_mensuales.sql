-- Migracion 0010: citas recurrentes mensuales
-- Permite que una cita se repita el mismo dia cada mes hasta una fecha definida
-- o indefinidamente. Todas las instancias de la misma serie comparten serie_id.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS serie_id          uuid,
  ADD COLUMN IF NOT EXISTS recurrencia_tipo  text,
  ADD COLUMN IF NOT EXISTS recurrencia_fin   date;

-- Validacion de tipos de recurrencia soportados.
-- Se deja NULL como valor por defecto (cita no recurrente).
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_recurrencia_tipo_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_recurrencia_tipo_check
  CHECK (recurrencia_tipo IS NULL OR recurrencia_tipo IN ('mensual'));

-- Indice para encontrar rapidamente las citas de una serie
CREATE INDEX IF NOT EXISTS idx_appointments_serie_id
  ON public.appointments(serie_id)
  WHERE serie_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.serie_id IS
  'Identifica todas las citas que pertenecen a la misma serie recurrente. NULL = cita unica.';
COMMENT ON COLUMN public.appointments.recurrencia_tipo IS
  'Tipo de recurrencia. Actualmente solo mensual. NULL = no recurrente.';
COMMENT ON COLUMN public.appointments.recurrencia_fin IS
  'Fecha hasta la cual se generan instancias de la serie. NULL = indefinido (12 meses por defecto).';

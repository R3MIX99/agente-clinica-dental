-- Migracion 0014: marca de recordatorio de pago enviado.
-- Permite al workflow de n8n (cron) avisar una sola vez por cita cuando quedo
-- Completada pero con Pago pendiente, 2 horas despues de la cita.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS pago_recordatorio_enviado_at timestamptz;

COMMENT ON COLUMN public.appointments.pago_recordatorio_enviado_at IS
  'Fecha en que se envio el recordatorio automatico de pago. NULL = aun no enviado.';

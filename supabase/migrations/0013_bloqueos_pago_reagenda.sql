-- Migracion 0013: cierre de dias / bloqueo por servicio, estado de pago y datos de reagenda.
--   1. Tabla bloqueos: dias cerrados (toda la clinica o solo un servicio).
--   2. appointments.estado_pago: pendiente | pagado.
--   3. appointment_status gana el valor 'por_reagendar' (citas afectadas por un cierre).
--   4. clinicas: google_reserva_url (enlace de reserva de Google) y datos_pago (transferencia).

-- ===========================================================================
-- 1. Nuevo estado de cita: por_reagendar
--    (ALTER TYPE ADD VALUE no permite usar el valor en la misma transaccion,
--     pero aqui solo lo agregamos; el codigo lo usa en runtime.)
-- ===========================================================================
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'por_reagendar';

-- ===========================================================================
-- 2. Estado de pago en citas
-- ===========================================================================
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS estado_pago text NOT NULL DEFAULT 'pendiente'
    CHECK (estado_pago IN ('pendiente', 'pagado'));

COMMENT ON COLUMN public.appointments.estado_pago IS
  'Estado de cobro de la cita, independiente del status clinico. La doctora lo marca manualmente.';

-- ===========================================================================
-- 3. Datos de la clinica: enlace de reserva de Google y datos de pago
-- ===========================================================================
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS google_reserva_url text,
  ADD COLUMN IF NOT EXISTS datos_pago text;

COMMENT ON COLUMN public.clinicas.google_reserva_url IS
  'Enlace de la pagina de reservas de Google Calendar de la clinica. Se envia a los pacientes para reagendar.';
COMMENT ON COLUMN public.clinicas.datos_pago IS
  'Datos de transferencia/instrucciones de pago que se envian al paciente para cobrar una cita.';

-- ===========================================================================
-- 4. Tabla de bloqueos (dias cerrados)
--    service_id NULL = toda la clinica ese dia.
--    service_id con valor = solo ese servicio ese dia (ej. maquina descompuesta).
--    doctor_id NULL = aplica a la clinica; con valor = solo ese doctor.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.bloqueos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id    uuid        NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  doctor_id     uuid        REFERENCES public.doctors(id) ON DELETE CASCADE,
  fecha         date        NOT NULL,
  service_id    uuid        REFERENCES public.services(id) ON DELETE CASCADE,
  motivo        text,
  notificado_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloqueos_clinica_fecha
  ON public.bloqueos (clinica_id, fecha);

ALTER TABLE public.bloqueos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bloqueos_clinica" ON public.bloqueos
  FOR ALL
  USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id))
  WITH CHECK (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));

-- Migracion 0015: facturacion manual desde el panel de superadmin.
--   1. Precio personalizado y fecha de vencimiento por suscripcion (los fija el superadmin).
--   2. Banderas para no duplicar los recordatorios de pago (2 dias antes / vencido).
--   3. Notas internas del superadmin.
--   4. historial_pagos: metodo y quien registro el pago manual.

-- ===========================================================================
-- 1. Suscripciones: precio personalizado, vencimiento, recordatorios y notas
-- ===========================================================================
ALTER TABLE public.suscripciones
  ADD COLUMN IF NOT EXISTS precio_personalizado_mxn numeric,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento        date,
  ADD COLUMN IF NOT EXISTS recordatorio_2d_at       timestamptz,
  ADD COLUMN IF NOT EXISTS recordatorio_vencido_at  timestamptz,
  ADD COLUMN IF NOT EXISTS notas_admin              text;

COMMENT ON COLUMN public.suscripciones.precio_personalizado_mxn IS
  'Precio mensual personalizado que fija el superadmin. Si es NULL, se usa el precio del plan. Es el monto que ve la clinica en Uso y facturacion.';
COMMENT ON COLUMN public.suscripciones.fecha_vencimiento IS
  'Fecha del proximo pago de la suscripcion (facturacion manual). Base para los recordatorios.';
COMMENT ON COLUMN public.suscripciones.recordatorio_2d_at IS
  'Ultima vez que se envio el recordatorio de 2 dias antes del vencimiento (evita duplicados).';
COMMENT ON COLUMN public.suscripciones.recordatorio_vencido_at IS
  'Ultima vez que se envio el recordatorio de pago vencido (evita duplicados).';

-- ===========================================================================
-- 2. historial_pagos: metodo y quien lo registro (pagos manuales del superadmin)
-- ===========================================================================
ALTER TABLE public.historial_pagos
  ADD COLUMN IF NOT EXISTS metodo         text,
  ADD COLUMN IF NOT EXISTS registrado_por text;

COMMENT ON COLUMN public.historial_pagos.metodo IS
  'Metodo del pago registrado manualmente (transferencia, efectivo, etc.).';
COMMENT ON COLUMN public.historial_pagos.registrado_por IS
  'Correo o identificador de quien registro el pago manual (superadmin).';

-- ===========================================================================
-- Fix: uso_metering (tipo='recordatorio') nunca incrementaba
-- suscripciones.recordatorios_enviados, por lo que el panel de uso siempre
-- mostraba 0 recordatorios enviados aunque n8n si los registraba en
-- uso_metering. Este trigger conecta ambas tablas.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.incrementar_recordatorios_enviados()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'recordatorio' THEN
    UPDATE public.suscripciones
    SET recordatorios_enviados = recordatorios_enviados + GREATEST(NEW.cantidad, 0)::integer
    WHERE id = (
      SELECT id FROM public.suscripciones
      WHERE cuenta_id = NEW.cuenta_id
        AND estado IN ('activa', 'prueba')
      ORDER BY created_at DESC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incrementar_recordatorios_enviados ON public.uso_metering;

CREATE TRIGGER trg_incrementar_recordatorios_enviados
AFTER INSERT ON public.uso_metering
FOR EACH ROW
EXECUTE FUNCTION public.incrementar_recordatorios_enviados();

-- Backfill: recuperar el conteo de recordatorios ya enviados y no contabilizados
UPDATE public.suscripciones s
SET recordatorios_enviados = recordatorios_enviados + backfill.cantidad
FROM (
  SELECT cuenta_id, COUNT(*) AS cantidad
  FROM public.uso_metering
  WHERE tipo = 'recordatorio'
  GROUP BY cuenta_id
) backfill
WHERE s.cuenta_id = backfill.cuenta_id
  AND s.id = (
    SELECT id FROM public.suscripciones s2
    WHERE s2.cuenta_id = backfill.cuenta_id
      AND s2.estado IN ('activa', 'prueba')
    ORDER BY created_at DESC
    LIMIT 1
  );

REVOKE EXECUTE ON FUNCTION public.incrementar_recordatorios_enviados() FROM anon, authenticated;

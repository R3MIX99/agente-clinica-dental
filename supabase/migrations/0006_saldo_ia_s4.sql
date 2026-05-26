-- Migracion 0006: S4 — Saldo de IA por consumo real, recargas y configuracion de sistema
-- Agrega config_sistema (clave/valor editable por superadmin), consumos_ia (log detallado
-- por llamada a la API) y recargas_saldo (compras de saldo adicional via Mercado Pago en S5).

-- ===========================================================================
-- 1. config_sistema — tabla clave/valor para parametros configurables
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.config_sistema (
  clave        text        PRIMARY KEY,
  valor        text        NOT NULL,
  descripcion  text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.config_sistema (clave, valor, descripcion) VALUES
  ('ia_precio_input_usd_por_mtoken',    '0.80',               'Precio USD por millon de tokens de entrada (claude-haiku-4-5-20251001)'),
  ('ia_precio_output_usd_por_mtoken',   '4.00',               'Precio USD por millon de tokens de salida (claude-haiku-4-5-20251001)'),
  ('ia_tipo_cambio_usd_mxn',            '17.50',              'Tipo de cambio USD a MXN para calculo de costo de IA'),
  ('ia_markup',                         '2.00',               'Multiplicador sobre el costo real de la API (margen del negocio)'),
  ('ia_pct_saldo_plan',                 '20.00',              'Porcentaje del precio del plan destinado a saldo de IA incluido'),
  ('ia_umbral_saldo_bajo_pct',          '20.00',              'Porcentaje de saldo restante que activa el aviso de saldo bajo'),
  ('ia_comportamiento_saldo_cero',      'pausar_y_notificar', 'Comportamiento al agotar el saldo: pausar_y_notificar | continuar'),
  ('ia_saldo_incluido_acumula',         'false',              'Si el saldo incluido no consumido se acumula al siguiente periodo (las recargas si acumulan)'),
  ('recordatorios_comportamiento_tope', 'avisar_y_pausar',    'Comportamiento al superar el tope de recordatorios: avisar_y_pausar | continuar')
ON CONFLICT (clave) DO NOTHING;

-- ===========================================================================
-- 2. consumos_ia — registro detallado por llamada a la API de Claude
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.consumos_ia (
  id                    uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_id             uuid          NOT NULL REFERENCES public.cuentas(id)       ON DELETE CASCADE,
  clinica_id            uuid          NOT NULL REFERENCES public.clinicas(id)      ON DELETE CASCADE,
  suscripcion_id        uuid          NOT NULL REFERENCES public.suscripciones(id) ON DELETE CASCADE,
  conversacion_id       uuid          REFERENCES public.conversations(id)          ON DELETE SET NULL,
  modelo                text          NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  tokens_entrada        integer       NOT NULL DEFAULT 0,
  tokens_salida         integer       NOT NULL DEFAULT 0,
  costo_api_usd         numeric(12,8) NOT NULL DEFAULT 0,
  tipo_cambio           numeric(8,4)  NOT NULL DEFAULT 17.50,
  markup                numeric(6,4)  NOT NULL DEFAULT 2.00,
  costo_descontado_mxn  numeric(10,4) NOT NULL DEFAULT 0,
  created_at            timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.consumos_ia IS 'Registro detallado de cada llamada a la API de Claude. Ver docs/formula_costo_ia.md.';
COMMENT ON COLUMN public.consumos_ia.costo_api_usd        IS 'Costo bruto segun precios de Anthropic en USD.';
COMMENT ON COLUMN public.consumos_ia.costo_descontado_mxn IS 'Monto descontado del saldo: costo_api_usd * tipo_cambio * markup.';

-- ===========================================================================
-- 3. recargas_saldo — compras de saldo adicional (Mercado Pago, Fase S5)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.recargas_saldo (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_id       uuid          NOT NULL REFERENCES public.cuentas(id)       ON DELETE CASCADE,
  clinica_id      uuid          NOT NULL REFERENCES public.clinicas(id)      ON DELETE CASCADE,
  suscripcion_id  uuid          NOT NULL REFERENCES public.suscripciones(id) ON DELETE CASCADE,
  monto_mxn       numeric(10,4) NOT NULL,
  estado          text          NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'completada', 'fallida', 'revertida')),
  referencia_pago text,
  -- NULL = vigencia hasta fin del periodo activo de la suscripcion.
  -- Las recargas si acumulan al siguiente periodo si tienen vigencia_fin posterior.
  vigencia_fin    date,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.recargas_saldo.vigencia_fin IS 'Fecha limite de uso del saldo recargado. NULL = expira con el periodo. Las recargas pueden sobrevivir al periodo a diferencia del saldo incluido.';

-- ===========================================================================
-- 4. Columna saldo_ia_pct en planes (porcentaje de referencia, auditable)
-- ===========================================================================

ALTER TABLE public.planes
  ADD COLUMN IF NOT EXISTS saldo_ia_pct numeric(5,2) NOT NULL DEFAULT 20.00;

COMMENT ON COLUMN public.planes.saldo_ia_pct IS 'Porcentaje del precio mensual destinado a saldo de IA incluido. saldo_ia_incluido_mxn = precio_mensual_mxn * saldo_ia_pct / 100.';

-- ===========================================================================
-- 5. Funcion atomica: registrar_consumo_ia
--    Descuenta del saldo y guarda el log en una sola transaccion.
--    Llamada desde n8n via POST /api/ia/consumo con X-Shared-Secret.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.registrar_consumo_ia(
  p_clinica_id       uuid,
  p_conversacion_id  uuid,
  p_tokens_entrada   integer,
  p_tokens_salida    integer,
  p_modelo           text DEFAULT 'claude-haiku-4-5-20251001'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cuenta_id      uuid;
  v_suscripcion_id uuid;
  v_precio_input   numeric;
  v_precio_output  numeric;
  v_tipo_cambio    numeric;
  v_markup         numeric;
  v_costo_usd      numeric;
  v_costo_mxn      numeric;
  v_saldo_actual   numeric;
  v_comportamiento text;
BEGIN
  -- Obtener cuenta de la clinica
  SELECT cuenta_id INTO v_cuenta_id FROM public.clinicas WHERE id = p_clinica_id;
  IF v_cuenta_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'clinica_no_encontrada');
  END IF;

  -- Bloquear fila de la suscripcion activa para evitar condiciones de carrera
  SELECT id, saldo_ia_disponible_mxn
    INTO v_suscripcion_id, v_saldo_actual
  FROM public.suscripciones
  WHERE cuenta_id = v_cuenta_id AND estado IN ('activa', 'prueba')
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;

  IF v_suscripcion_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sin_suscripcion_activa');
  END IF;

  -- Verificar saldo antes de procesar
  SELECT valor INTO v_comportamiento FROM public.config_sistema WHERE clave = 'ia_comportamiento_saldo_cero';

  IF COALESCE(v_saldo_actual, 0) <= 0 THEN
    RETURN jsonb_build_object(
      'ok',            false,
      'error',         'saldo_agotado',
      'comportamiento', COALESCE(v_comportamiento, 'pausar_y_notificar')
    );
  END IF;

  -- Leer parametros de configuracion
  SELECT valor::numeric INTO v_precio_input  FROM public.config_sistema WHERE clave = 'ia_precio_input_usd_por_mtoken';
  SELECT valor::numeric INTO v_precio_output FROM public.config_sistema WHERE clave = 'ia_precio_output_usd_por_mtoken';
  SELECT valor::numeric INTO v_tipo_cambio   FROM public.config_sistema WHERE clave = 'ia_tipo_cambio_usd_mxn';
  SELECT valor::numeric INTO v_markup        FROM public.config_sistema WHERE clave = 'ia_markup';

  -- Calcular costo (ver docs/formula_costo_ia.md)
  v_costo_usd := (p_tokens_entrada::numeric / 1000000 * COALESCE(v_precio_input,  0.80))
               + (p_tokens_salida::numeric  / 1000000 * COALESCE(v_precio_output, 4.00));
  v_costo_mxn := v_costo_usd * COALESCE(v_tipo_cambio, 17.50) * COALESCE(v_markup, 2.00);

  -- Descontar saldo (no baja de cero)
  UPDATE public.suscripciones
  SET saldo_ia_disponible_mxn = GREATEST(saldo_ia_disponible_mxn - v_costo_mxn, 0)
  WHERE id = v_suscripcion_id;

  -- Registrar consumo detallado
  INSERT INTO public.consumos_ia (
    cuenta_id, clinica_id, suscripcion_id, conversacion_id,
    modelo, tokens_entrada, tokens_salida,
    costo_api_usd, tipo_cambio, markup, costo_descontado_mxn
  ) VALUES (
    v_cuenta_id, p_clinica_id, v_suscripcion_id, p_conversacion_id,
    p_modelo, p_tokens_entrada, p_tokens_salida,
    v_costo_usd,
    COALESCE(v_tipo_cambio, 17.50),
    COALESCE(v_markup, 2.00),
    v_costo_mxn
  );

  RETURN jsonb_build_object(
    'ok',                   true,
    'costo_api_usd',        v_costo_usd,
    'costo_descontado_mxn', v_costo_mxn,
    'saldo_restante_mxn',   GREATEST(v_saldo_actual - v_costo_mxn, 0)
  );
END;
$$;

-- ===========================================================================
-- 6. Funcion de consulta: ia_disponible (lectura, sin mutar)
--    Usada por n8n antes de llamar a Claude para decidir si continua.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.ia_disponible(p_clinica_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_cuenta_id      uuid;
  v_saldo          numeric;
  v_saldo_incluido numeric;
  v_umbral_pct     numeric;
  v_pct_restante   numeric;
BEGIN
  SELECT cuenta_id INTO v_cuenta_id FROM public.clinicas WHERE id = p_clinica_id;

  SELECT s.saldo_ia_disponible_mxn, pl.saldo_ia_incluido_mxn
    INTO v_saldo, v_saldo_incluido
  FROM public.suscripciones s
  JOIN public.planes pl ON pl.id = s.plan_id
  WHERE s.cuenta_id = v_cuenta_id AND s.estado IN ('activa', 'prueba')
  ORDER BY s.created_at DESC LIMIT 1;

  SELECT valor::numeric INTO v_umbral_pct FROM public.config_sistema WHERE clave = 'ia_umbral_saldo_bajo_pct';

  v_pct_restante := CASE
    WHEN COALESCE(v_saldo_incluido, 0) > 0
    THEN (COALESCE(v_saldo, 0) / v_saldo_incluido) * 100
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'disponible',  COALESCE(v_saldo, 0) > 0,
    'saldo',       COALESCE(v_saldo, 0),
    'pct_restante', ROUND(v_pct_restante, 2),
    'saldo_bajo',  v_pct_restante <= COALESCE(v_umbral_pct, 20) AND COALESCE(v_saldo, 0) > 0,
    'agotado',     COALESCE(v_saldo, 0) <= 0
  );
END;
$$;

-- ===========================================================================
-- 7. Indices
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_consumos_ia_clinica     ON public.consumos_ia(clinica_id);
CREATE INDEX IF NOT EXISTS idx_consumos_ia_suscripcion ON public.consumos_ia(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_consumos_ia_created     ON public.consumos_ia(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recargas_clinica        ON public.recargas_saldo(clinica_id);
CREATE INDEX IF NOT EXISTS idx_recargas_cuenta         ON public.recargas_saldo(cuenta_id);

-- ===========================================================================
-- 8. RLS
-- ===========================================================================

ALTER TABLE public.config_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumos_ia    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recargas_saldo ENABLE ROW LEVEL SECURITY;

-- config_sistema: lectura para todos los autenticados; escritura solo superadmin
CREATE POLICY "config_lectura" ON public.config_sistema
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "config_escritura_superadmin" ON public.config_sistema
  FOR ALL USING (public.es_superadmin());

-- consumos_ia y recargas_saldo: solo miembros de la clinica
CREATE POLICY "consumos_ia_de_clinica" ON public.consumos_ia
  FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));

CREATE POLICY "recargas_de_clinica" ON public.recargas_saldo
  FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));

-- ===========================================================================
-- 9. Abono inicial de saldo en la suscripcion demo si aun esta en 0
-- ===========================================================================

UPDATE public.suscripciones
SET saldo_ia_disponible_mxn = 380
WHERE cuenta_id = '00000000-0000-0000-0000-000000000001'
  AND saldo_ia_disponible_mxn = 0;

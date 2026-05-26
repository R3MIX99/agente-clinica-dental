-- Migracion 0004: modelo multi-tenant S1
-- Introduce jerarquia Cuenta -> Clinica -> (dominio) con aislamiento por fila.
-- Migra todos los datos existentes a Cuenta demo / Clinica demo.

-- ===========================================================================
-- 1. Tablas nuevas
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.cuentas (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre          text NOT NULL,
    email_contacto  text,
    estado          text NOT NULL DEFAULT 'prueba'
                    CHECK (estado IN ('activa', 'prueba', 'suspendida', 'cancelada')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinicas (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cuenta_id       uuid NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
    nombre          text,
    direccion       text,
    telefono        text,
    email           text,
    sitio_web       text,
    horario         text,
    formas_pago     text,
    facturacion     text,
    mapa_url        text,
    faq             jsonb,
    activa          boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.membresias (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cuenta_id   uuid NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
    clinica_id  uuid REFERENCES public.clinicas(id) ON DELETE CASCADE,
    rol         text NOT NULL CHECK (rol IN ('administrador', 'supervisor', 'doctor')),
    activa      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, clinica_id)
);

CREATE TABLE IF NOT EXISTS public.planes (
    id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre                  text NOT NULL,
    precio_mensual_mxn      numeric NOT NULL,
    precio_anual_mxn        numeric NOT NULL,
    max_doctores            integer NOT NULL,
    max_usuarios            integer NOT NULL,
    max_clinicas            integer NOT NULL,
    saldo_ia_incluido_mxn   numeric NOT NULL,
    max_recordatorios_mes   integer NOT NULL,
    activo                  boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suscripciones (
    id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cuenta_id                uuid NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
    plan_id                  uuid NOT NULL REFERENCES public.planes(id),
    estado                   text NOT NULL DEFAULT 'prueba'
                             CHECK (estado IN ('prueba', 'activa', 'vencida', 'cancelada', 'suspendida')),
    periodo                  text NOT NULL DEFAULT 'mensual'
                             CHECK (periodo IN ('mensual', 'anual')),
    inicio_periodo           date,
    fin_periodo              date,
    saldo_ia_disponible_mxn  numeric NOT NULL DEFAULT 0,
    recordatorios_enviados   integer NOT NULL DEFAULT 0,
    mp_subscription_id       text,
    created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.uso_metering (
    id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cuenta_id     uuid NOT NULL REFERENCES public.cuentas(id),
    clinica_id    uuid NOT NULL REFERENCES public.clinicas(id),
    tipo          text NOT NULL CHECK (tipo IN ('ia', 'recordatorio')),
    cantidad      numeric NOT NULL,
    referencia_id uuid,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 2. Datos semilla
-- ===========================================================================

INSERT INTO public.cuentas (id, nombre, email_contacto, estado)
VALUES ('00000000-0000-0000-0000-000000000001', 'Cuenta demo', 'demo@agentedental.mx', 'prueba')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.planes
    (id, nombre, precio_mensual_mxn, precio_anual_mxn, max_doctores, max_usuarios, max_clinicas, saldo_ia_incluido_mxn, max_recordatorios_mes)
VALUES
    ('00000000-0000-0000-0000-000000000010', 'Solo',        599,   5990,  1,  1, 1, 120,  300),
    ('00000000-0000-0000-0000-000000000011', 'Profesional', 1899, 18990,  5,  2, 1, 380, 1500),
    ('00000000-0000-0000-0000-000000000012', 'Clinica',     3799, 37990, 12,  4, 3, 760, 5000)
ON CONFLICT (id) DO NOTHING;

-- Clinica demo: copiar datos de clinic_info si existe
INSERT INTO public.clinicas (id, cuenta_id, nombre, direccion, telefono, email, sitio_web, horario, formas_pago, facturacion, mapa_url, faq)
SELECT
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    ci.nombre, ci.direccion, ci.telefono, ci.email,
    ci.sitio_web, ci.horario, ci.formas_pago, ci.facturacion, ci.mapa_url, ci.faq
FROM public.clinic_info ci
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinicas (id, cuenta_id, nombre)
SELECT
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Clinica demo'
WHERE NOT EXISTS (SELECT 1 FROM public.clinicas WHERE id = '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suscripciones (cuenta_id, plan_id, estado, saldo_ia_disponible_mxn)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000011'::uuid,
    'prueba', 380
WHERE NOT EXISTS (
    SELECT 1 FROM public.suscripciones WHERE cuenta_id = '00000000-0000-0000-0000-000000000001'
);

-- ===========================================================================
-- 3. Columnas clinica_id en tablas existentes
-- ===========================================================================

ALTER TABLE public.agents           ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.appointments     ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.clinical_notes   ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.conversations    ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.doctor_schedules ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.doctors          ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.messages         ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.patient_doctors  ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.patients         ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.services         ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.studies          ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.profiles         ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES public.clinicas(id);
ALTER TABLE public.profiles         ADD COLUMN IF NOT EXISTS cuenta_id  uuid REFERENCES public.cuentas(id);

-- ===========================================================================
-- 4. Migracion de datos existentes → Clinica demo
-- ===========================================================================

UPDATE public.agents           SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.appointments     SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.clinical_notes   SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.conversations    SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.doctor_schedules SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.doctors          SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.messages         SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.patient_doctors  SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.patients         SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.services         SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.studies          SET clinica_id = '00000000-0000-0000-0000-000000000002' WHERE clinica_id IS NULL;
UPDATE public.profiles
    SET clinica_id = '00000000-0000-0000-0000-000000000002',
        cuenta_id  = '00000000-0000-0000-0000-000000000001'
WHERE clinica_id IS NULL;

-- Membresias para usuarios existentes
INSERT INTO public.membresias (user_id, cuenta_id, clinica_id, rol, activa)
SELECT
    p.id, '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid, p.rol::text, p.activo
FROM public.profiles p
ON CONFLICT (user_id, clinica_id) DO NOTHING;

-- ===========================================================================
-- 5. NOT NULL en tablas del dominio (excepto messages y profiles)
-- ===========================================================================

ALTER TABLE public.agents           ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.appointments     ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.clinical_notes   ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.conversations    ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.doctor_schedules ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.doctors          ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.patient_doctors  ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.patients         ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.services         ALTER COLUMN clinica_id SET NOT NULL;
ALTER TABLE public.studies          ALTER COLUMN clinica_id SET NOT NULL;

-- ===========================================================================
-- 6. Trigger: auto-rellenar messages.clinica_id desde la conversacion
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.set_message_clinica_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.clinica_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
        SELECT clinica_id INTO NEW.clinica_id
        FROM public.conversations
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_set_clinica_id ON public.messages;
CREATE TRIGGER trg_messages_set_clinica_id
    BEFORE INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.set_message_clinica_id();

-- ===========================================================================
-- 7. Funciones auxiliares para RLS
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.usuario_en_clinica(p_clinica_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.membresias
        WHERE user_id = auth.uid() AND clinica_id = p_clinica_id AND activa = true
    );
$$;

CREATE OR REPLACE FUNCTION public.es_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT raw_user_meta_data->>'rol' = 'superadmin'
         FROM auth.users WHERE id = auth.uid()),
        false
    );
$$;

-- ===========================================================================
-- 8. Indices
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_agents_clinica           ON public.agents(clinica_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinica     ON public.appointments(clinica_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_clinica   ON public.clinical_notes(clinica_id);
CREATE INDEX IF NOT EXISTS idx_conversations_clinica    ON public.conversations(clinica_id);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_clinica ON public.doctor_schedules(clinica_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinica          ON public.doctors(clinica_id);
CREATE INDEX IF NOT EXISTS idx_messages_clinica         ON public.messages(clinica_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctors_clinica  ON public.patient_doctors(clinica_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinica         ON public.patients(clinica_id);
CREATE INDEX IF NOT EXISTS idx_services_clinica         ON public.services(clinica_id);
CREATE INDEX IF NOT EXISTS idx_studies_clinica          ON public.studies(clinica_id);
CREATE INDEX IF NOT EXISTS idx_profiles_clinica         ON public.profiles(clinica_id);
CREATE INDEX IF NOT EXISTS idx_membresias_user_id       ON public.membresias(user_id);
CREATE INDEX IF NOT EXISTS idx_membresias_clinica_id    ON public.membresias(clinica_id);
CREATE INDEX IF NOT EXISTS idx_membresias_cuenta_id     ON public.membresias(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_cuenta     ON public.suscripciones(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_uso_metering_clinica     ON public.uso_metering(clinica_id);
CREATE INDEX IF NOT EXISTS idx_clinicas_cuenta          ON public.clinicas(cuenta_id);

-- ===========================================================================
-- 9. RLS en tablas nuevas y del dominio
-- ===========================================================================

ALTER TABLE public.cuentas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membresias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_metering  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_doctors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studies          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cuentas_propias" ON public.cuentas FOR ALL
    USING (public.es_superadmin() OR id IN (SELECT cuenta_id FROM public.membresias WHERE user_id = auth.uid() AND activa = true));
CREATE POLICY "clinicas_de_cuenta" ON public.clinicas FOR ALL
    USING (public.es_superadmin() OR public.usuario_en_clinica(id));
CREATE POLICY "membresias_propias" ON public.membresias FOR SELECT
    USING (user_id = auth.uid() OR public.es_superadmin());
CREATE POLICY "planes_lectura" ON public.planes FOR SELECT
    USING (activo = true OR public.es_superadmin());
CREATE POLICY "suscripciones_de_cuenta" ON public.suscripciones FOR ALL
    USING (public.es_superadmin() OR cuenta_id IN (SELECT cuenta_id FROM public.membresias WHERE user_id = auth.uid() AND activa = true));
CREATE POLICY "metering_de_clinica" ON public.uso_metering FOR ALL
    USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));

CREATE POLICY "agents_clinica"           ON public.agents           FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "appointments_clinica"     ON public.appointments     FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "clinical_notes_clinica"   ON public.clinical_notes   FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "conversations_clinica"    ON public.conversations    FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "doctor_schedules_clinica" ON public.doctor_schedules FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "doctors_clinica"          ON public.doctors          FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "messages_clinica"         ON public.messages         FOR ALL USING (public.es_superadmin() OR clinica_id IS NULL OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "patient_doctors_clinica"  ON public.patient_doctors  FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "patients_clinica"         ON public.patients         FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "services_clinica"         ON public.services         FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));
CREATE POLICY "studies_clinica"          ON public.studies          FOR ALL USING (public.es_superadmin() OR public.usuario_en_clinica(clinica_id));

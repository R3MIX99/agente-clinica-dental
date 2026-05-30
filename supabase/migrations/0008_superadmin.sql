-- Migracion 0008: politicas de escritura para el panel de superadmin

-- La funcion es_superadmin() ya existe desde 0004.
-- Solo hace falta habilitar operaciones de escritura en planes
-- (las demas tablas administrativas ya tienen FOR ALL USING es_superadmin()).

-- Planes: el superadmin puede crear, modificar y desactivar planes.
-- La politica "planes_lectura" ya existe (SELECT). Agregamos FOR ALL para escritura.
CREATE POLICY "planes_superadmin_write" ON public.planes
    FOR ALL
    USING (public.es_superadmin())
    WITH CHECK (public.es_superadmin());

-- Profiles: el superadmin puede leer perfiles de cualquier usuario (solo lectura).
-- La tabla profiles no tiene politica previa en las migraciones anteriores.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_propios'
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "profiles_propios" ON public.profiles
        FOR ALL
        USING (auth.uid() = id OR public.es_superadmin());
  END IF;
END $$;

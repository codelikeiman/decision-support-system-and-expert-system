-- Pengamanan untuk Supabase.
--
-- Supabase membuka setiap tabel di skema `public` melalui Data API (PostgREST)
-- yang dapat diakses dengan anon key. Aplikasi ini TIDAK memakai Data API:
-- seluruh akses melalui Prisma (peran `postgres`, pemilik tabel) dan isolasi
-- tenant ditangani `tenantDb`. Karena itu:
--   1. RLS diaktifkan pada semua tabel TANPA policy → Data API tidak dapat
--      membaca/menulis apa pun. Pemilik tabel (Prisma) tidak terpengaruh.
--   2. Hak akses peran `anon` dan `authenticated` dicabut (lapisan kedua).
-- Blok ini aman dijalankan pada PostgreSQL biasa (peran Supabase dilewati
-- bila tidak ada).

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
  END IF;
END $$;

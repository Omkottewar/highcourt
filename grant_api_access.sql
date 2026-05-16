-- ============================================================================
-- Expose tblRegEntry (and adv_master) to the Supabase REST API.
--
-- WHY: tblRegEntry was created by import_csv.py via a direct psycopg2
-- connection. Tables created that way are owned by `postgres` and have NO
-- privileges granted to the API roles (`anon`, `authenticated`), so PostgREST
-- returns 404 — it literally cannot see the table.
--
-- Run this once in the Supabase dashboard → SQL Editor.
-- ============================================================================

-- 1. Let the API roles use the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grant table privileges.
--    The app has no login, so it uses the `anon` key for everything,
--    including New / Edit / Delete — hence full CRUD here.
GRANT SELECT, INSERT, UPDATE, DELETE ON public."tblRegEntry" TO anon, authenticated;
GRANT SELECT                        ON public.adv_master      TO anon, authenticated;
GRANT SELECT                        ON public.case_type       TO anon, authenticated;
GRANT SELECT                        ON public.district        TO anon, authenticated;

-- 3. Make sure Row Level Security isn't silently filtering everything out.
--    With no login there are no per-user rules to enforce, so disable it.
--    (If RLS were ON with no policy, reads would return an empty list.)
ALTER TABLE public."tblRegEntry" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.adv_master    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_type     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.district      DISABLE ROW LEVEL SECURITY;

-- 4. Tell PostgREST to reload its schema cache so the change takes effect now.
NOTIFY pgrst, 'reload schema';

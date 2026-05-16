-- ============================================================================
-- Seed the public.district table from SQLQuery25.csv
-- Run once in the Supabase dashboard -> SQL Editor.
--
-- Notes:
--  * ids are inserted explicitly to match the source file.
--  * ON CONFLICT makes this safe to re-run.
-- ============================================================================

INSERT INTO public.district (id, name) VALUES
  (27, 'GADCHIROLI'),
  (28, 'MUMBAI'),
  (33, 'YAVATMAL'),
  (38, 'WARDHA'),
  (40, 'WASHIM'),
  (51, 'PUNE'),
  (53, 'NANDED'),
  (54, 'GARHCHIROLI'),
  (55, 'PARBHANI'),
  (56, 'BHANDARA'),
  (59, 'HINGOLI'),
  (60, 'BETUL'),
  (62, 'AMRAVATI'),
  (63, 'SOLAPUR'),
  (65, 'BULDHANA'),
  (66, 'NAGPUR'),
  (67, 'CHANDRAPUR'),
  (68, 'GONDIA'),
  (69, 'NASHIK'),
  (70, 'AKOLA'),
  (71, 'DHULE')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- Bump the serial sequence past the highest explicit id so future inserts
-- (without an explicit id) don't collide.
SELECT setval(
  pg_get_serial_sequence('public.district', 'id'),
  (SELECT MAX(id) FROM public.district)
);

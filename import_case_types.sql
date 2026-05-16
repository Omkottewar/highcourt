-- ============================================================================
-- Seed the public.case_type table from SQLQuery24.csv
-- Run once in the Supabase dashboard -> SQL Editor.
--
-- Notes:
--  * ids are inserted explicitly to match the source file.
--  * Rows 49 (LD-VC-CW) and 50 (LD-VC-PIL) have no long_type -> stored as NULL.
--  * Row 51 from the CSV is skipped: its short_type is empty and the column is
--    NOT NULL, so it cannot be inserted (and carries no meaningful data).
--  * ON CONFLICT makes this safe to re-run.
-- ============================================================================

INSERT INTO public.case_type (id, short_type, long_type) VALUES
  (1,  'AO',       'Appeal From Order'),
  (2,  'AA',       'Arbitration Appeal'),
  (3,  'ARA',      'Arbitration Application'),
  (4,  'ARP',      'Arbitration Petition'),
  (5,  'CAO',      'CA in (MCA/EP/CA/XOB)'),
  (6,  'CEL',      'Central Excise Appeal'),
  (7,  'CAM',      'Civil Application in AA'),
  (8,  'CAA',      'Civil Application in AO'),
  (9,  'CAE',      'Civil Application in C.REF'),
  (10, 'CAN',      'Civil Application in CP'),
  (11, 'CAC',      'Civil Application in CRA'),
  (12, 'CAF',      'Civil Application in FA'),
  (13, 'CAZ',      'Civil Application in LPA'),
  (14, 'CAS',      'Civil Application in SA'),
  (15, 'CAT',      'Civil Application in Tax Matters'),
  (16, 'CAW',      'Civil Application in WP'),
  (17, 'CA',       'Civil Applications'),
  (18, 'C. REF',   'Civil Reference'),
  (19, 'CRA',      'Civil revision Application'),
  (20, 'CS',       'Civil Suits'),
  (21, 'CAP',      'Company Appeal'),
  (22, 'CAL',      'Company Applications'),
  (23, 'CALCR',    'Company Appln.(Criminal).'),
  (24, 'CMP',      'Company Petition'),
  (25, 'CPL',      'Contempt Appeal'),
  (26, 'CP',       'Contempt Petition'),
  (27, 'XOB',      'Cross Objection'),
  (28, 'CAPL',     'Custom Appeal'),
  (29, 'EP',       'Election Petition'),
  (30, 'EDR',      'Estate Duty Reference'),
  (31, 'FCA',      'Family Court Appeal'),
  (32, 'FA',       'First Appeal'),
  (33, 'GTA',      'Gift Tax Applicxation'),
  (34, 'GTR',      'Gift Tax Reference'),
  (35, 'ITL',      'Income Tax Appeal'),
  (36, 'ITA',      'Income Tax Application'),
  (37, 'ITR',      'Income Tax Reference'),
  (38, 'LPA',      'Letter Patent Appeal'),
  (39, 'MCA',      'Misc. Civil Applications'),
  (40, 'OLR',      'Official Liquidators Report'),
  (41, 'PIL',      'PUBLIC INTEREST LITIGATION'),
  (42, 'STA',      'Sales Tax Application'),
  (43, 'STR',      'Sales Tax Reference'),
  (44, 'SA',       'Second Appeal'),
  (45, 'WTL',      'Wealth Tax Appeal'),
  (46, 'WTA',      'Wealth Tax Application'),
  (47, 'WTR',      'Wealth Tax Reference'),
  (48, 'WP',       'Writ Petition'),
  (49, 'LD-VC-CW',  NULL),
  (50, 'LD-VC-PIL', NULL),
  (52, 'SMPIL',    'SUO MOTO PUBLIC INTEREST LITIGATION')
ON CONFLICT (id) DO UPDATE SET
  short_type = EXCLUDED.short_type,
  long_type  = EXCLUDED.long_type;

-- Bump the serial sequence past the highest explicit id so future inserts
-- (without an explicit id) don't collide.
SELECT setval(
  pg_get_serial_sequence('public.case_type', 'id'),
  (SELECT MAX(id) FROM public.case_type)
);

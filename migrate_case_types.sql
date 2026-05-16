-- Upsert all case types from the master list.
-- Rows are matched on id; short_code and long_name are updated if they differ.
-- Run in Supabase SQL editor (Database > SQL Editor).

INSERT INTO case_types (id, short_code, long_name) VALUES
  (1,  'AO',      'Appeal From Order'),
  (2,  'AA',      'Arbitration Appeal'),
  (3,  'ARA',     'Arbitration Application'),
  (4,  'ARP',     'Arbitration Petition'),
  (5,  'CAO',     'CA in (MCA/EP/CA/XOB)'),
  (6,  'CEL',     'Central Excise Appeal'),
  (7,  'CAM',     'Civil Application in AA'),
  (8,  'CAA',     'Civil Application in AO'),
  (9,  'CAE',     'Civil Application in C.REF'),
  (10, 'CAN',     'Civil Application in CP'),
  (11, 'CAC',     'Civil Application in CRA'),
  (12, 'CAF',     'Civil Application in FA'),
  (13, 'CAZ',     'Civil Application in LPA'),
  (14, 'CAS',     'Civil Application in SA'),
  (15, 'CAT',     'Civil Application in Tax Matters'),
  (16, 'CAW',     'Civil Application in WP'),
  (17, 'CA',      'Civil Applications'),
  (18, 'C. REF',  'Civil Reference'),
  (19, 'CRA',     'Civil Revision Application'),
  (20, 'CS',      'Civil Suits'),
  (21, 'CAP',     'Company Appeal'),
  (22, 'CAL',     'Company Applications'),
  (23, 'CALCR',   'Company Appln. (Criminal)'),
  (24, 'CMP',     'Company Petition'),
  (25, 'CPL',     'Contempt Appeal'),
  (26, 'CP',      'Contempt Petition'),
  (27, 'XOB',     'Cross Objection'),
  (28, 'CAPL',    'Custom Appeal'),
  (29, 'EP',      'Election Petition'),
  (30, 'EDR',     'Estate Duty Reference'),
  (31, 'FCA',     'Family Court Appeal'),
  (32, 'FA',      'First Appeal'),
  (33, 'GTA',     'Gift Tax Application'),
  (34, 'GTR',     'Gift Tax Reference'),
  (35, 'ITL',     'Income Tax Appeal'),
  (36, 'ITA',     'Income Tax Application'),
  (37, 'ITR',     'Income Tax Reference'),
  (38, 'LPA',     'Letter Patent Appeal'),
  (39, 'MCA',     'Misc. Civil Applications'),
  (40, 'OLR',     'Official Liquidators Report'),
  (41, 'PIL',     'Public Interest Litigation'),
  (42, 'STA',     'Sales Tax Application'),
  (43, 'STR',     'Sales Tax Reference'),
  (44, 'SA',      'Second Appeal'),
  (45, 'WTL',     'Wealth Tax Appeal'),
  (46, 'WTA',     'Wealth Tax Application'),
  (47, 'WTR',     'Wealth Tax Reference'),
  (48, 'WP',      'Writ Petition'),
  (49, 'LD-VC-CW',  'LD-VC-CW'),
  (50, 'LD-VC-PIL', 'LD-VC-PIL'),
  (51, 'SMPIL',   'Suo Moto Public Interest Litigation')
ON CONFLICT (id) DO UPDATE SET
  short_code = EXCLUDED.short_code,
  long_name  = EXCLUDED.long_name;

-- Remove any old case type rows whose id is not in the new list
-- (only deletes rows that no case currently references).
DELETE FROM case_types
WHERE id NOT IN (
  1,2,3,4,5,6,7,8,9,10,
  11,12,13,14,15,16,17,18,19,20,
  21,22,23,24,25,26,27,28,29,30,
  31,32,33,34,35,36,37,38,39,40,
  41,42,43,44,45,46,47,48,49,50,
  51
)
AND id NOT IN (
  SELECT DISTINCT case_type_id FROM cases WHERE case_type_id IS NOT NULL
);

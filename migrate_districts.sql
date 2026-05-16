-- Districts clean-up migration
-- Run in Supabase SQL Editor (Database → SQL Editor).
-- Safe: re-points all case records before deleting old rows.

-- ── STEP 0a: Drop NOT NULL on cases.district_id so unmatched cases
--             (non-Maharashtra districts) can be set to NULL temporarily.
ALTER TABLE cases ALTER COLUMN district_id DROP NOT NULL;

-- ── STEP 0b: Temporarily rename dirty rows whose name exactly matches a
--             canonical district name (avoids unique constraint violation).
--             The ILIKE patterns in step 2 still match the '__old' suffix.
UPDATE districts
SET name = name || '__old'
WHERE name IN (
  'GADCHIROLI','MUMBAI','YAVATMAL','WARDHA','WASHIM',
  'PUNE','NANDED','GARHCHIROLI','PARBHANI','BHANDARA',
  'HINGOLI','BETUL','AMRAVATI','SOLAPUR','BULDHANA',
  'NAGPUR','CHANDRAPUR','GONDIA','NASHIK','AKOLA','DHULE'
)
AND id NOT IN (27,28,33,38,40,51,53,54,55,56,59,60,62,63,65,66,67,68,69,70,71);


-- ── STEP 1: Insert / update the 21 canonical districts ────────────────────
INSERT INTO districts (id, name, division, is_active) VALUES
  (27, 'GADCHIROLI',  NULL, true),
  (28, 'MUMBAI',      NULL, true),
  (33, 'YAVATMAL',    NULL, true),
  (38, 'WARDHA',      NULL, true),
  (40, 'WASHIM',      NULL, true),
  (51, 'PUNE',        NULL, true),
  (53, 'NANDED',      NULL, true),
  (54, 'GARHCHIROLI', NULL, true),
  (55, 'PARBHANI',    NULL, true),
  (56, 'BHANDARA',    NULL, true),
  (59, 'HINGOLI',     NULL, true),
  (60, 'BETUL',       NULL, true),
  (62, 'AMRAVATI',    NULL, true),
  (63, 'SOLAPUR',     NULL, true),
  (65, 'BULDHANA',    NULL, true),
  (66, 'NAGPUR',      NULL, true),
  (67, 'CHANDRAPUR',  NULL, true),
  (68, 'GONDIA',      NULL, true),
  (69, 'NASHIK',      NULL, true),
  (70, 'AKOLA',       NULL, true),
  (71, 'DHULE',       NULL, true)
ON CONFLICT (id) DO UPDATE
  SET name      = EXCLUDED.name,
      is_active = true;


-- ── STEP 2: Re-point cases from dirty district IDs to canonical ones ───────

-- GADCHIROLI (27) — GADCHIOLI, GADCHIROLI
UPDATE cases SET district_id = 27
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%GADCH%' AND id <> 27
);

-- GARHCHIROLI (54)
UPDATE cases SET district_id = 54
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%GARHCH%' AND id <> 54
);

-- MUMBAI (28) — BOMBAY, BORIVALI, DOMBIVALI
UPDATE cases SET district_id = 28
WHERE district_id IN (
  SELECT id FROM districts
  WHERE (name ILIKE '%MUMBAI%'
      OR name ILIKE '%BOMBAY%'
      OR name ILIKE '%BORIVALI%'
      OR name ILIKE '%DOMBIVALI%')
    AND id <> 28
);

-- YAVATMAL (33)
UPDATE cases SET district_id = 33
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%YAVATMAL%' AND id <> 33
);

-- WARDHA (38)
UPDATE cases SET district_id = 38
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%WARDHA%' AND id <> 38
);

-- WASHIM (40)
UPDATE cases SET district_id = 40
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%WASHIM%' AND id <> 40
);

-- PUNE (51)
UPDATE cases SET district_id = 51
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%PUNE%' AND id <> 51
);

-- NANDED (53)
UPDATE cases SET district_id = 53
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%NANDED%' AND id <> 53
);

-- PARBHANI (55)
UPDATE cases SET district_id = 55
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%PARBHANI%' AND id <> 55
);

-- BHANDARA (56) — BHANDAR
UPDATE cases SET district_id = 56
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%BHANDAR%' AND id <> 56
);

-- HINGOLI (59)
UPDATE cases SET district_id = 59
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%HINGOLI%' AND id <> 59
);

-- BETUL (60) — BAITUL
UPDATE cases SET district_id = 60
WHERE district_id IN (
  SELECT id FROM districts
  WHERE (name ILIKE '%BETUL%' OR name ILIKE '%BAITUL%') AND id <> 60
);

-- AMRAVATI (62) — AMRAVTI, AMRAVATI.
UPDATE cases SET district_id = 62
WHERE district_id IN (
  SELECT id FROM districts
  WHERE (name ILIKE '%AMRAVATI%' OR name ILIKE '%AMRAVTI%') AND id <> 62
);

-- SOLAPUR (63) — ?OLAPUR
UPDATE cases SET district_id = 63
WHERE district_id IN (
  SELECT id FROM districts
  WHERE (name ILIKE '%SOLAPUR%' OR name ILIKE '%OLAPUR%') AND id <> 63
);

-- BULDHANA (65) — BULDANA, BULDHAN
UPDATE cases SET district_id = 65
WHERE district_id IN (
  SELECT id FROM districts
  WHERE (name ILIKE '%BULDHANA%'
      OR name ILIKE '%BULDANA%'
      OR name ILIKE '%BULDHAN%')
    AND id <> 65
);

-- NAGPUR (66)
UPDATE cases SET district_id = 66
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%NAGPUR%' AND id <> 66
);

-- CHANDRAPUR (67) — CHANDRAPR, CHANDRPUR, CHANDRAPUR.
UPDATE cases SET district_id = 67
WHERE district_id IN (
  SELECT id FROM districts
  WHERE (name ILIKE '%CHANDRAPUR%'
      OR name ILIKE '%CHANDRAPR%'
      OR name ILIKE '%CHANDRPUR%')
    AND id <> 67
);

-- GONDIA (68)
UPDATE cases SET district_id = 68
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%GONDIA%' AND id <> 68
);

-- NASHIK (69)
UPDATE cases SET district_id = 69
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%NASHIK%' AND id <> 69
);

-- AKOLA (70) — AKLOLA, AKOLA.
UPDATE cases SET district_id = 70
WHERE district_id IN (
  SELECT id FROM districts
  WHERE (name ILIKE '%AKOLA%' OR name ILIKE '%AKLOLA%') AND id <> 70
);

-- DHULE (71)
UPDATE cases SET district_id = 71
WHERE district_id IN (
  SELECT id FROM districts
  WHERE name ILIKE '%DHULE%' AND id <> 71
);


-- ── STEP 3: Null out cases still pointing to unrecognised districts ────────
-- These are cases filed from outside Maharashtra (Bhopal, Delhi, etc.).
-- district_id is now nullable so this succeeds.
UPDATE cases
SET district_id = NULL
WHERE district_id IN (
  SELECT id FROM districts
  WHERE id NOT IN (27,28,33,38,40,51,53,54,55,56,59,60,62,63,65,66,67,68,69,70,71)
);


-- ── STEP 4: Delete all dirty district rows ────────────────────────────────
DELETE FROM districts
WHERE id NOT IN (27,28,33,38,40,51,53,54,55,56,59,60,62,63,65,66,67,68,69,70,71);


-- ── STEP 5: Show how many cases now have no district (for your review) ─────
SELECT COUNT(*) AS cases_with_no_district FROM cases WHERE district_id IS NULL;

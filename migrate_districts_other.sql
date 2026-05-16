-- Assign the 611 unmatched cases to a new "OTHER" district.
-- Run in Supabase SQL Editor after migrate_districts.sql has completed.

-- Insert the OTHER district (id=1, safely below the dirty range of 2145+)
INSERT INTO districts (id, name, division, is_active)
VALUES (1, 'OTHER', NULL, true)
ON CONFLICT (id) DO UPDATE SET name = 'OTHER', is_active = true;

-- Point all NULL-district cases to it
UPDATE cases SET district_id = 1 WHERE district_id IS NULL;

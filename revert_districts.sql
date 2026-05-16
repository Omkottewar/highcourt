-- REVERT: Re-insert original dirty district rows (IDs 2145–2244)
-- Run in Supabase SQL Editor.
--
-- ⚠️  KNOWN LIMITATIONS:
--   1. Case district_id values CANNOT be reverted — cases now point to the
--      canonical IDs (1, 27, 28, 33, 38, 40, 51, 53, 54, 55, 56, 59, 60,
--      62, 63, 65, 66, 67, 68, 69, 70, 71). That mapping was not saved.
--   2. The 8 rows whose name exactly matches a canonical district are SKIPPED
--      (unique name constraint): AKOLA(2159), AMRAVATI(2163), BETUL(2185),
--      BHANDARA(2189), BULDHANA(2205), CHANDRAPUR(2210), DHULE(2234),
--      GADCHIROLI(2244).
--   3. Only IDs 2145–2244 are covered here. If more rows existed beyond 2244
--      in the original data, add them from your original CSV export.
--   For a COMPLETE restore use Supabase → Database → Backups (point-in-time).

INSERT INTO districts (id, name, is_active, created_at)
SELECT id, name, is_active, created_at
FROM (VALUES
  (2145, '----',                          true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2146, '1',                             true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2147, '3',                             true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2148, '?OLAPUR',                       true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2149, 'ADILABAD',                      true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2150, 'ADIPUR',                        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2151, 'AHAMEDNAGAR',                   true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2152, 'AHMADABAD',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2153, 'AHMADNAGAR',                    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2154, 'AHMEDABAD',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2155, 'AHMEDABAD (GUJARAT)',           true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2156, 'AHMEDABAD (GUJRAT)',            true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2157, 'AHMEDNAGAR',                    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2158, 'AKLOLA',                        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  -- 2159 AKOLA skipped — name conflicts with canonical district id=70
  (2160, 'AKOLA.',                        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2161, 'AM',                            true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2162, 'AMEHMDABAD',                    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  -- 2163 AMRAVATI skipped — name conflicts with canonical district id=62
  (2164, 'AMRAVATI.',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2165, 'AMRAVATI. 1',                   true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2166, 'AMRAVTI',                       true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2167, 'ANDHRA PARDESH',               true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2168, 'AURAMGABAD',                    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2169, 'AURANGABAD',                    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2170, 'AURANGABAD,',                   true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2171, 'BADNERA',                       true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2172, 'BAITUL',                        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2173, 'BAITUL (MP)',                   true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2174, 'BALAGAHAT(M.P)',               true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2175, 'BALAGHAT',                      true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2176, 'BALAGHAT (M. P.)',             true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2177, 'BALAGHAT (M.P.)',              true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2178, 'BANGLORE',                      true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2179, 'BARDDHAMAN WEST BENGAL',       true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2180, 'BARDWAN (WEST BENGAL)',        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2181, 'BEED',                          true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2182, 'BEGUMPETH, HYDERABAD',         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2183, 'BENGALURU',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2184, 'BENGALURU (KARNATAKA)',        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  -- 2185 BETUL skipped — name conflicts with canonical district id=60
  (2186, 'BETUL (M.P.)',                 true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2187, 'BETUL (MADHYAPRADESH)',        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2188, 'BHANDAR',                       true, '2026-05-07 12:45:08.007+00'::timestamptz),
  -- 2189 BHANDARA skipped — name conflicts with canonical district id=56
  (2190, 'BHATAPARA (CHHATTISGARH)',     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2191, 'BHILAI',                        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2192, 'BHILAI (C.G.)',               true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2193, 'BHILAI (CHATTISGARH)',         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2194, 'BHOPAL',                        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2195, 'BHOPAL (M.P.)',               true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2196, 'BHOPAL-MP',                    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2197, 'BHUSAWAL',                      true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2198, 'BILANPARA',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2199, 'BILASPUR (CHATTISGARH)',       true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2200, 'BILASPUR CHHATISGARD',         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2201, 'BOMBAY',                        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2202, 'BORIVALI',                      true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2203, 'BULDANA',                       true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2204, 'BULDHAN',                       true, '2026-05-07 12:45:08.007+00'::timestamptz),
  -- 2205 BULDHANA skipped — name conflicts with canonical district id=65
  (2206, 'BULDHANA.',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2207, 'BURHANPUR',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2208, 'BURHANPUR (MP)',               true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2209, 'CHANDRAPR',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  -- 2210 CHANDRAPUR skipped — name conflicts with canonical district id=67
  (2211, 'CHANDRAPUR              3',    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2212, 'CHANDRAPUR.',                   true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2213, 'CHANDRAPUR.  4',              true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2214, 'CHANDRPUR',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2215, 'CHATTISAGAD',                   true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2216, 'CHH. SAMBHAJINAGAR',           true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2217, 'CHHATRAPATI SAMBHAJINAGAR',    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2218, 'CHHATTISGARH',                 true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2219, 'CHHINDWADA',                    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2220, 'CHHINDWARA',                    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2221, 'CHHINDWARA (M.P.)',            true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2222, 'CHHINDWARA (M.p',             true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2223, 'CHINDWADA',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2224, 'CHINDWARA',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2225, 'DABHA',                         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2226, 'DARRI KORBA (CHATTISGARH)',    true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2227, 'DAVANGERE',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2228, 'DELHI',                         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2229, 'DELHI (STATE)',                true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2230, 'DEOLI',                         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2231, 'DERA BASSI',                   true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2232, 'DHAMTARI CHATTISGARH',         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2233, 'DHAMTARI CHHATTSGARH',         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  -- 2234 DHULE skipped — name conflicts with canonical district id=71
  (2235, 'DOMBIVALI',                     true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2236, 'DOMBIVALI (MUMBAI)',           true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2237, 'DUNGARPUR (RAJASTHAN)',        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2238, 'DURG',                          true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2239, 'DURG (CHHATISGARH)',           true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2240, 'EAST DELHI',                   true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2241, 'ERUMAKADU P.O KERALA',         true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2242, 'GACHIBOWLI(HYDERABAD)',        true, '2026-05-07 12:45:08.007+00'::timestamptz),
  (2243, 'GADCHIOLI',                     true, '2026-05-07 12:45:08.007+00'::timestamptz)
  -- 2244 GADCHIROLI skipped — name conflicts with canonical district id=27
) AS v(id, name, is_active, created_at)
WHERE NOT EXISTS (SELECT 1 FROM districts d WHERE d.name = v.name)
  AND NOT EXISTS (SELECT 1 FROM districts d WHERE d.id   = v.id);

-- Verify: count rows restored and list the 8 that were skipped
SELECT COUNT(*) AS rows_restored FROM districts WHERE id BETWEEN 2145 AND 2244;

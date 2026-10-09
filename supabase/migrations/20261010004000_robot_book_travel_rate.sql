SET lock_timeout = '3s';

-- Travel in the robot book at the owner's rate (v2.5034; the owner's call of 2026-10-09): $0.70 a mile, round
-- trip, once per job day. It replaces the interim rule (the lesser of $80 × miles and 10% of the building).
--
-- The 🤖 Robot Default book (price_book_versions.is_robot, no bid) holds one travel entry, fixture type
-- 'Travel & Rentals (per mile from office)', at $80.00 (rough-in $80, the other phases $0). That rate put
-- $23,464 of travel on a ~$49k Brownsville proto at 293 mi. It becomes $1.40 a count — $0.70 × 2, both ways,
-- per mile from the office — and the robot rows it at count = miles from the office × job days
-- (docs/twins/PLACEMENT.md): 293 mi is $410.20 a job day.
--
-- Data only, scoped to the robot book's global version and that one fixture type. The name stays, so past
-- bids' rows that match by name still do. Idempotent: a second run changes nothing.

UPDATE public.price_book_entries e
SET rough_in_price = 1.40,
    top_out_price = 0,
    trim_set_price = 0,
    total_price = 1.40
FROM public.price_book_versions v, public.fixture_types ft
WHERE e.version_id = v.id
  AND v.is_robot
  AND v.bid_id IS NULL
  AND e.fixture_type_id = ft.id
  AND ft.name = 'Travel & Rentals (per mile from office)'
  AND (e.total_price IS DISTINCT FROM 1.40 OR e.rough_in_price IS DISTINCT FROM 1.40
       OR e.top_out_price IS DISTINCT FROM 0 OR e.trim_set_price IS DISTINCT FROM 0);

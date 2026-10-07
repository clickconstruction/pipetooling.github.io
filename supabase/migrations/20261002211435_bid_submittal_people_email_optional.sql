SET lock_timeout = '3s';

-- Submittals: a reviewer the office names can have no email (2026-10-02).
--
-- The office types what a reviewer said onto the rows. Until now the person it is recorded
-- under needed an email, and the estimator often has none: she knows the GC said no, not which
-- address said it. The email stays the room's key for a person who comes back (the unique index
-- on (room_id, lower(email)) is untouched, and NULLs never collide in it); a person without
-- one is known by name. Additive: one constraint dropped, no row changes.
ALTER TABLE public.bid_submittal_people
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.bid_submittal_people.email IS
  'The room''s key for a person who comes back. NULL = a reviewer the office named without an address (how = named): known by name, and never emailed.';

SET lock_timeout = '3s';

-- The homestead question, answered or not (v2.6937, punch list #305, item 3 of the lien affidavit's short-form train).
--
-- customer_addresses.homestead is boolean NOT NULL DEFAULT false, so a property nobody asked about reads the
-- same as one answered no, and the Lien desk passed it as "Not a homestead". A lien on a homestead needs a
-- pre-work contract signed by both spouses and recorded (Tex. Prop. Code § 53.254), so "nobody asked" must not
-- read as "no". This column records that a person answered: NULL until someone says yes or no on the property
-- record, then the time of the answer. The desk holds an affidavit on a residential property while it is NULL
-- (affidavitGates in src/lib/jobs/lienDeskAffidavits.ts).
--
-- Additive and idempotent. No CREATE TABLE, so no fence calls: the table already carries the read-only blocks,
-- the twin fence and the archived seal. The client reads the column through select('*') and writes it only off
-- a row that carries it, so nothing fails before the push; before the push the desk does not judge the question.
-- Push right after the merge: from then on every residential property under an affidavit holds until answered.

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS homestead_answered_at timestamptz;

COMMENT ON COLUMN public.customer_addresses.homestead_answered_at IS
  'When a person answered the homestead question on this property record, yes or no (v2.6937). NULL means nobody answered: homestead is false by default, and the Lien desk holds a residential property''s affidavit until an answer is on record.';

-- A property already marked homestead was answered yes by whoever marked it. One row on prod on 2026-11-11.
UPDATE public.customer_addresses
   SET homestead_answered_at = COALESCE(updated_at, now())
 WHERE homestead = true
   AND homestead_answered_at IS NULL;

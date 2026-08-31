SET lock_timeout = '3s';

-- Reference grading (v2.2545): a fifth digest bucket. When a careful blind run
-- wildly disagrees with a sparse/weak historical reference, the honest verdict
-- can be "reference incomplete — robot plausibly right": the note digests as
-- reference_quality and becomes a data-repair task on the human bid instead of
-- falsely teaching doctrine. The robots fix the history they practice on.

ALTER TABLE public.bid_audit_notes
  DROP CONSTRAINT IF EXISTS bid_audit_notes_digest_outcome_check;
ALTER TABLE public.bid_audit_notes
  ADD CONSTRAINT bid_audit_notes_digest_outcome_check
  CHECK (digest_outcome IS NULL OR digest_outcome = ANY (ARRAY['doctrine'::text, 'books'::text, 'code'::text, 'bid_only'::text, 'reference_quality'::text]));

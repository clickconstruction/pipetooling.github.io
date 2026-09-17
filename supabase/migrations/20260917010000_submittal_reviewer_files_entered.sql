SET lock_timeout = '3s';

-- Submittals stage 5b (v2.3543): the drop zone and "entered by".
--   * bid_submittals.reviewer_files — a reviewer's redlined PDF or forwarded email, dropped on
--     the revision by the office ([{ path, name, kind: 'redline' | 'email', dropped_at,
--     dropped_by, dropped_by_name, person_id, person_name }]). The room never shows these.
--   * bid_submittal_items.decision_source — where a row's decision came from: the room (the
--     person tapped it), entered (the office typed it on the reviewer's behalf from their file),
--     robot (stage 6's read_redlines, confirmed by a person).
--   * decision_entered_by / _name — the office user who typed it, so the tab reads
--     "Revise · Dana Whitfield · entered by Wendi".
-- No table, no policy change: the pricing sharers already write both tables on bids they can price.

ALTER TABLE public.bid_submittals ADD COLUMN IF NOT EXISTS reviewer_files jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.bid_submittals.reviewer_files IS
  'Submittals 5b: the reviewer''s redlined PDFs / forwarded emails dropped on this revision by the office; objects in the bid-submittals bucket under <bid>/<rev>/reviewer/. Never shown on the room.';

ALTER TABLE public.bid_submittal_items ADD COLUMN IF NOT EXISTS decision_source text NOT NULL DEFAULT 'room';
ALTER TABLE public.bid_submittal_items ADD COLUMN IF NOT EXISTS decision_entered_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.bid_submittal_items ADD COLUMN IF NOT EXISTS decision_entered_by_name text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_submittal_items_decision_source_check') THEN
    ALTER TABLE public.bid_submittal_items
      ADD CONSTRAINT bid_submittal_items_decision_source_check CHECK (decision_source IN ('room', 'entered', 'robot'));
  END IF;
END $$;

COMMENT ON COLUMN public.bid_submittal_items.decision_source IS
  'Submittals 5b: room = the reviewer tapped it on the room; entered = the office typed it from the reviewer''s file on their behalf; robot = read from a redlined PDF and confirmed by a person (stage 6).';
COMMENT ON COLUMN public.bid_submittal_items.decision_entered_by IS 'Submittals 5b: the office user who entered the decision (decision_source entered / robot).';
COMMENT ON COLUMN public.bid_submittal_items.decision_entered_by_name IS 'Submittals 5b: that user''s name at the time, for the tab''s "entered by" line.';

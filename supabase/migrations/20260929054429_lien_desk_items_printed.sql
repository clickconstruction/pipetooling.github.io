SET lock_timeout = '3s';

-- v2.4119 — the Lien desk's run gains a printed state (punch list #56's neighbour, board 9 of the runway canvas).
-- "Print the packet" stamps the approved items it printed; the desk shows them in a pile of their own —
-- "In the mail · tracking owed" — until "Record the mailing" writes each notice with its tracking numbers.
-- Additive: two nullable columns, no constraint change, no policy change (the office's update policy already covers them).

ALTER TABLE public.job_lien_desk_items
  ADD COLUMN IF NOT EXISTS printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS printed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.job_lien_desk_items.printed_at IS 'When the run''s packet holding this notice was printed (v2.4119). An approved item with a printed_at sits in the desk''s "In the mail · tracking owed" pile until it is recorded as sent.';
COMMENT ON COLUMN public.job_lien_desk_items.printed_by IS 'Who printed the packet (v2.4119).';

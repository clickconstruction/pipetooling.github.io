-- Add a column to store the read-only deep link back to the source CountTooling
-- (counttooling.com) takeoff project. Captured automatically when a user imports
-- Counts whose pasted "Copy to /Tooling" payload includes the trailing
-- `View link:\t<url>` footer. Distinct from `count_tooling_link`
-- ("Marked up / cover page"), which is a manually-entered field.
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS count_tooling_plans_link text;

COMMENT ON COLUMN public.bids.count_tooling_plans_link IS
  'Read-only deep link back to the source CountTooling takeoff project, captured on Counts import.';

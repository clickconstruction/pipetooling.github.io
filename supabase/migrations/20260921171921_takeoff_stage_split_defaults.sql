SET lock_timeout = '3s';

-- Materials by stage, PR 4: the book and the assembly remember a stage split.
--
--   takeoff_book_entries.stage_split     — the fixture's split the book learned ("Remember" on a
--                                           finished fixture writes it); Fill from rules & book
--                                           applies it before the name rules (source 'book').
--   material_template_items.stage_split  — a part's split inside an assembly ("Remember for this
--                                           assembly" on a bundle part writes it); every bid that
--                                           uses the assembly reads it as the part's default,
--                                           between the bid's own line split and the fixture.
--
-- Shape: {"rough_in": 1, "top_out": 1, "trim_set": 0} — relative weights, as in
-- bid_takeoff_stage_splits. NULL = nothing learned. Additive; no data moves.

ALTER TABLE public.takeoff_book_entries
  ADD COLUMN IF NOT EXISTS stage_split jsonb NULL;
COMMENT ON COLUMN public.takeoff_book_entries.stage_split IS
  'Materials by stage: the fixture''s learned stage split {rough_in, top_out, trim_set} (relative weights). NULL = the name rules decide.';

ALTER TABLE public.material_template_items
  ADD COLUMN IF NOT EXISTS stage_split jsonb NULL;
COMMENT ON COLUMN public.material_template_items.stage_split IS
  'Materials by stage: this part''s stage split inside the assembly {rough_in, top_out, trim_set} (relative weights). NULL = follow the bid''s line / fixture.';

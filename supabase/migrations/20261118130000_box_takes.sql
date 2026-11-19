SET lock_timeout = '3s';

-- Take from a box: a take ties its rows and its photos together (the owner's ask of 2026-11-18: when someone goes to
-- take materials out of a box they take a photo of how they found the box, they mark the materials they are taking,
-- and they take a photo of the box after).
--
-- Until now a box photo was a photo of a box and nothing more: job_box_photos held no word for before or after, and
-- nothing tied a photo to the ledger rows of the parts that left. A person's Used press and the photo they took a
-- minute later were two unrelated rows.
--
-- Three columns, no table. A take is not a row of its own: it is an id minted on the phone when a person presses
-- Take from G12, written on every row that take makes.
--
--   job_box_photos.kind              'before' = the box as found, 'after' = the box after the parts left.
--                                    NULL = any other photo of a box, which is every photo taken before this file.
--   job_box_photos.take_id           the take this photo belongs to. NULL for a photo outside a take.
--   job_material_movements.take_id   the take this ledger row belongs to. NULL for a press outside a take.
--
-- What the rows say together, with no state column to keep true:
--   a before photo, rows and an after photo under one id   a whole take
--   rows with one photo missing                            a take with a photo skipped
--   a before photo and nothing else                        a take that was started and left
--
-- Written by the phone the way every other on-site row is written: an INSERT under the tables' own policies, which
-- ask on_site_can_touch_job. No new function, no new grant, no change to a policy or a trigger. The ledger takes no
-- UPDATE from anyone, so a row's take_id is fixed when it lands. on_site_guard_box_photo does not pin kind or
-- take_id on a later update by the photo's own taker; nothing on a screen changes either.
--
-- Additive and idempotent. Nullable columns with no default are a catalog change alone: no row is rewritten. The two
-- partial indexes cover only rows inside a take, of which there are none today. No CREATE TABLE, so no fence calls.
-- Nothing reads or writes the columns until the client that follows, and that client must not merge before this is
-- pushed: it names take_id in the read of every ledger row and every box photo.

ALTER TABLE public.job_box_photos
  ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.job_box_photos
  ADD COLUMN IF NOT EXISTS take_id uuid;
ALTER TABLE public.job_material_movements
  ADD COLUMN IF NOT EXISTS take_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_box_photos_kind_known' AND conrelid = 'public.job_box_photos'::regclass) THEN
    ALTER TABLE public.job_box_photos
      ADD CONSTRAINT job_box_photos_kind_known CHECK (kind IS NULL OR kind IN ('before', 'after'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS job_box_photos_take_idx ON public.job_box_photos (take_id) WHERE take_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_material_movements_take_idx ON public.job_material_movements (take_id) WHERE take_id IS NOT NULL;

COMMENT ON COLUMN public.job_box_photos.kind IS 'Take from a box: before = the box as found, after = the box after the parts left. NULL = a photo of a box outside a take.';
COMMENT ON COLUMN public.job_box_photos.take_id IS 'Take from a box: the take this photo belongs to, an id minted on the phone and shared with the take''s ledger rows. NULL for a photo outside a take.';
COMMENT ON COLUMN public.job_material_movements.take_id IS 'Take from a box: the take this row belongs to, an id minted on the phone and shared with the take''s photos. NULL for a press outside a take.';

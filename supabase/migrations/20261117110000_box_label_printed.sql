SET lock_timeout = '3s';

-- A box remembers when its label last went out (punch list #304; the owner's word of 2026-11-16 on the Print labels
-- mock-up's third call: "add a true 'not printed yet' mark").
--
-- Until now the app kept no record of which labels were printed. Print labels' Which job? window could only say which
-- boxes were added in the last seven days, which is a guess at the same question: a box added eight days ago with no
-- label read as done, and a box added yesterday and labelled the same hour read as waiting.
--
-- One column on the box. NULL means the app has not seen this box's label go out. A time means it has: the moment the
-- last copy of its strip left the printer, the print window closed on its page, or a person said the box already
-- wears a label. A box made before this column cannot be told apart from one that is waiting, so the client counts a
-- NULL as "not printed yet" only for a box made after the mark began, and says nothing about the older ones.
--
-- Written by the screens the way every other change to a box is written: an UPDATE of the row under the table's own
-- policy, job_containers_update, which asks on_site_can_touch_job. No new function and no new grant. The read-only
-- blocks, the twin fence and the archived seal already stand on job_containers, so training mode leaves no mark.
--
-- Additive and idempotent. A nullable column with no default is a catalog change alone: no row is rewritten. No
-- CREATE TABLE, so no fence calls. Nothing reads or writes the column until the client that follows, and that client
-- must not merge before this is pushed: it names the column in the read of every box.

ALTER TABLE public.job_containers
  ADD COLUMN IF NOT EXISTS label_printed_at timestamptz;

COMMENT ON COLUMN public.job_containers.label_printed_at IS 'Materials on site (#304): when this box''s label last went out, by the P-touch, by the print window, or by a person saying it already wears one. NULL: the app has not seen it printed. Cleared when a person takes the mark off.';

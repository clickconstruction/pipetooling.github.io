SET lock_timeout = '3s';

-- v2.7058 (punch list #328, PR 1 of 8): a task can carry a place.
--
-- A task is words, a day and people. It cannot say where the work is, and on a large property the street address
-- would not help: the task is at the pump house, the north gate, a corner of a field. This gives the task as written
-- (checklist_items, so a repeating task keeps its place every day) one optional place: a name and a point.
--
--   * place_name: what a person reads and presses, "Pump house". A place used before is offered by its name.
--   * place_lat, place_lng: the point. Both or neither, inside the globe's range.
--   * place_accuracy_m: how sure the phone was, in metres, when the place was set with Use where I am. Null when the
--     giver dragged the map, since a hand has no margin to report.
--   * place_set_by, place_set_at: who set it and when, shown to the doer so a place that has gone stale can be judged.
--
-- No screen reads or writes these yet. No new table, so no fence calls. Nothing changes for a task with no place:
-- every column is null and no default is stored.
--
-- Who may read and write: the row's own policies. The office, the task's maker and its assignees read it, and the
-- office or its maker writes it, as they do the title.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and each check is dropped before it is added.

ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS place_name text;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS place_lat double precision;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS place_lng double precision;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS place_accuracy_m integer;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS place_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS place_set_at timestamptz;

COMMENT ON COLUMN public.checklist_items.place_name IS 'Task places (#328): the place''s name, "Pump house". Null with no place.';
COMMENT ON COLUMN public.checklist_items.place_lat IS 'Task places (#328): the place''s latitude. Set with place_lng or not at all.';
COMMENT ON COLUMN public.checklist_items.place_lng IS 'Task places (#328): the place''s longitude. Set with place_lat or not at all.';
COMMENT ON COLUMN public.checklist_items.place_accuracy_m IS 'Task places (#328): the phone''s margin in metres when the place was set from where the giver stood. Null when the map was dragged.';
COMMENT ON COLUMN public.checklist_items.place_set_by IS 'Task places (#328): who set the place.';
COMMENT ON COLUMN public.checklist_items.place_set_at IS 'Task places (#328): when the place was set.';

-- A point is whole or absent, and on the globe. Both numbers are asked for by name: a check passes when its answer
-- is unknown, and a range test on a null is unknown, so half a point would otherwise slip through.
ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_place_point_check;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_place_point_check CHECK (
  (place_lat IS NULL AND place_lng IS NULL)
  OR (place_lat IS NOT NULL AND place_lng IS NOT NULL AND place_lat BETWEEN -90 AND 90 AND place_lng BETWEEN -180 AND 180)
);

-- A name, a margin, a setter and a day belong to a point. None stands without one.
ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_place_whole_check;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_place_whole_check CHECK (
  place_lat IS NOT NULL
  OR (place_name IS NULL AND place_accuracy_m IS NULL AND place_set_by IS NULL AND place_set_at IS NULL)
);

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_place_accuracy_check;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_place_accuracy_check CHECK (
  place_accuracy_m IS NULL OR place_accuracy_m >= 0
);

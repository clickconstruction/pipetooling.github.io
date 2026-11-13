SET lock_timeout = '3s';

-- v2.7064 (punch list #328, PR 6 of 8): the giver's photo of the spot.
--
-- A task's place says where. A photo says what it looks like. Until now only the person doing a task could put a
-- photo on it (task_photos, a shot on a day's card, proof of the work), and never when the task was made. So the
-- giver could not show the spot. This gives the task as written one optional photo of its own, taken by whoever
-- wrote the task.
--
-- It is kept apart from task_photos on purpose. Those are the doer's: they count toward the finish photo a task can
-- ask for, they ride the day's card, and the Drive sweep files them. A giver's picture among them would read as
-- proof of work, and would let a task that asks for a finishing photo close on a photo taken before it began.
--
--   * spot_photo_path on checklist_items and on checklist_tech_tree_group_tasks (a roadmap task, whose card reads it
--     through roadmap_group_task_id, as it reads the place): the object's name in the bucket, or null.
--   * The bucket task-spot-photos: private, 2 MB a file, images only. An object is named
--       item/<checklist_item_id>/<photo_id>.jpg      or      roadmap/<roadmap_task_id>/<photo_id>.jpg
--     so the gate reads its task from the name.
--   * can_write_task_spot_photo(name): whoever may write the task's Done when… lines may put its photo there, the
--     office or the task's maker, and for a roadmap task whoever may edit that roadmap (can_write_task_criteria). A
--     name of any other shape is refused, never raised on.
--   * Reading: whoever may read the task reads its photo. The policy asks the task's own table, so the task's own
--     row rules decide, as they do for the Done when… lines.
--
-- No new table, so no fence calls. Idempotent: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING, CREATE OR REPLACE,
-- and each check and policy is dropped before it is made.

ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS spot_photo_path text;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS spot_photo_path text;
COMMENT ON COLUMN public.checklist_items.spot_photo_path IS 'Task places (#328): the giver''s photo of the spot, an object name in the task-spot-photos bucket (item/<id>/<photo>.jpg). Null with no photo.';
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.spot_photo_path IS 'Task places (#328): the planner''s photo of the spot, an object name in the task-spot-photos bucket (roadmap/<id>/<photo>.jpg). Null with no photo.';

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_spot_photo_path_check;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_spot_photo_path_check CHECK (spot_photo_path IS NULL OR length(spot_photo_path) BETWEEN 1 AND 300);
ALTER TABLE public.checklist_tech_tree_group_tasks DROP CONSTRAINT IF EXISTS checklist_tech_tree_group_tasks_spot_photo_path_check;
ALTER TABLE public.checklist_tech_tree_group_tasks ADD CONSTRAINT checklist_tech_tree_group_tasks_spot_photo_path_check CHECK (spot_photo_path IS NULL OR length(spot_photo_path) BETWEEN 1 AND 300);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-spot-photos', 'task-spot-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_write_task_spot_photo(p_name text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts text[] := string_to_array(COALESCE(p_name, ''), '/');
  v_id uuid;
BEGIN
  -- <kind>/<task id>/<file>: three parts and no more.
  IF array_length(v_parts, 1) IS DISTINCT FROM 3 THEN
    RETURN false;
  END IF;
  IF v_parts[2] !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN false;
  END IF;
  v_id := v_parts[2]::uuid;
  IF v_parts[1] = 'item' THEN
    RETURN public.can_write_task_criteria(v_id, NULL);
  ELSIF v_parts[1] = 'roadmap' THEN
    RETURN public.can_write_task_criteria(NULL, v_id);
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.can_write_task_spot_photo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_task_spot_photo(text) TO authenticated;
COMMENT ON FUNCTION public.can_write_task_spot_photo(text) IS 'Task places (#328): may the caller put or remove the spot photo this object name belongs to? The task''s own write rule (can_write_task_criteria), read from item/<id>/… or roadmap/<id>/…. Any other name is refused.';

DROP POLICY IF EXISTS task_spot_photos_files_insert ON storage.objects;
CREATE POLICY task_spot_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-spot-photos' AND public.can_write_task_spot_photo(name));

-- Whoever may read the task reads its photo. Compared as text, so a name of another shape matches nothing and
-- never raises. A roadmap task's photo is also read by whoever has the list row made from it.
DROP POLICY IF EXISTS task_spot_photos_files_select ON storage.objects;
CREATE POLICY task_spot_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-spot-photos'
    AND (
      (split_part(name, '/', 1) = 'item' AND EXISTS (SELECT 1 FROM public.checklist_items i WHERE i.id::text = split_part(name, '/', 2)))
      OR (split_part(name, '/', 1) = 'roadmap' AND (
        EXISTS (SELECT 1 FROM public.checklist_tech_tree_group_tasks t WHERE t.id::text = split_part(name, '/', 2))
        OR EXISTS (SELECT 1 FROM public.checklist_items i WHERE i.roadmap_group_task_id::text = split_part(name, '/', 2))
      ))
    )
  );

DROP POLICY IF EXISTS task_spot_photos_files_delete ON storage.objects;
CREATE POLICY task_spot_photos_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-spot-photos' AND public.can_write_task_spot_photo(name));

SET lock_timeout = '3s';

-- Task cards: % done instead of a tick, Done when… lines, photos (punch list #273, PR 1 of six, v2.6592). Taunya's
-- ask of 2026-11-06 on the Checklist and Roadmap pages: a card carries how far along it is, what done means, and the
-- proof. This migration is the ground; the screens come in PRs 2 to 4 and read nothing here until then.
--
--   1. percent_complete on a card's day row (checklist_instances) and on a roadmap task; asks_for_photo on the card's
--      definition (checklist_items) and on a roadmap task, the writer's switch (on by itself once lines are written).
--   2. The thread (checklist_instance_events) takes two more kinds, progress (its percent column, the body the
--      "what is left" words) and criterion (a line ticked or unticked), written by the person in their own name.
--   3. task_criteria: the Done when… lines, on a card's definition or on a roadmap task (one, never both); a roadmap
--      task's lines serve every card the sync makes from it, so nothing is copied.
--   4. task_photos: a shot taken on a card at a %, at the finish or on a line, in the task-photos bucket until the
--      photo-save sweep files it in Drive (PR 4); task_criteria_checks: a line's tick on one day row, with its photo.
--   5. Two gates: can_see_checklist_instance (the office, an assignee, the card's writer) and can_work_checklist_instance
--      (the office, an assignee), the day row's own read and update rules as functions, so the new tables and the
--      bucket read the instance from a row or a path.
--   6. Triggers: a_task_percent_keeps_done keeps percent and completed_at agreed (done is 100, 100 is done, a reopen
--      starts the card over at 0 with its ticks cleared; the thread keeps who ticked what); a tick recounts the day
--      row's percent from its lines; the roadmap mirror now carries the percent too and fires on it.
--   7. The photo-save cron gains the eighth clause: it calls while a task photo waits.

-- 1. The percent and the switch.
ALTER TABLE public.checklist_instances ADD COLUMN IF NOT EXISTS percent_complete smallint NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checklist_instances_percent_complete_range') THEN
    ALTER TABLE public.checklist_instances ADD CONSTRAINT checklist_instances_percent_complete_range CHECK (percent_complete BETWEEN 0 AND 100);
  END IF;
END $$;
COMMENT ON COLUMN public.checklist_instances.percent_complete IS 'Task cards (#273): how far along this day row is, 0 to 100. A done row reads 100 whatever is stored (a_task_percent_keeps_done keeps them agreed); a card with Done when… lines carries the recount from its ticks.';

ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS percent_complete smallint NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checklist_tech_tree_group_tasks_percent_complete_range') THEN
    ALTER TABLE public.checklist_tech_tree_group_tasks ADD CONSTRAINT checklist_tech_tree_group_tasks_percent_complete_range CHECK (percent_complete BETWEEN 0 AND 100);
  END IF;
END $$;
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.percent_complete IS 'Task cards (#273): the task''s percent, mirrored from its card''s day row by sync_roadmap_task_from_instance, or set on the task card before a card exists. A stage''s bar adds the fractions.';

ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS asks_for_photo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.checklist_items.asks_for_photo IS 'Task cards (#273): the writer''s switch. On, the finish holds for a photo (a typed reason frees it); off, the card closes on its last tick or its Done. The dialogs turn it on when a Done when… line is written.';
ALTER TABLE public.checklist_tech_tree_group_tasks ADD COLUMN IF NOT EXISTS asks_for_photo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.checklist_tech_tree_group_tasks.asks_for_photo IS 'Task cards (#273): the same switch on a roadmap task; a card made from the task reads the task''s switch or its own.';

-- 2. The thread's two new kinds. The CHECK was inline on the CREATE TABLE (20260820010000), so it is found by what it
--    constrains rather than by a name, then written again with the two kinds.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checklist_instance_events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.checklist_instance_events DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.checklist_instance_events
  ADD CONSTRAINT checklist_instance_events_event_type_check
  CHECK (event_type IN ('completed', 'reopened', 'comment', 'accepted', 'progress', 'criterion'));
ALTER TABLE public.checklist_instance_events ADD COLUMN IF NOT EXISTS percent smallint;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checklist_instance_events_percent_range') THEN
    ALTER TABLE public.checklist_instance_events ADD CONSTRAINT checklist_instance_events_percent_range CHECK (percent IS NULL OR percent BETWEEN 0 AND 100);
  END IF;
END $$;
COMMENT ON COLUMN public.checklist_instance_events.percent IS 'Task cards (#273): on a progress event, the percent the person set; the body holds their what-is-left words. Null on every other kind.';

DROP POLICY IF EXISTS "Insert own comments on visible instances" ON public.checklist_instance_events;
CREATE POLICY "Insert own comments on visible instances" ON public.checklist_instance_events
  FOR INSERT WITH CHECK (
    event_type IN ('comment', 'progress', 'criterion')
    AND actor_user_id = (SELECT auth.uid())
    AND (event_type <> 'progress' OR percent IS NOT NULL)
    AND EXISTS (SELECT 1 FROM public.checklist_instances i WHERE i.id = instance_id)
  );

-- 5. The two gates, the day row's own rules as functions.
CREATE OR REPLACE FUNCTION public.can_see_checklist_instance(p_instance_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_instance_id IS NOT NULL AND (
    public.is_dev_or_master_or_assistant()
    OR EXISTS (
      SELECT 1 FROM public.checklist_instance_assignees a
      WHERE a.checklist_instance_id = p_instance_id AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.checklist_instances i
      WHERE i.id = p_instance_id AND public.checklist_item_created_by_auth_user(i.checklist_item_id)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_see_checklist_instance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_checklist_instance(uuid) TO authenticated;
COMMENT ON FUNCTION public.can_see_checklist_instance(uuid) IS 'Task cards (#273): the day row''s read rule as a function: the office, an assignee, or the card''s writer. task_criteria_checks, task_photos and the task-photos bucket read the instance through it.';

CREATE OR REPLACE FUNCTION public.can_work_checklist_instance(p_instance_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_instance_id IS NOT NULL AND (
    public.is_dev_or_master_or_assistant()
    OR EXISTS (
      SELECT 1 FROM public.checklist_instance_assignees a
      WHERE a.checklist_instance_id = p_instance_id AND a.user_id = auth.uid()
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_work_checklist_instance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_work_checklist_instance(uuid) TO authenticated;
COMMENT ON FUNCTION public.can_work_checklist_instance(uuid) IS 'Task cards (#273): the day row''s update rule as a function: the office or an assignee. A tick, a percent and a photo are written through it.';

CREATE OR REPLACE FUNCTION public.can_write_task_criteria(p_item_id uuid, p_task_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_item_id IS NOT NULL THEN
      public.is_dev_or_master_or_assistant()
      OR (public.can_define_task_style_checklist_items() AND public.checklist_item_created_by_auth_user(p_item_id))
    WHEN p_task_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.checklist_tech_tree_group_tasks t
      JOIN public.checklist_tech_tree_groups g ON g.id = t.group_id
      WHERE t.id = p_task_id AND public.can_edit_checklist_tech_tree_structure_for_roadmap(g.roadmap_id)
    )
    ELSE false
  END;
$$;
REVOKE ALL ON FUNCTION public.can_write_task_criteria(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_task_criteria(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.can_write_task_criteria(uuid, uuid) IS 'Task cards (#273): who writes a Done when… line: on a card, whoever may write the card (the office, or its writer under the task-style rule); on a roadmap task, whoever edits the roadmap''s structure.';

-- 3. The lines.
CREATE TABLE IF NOT EXISTS public.task_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  roadmap_task_id uuid REFERENCES public.checklist_tech_tree_group_tasks(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 200),
  sort_index integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  CONSTRAINT task_criteria_one_parent CHECK ((checklist_item_id IS NULL) <> (roadmap_task_id IS NULL))
);
CREATE INDEX IF NOT EXISTS task_criteria_item_idx ON public.task_criteria (checklist_item_id, sort_index) WHERE checklist_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS task_criteria_task_idx ON public.task_criteria (roadmap_task_id, sort_index) WHERE roadmap_task_id IS NOT NULL;
COMMENT ON TABLE public.task_criteria IS 'Task cards (#273): the Done when… lines a card''s writer lists, on the card''s definition or on a roadmap task (one, never both). A line is retired, never rewritten, once a tick names it; a card with live lines derives its percent from the ticks.';

ALTER TABLE public.task_criteria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_criteria_select ON public.task_criteria;
CREATE POLICY task_criteria_select ON public.task_criteria FOR SELECT TO authenticated
  USING (
    (checklist_item_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.checklist_items i WHERE i.id = checklist_item_id))
    OR (roadmap_task_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.checklist_tech_tree_group_tasks t WHERE t.id = roadmap_task_id)
      OR EXISTS (SELECT 1 FROM public.checklist_items i WHERE i.roadmap_group_task_id = roadmap_task_id)
    ))
  );
DROP POLICY IF EXISTS task_criteria_insert ON public.task_criteria;
CREATE POLICY task_criteria_insert ON public.task_criteria FOR INSERT TO authenticated
  WITH CHECK (public.can_write_task_criteria(checklist_item_id, roadmap_task_id) AND created_by = auth.uid());
DROP POLICY IF EXISTS task_criteria_update ON public.task_criteria;
CREATE POLICY task_criteria_update ON public.task_criteria FOR UPDATE TO authenticated
  USING (public.can_write_task_criteria(checklist_item_id, roadmap_task_id))
  WITH CHECK (public.can_write_task_criteria(checklist_item_id, roadmap_task_id));
DROP POLICY IF EXISTS task_criteria_delete ON public.task_criteria;
CREATE POLICY task_criteria_delete ON public.task_criteria FOR DELETE TO authenticated
  USING (public.can_write_task_criteria(checklist_item_id, roadmap_task_id));

-- 4a. The photos: the report_photos shape (20261029220000), keyed on the day row.
CREATE TABLE IF NOT EXISTS public.task_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.checklist_instances(id) ON DELETE CASCADE,
  criterion_id uuid REFERENCES public.task_criteria(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'progress' CHECK (kind IN ('progress', 'finish', 'line')),
  percent_at smallint CHECK (percent_at IS NULL OR percent_at BETWEEN 0 AND 100),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 200),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  taken_at timestamptz NOT NULL DEFAULT now(),
  bytes integer NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  original_bytes integer NOT NULL DEFAULT 0 CHECK (original_bytes >= 0),
  width integer NOT NULL DEFAULT 0 CHECK (width >= 0),
  height integer NOT NULL DEFAULT 0 CHECK (height >= 0),
  storage_path text CHECK (length(storage_path) <= 300),
  drive_file_id text CHECK (length(drive_file_id) <= 120),
  filed_at timestamptz,
  fail_why text CHECK (length(fail_why) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_photos_instance_idx ON public.task_photos (instance_id, taken_at);
CREATE INDEX IF NOT EXISTS task_photos_unfiled_idx ON public.task_photos (taken_at) WHERE filed_at IS NULL AND storage_path IS NOT NULL;
COMMENT ON TABLE public.task_photos IS 'Task cards (#273): a photo taken on a card, at a percent (progress), at the finish (finish) or on a Done when… line (line). The phone shrinks the shot into the task-photos bucket; the photo-save sweep files it under the Tasks folder in Drive, writes drive_file_id and filed_at, and deletes the bucket copy. fail_why is why it is not in Drive yet.';

ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_photos_select ON public.task_photos;
CREATE POLICY task_photos_select ON public.task_photos FOR SELECT TO authenticated USING (public.can_see_checklist_instance(instance_id));
DROP POLICY IF EXISTS task_photos_insert_own ON public.task_photos;
CREATE POLICY task_photos_insert_own ON public.task_photos FOR INSERT TO authenticated
  WITH CHECK (public.can_work_checklist_instance(instance_id) AND by_user_id = auth.uid());
DROP POLICY IF EXISTS task_photos_update_own ON public.task_photos;
CREATE POLICY task_photos_update_own ON public.task_photos FOR UPDATE TO authenticated
  USING (by_user_id = auth.uid())
  WITH CHECK (by_user_id = auth.uid());
-- A shot the sweep has not filed yet may be discarded by its taker; a filed one stays, Drive holds it.
DROP POLICY IF EXISTS task_photos_delete_unfiled_own ON public.task_photos;
CREATE POLICY task_photos_delete_unfiled_own ON public.task_photos FOR DELETE TO authenticated
  USING (by_user_id = auth.uid() AND filed_at IS NULL);

-- The bucket: private, 2 MB a file, images only. Objects are named <instance_id>/<photo_id>.jpg, so the gate reads the
-- day row from the path. The sweep deletes with the service role; the taker may delete their own unfiled shot.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-photos', 'task-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS task_photos_files_insert ON storage.objects;
CREATE POLICY task_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-photos' AND public.can_work_checklist_instance(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS task_photos_files_select ON storage.objects;
CREATE POLICY task_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-photos' AND public.can_see_checklist_instance(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS task_photos_files_delete_own ON storage.objects;
CREATE POLICY task_photos_files_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-photos' AND owner = auth.uid());

-- 4b. The ticks: one per line per day row, with the photo that proves it when one was taken.
CREATE TABLE IF NOT EXISTS public.task_criteria_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id uuid NOT NULL REFERENCES public.task_criteria(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.checklist_instances(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  photo_id uuid REFERENCES public.task_photos(id) ON DELETE SET NULL,
  UNIQUE (criterion_id, instance_id)
);
CREATE INDEX IF NOT EXISTS task_criteria_checks_instance_idx ON public.task_criteria_checks (instance_id);
COMMENT ON TABLE public.task_criteria_checks IS 'Task cards (#273): a Done when… line ticked on one day row, by whom and when, with its photo. An untick deletes the row; the thread''s criterion events keep the history. A reopen clears the day row''s ticks.';

ALTER TABLE public.task_criteria_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_criteria_checks_select ON public.task_criteria_checks;
CREATE POLICY task_criteria_checks_select ON public.task_criteria_checks FOR SELECT TO authenticated USING (public.can_see_checklist_instance(instance_id));
DROP POLICY IF EXISTS task_criteria_checks_insert ON public.task_criteria_checks;
CREATE POLICY task_criteria_checks_insert ON public.task_criteria_checks FOR INSERT TO authenticated
  WITH CHECK (public.can_work_checklist_instance(instance_id) AND checked_by = auth.uid());
DROP POLICY IF EXISTS task_criteria_checks_update ON public.task_criteria_checks;
CREATE POLICY task_criteria_checks_update ON public.task_criteria_checks FOR UPDATE TO authenticated
  USING (public.can_work_checklist_instance(instance_id))
  WITH CHECK (public.can_work_checklist_instance(instance_id));
DROP POLICY IF EXISTS task_criteria_checks_delete ON public.task_criteria_checks;
CREATE POLICY task_criteria_checks_delete ON public.task_criteria_checks FOR DELETE TO authenticated
  USING (public.can_work_checklist_instance(instance_id));

-- 6a. Percent and done agree. Named to sort before checklist_instance_transitions_trigger (BEFORE triggers fire by
--     name), so a 100 that sets completed_at here is logged as completed there and lands in the Review queue as a tick
--     does. A reopen (completed_at set back to null) starts the card over: percent 0 and the day row's ticks cleared.
CREATE OR REPLACE FUNCTION public.task_percent_keeps_done()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.completed_at IS NOT NULL AND NEW.completed_at IS NULL THEN
    NEW.percent_complete := 0;
    DELETE FROM public.task_criteria_checks WHERE instance_id = NEW.id;
  ELSIF NEW.completed_at IS NOT NULL THEN
    NEW.percent_complete := 100;
  ELSIF NEW.percent_complete = 100 AND COALESCE(OLD.percent_complete, 0) <> 100 THEN
    NEW.completed_at := now();
    NEW.completed_by_user_id := COALESCE(NEW.completed_by_user_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_task_percent_keeps_done ON public.checklist_instances;
CREATE TRIGGER a_task_percent_keeps_done
  BEFORE UPDATE ON public.checklist_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.task_percent_keeps_done();

-- 6b. A tick recounts the day row's percent from its live lines. The reopen above deletes ticks at depth 2; that pass is
--     skipped, since the reopen has already set the row to 0 and the row is mid-update.
CREATE OR REPLACE FUNCTION public.task_criteria_checks_recount()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance uuid;
  v_item uuid;
  v_task uuid;
  v_total integer;
  v_ticked integer;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;
  v_instance := COALESCE(NEW.instance_id, OLD.instance_id);
  SELECT i.checklist_item_id, it.roadmap_group_task_id INTO v_item, v_task
  FROM public.checklist_instances i JOIN public.checklist_items it ON it.id = i.checklist_item_id
  WHERE i.id = v_instance;
  SELECT count(*) INTO v_total FROM public.task_criteria c
  WHERE c.retired_at IS NULL AND ((v_item IS NOT NULL AND c.checklist_item_id = v_item) OR (v_task IS NOT NULL AND c.roadmap_task_id = v_task));
  IF COALESCE(v_total, 0) = 0 THEN
    RETURN NULL;
  END IF;
  SELECT count(*) INTO v_ticked FROM public.task_criteria_checks k
  JOIN public.task_criteria c ON c.id = k.criterion_id
  WHERE k.instance_id = v_instance AND c.retired_at IS NULL;
  BEGIN
    UPDATE public.checklist_instances
    SET percent_complete = LEAST(100, GREATEST(0, round(100.0 * v_ticked / v_total)))::smallint
    WHERE id = v_instance AND completed_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'task percent recount failed for instance %: %', v_instance, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS task_criteria_checks_recount_aiud ON public.task_criteria_checks;
CREATE TRIGGER task_criteria_checks_recount_aiud
  AFTER INSERT OR DELETE ON public.task_criteria_checks
  FOR EACH ROW
  EXECUTE FUNCTION public.task_criteria_checks_recount();

-- 6c. The roadmap mirror (20260820041532) now carries the percent and fires when the percent moves, so a stage's bar
--     adds the fractions. Written whole, as the rule for a replaced function asks.
CREATE OR REPLACE FUNCTION public.sync_roadmap_task_from_instance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
BEGIN
  IF (OLD.completed_at IS NULL) = (NEW.completed_at IS NULL) AND OLD.percent_complete IS NOT DISTINCT FROM NEW.percent_complete THEN
    RETURN NEW;
  END IF;
  SELECT i.roadmap_group_task_id INTO v_task_id
  FROM public.checklist_items i
  WHERE i.id = NEW.checklist_item_id AND i.roadmap_group_task_id IS NOT NULL;
  IF v_task_id IS NULL THEN
    RETURN NEW;
  END IF;
  BEGIN
    UPDATE public.checklist_tech_tree_group_tasks
    SET completed_at = NEW.completed_at,
        completed_by_user_id = CASE WHEN NEW.completed_at IS NULL THEN NULL ELSE NEW.completed_by_user_id END,
        percent_complete = NEW.percent_complete
    WHERE id = v_task_id
      AND (completed_at IS DISTINCT FROM NEW.completed_at OR percent_complete IS DISTINCT FROM NEW.percent_complete);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'roadmap task sync failed for instance %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_roadmap_task_from_instance_au ON public.checklist_instances;
CREATE TRIGGER sync_roadmap_task_from_instance_au
  AFTER UPDATE OF completed_at, percent_complete ON public.checklist_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_roadmap_task_from_instance();

-- 7. The cron: the seven clauses of 20261106050000 and the eighth, a task photo waiting. Unscheduled first, so a second
--    run leaves one row.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'photo-save';

SELECT cron.schedule(
  'photo-save',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/photo-save',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.photo_saves WHERE on_since IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.report_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL AND report_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_answers WHERE photo_filed_at IS NULL AND photo_storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_photo_notes WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.machine_check_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_records WHERE pdf_filed_at IS NULL AND pdf_tries < 5)
     OR EXISTS (SELECT 1 FROM public.task_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL);
  $$
);

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal on the new tables.
select public.apply_read_only_write_blocks();
select public.apply_read_only_stmt_blocks();
select public.apply_digital_twin_write_blocks();
select public.apply_archived_read_blocks();

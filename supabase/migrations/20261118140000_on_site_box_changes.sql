SET lock_timeout = '3s';

-- ===============================================================================================================
-- Materials on site: who changed a box, and who took an answer off.
--
-- A site's By person look reads every press by who made it. Three kinds of change left no person behind:
--   a box retired or brought back        job_containers.retired_at holds the day and nobody's name
--   a box's kind, where line or words    the row is updated in place and the old value is gone
--   a part tie or a site price deleted   the row is gone, with whoever answered it and whoever took it off
-- A box's name already keeps its history (job_container_names) and a box moved between places is a row of
-- job_container_moves. This file gives the rest the same treatment: a trigger writes one insert-only row a
-- change, in the caller's own name, for every client at once. Nothing here changes what anyone may do.
--
--   job_container_changes                 one row a change to a box: what, the old value, the new one, who, when
--   job_containers_keep_changes           AFTER UPDATE on job_containers: a row for each of the four that moved
--   on_site_removed_answers               one row a tie or a price deleted: which table, the row as it stood, who
--   on_site_keep_removed_answer           BEFORE DELETE on on_site_part_ties and on_site_prices
--
-- Both tables are read by the rule of the rows they describe and written by their trigger alone: no INSERT,
-- UPDATE or DELETE policy exists, so no client can add, change or remove a line of either.
-- ===============================================================================================================

-- ---------------------------------------------------------------------------------------------------------------
-- 1. A change to a box.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_container_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.job_containers(id) ON DELETE CASCADE,
  what text NOT NULL CHECK (what IN ('retired', 'brought_back', 'kind', 'where', 'said')),
  old_value text NOT NULL DEFAULT '' CHECK (length(old_value) <= 200),
  new_value text NOT NULL DEFAULT '' CHECK (length(new_value) <= 200),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_container_changes_container_idx ON public.job_container_changes (container_id, at);
COMMENT ON TABLE public.job_container_changes IS 'Materials on site: a box retired, brought back, or its kind, where line or words changed, insert only: what, the old value, the new one, who and when. Written by a trigger on job_containers and by nothing else. A box''s name is job_container_names and a move between places is job_container_moves.';

CREATE OR REPLACE FUNCTION public.job_containers_keep_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_who uuid := auth.uid();
  v_name text := public.box_sticker_caller_name();
BEGIN
  IF OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
    INSERT INTO public.job_container_changes (container_id, what, by_user_id, by_name) VALUES (NEW.id, 'retired', v_who, v_name);
  ELSIF OLD.retired_at IS NOT NULL AND NEW.retired_at IS NULL THEN
    INSERT INTO public.job_container_changes (container_id, what, by_user_id, by_name) VALUES (NEW.id, 'brought_back', v_who, v_name);
  END IF;
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    INSERT INTO public.job_container_changes (container_id, what, old_value, new_value, by_user_id, by_name)
    VALUES (NEW.id, 'kind', OLD.kind, NEW.kind, v_who, v_name);
  END IF;
  IF OLD.where_note IS DISTINCT FROM NEW.where_note THEN
    INSERT INTO public.job_container_changes (container_id, what, old_value, new_value, by_user_id, by_name)
    VALUES (NEW.id, 'where', left(COALESCE(OLD.where_note, ''), 200), left(COALESCE(NEW.where_note, ''), 200), v_who, v_name);
  END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO public.job_container_changes (container_id, what, old_value, new_value, by_user_id, by_name)
    VALUES (NEW.id, 'said', left(COALESCE(OLD.description, ''), 200), left(COALESCE(NEW.description, ''), 200), v_who, v_name);
  END IF;
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.job_containers_keep_changes() IS 'Materials on site: AFTER UPDATE on job_containers. One job_container_changes row for each of a retire, a bring-back, the kind, the where line and the words that moved, in the caller''s own name, for every client at once.';
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_changes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_changes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_changes() FROM authenticated;
CREATE OR REPLACE TRIGGER job_containers_keep_changes AFTER UPDATE OF retired_at, kind, where_note, description ON public.job_containers
  FOR EACH ROW WHEN (
    OLD.retired_at IS DISTINCT FROM NEW.retired_at OR OLD.kind IS DISTINCT FROM NEW.kind
    OR OLD.where_note IS DISTINCT FROM NEW.where_note OR OLD.description IS DISTINCT FROM NEW.description
  ) EXECUTE FUNCTION public.job_containers_keep_changes();

ALTER TABLE public.job_container_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_container_changes FROM anon, authenticated;
GRANT SELECT ON TABLE public.job_container_changes TO authenticated;
GRANT ALL ON TABLE public.job_container_changes TO service_role;
DROP POLICY IF EXISTS job_container_changes_select ON public.job_container_changes;
CREATE POLICY job_container_changes_select ON public.job_container_changes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = container_id AND public.on_site_can_touch_job(c.job_id)));

-- ---------------------------------------------------------------------------------------------------------------
-- 2. An answer taken off: a part tie or a site price deleted.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.on_site_removed_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer text NOT NULL CHECK (answer IN ('tie', 'price')),
  -- The scope the answer stood on, as its own row carried it: one of the two, never both.
  development_id uuid REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- The row as it stood, whole: enough to read what it said and to put it back.
  was jsonb NOT NULL,
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS on_site_removed_answers_development_idx ON public.on_site_removed_answers (development_id, at) WHERE development_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS on_site_removed_answers_job_idx ON public.on_site_removed_answers (job_id, at) WHERE job_id IS NOT NULL;
COMMENT ON TABLE public.on_site_removed_answers IS 'Materials on site: a part tie (on_site_part_ties) or a site price (on_site_prices) deleted, insert only: which, its scope, the row as it stood, who took it off and when. Written by a trigger on the two tables and by nothing else.';

CREATE OR REPLACE FUNCTION public.on_site_keep_removed_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- A scope that is going away takes its answers with it (ON DELETE CASCADE): those are not a person's act,
  -- and a row here pointing at the vanishing job or development would be refused.
  IF OLD.development_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.developments d WHERE d.id = OLD.development_id) THEN
    RETURN OLD;
  END IF;
  IF OLD.job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = OLD.job_id) THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.on_site_removed_answers (answer, development_id, job_id, was, by_user_id, by_name)
  VALUES (TG_ARGV[0], OLD.development_id, OLD.job_id, to_jsonb(OLD), auth.uid(), public.box_sticker_caller_name());
  RETURN OLD;
END;
$fn$;
COMMENT ON FUNCTION public.on_site_keep_removed_answer() IS 'Materials on site: BEFORE DELETE on on_site_part_ties (''tie'') and on_site_prices (''price''). Keeps the row as it stood with who took it off. A row that goes with its job or development is not kept.';
REVOKE EXECUTE ON FUNCTION public.on_site_keep_removed_answer() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_keep_removed_answer() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_site_keep_removed_answer() FROM authenticated;
CREATE OR REPLACE TRIGGER on_site_part_ties_keep_removed BEFORE DELETE ON public.on_site_part_ties
  FOR EACH ROW EXECUTE FUNCTION public.on_site_keep_removed_answer('tie');
CREATE OR REPLACE TRIGGER on_site_prices_keep_removed BEFORE DELETE ON public.on_site_prices
  FOR EACH ROW EXECUTE FUNCTION public.on_site_keep_removed_answer('price');

ALTER TABLE public.on_site_removed_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.on_site_removed_answers FROM anon, authenticated;
GRANT SELECT ON TABLE public.on_site_removed_answers TO authenticated;
GRANT ALL ON TABLE public.on_site_removed_answers TO service_role;
DROP POLICY IF EXISTS on_site_removed_answers_select ON public.on_site_removed_answers;
CREATE POLICY on_site_removed_answers_select ON public.on_site_removed_answers FOR SELECT TO authenticated
  USING (public.on_site_can_tie_parts() AND public.on_site_can_read_ties(development_id, job_id));

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();

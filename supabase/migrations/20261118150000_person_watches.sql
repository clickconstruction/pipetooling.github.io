SET lock_timeout = '3s';

-- ===============================================================================================================
-- A watch on what one person does with the material on site.
--
-- The office keeps a person's access to a site's material and wants to see what they do with it. A dev turns a
-- watch on for that person. The watch changes nothing the person may do and nothing they see: it is a mark only
-- devs can read, a list of who to tell, and a quiet log of the boxes the person opened.
--
--   person_watches            one row a watch: who is watched, why, who to tell, who set it, and who lifted it
--   watched_box_opens         one row each time a watched person opened a box on a screen
--   on_site_note_box_open     the box screens call it for everyone; it writes only for a watched caller
--
-- Dev-only by RLS, like the HR file: no other role reads a row of either table, the watched person included.
-- A watch is lifted, never deleted, and a box open is insert only through the function.
-- ===============================================================================================================

CREATE TABLE IF NOT EXISTS public.person_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The person watched.
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  why text NOT NULL DEFAULT '' CHECK (length(why) <= 500),
  -- Who hears about it. Empty means nobody is told and the By person look is the only reader.
  tell_user_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(tell_user_ids) <= 12),
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  set_by_name text NOT NULL DEFAULT '' CHECK (length(set_by_name) <= 120),
  set_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  lifted_by_name text NOT NULL DEFAULT '' CHECK (length(lifted_by_name) <= 120),
  lifted_why text NOT NULL DEFAULT '' CHECK (length(lifted_why) <= 500)
);
-- One live watch a person. A lifted one stays as the record of when the person was watched.
CREATE UNIQUE INDEX IF NOT EXISTS person_watches_live_key ON public.person_watches (user_id) WHERE lifted_at IS NULL;
COMMENT ON TABLE public.person_watches IS 'A watch on what one person does with the material on site: who, why, who to tell, who set it and when, and who lifted it. One live watch a person; lifted, never deleted. Dev-only by RLS: the watched person cannot read it.';

-- Who set it and who lifted it are the caller, whatever the client sent.
CREATE OR REPLACE FUNCTION public.person_watches_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.set_by := auth.uid();
    NEW.set_by_name := public.box_sticker_caller_name();
    NEW.set_at := now();
    NEW.lifted_at := NULL;
    NEW.lifted_by := NULL;
    NEW.lifted_by_name := '';
    NEW.lifted_why := '';
    RETURN NEW;
  END IF;
  -- An update may change the reason, who is told, and lift the watch once. Who is watched and who set it stand.
  NEW.user_id := OLD.user_id;
  NEW.set_by := OLD.set_by;
  NEW.set_by_name := OLD.set_by_name;
  NEW.set_at := OLD.set_at;
  IF OLD.lifted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This watch was lifted. Turn a new one on instead.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.lifted_at IS NOT NULL THEN
    NEW.lifted_at := now();
    NEW.lifted_by := auth.uid();
    NEW.lifted_by_name := public.box_sticker_caller_name();
  ELSE
    NEW.lifted_by := NULL;
    NEW.lifted_by_name := '';
    NEW.lifted_why := '';
  END IF;
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.person_watches_stamp() IS 'BEFORE INSERT OR UPDATE on person_watches: who set a watch and who lifted it are the caller, the watched person and the setter never change, and a lifted watch is closed.';
REVOKE EXECUTE ON FUNCTION public.person_watches_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.person_watches_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.person_watches_stamp() FROM authenticated;
CREATE OR REPLACE TRIGGER person_watches_stamp BEFORE INSERT OR UPDATE ON public.person_watches
  FOR EACH ROW EXECUTE FUNCTION public.person_watches_stamp();

ALTER TABLE public.person_watches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS person_watches_select ON public.person_watches;
CREATE POLICY person_watches_select ON public.person_watches FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS person_watches_insert ON public.person_watches;
CREATE POLICY person_watches_insert ON public.person_watches FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS person_watches_update ON public.person_watches;
CREATE POLICY person_watches_update ON public.person_watches FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());

-- ---------------------------------------------------------------------------------------------------------------
-- The boxes a watched person opened.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.watched_box_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id uuid NOT NULL REFERENCES public.person_watches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  container_id uuid NOT NULL REFERENCES public.job_containers(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watched_box_opens_user_idx ON public.watched_box_opens (user_id, at);
CREATE INDEX IF NOT EXISTS watched_box_opens_container_idx ON public.watched_box_opens (container_id, at);
COMMENT ON TABLE public.watched_box_opens IS 'A box a watched person opened on a screen, insert only through on_site_note_box_open: the watch, the person, the box and when. The phone reports the open, so a person who never opens the screen leaves no row. Dev-only by RLS.';

ALTER TABLE public.watched_box_opens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watched_box_opens_select ON public.watched_box_opens;
CREATE POLICY watched_box_opens_select ON public.watched_box_opens FOR SELECT TO authenticated USING (public.is_dev());

-- Every box screen calls this for every person. It answers nothing either way, so the caller cannot tell whether
-- they are watched. A row lands only for a caller with a live watch, on a box of a job they may touch, and at most
-- once a box each ten minutes, so a screen that draws again does not fill the log.
CREATE OR REPLACE FUNCTION public.on_site_note_box_open(p_container_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me uuid := auth.uid();
  v_watch uuid;
BEGIN
  IF v_me IS NULL OR p_container_id IS NULL THEN
    RETURN;
  END IF;
  SELECT w.id INTO v_watch FROM public.person_watches w WHERE w.user_id = v_me AND w.lifted_at IS NULL;
  IF v_watch IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = p_container_id) THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.watched_box_opens o
    WHERE o.user_id = v_me AND o.container_id = p_container_id AND o.at > now() - interval '10 minutes'
  ) THEN
    RETURN;
  END IF;
  -- A watched caller in training mode, or a twin, is refused the write by the fences. That refusal must not
  -- reach the screen, where it would be the one sign of a watch: swallow it and answer as for anyone.
  BEGIN
    INSERT INTO public.watched_box_opens (watch_id, user_id, container_id) VALUES (v_watch, v_me, p_container_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
END;
$fn$;
COMMENT ON FUNCTION public.on_site_note_box_open(uuid) IS 'A box screen opened a box. Writes a watched_box_opens row only when the caller has a live watch, at most once a box each ten minutes, and answers nothing either way. SECURITY DEFINER: the caller cannot read the watch.';
REVOKE EXECUTE ON FUNCTION public.on_site_note_box_open(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_note_box_open(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.on_site_note_box_open(uuid) TO authenticated;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();

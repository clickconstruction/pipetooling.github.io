SET lock_timeout = '3s';

-- Plan sets by part (punch list #239, PR 6: the row and History). When a part switches the set it builds from, every
-- job naming the part follows at once (a job follows its part), and nobody types the event: the site's History gains
-- one line per job on the part, the moment of the switch, as whoever switched it. The mock-up's words: "Plans · the
-- Bunker now builds from Bunker addendum 1, dated Oct 2 · replaces Bunker issued set". A part of a job outside any
-- development has no site History to write on; its job's Plans section still reads the switch (set by, on).
-- See docs/migrations/20261102063000_plan_part_switch_history.md.

CREATE OR REPLACE FUNCTION public.plan_part_switch_words(p_part text, p_set public.plan_sets, p_old text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Plans · ' || p_part || ' now builds from ' || p_set.name
    || CASE WHEN p_set.dated IS NOT NULL THEN ', dated ' || to_char(p_set.dated, 'Mon FMDD, YYYY') ELSE '' END
    || CASE WHEN p_old IS NOT NULL AND p_old <> p_set.name THEN ' · replaces ' || p_old ELSE '' END
$$;
COMMENT ON FUNCTION public.plan_part_switch_words(text, public.plan_sets, text) IS 'Plan sets by part (#239, PR 6): the History line a part switch writes.';

-- SECURITY DEFINER, since the entries table lets only the office keep lines through the app and the switch may be an
-- estimator's, or a trigger's (the hand-off from a bid), or a robot's.
CREATE OR REPLACE FUNCTION public.plan_parts_history_on_switch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_set public.plan_sets;
  v_old text;
  v_words text;
  v_jobs integer := 0;
BEGIN
  IF NEW.current_set_id IS NULL OR NEW.current_set_id IS NOT DISTINCT FROM OLD.current_set_id THEN RETURN NEW; END IF;
  IF NEW.development_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_set FROM public.plan_sets WHERE id = NEW.current_set_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT name INTO v_old FROM public.plan_sets WHERE id = OLD.current_set_id;
  v_words := public.plan_part_switch_words(NEW.name, v_set, v_old);
  -- One line per job naming the part, so each job's own History reads it.
  INSERT INTO public.development_history_entries (development_id, job_id, happened_at, source, body, author_user_id, via, link_url)
  SELECT NEW.development_id, j.id, now(), 'note', v_words, auth.uid(), 'app', NULLIF(v_set.link, '')
  FROM public.jobs_ledger j WHERE j.plan_part_id = NEW.id;
  GET DIAGNOSTICS v_jobs = ROW_COUNT;
  -- A part with no job yet still tells the site.
  IF v_jobs = 0 THEN
    INSERT INTO public.development_history_entries (development_id, job_id, happened_at, source, body, author_user_id, via, link_url)
    VALUES (NEW.development_id, NULL, now(), 'note', v_words, auth.uid(), 'app', NULLIF(v_set.link, ''));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.plan_parts_history_on_switch() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.plan_parts_history_on_switch() IS 'Plan sets by part (#239, PR 6): when a development part switches its current set, one History line per job naming the part (or one for the site when none does), as whoever switched it, with the set''s link.';
DROP TRIGGER IF EXISTS plan_parts_history_on_switch ON public.plan_parts;
CREATE TRIGGER plan_parts_history_on_switch
  AFTER UPDATE OF current_set_id ON public.plan_parts
  FOR EACH ROW EXECUTE FUNCTION public.plan_parts_history_on_switch();

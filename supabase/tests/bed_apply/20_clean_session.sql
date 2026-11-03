-- Runs after 10, 15 and 16 in the one psql. Raises unless this is a session of its own.
DO $$
BEGIN
  IF current_setting('lock_timeout') <> '0' THEN RAISE EXCEPTION 'lock_timeout leaked: %', current_setting('lock_timeout'); END IF;
  IF current_setting('search_path') = 'pg_catalog' THEN RAISE EXCEPTION 'search_path leaked'; END IF;
  IF current_setting('application_name') = 'bed_apply_10' THEN RAISE EXCEPTION 'application_name leaked'; END IF;
  IF to_regclass('pg_temp.bed_apply_left_behind') IS NOT NULL THEN RAISE EXCEPTION 'a temp table leaked'; END IF;
END $$;
INSERT INTO public.bed_apply_ran (file) VALUES ('20');

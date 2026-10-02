-- By Stage's flag flip (v2.4405, punch list #77 PR 3): three old bids flagged 'exact' become 'rough'
-- with their updated_at untouched, the trigger is back on afterwards, and a second run changes
-- nothing. The runner applies the migration between the SEED and CHECK parts of this file by
-- running it twice with -v part=seed / -v part=check. Never against prod.
\set ON_ERROR_STOP 1
\if :{?part}
\else
  \set part seed
\endif
SELECT :'part' = 'seed' AS is_seed \gset
\if :is_seed
  INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000f1', 'flip@bed.test') ON CONFLICT DO NOTHING;
  INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000000f1', 'flip@bed.test', 'Bed Flip', 'estimator') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000f0a1', 'Bed Flip Plumbing') ON CONFLICT DO NOTHING;
  INSERT INTO public.bids (id, created_by, service_type_id, project_name, materials_model) VALUES
    ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000f0a1', 'Flip A (By Stage, old)', 'exact'),
    ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000f0a1', 'Flip B (By Stage, sent)', 'exact'),
    ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000f0a1', 'Flip C (Combined)', 'rough');
  -- Give them a past: the trigger is off only while the dates are set.
  ALTER TABLE public.bids DISABLE TRIGGER update_bids_updated_at;
  UPDATE public.bids SET updated_at = '2026-03-20 15:00:00+00', bid_date_sent = CASE WHEN id = '00000000-0000-0000-0000-00000000f002' THEN DATE '2026-03-01' END
   WHERE id IN ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f003');
  ALTER TABLE public.bids ENABLE TRIGGER update_bids_updated_at;
  SELECT 'materials_model_flip SEEDED' AS result;
\else
  DO $$
  DECLARE r record;
  BEGIN
    ASSERT (SELECT count(*) FROM public.bids WHERE materials_model <> 'rough') = 0, 'every bid is Combined';
    FOR r IN SELECT project_name, materials_model, updated_at FROM public.bids WHERE id IN ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f003') LOOP
      ASSERT r.materials_model = 'rough', r.project_name || ' is ' || r.materials_model;
      ASSERT r.updated_at = '2026-03-20 15:00:00+00'::timestamptz, r.project_name || ' updated_at moved to ' || r.updated_at;
    END LOOP;
    ASSERT (SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.bids'::regclass AND tgname = 'update_bids_updated_at') = 'O', 'the updated_at trigger is back on';
    ASSERT (SELECT bid_date_sent FROM public.bids WHERE id = '00000000-0000-0000-0000-00000000f002') = DATE '2026-03-01', 'the sent date is untouched';
    ASSERT col_description('public.bids'::regclass, (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.bids'::regclass AND attname = 'materials_model')) LIKE 'Always ''rough''%', 'the column comment says so';
  END $$;
  -- An ordinary edit still stamps updated_at: the trigger works again.
  UPDATE public.bids SET notes = 'touched' WHERE id = '00000000-0000-0000-0000-00000000f001';
  DO $$ BEGIN
    ASSERT (SELECT updated_at FROM public.bids WHERE id = '00000000-0000-0000-0000-00000000f001') > now() - interval '1 minute', 'an ordinary edit stamps updated_at';
  END $$;
  DELETE FROM public.bids WHERE id IN ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f003');
  SELECT 'materials_model_flip PASSED' AS result;
\endif

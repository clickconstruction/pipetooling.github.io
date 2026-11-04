-- Employment stints bed (v2.6481): the roster as it stood before the migration, written with the stints trigger off so
-- the next re-run of the migration has rows to backfill. A throwaway container; never against prod.
\set ON_ERROR_STOP 1

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000005d01', 'dev@stints.test'),
  ('00000000-0000-0000-0000-000000005a01', 'lead@stints.test'),
  ('00000000-0000-0000-0000-000000005a02', 'tech@stints.test');
INSERT INTO public.users (id, email, name, role, archived_at, is_sample, is_digital_twin, read_only) VALUES
  ('00000000-0000-0000-0000-000000005d01', 'dev@stints.test', 'Stint Dev', 'dev', NULL, false, false, false),
  ('00000000-0000-0000-0000-000000005a01', 'lead@stints.test', 'Lou Lead', 'master_technician', NULL, false, false, false),
  ('00000000-0000-0000-0000-000000005a02', 'tech@stints.test', 'Tess Tech', 'helpers', NULL, false, false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at,
    is_sample = EXCLUDED.is_sample, is_digital_twin = EXCLUDED.is_digital_twin, read_only = EXCLUDED.read_only;

ALTER TABLE public.people DISABLE TRIGGER people_stints_follow_dates;
-- The lead's roster: one still working, one who left, one with no dates, one with only an end date.
INSERT INTO public.people (id, master_user_id, kind, name, start_date, end_date) VALUES
  ('00000000-0000-0000-0000-000000005b01', '00000000-0000-0000-0000-000000005a01', 'helper', 'Corinne Vela', '2024-03-04', NULL),
  ('00000000-0000-0000-0000-000000005b02', '00000000-0000-0000-0000-000000005a01', 'helper', 'Ben Left', '2025-01-06', '2026-10-01'),
  ('00000000-0000-0000-0000-000000005b03', '00000000-0000-0000-0000-000000005a01', 'helper', 'Nora Nodates', NULL, NULL),
  ('00000000-0000-0000-0000-000000005b04', '00000000-0000-0000-0000-000000005a01', 'sub', 'Eddie Endonly', NULL, '2026-06-30');
ALTER TABLE public.people ENABLE TRIGGER people_stints_follow_dates;

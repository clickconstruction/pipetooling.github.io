SET lock_timeout = '3s';

-- Equipment pre-use check (punch list #270, v2.6555): machines on the fleet board, the templates by kind and size the
-- office edits, the questions a walk asks, the checks a crew signs (the morning walk and the leaving check, with the
-- gauges' readings and the hour meter), the photos a check takes (filed into the machine's own Drive folder by the
-- photo-save sweep, a sixth source), the machines Dispatch attaches to a schedule block for a day, and a held machine's
-- kind on Dispatch's inbox. Additive and idempotent; nothing here changes a truck.
--
-- A machine is a vehicles row with kind = 'machine'. Its gauges are the template's unless the row carries its own
-- list; both are the LevelDef list the phone draws: [{ key, name, look (tank | glass | stick | dial), marks, lowBelow,
-- color, where }]. A reading is kept as how full the gauge reads, 0 to 100.

-- 1. Templates: a kind of machine at a size (Small excavator, Skid steer, Directional drill), with its gauges.
CREATE TABLE IF NOT EXISTS public.machine_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 80),
  machine_kind text NOT NULL CHECK (machine_kind IN ('excavator', 'directional_drill', 'trencher', 'skid_steer', 'compactor', 'trailer', 'other')),
  size text CHECK (size IS NULL OR size IN ('small', 'medium', 'large')),
  levels jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.machine_templates IS 'A kind of machine at a size, with the gauges the check sheet draws (levels: the LevelDef list) and, through machine_check_questions, the questions its walk asks. The office edits these at Settings; a machine picks one.';
COMMENT ON COLUMN public.machine_templates.levels IS 'The gauges: [{ key, name, look (tank|glass|stick|dial), marks: [{ at, label, line? }], lowBelow, color, where }]. A reading is 0..100 of the gauge.';

ALTER TABLE public.machine_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machine_templates select" ON public.machine_templates;
CREATE POLICY "machine_templates select" ON public.machine_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "machine_templates insert" ON public.machine_templates;
CREATE POLICY "machine_templates insert" ON public.machine_templates FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS "machine_templates update" ON public.machine_templates;
CREATE POLICY "machine_templates update" ON public.machine_templates FOR UPDATE TO authenticated USING (public.is_master_or_dev() OR public.is_assistant()) WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS "machine_templates delete" ON public.machine_templates;
CREATE POLICY "machine_templates delete" ON public.machine_templates FOR DELETE TO authenticated USING (public.is_dev());

-- 2. The questions a walk asks: every machine's (both null), a template's, or one machine's own.
CREATE TABLE IF NOT EXISTS public.machine_check_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.machine_templates(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  words text NOT NULL CHECK (char_length(words) BETWEEN 1 AND 200),
  holds_machine boolean NOT NULL DEFAULT false,
  asked_on text NOT NULL DEFAULT 'pre' CHECK (asked_on IN ('pre', 'post', 'both')),
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT machine_check_questions_one_owner CHECK (template_id IS NULL OR vehicle_id IS NULL)
);
CREATE INDEX IF NOT EXISTS machine_check_questions_template_idx ON public.machine_check_questions (template_id, sort);
CREATE INDEX IF NOT EXISTS machine_check_questions_vehicle_idx ON public.machine_check_questions (vehicle_id, sort);
COMMENT ON TABLE public.machine_check_questions IS 'A line of the walk. template_id and vehicle_id both null: every machine; template_id: that kind; vehicle_id: that machine only. holds_machine: a No holds it. asked_on: the morning walk (pre), the leaving check (post), or both.';

ALTER TABLE public.machine_check_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machine_check_questions select" ON public.machine_check_questions;
CREATE POLICY "machine_check_questions select" ON public.machine_check_questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "machine_check_questions insert" ON public.machine_check_questions;
CREATE POLICY "machine_check_questions insert" ON public.machine_check_questions FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS "machine_check_questions update" ON public.machine_check_questions;
CREATE POLICY "machine_check_questions update" ON public.machine_check_questions FOR UPDATE TO authenticated USING (public.is_master_or_dev() OR public.is_assistant()) WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS "machine_check_questions delete" ON public.machine_check_questions;
CREATE POLICY "machine_check_questions delete" ON public.machine_check_questions FOR DELETE TO authenticated USING (public.is_master_or_dev() OR public.is_assistant());

-- 3. A machine is a vehicles row: its kind, its name the crew says, its meter, its label's code, its template, its own
--    gauges when they differ from the template's, its rental agreement when it is not ours, and its Drive folder.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'truck',
  ADD COLUMN IF NOT EXISTS machine_kind text,
  ADD COLUMN IF NOT EXISTS unit_label text,
  ADD COLUMN IF NOT EXISTS meter text NOT NULL DEFAULT 'miles',
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.machine_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS levels jsonb,
  ADD COLUMN IF NOT EXISTS rental_from text,
  ADD COLUMN IF NOT EXISTS rental_agreement_no text,
  ADD COLUMN IF NOT EXISTS rental_out_on date,
  ADD COLUMN IF NOT EXISTS rental_due_back date,
  ADD COLUMN IF NOT EXISTS google_drive_link text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_kind_check') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_kind_check CHECK (kind IN ('truck', 'machine'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_machine_kind_check') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_machine_kind_check CHECK (machine_kind IS NULL OR machine_kind IN ('excavator', 'directional_drill', 'trencher', 'skid_steer', 'compactor', 'trailer', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_meter_check') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_meter_check CHECK (meter IN ('miles', 'hours'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_code_len') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_code_len CHECK (code IS NULL OR char_length(code) BETWEEN 4 AND 12);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_unit_label_len') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_unit_label_len CHECK (unit_label IS NULL OR char_length(unit_label) BETWEEN 1 AND 40);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_rental_len') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_rental_len CHECK ((rental_from IS NULL OR char_length(rental_from) <= 80) AND (rental_agreement_no IS NULL OR char_length(rental_agreement_no) <= 60));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_code_unique ON public.vehicles (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS vehicles_kind_idx ON public.vehicles (kind);
COMMENT ON COLUMN public.vehicles.kind IS 'truck (the fleet as it was) or machine (an excavator, a drill: hours on a meter, a pre-use check, a label with a code).';
COMMENT ON COLUMN public.vehicles.unit_label IS 'The name the crew says: E-12, D-3.';
COMMENT ON COLUMN public.vehicles.code IS 'The label''s code, /m/<code> on the machine; unique where set.';
COMMENT ON COLUMN public.vehicles.levels IS 'This machine''s own gauges (a LevelDef list) when they differ from its template''s; null reads the template.';
COMMENT ON COLUMN public.vehicles.rental_agreement_no IS 'Set with rental_from when the machine is rented: the checks at pickup and at return are the evidence against a damage claim, and its Drive folder is named by the agreement.';
COMMENT ON COLUMN public.vehicles.google_drive_link IS 'The machine''s own Drive folder under the fleet root (app_settings drive_fleet_root_folder_id), made by the photo-save sweep the first time a photo lands.';

-- 4. A machine's place is a possession by job: Dispatch's hand-off, the first morning walk on a job, or the leaving
--    check's last answer. A possession names a person or a job, never both.
ALTER TABLE public.vehicle_possessions
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_possessions_one_holder') THEN
    ALTER TABLE public.vehicle_possessions ADD CONSTRAINT vehicle_possessions_one_holder CHECK (user_id IS NULL OR job_id IS NULL);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS vehicle_possessions_job_idx ON public.vehicle_possessions (job_id) WHERE job_id IS NOT NULL;
COMMENT ON COLUMN public.vehicle_possessions.job_id IS 'A machine held by a job (not a person): on it until Dispatch moves it or the leaving check says it went.';

-- 5. The checks: the morning walk (pre) and the leaving check (post), one each per machine per job per day at most in
--    practice; the kernel pairs them for the hours used and where it was left.
CREATE TABLE IF NOT EXISTS public.machine_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'pre' CHECK (kind IN ('pre', 'post')),
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (char_length(by_name) <= 120),
  started_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  verdict text NOT NULL DEFAULT 'unfinished' CHECK (verdict IN ('unfinished', 'safe', 'held')),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  hours numeric CHECK (hours IS NULL OR hours >= 0),
  left_where text CHECK (left_where IS NULL OR left_where IN ('job', 'yard', 'other')),
  left_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  run_anyway_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  run_anyway_by_name text CHECK (run_anyway_by_name IS NULL OR char_length(run_anyway_by_name) <= 120),
  run_anyway_at timestamptz,
  dispatch_request_id uuid REFERENCES public.dispatch_requests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS machine_checks_vehicle_day_idx ON public.machine_checks (vehicle_id, work_date DESC, started_at DESC);
CREATE INDEX IF NOT EXISTS machine_checks_job_day_idx ON public.machine_checks (job_id, work_date) WHERE job_id IS NOT NULL;
COMMENT ON TABLE public.machine_checks IS 'A pre-use walk or a leaving check on a machine: the answers ([{ questionId, pick (yes|no|not_here), note, photoId, at }]), the gauge readings ({ <level key>: 0..100 }), the hour meter, the verdict (held when a holding question got a No), where it was left, and Dispatch''s run-it-anyway on a held one.';

ALTER TABLE public.machine_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machine_checks select" ON public.machine_checks;
CREATE POLICY "machine_checks select" ON public.machine_checks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "machine_checks insert" ON public.machine_checks;
CREATE POLICY "machine_checks insert" ON public.machine_checks FOR INSERT TO authenticated WITH CHECK (by_user_id = auth.uid());
DROP POLICY IF EXISTS "machine_checks update" ON public.machine_checks;
CREATE POLICY "machine_checks update" ON public.machine_checks FOR UPDATE TO authenticated
  USING (by_user_id = auth.uid() OR public.is_master_or_dev() OR public.is_assistant())
  WITH CHECK (by_user_id = auth.uid() OR public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS "machine_checks delete" ON public.machine_checks;
CREATE POLICY "machine_checks delete" ON public.machine_checks FOR DELETE TO authenticated USING (public.is_dev());

-- 6. The photos a check takes: the hour meter, the four sides, anything wrong, a gauge, a No. Kept in the
--    machine-check-photos bucket as <vehicle_id>/<photo_id>.jpg until the photo-save sweep files them in the machine's
--    Drive folder under file_name (2026-11-05 Robert · E-12 pre-use front.jpg) and deletes the bucket copy.
CREATE TABLE IF NOT EXISTS public.machine_check_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.machine_checks(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  shot text NOT NULL CHECK (char_length(shot) BETWEEN 1 AND 80),
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  bytes integer NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  taken_at timestamptz NOT NULL DEFAULT now(),
  storage_path text CHECK (storage_path IS NULL OR char_length(storage_path) <= 300),
  drive_file_id text CHECK (drive_file_id IS NULL OR char_length(drive_file_id) <= 120),
  filed_at timestamptz,
  fail_why text CHECK (fail_why IS NULL OR char_length(fail_why) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS machine_check_photos_check_idx ON public.machine_check_photos (check_id);
CREATE INDEX IF NOT EXISTS machine_check_photos_waiting_idx ON public.machine_check_photos (taken_at) WHERE filed_at IS NULL AND storage_path IS NOT NULL;
COMMENT ON TABLE public.machine_check_photos IS 'A photo of a machine check. shot: meter | front | side | back | wrong | gauge:<level key> | no:<question id>. The photo-save sweep files it in the machine''s Drive folder (vehicles.google_drive_link, made under app_settings drive_fleet_root_folder_id) and writes drive_file_id and filed_at, or fail_why.';

ALTER TABLE public.machine_check_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machine_check_photos select" ON public.machine_check_photos;
CREATE POLICY "machine_check_photos select" ON public.machine_check_photos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "machine_check_photos insert" ON public.machine_check_photos;
CREATE POLICY "machine_check_photos insert" ON public.machine_check_photos FOR INSERT TO authenticated WITH CHECK (by_user_id = auth.uid());
DROP POLICY IF EXISTS "machine_check_photos delete" ON public.machine_check_photos;
CREATE POLICY "machine_check_photos delete" ON public.machine_check_photos FOR DELETE TO authenticated USING (by_user_id = auth.uid() AND filed_at IS NULL);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('machine-check-photos', 'machine-check-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "machine-check-photos insert" ON storage.objects;
CREATE POLICY "machine-check-photos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'machine-check-photos' AND owner = auth.uid());
DROP POLICY IF EXISTS "machine-check-photos select" ON storage.objects;
CREATE POLICY "machine-check-photos select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'machine-check-photos');
DROP POLICY IF EXISTS "machine-check-photos delete" ON storage.objects;
CREATE POLICY "machine-check-photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'machine-check-photos' AND owner = auth.uid());

-- 7. Dispatch's plan: a machine rides with a job on a day, brought by someone; the phone's morning answers whether it
--    arrived.
CREATE TABLE IF NOT EXISTS public.machine_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  brought_by text NOT NULL DEFAULT '' CHECK (char_length(brought_by) <= 120),
  answer text CHECK (answer IS NULL OR answer IN ('here', 'later', 'not_coming')),
  answered_at timestamptz,
  why text NOT NULL DEFAULT '' CHECK (char_length(why) <= 200),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT machine_assignments_once_a_day UNIQUE (vehicle_id, job_id, work_date)
);
CREATE INDEX IF NOT EXISTS machine_assignments_job_day_idx ON public.machine_assignments (job_id, work_date);
CREATE INDEX IF NOT EXISTS machine_assignments_vehicle_day_idx ON public.machine_assignments (vehicle_id, work_date);
COMMENT ON TABLE public.machine_assignments IS 'A machine attached to a job for a day when the job went on someone''s schedule (the block editor''s Equipment row). answer: the morning''s Is it here (here | later | not_coming), with why for Dispatch.';

ALTER TABLE public.machine_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "machine_assignments select" ON public.machine_assignments;
CREATE POLICY "machine_assignments select" ON public.machine_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "machine_assignments insert" ON public.machine_assignments;
CREATE POLICY "machine_assignments insert" ON public.machine_assignments FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS "machine_assignments update" ON public.machine_assignments;
CREATE POLICY "machine_assignments update" ON public.machine_assignments FOR UPDATE TO authenticated
  USING (public.is_master_or_dev() OR public.is_assistant() OR public.can_report_stage_progress(job_id))
  WITH CHECK (public.is_master_or_dev() OR public.is_assistant() OR public.can_report_stage_progress(job_id));
DROP POLICY IF EXISTS "machine_assignments delete" ON public.machine_assignments;
CREATE POLICY "machine_assignments delete" ON public.machine_assignments FOR DELETE TO authenticated USING (public.is_master_or_dev() OR public.is_assistant());

-- 8. A held machine on Dispatch's inbox: pending_action = 'machine_held' (free text by the baseline; the comment lists
--    the kinds) with the open rows indexed for the board's count.
COMMENT ON COLUMN public.dispatch_requests.pending_action IS 'What the row asks of Dispatch: link_job_pictures, find_property_owner, open_job_account, trip_charge_turnaway, review_field_estimate, running_late, open_job_from_bid, stage_check, machine_held (a pre-use or leaving check found something that holds the machine; v2.6555).';
CREATE INDEX IF NOT EXISTS dispatch_requests_machine_held_open_idx ON public.dispatch_requests (job_ledger_id) WHERE pending_action = 'machine_held' AND status = 'open';

-- 9. The seed: the templates the owner named (excavators small, medium and large; skid steers) and the kinds the spike
--    drew, each with its gauges, and the walk's questions. Fixed ids, so a second push changes nothing.
INSERT INTO public.machine_templates (id, name, machine_kind, size, sort, levels) VALUES
  ('00000000-0000-4000-8000-0000000a0001', 'Small excavator', 'excavator', 'small', 10, '[{"key":"fuel","name":"Fuel","look":"tank","marks":[{"at":0,"label":"E"},{"at":25,"label":"¼"},{"at":50,"label":"½"},{"at":75,"label":"¾"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#f59e0b","where":"Gauge on the dash"},{"key":"hydraulic","name":"Hydraulic oil","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#2563eb","where":"Sight glass on the tank, behind the cab"},{"key":"engine_oil","name":"Engine oil","look":"stick","marks":[{"at":35,"label":"ADD"},{"at":75,"label":"FULL","line":true}],"lowBelow":35,"color":"#92400e","where":"Dipstick under the side hood"},{"key":"coolant","name":"Coolant","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#16a34a","where":"Overflow bottle by the radiator"}]'::jsonb),
  ('00000000-0000-4000-8000-0000000a0002', 'Medium excavator', 'excavator', 'medium', 20, '[{"key":"fuel","name":"Fuel","look":"tank","marks":[{"at":0,"label":"E"},{"at":25,"label":"¼"},{"at":50,"label":"½"},{"at":75,"label":"¾"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#f59e0b","where":"Gauge on the dash"},{"key":"hydraulic","name":"Hydraulic oil","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#2563eb","where":"Sight glass on the hydraulic tank"},{"key":"engine_oil","name":"Engine oil","look":"stick","marks":[{"at":35,"label":"ADD"},{"at":75,"label":"FULL","line":true}],"lowBelow":35,"color":"#92400e","where":"Dipstick in the engine bay"},{"key":"coolant","name":"Coolant","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#16a34a","where":"Overflow bottle by the radiator"}]'::jsonb),
  ('00000000-0000-4000-8000-0000000a0003', 'Large excavator', 'excavator', 'large', 30, '[{"key":"fuel","name":"Fuel","look":"dial","marks":[{"at":0,"label":"E"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#f59e0b","where":"Dial on the monitor"},{"key":"hydraulic","name":"Hydraulic oil","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#2563eb","where":"Sight glass on the hydraulic tank"},{"key":"engine_oil","name":"Engine oil","look":"stick","marks":[{"at":35,"label":"ADD"},{"at":75,"label":"FULL","line":true}],"lowBelow":35,"color":"#92400e","where":"Dipstick in the engine bay"},{"key":"coolant","name":"Coolant","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#16a34a","where":"Sight glass on the radiator tank"}]'::jsonb),
  ('00000000-0000-4000-8000-0000000a0004', 'Skid steer', 'skid_steer', NULL, 40, '[{"key":"fuel","name":"Fuel","look":"tank","marks":[{"at":0,"label":"E"},{"at":25,"label":"¼"},{"at":50,"label":"½"},{"at":75,"label":"¾"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#f59e0b","where":"Gauge on the panel"},{"key":"hydraulic","name":"Hydraulic oil","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#2563eb","where":"Sight glass behind the seat"},{"key":"engine_oil","name":"Engine oil","look":"stick","marks":[{"at":35,"label":"ADD"},{"at":75,"label":"FULL","line":true}],"lowBelow":35,"color":"#92400e","where":"Dipstick under the rear door"},{"key":"coolant","name":"Coolant","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#16a34a","where":"Overflow bottle under the rear door"}]'::jsonb),
  ('00000000-0000-4000-8000-0000000a0005', 'Directional drill', 'directional_drill', NULL, 50, '[{"key":"fuel","name":"Fuel","look":"dial","marks":[{"at":0,"label":"E"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#f59e0b","where":"Dial on the operator panel"},{"key":"hydraulic","name":"Hydraulic oil","look":"dial","marks":[{"at":0,"label":"E"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#2563eb","where":"Dial on the operator panel, beside fuel"},{"key":"engine_oil","name":"Engine oil","look":"stick","marks":[{"at":35,"label":"ADD"},{"at":75,"label":"FULL","line":true}],"lowBelow":35,"color":"#92400e","where":"Dipstick under the engine cover"},{"key":"drilling_fluid","name":"Drilling fluid","look":"tank","marks":[{"at":0,"label":"E"},{"at":25,"label":"¼"},{"at":50,"label":"½"},{"at":75,"label":"¾"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#0891b2","where":"Mix tank on the trailer"}]'::jsonb),
  ('00000000-0000-4000-8000-0000000a0006', 'Trencher', 'trencher', NULL, 60, '[{"key":"fuel","name":"Fuel","look":"tank","marks":[{"at":0,"label":"E"},{"at":25,"label":"¼"},{"at":50,"label":"½"},{"at":75,"label":"¾"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#f59e0b","where":"Gauge on the panel"},{"key":"hydraulic","name":"Hydraulic oil","look":"glass","marks":[{"at":30,"label":"Low"},{"at":65,"label":"The line","line":true}],"lowBelow":55,"color":"#2563eb","where":"Sight glass on the tank"},{"key":"engine_oil","name":"Engine oil","look":"stick","marks":[{"at":35,"label":"ADD"},{"at":75,"label":"FULL","line":true}],"lowBelow":35,"color":"#92400e","where":"Dipstick under the hood"}]'::jsonb),
  ('00000000-0000-4000-8000-0000000a0007', 'Compactor', 'compactor', NULL, 70, '[{"key":"fuel","name":"Fuel","look":"tank","marks":[{"at":0,"label":"E"},{"at":25,"label":"¼"},{"at":50,"label":"½"},{"at":75,"label":"¾"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#f59e0b","where":"Tank under the handle"},{"key":"engine_oil","name":"Engine oil","look":"stick","marks":[{"at":35,"label":"ADD"},{"at":75,"label":"FULL","line":true}],"lowBelow":35,"color":"#92400e","where":"Dipstick on the engine"}]'::jsonb),
  ('00000000-0000-4000-8000-0000000a0008', 'Trailer', 'trailer', NULL, 80, '[]'::jsonb),
  ('00000000-0000-4000-8000-0000000a0009', 'Other machine', 'other', NULL, 90, '[{"key":"fuel","name":"Fuel","look":"tank","marks":[{"at":0,"label":"E"},{"at":25,"label":"¼"},{"at":50,"label":"½"},{"at":75,"label":"¾"},{"at":100,"label":"F"}],"lowBelow":30,"color":"#f59e0b","where":""},{"key":"engine_oil","name":"Engine oil","look":"stick","marks":[{"at":35,"label":"ADD"},{"at":75,"label":"FULL","line":true}],"lowBelow":35,"color":"#92400e","where":""}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.machine_check_questions (id, template_id, words, holds_machine, asked_on, sort) VALUES
  -- the walk every machine gets
  ('00000000-0000-4000-8000-0000000b0001', NULL, 'Tracks or tires and the undercarriage clear, no cracks', true, 'pre', 10),
  ('00000000-0000-4000-8000-0000000b0002', NULL, 'Hydraulic hoses and cylinders, no leaks', true, 'pre', 20),
  ('00000000-0000-4000-8000-0000000b0003', NULL, 'Lights, horn and the backup alarm work', false, 'pre', 30),
  ('00000000-0000-4000-8000-0000000b0004', NULL, 'Seat belt and ROPS in place', true, 'pre', 40),
  ('00000000-0000-4000-8000-0000000b0005', NULL, 'Fire extinguisher on board and charged', false, 'pre', 50),
  ('00000000-0000-4000-8000-0000000b0006', NULL, 'Grease points greased today', false, 'pre', 60),
  ('00000000-0000-4000-8000-0000000b0007', NULL, 'Air filter indicator clear', false, 'pre', 70),
  -- the leaving check, short: only what using it changes
  ('00000000-0000-4000-8000-0000000b0011', NULL, 'Nothing new broken or leaking since the morning', true, 'post', 10),
  ('00000000-0000-4000-8000-0000000b0012', NULL, 'Parked on the job, bucket down, locked, keys out', false, 'post', 20),
  ('00000000-0000-4000-8000-0000000b0013', NULL, 'Cab cleaned out and the attachments back on the trailer', false, 'post', 30),
  -- the excavators'
  ('00000000-0000-4000-8000-0000000b0021', '00000000-0000-4000-8000-0000000a0001', 'Bucket pins, teeth and the thumb tight', true, 'pre', 100),
  ('00000000-0000-4000-8000-0000000b0022', '00000000-0000-4000-8000-0000000a0002', 'Bucket pins, teeth and the thumb tight', true, 'pre', 100),
  ('00000000-0000-4000-8000-0000000b0023', '00000000-0000-4000-8000-0000000a0003', 'Bucket pins, teeth and the thumb tight', true, 'pre', 100),
  ('00000000-0000-4000-8000-0000000b0024', '00000000-0000-4000-8000-0000000a0003', 'Swing brake and the travel alarm work', true, 'pre', 110),
  -- the skid steer's
  ('00000000-0000-4000-8000-0000000b0031', '00000000-0000-4000-8000-0000000a0004', 'Quick-attach pins locked and the attachment seated', true, 'pre', 100),
  ('00000000-0000-4000-8000-0000000b0032', '00000000-0000-4000-8000-0000000a0004', 'Lift arm support and the door interlock work', true, 'pre', 110),
  -- the drill's
  ('00000000-0000-4000-8000-0000000b0041', '00000000-0000-4000-8000-0000000a0005', 'Rod box latched, rods seated', true, 'pre', 100),
  ('00000000-0000-4000-8000-0000000b0042', '00000000-0000-4000-8000-0000000a0005', 'Vise dies and sub savers clean, not worn', false, 'pre', 110),
  ('00000000-0000-4000-8000-0000000b0043', '00000000-0000-4000-8000-0000000a0005', 'Strike alert on and the stakes down', true, 'pre', 120),
  -- the trencher's and the compactor's
  ('00000000-0000-4000-8000-0000000b0051', '00000000-0000-4000-8000-0000000a0006', 'Chain tension right and the teeth not worn through', true, 'pre', 100),
  ('00000000-0000-4000-8000-0000000b0061', '00000000-0000-4000-8000-0000000a0007', 'Plate clean and the water tank filled', false, 'pre', 100)
ON CONFLICT (id) DO NOTHING;

-- 10. The cron: photo-save calls while any source waits; a sixth clause for a machine's photo. Every earlier clause is
--     written again (20261030070000's rule). Unscheduled first, so a second run leaves one row.
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
     OR EXISTS (SELECT 1 FROM public.machine_check_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL);
  $$
);

-- House rules for every CREATE TABLE: training-mode blocks and the digital-twin fence on the new tables.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

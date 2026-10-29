SET lock_timeout = '3s';

-- Materials on site (punch list #209, the owner's ask of 2026-10-28): what is in the cages and boxes a crew
-- leaves on a big job site, kept as a ledger of movements rather than a stock table. A container (a cage,
-- a box, a loose pile, or the job's Unsorted row a delivery lands in) stands in a place on the site; every
-- change to what is in it is one append-only row (delivered, moved, used, returned, taken, cannot find,
-- damaged, counted). What is on hand is the sum; a count resets the line and keeps its difference, which
-- is what "missing" means. A photo of a box is a row that names the file in the job's Drive folder.
--
--   1. job_places              — the places on a site a box can stand in (Building A level 2, the laydown yard).
--   2. job_containers          — the cages and boxes, with the eight-character code a label's QR carries.
--   3. job_container_moves     — a box moved from one place to another.
--   4. job_material_movements  — the ledger: one row per press on the phone or line landed by the office.
--   5. job_box_photos          — a photo of a box, shrunk on the phone, filed in Drive by the photo sweep.
--   6. The gate: you may read or write a job's materials when you can see the job (the ledger's own RLS,
--      so a primary keeps their scope) or you are on its team (helpers and subcontractors).
--   7. The bucket box-photos, where a shot waits until the sweep moves it into Drive and deletes it here.

-- 1. Places.
CREATE TABLE IF NOT EXISTS public.job_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(TRIM(name)) BETWEEN 1 AND 80),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS job_places_job_name_key ON public.job_places (job_id, lower(TRIM(name)));
COMMENT ON TABLE public.job_places IS 'Materials on site (#209): the places on a job site a container can stand in. One per (job, name).';

-- 2. Containers.
CREATE TABLE IF NOT EXISTS public.job_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(TRIM(label)) BETWEEN 1 AND 24),
  kind text NOT NULL CHECK (kind IN ('cage', 'box', 'loose', 'unsorted')),
  where_note text NOT NULL DEFAULT '' CHECK (length(where_note) <= 120),
  place_id uuid REFERENCES public.job_places(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  code text GENERATED ALWAYS AS (upper(left(replace(id::text, '-', ''), 8))) STORED,
  retired_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS job_containers_code_key ON public.job_containers (code);
CREATE UNIQUE INDEX IF NOT EXISTS job_containers_live_label_key ON public.job_containers (job_id, lower(TRIM(label))) WHERE retired_at IS NULL;
CREATE INDEX IF NOT EXISTS job_containers_job_idx ON public.job_containers (job_id);
COMMENT ON TABLE public.job_containers IS 'Materials on site (#209): a cage, box or loose pile on a job site, or the job''s Unsorted row a delivery lands in. Its code is what the label''s QR carries (prts.co/b/<code>).';
COMMENT ON COLUMN public.job_containers.code IS 'The id''s first eight hex characters in capitals: the short address on the printed label, read by /b/:code.';
COMMENT ON COLUMN public.job_containers.where_note IS 'Where exactly inside its place, in the crew''s words ("by the north stair"); empty when nobody said.';

-- 3. A box moved between places.
CREATE TABLE IF NOT EXISTS public.job_container_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.job_containers(id) ON DELETE CASCADE,
  from_place_id uuid REFERENCES public.job_places(id) ON DELETE SET NULL,
  to_place_id uuid REFERENCES public.job_places(id) ON DELETE SET NULL,
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_container_moves_container_idx ON public.job_container_moves (container_id, at);
COMMENT ON TABLE public.job_container_moves IS 'Materials on site (#209): a container moved from one place on the site to another, by whom and when.';

-- 4. The ledger.
CREATE TABLE IF NOT EXISTS public.job_material_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.material_parts(id) ON DELETE SET NULL,
  part_name text NOT NULL CHECK (length(TRIM(part_name)) BETWEEN 1 AND 160),
  manufacturer text CHECK (length(manufacturer) <= 120),
  quantity integer NOT NULL CHECK (quantity >= 0 AND quantity <= 100000),
  reason text NOT NULL CHECK (reason IN ('delivered', 'moved', 'used', 'returned', 'taken', 'cannot_find', 'damaged', 'counted')),
  from_container_id uuid REFERENCES public.job_containers(id) ON DELETE SET NULL,
  to_container_id uuid REFERENCES public.job_containers(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 300),
  source text CHECK (length(source) <= 120),
  item_id uuid,
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  at timestamptz NOT NULL DEFAULT now(),
  CHECK (reason = 'counted' OR quantity > 0),
  CHECK (reason <> 'counted' OR from_container_id IS NOT NULL),
  CHECK (reason <> 'delivered' OR to_container_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS job_material_movements_job_at_idx ON public.job_material_movements (job_id, at);
CREATE INDEX IF NOT EXISTS job_material_movements_from_idx ON public.job_material_movements (from_container_id) WHERE from_container_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_material_movements_to_idx ON public.job_material_movements (to_container_id) WHERE to_container_id IS NOT NULL;
COMMENT ON TABLE public.job_material_movements IS 'Materials on site (#209): the append-only ledger of a job''s material. On hand = the sum of a container''s rows; a counted row is the number counted, not a change, and resets the line. A wrong press gets a new row, never an edit.';
COMMENT ON COLUMN public.job_material_movements.part_id IS 'material_parts.id, or null for a name typed on site that the office ties to the parts book later.';
COMMENT ON COLUMN public.job_material_movements.source IS 'The invoice or PO behind a delivery (INV-10422, PO-2211), when known.';
COMMENT ON COLUMN public.job_material_movements.item_id IS 'V3: the engraved item this row is about. Null until then.';

-- 5. Photos of a box.
CREATE TABLE IF NOT EXISTS public.job_box_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  container_id uuid NOT NULL REFERENCES public.job_containers(id) ON DELETE CASCADE,
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  words text NOT NULL DEFAULT '' CHECK (length(words) <= 120),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  taken_at timestamptz NOT NULL DEFAULT now(),
  bytes integer NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  width integer NOT NULL DEFAULT 0 CHECK (width >= 0),
  height integer NOT NULL DEFAULT 0 CHECK (height >= 0),
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'on-phone', 'filed', 'shared')),
  storage_path text CHECK (length(storage_path) <= 300),
  drive_file_id text CHECK (length(drive_file_id) <= 120),
  filed_at timestamptz,
  fail_why text CHECK (length(fail_why) <= 300)
);
CREATE INDEX IF NOT EXISTS job_box_photos_job_idx ON public.job_box_photos (job_id, taken_at);
CREATE INDEX IF NOT EXISTS job_box_photos_unfiled_idx ON public.job_box_photos (taken_at) WHERE filed_at IS NULL AND storage_path IS NOT NULL AND fail_why IS NULL;
COMMENT ON TABLE public.job_box_photos IS 'Materials on site (#209): a photo of a box. The phone shrinks the shot and puts it in the box-photos bucket; the photo-save sweep files it in the job''s Drive folder under file_name, writes drive_file_id and filed_at, and deletes the bucket copy. No lasting copy in the app.';
COMMENT ON COLUMN public.job_box_photos.words IS 'What the shot is of, as the file is named: "A1 after Count".';
COMMENT ON COLUMN public.job_box_photos.status IS 'sending = waiting for the sweep; on-phone = kept on the phone for want of signal; filed = in the Drive folder; shared = sent by hand from the phone''s share sheet.';

-- 6. The gate. SECURITY INVOKER on purpose: the EXISTS on jobs_ledger runs under the caller's own RLS, so a
--    primary's job scope carries over; helpers and subcontractors reach a job through its team list.
CREATE OR REPLACE FUNCTION public.on_site_can_touch_job(p_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id)
    OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id AND m.user_id = auth.uid())
  )
$$;
COMMENT ON FUNCTION public.on_site_can_touch_job(uuid) IS 'Materials on site (#209): true when the caller can see the job in the ledger under their own RLS, or is on its team.';

ALTER TABLE public.job_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_places_select ON public.job_places;
CREATE POLICY job_places_select ON public.job_places FOR SELECT TO authenticated USING (public.on_site_can_touch_job(job_id));
DROP POLICY IF EXISTS job_places_insert ON public.job_places;
CREATE POLICY job_places_insert ON public.job_places FOR INSERT TO authenticated WITH CHECK (public.on_site_can_touch_job(job_id));

ALTER TABLE public.job_containers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_containers_select ON public.job_containers;
CREATE POLICY job_containers_select ON public.job_containers FOR SELECT TO authenticated USING (public.on_site_can_touch_job(job_id));
DROP POLICY IF EXISTS job_containers_insert ON public.job_containers;
CREATE POLICY job_containers_insert ON public.job_containers FOR INSERT TO authenticated WITH CHECK (public.on_site_can_touch_job(job_id));
DROP POLICY IF EXISTS job_containers_update ON public.job_containers;
CREATE POLICY job_containers_update ON public.job_containers FOR UPDATE TO authenticated USING (public.on_site_can_touch_job(job_id)) WITH CHECK (public.on_site_can_touch_job(job_id));

ALTER TABLE public.job_container_moves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_container_moves_select ON public.job_container_moves;
CREATE POLICY job_container_moves_select ON public.job_container_moves FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = container_id AND public.on_site_can_touch_job(c.job_id)));
DROP POLICY IF EXISTS job_container_moves_insert ON public.job_container_moves;
CREATE POLICY job_container_moves_insert ON public.job_container_moves FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = container_id AND public.on_site_can_touch_job(c.job_id)));

ALTER TABLE public.job_material_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_material_movements_select ON public.job_material_movements;
CREATE POLICY job_material_movements_select ON public.job_material_movements FOR SELECT TO authenticated USING (public.on_site_can_touch_job(job_id));
DROP POLICY IF EXISTS job_material_movements_insert ON public.job_material_movements;
CREATE POLICY job_material_movements_insert ON public.job_material_movements FOR INSERT TO authenticated WITH CHECK (public.on_site_can_touch_job(job_id));

ALTER TABLE public.job_box_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_box_photos_select ON public.job_box_photos;
CREATE POLICY job_box_photos_select ON public.job_box_photos FOR SELECT TO authenticated USING (public.on_site_can_touch_job(job_id));
DROP POLICY IF EXISTS job_box_photos_insert ON public.job_box_photos;
CREATE POLICY job_box_photos_insert ON public.job_box_photos FOR INSERT TO authenticated WITH CHECK (public.on_site_can_touch_job(job_id));
DROP POLICY IF EXISTS job_box_photos_update_own ON public.job_box_photos;
CREATE POLICY job_box_photos_update_own ON public.job_box_photos FOR UPDATE TO authenticated
  USING (public.on_site_can_touch_job(job_id) AND by_user_id = auth.uid())
  WITH CHECK (public.on_site_can_touch_job(job_id) AND by_user_id = auth.uid());

-- 7. The bucket: private, 2 MB a file, images only. Objects are named <job_id>/<photo_id>.jpg, so the same gate
--    reads the job from the path. The sweep deletes with the service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('box-photos', 'box-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS box_photos_files_insert ON storage.objects;
CREATE POLICY box_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'box-photos' AND public.on_site_can_touch_job(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS box_photos_files_select ON storage.objects;
CREATE POLICY box_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'box-photos' AND public.on_site_can_touch_job(((storage.foldername(name))[1])::uuid));

-- House rules for every CREATE TABLE: training-mode blocks and the digital-twin fence on the new tables.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

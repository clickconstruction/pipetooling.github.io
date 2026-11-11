SET lock_timeout = '3s';

-- Cards and footers: the facts a person's business card and email footer are drawn from, and the home of
-- their photo (punch list #313 PR 1, v2.6941; to-dos/cards-and-footers/README.md → The plan). Today each
-- card and footer is a flat picture a designer made by hand. The app will draw them from the person's own
-- row instead. It already holds a name, a title (users.title, 20261012190000), an email and a phone. Three
-- things are missing, and this adds a place for each:
--
--   * users.card_name: the name printed on the card and the footer. The account name is a first name for
--     most people; a card needs the name a customer should read. Null: the account name stands in. 80
--     characters at most (users_card_name_short), as the title is by users_title_short.
--   * users.photo_path: where the person's headshot sits in the person-photos bucket. Null: no photo yet.
--     It must sit under the person's own folder, "<users.id>/…" (users_photo_path_own_folder), so one
--     person's row can never point at another person's picture.
--   * users.photo_crop: where the photo sits in its ring, as three numbers the app writes:
--     {"fx": across 0 to 1, "fy": down 0 to 1, "zoom": 1 and up}. Null: the middle of the picture. The
--     photo is kept whole; the same three numbers place it in the footer and on the card.
--
-- Who may write them: the person on their own row ("Users can update own profile"), and the office on
-- anyone's row ("Masters assistants devs can update user notes": dev, master_technician, assistant,
-- controller), the same two doors a name, a phone and a note already use. users_guard_privileged_columns
-- does not name these columns, so they are plain profile fields. The table's own fences keep a training
-- account, a digital twin and an archived login from writing. The columns are granted by name, as title
-- and signature_lines were.
--
-- The bucket person-photos is private: 2 MB a file; JPEG, PNG or WebP; "<users.id>/<file>". A person
-- reads and writes their own folder. The office (is_office_staff(): the same four roles) reads and writes
-- every folder, since the office makes a card for a teammate. Nobody else can see a photo. storage.objects
-- has no training-mode or twin fence of its own, so each write policy says so itself; archived_fence
-- already keeps an archived login out of every bucket.
--
-- No table is made, so no fence call. Nothing in the client reads these yet: the screens come in later
-- PRs and read the columns fail-soft, so this can be pushed in any order against the Pages deploy.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS card_name text,
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS photo_crop jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_card_name_short' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_card_name_short CHECK (card_name IS NULL OR char_length(card_name) <= 80);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_photo_path_own_folder' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_photo_path_own_folder CHECK (photo_path IS NULL OR photo_path LIKE (id::text || '/%'));
  END IF;
END $$;

GRANT UPDATE (card_name, photo_path, photo_crop) ON public.users TO authenticated;

COMMENT ON COLUMN public.users.card_name IS
  'Cards and footers (punch list #313): the name printed on the person''s business card and email footer. Null: the account name stands in. 80 characters at most.';
COMMENT ON COLUMN public.users.photo_path IS
  'Cards and footers (punch list #313): the person''s headshot in the private person-photos bucket, under their own folder ("<users.id>/<file>"). Null: no photo yet.';
COMMENT ON COLUMN public.users.photo_crop IS
  'Cards and footers (punch list #313): where the photo sits in its ring, {"fx": 0-1 across, "fy": 0-1 down, "zoom": 1 and up}. Null: the middle of the picture. Written by the app.';

-- ── The photo's home ───────────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('person-photos', 'person-photos', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- The first folder is a person's users.id. The pattern guard comes first, so a stray path never reaches the
-- comparison with a caller's id.
DROP POLICY IF EXISTS person_photos_files_select ON storage.objects;
CREATE POLICY person_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'person-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_office_staff())
  );

DROP POLICY IF EXISTS person_photos_files_insert ON storage.objects;
CREATE POLICY person_photos_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'person-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_office_staff())
    AND NOT public.is_read_only()
    AND NOT public.is_digital_twin()
  );

DROP POLICY IF EXISTS person_photos_files_update ON storage.objects;
CREATE POLICY person_photos_files_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'person-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_office_staff())
    AND NOT public.is_read_only()
    AND NOT public.is_digital_twin()
  )
  WITH CHECK (
    bucket_id = 'person-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_office_staff())
    AND NOT public.is_read_only()
    AND NOT public.is_digital_twin()
  );

DROP POLICY IF EXISTS person_photos_files_delete ON storage.objects;
CREATE POLICY person_photos_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'person-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_office_staff())
    AND NOT public.is_read_only()
    AND NOT public.is_digital_twin()
  );

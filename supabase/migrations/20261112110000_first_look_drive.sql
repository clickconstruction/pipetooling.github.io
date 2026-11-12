SET lock_timeout = '3s';

-- First look in Google Drive (punch list #319 PR 2, v2.7001). The owner's ask of 2026-11-11: the files a customer
-- sends are kept in Drive, in a Customer supplied photos folder under the customer, a folder a look. The photo sweep
-- (photo-save) files them; these columns are where it keeps its place. No new table, so no fence call. Every column
-- is nullable with no default, so each ALTER is a catalog change and rewrites nothing.
--
--   first_looks.drive_folder_id        the look's own folder in Drive, once the sweep has made it.
--   first_look_files.drive_file_id     the file's copy in Drive.
--   first_look_files.filed_at          when it got there.
--   first_look_files.fail_why          why the last try did not file it, for the card to say.
--   first_look_files.drive_tried_at    when the sweep last looked at it, so a file that cannot file yet (a caller who
--                                      is not a customer) goes to the back of the line and never starves the rest.
--   first_look_files.drive_upload_uri, drive_upload_offset
--                                      a video's copy in pieces: Drive's address for the upload and how far it has
--                                      got, so a copy that is cut off picks up on the next run.

ALTER TABLE public.first_looks ADD COLUMN IF NOT EXISTS drive_folder_id text CHECK (drive_folder_id IS NULL OR char_length(drive_folder_id) <= 200);

ALTER TABLE public.first_look_files ADD COLUMN IF NOT EXISTS drive_file_id text CHECK (drive_file_id IS NULL OR char_length(drive_file_id) <= 200);
ALTER TABLE public.first_look_files ADD COLUMN IF NOT EXISTS filed_at timestamptz;
ALTER TABLE public.first_look_files ADD COLUMN IF NOT EXISTS fail_why text CHECK (fail_why IS NULL OR char_length(fail_why) <= 300);
ALTER TABLE public.first_look_files ADD COLUMN IF NOT EXISTS drive_tried_at timestamptz;
ALTER TABLE public.first_look_files ADD COLUMN IF NOT EXISTS drive_upload_uri text CHECK (drive_upload_uri IS NULL OR char_length(drive_upload_uri) <= 2000);
ALTER TABLE public.first_look_files ADD COLUMN IF NOT EXISTS drive_upload_offset bigint CHECK (drive_upload_offset IS NULL OR drive_upload_offset >= 0);

COMMENT ON COLUMN public.first_looks.drive_folder_id IS
  'First look (punch list #319 PR 2): the look''s own folder in Drive, under the customer''s Customer supplied photos. Written by photo-save.';
COMMENT ON COLUMN public.first_look_files.drive_file_id IS
  'First look (punch list #319 PR 2): the file''s copy in Drive. Written by photo-save.';
COMMENT ON COLUMN public.first_look_files.drive_upload_uri IS
  'First look (punch list #319 PR 2): Drive''s address for a video''s copy in pieces, cleared when the copy is whole. Never shown.';

-- What the sweep asks for every five minutes: finished files not in Drive yet, the ones it has not tried lately first.
CREATE INDEX IF NOT EXISTS first_look_files_to_file_idx ON public.first_look_files (drive_tried_at NULLS FIRST, finished_at)
  WHERE drive_file_id IS NULL AND finished_at IS NOT NULL AND removed_at IS NULL;

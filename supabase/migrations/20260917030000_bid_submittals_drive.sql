SET lock_timeout = '3s';

-- Submittals stage 6c (v2.3552): every shared package is filed in the bid's job folder on
-- Drive (Submittals/Rev N · <date>.pdf) by file-submittal-package; the revision remembers
-- the file so the tab reads "filed in Drive ↗" and a second filing reuses it.

ALTER TABLE public.bid_submittals ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE public.bid_submittals ADD COLUMN IF NOT EXISTS drive_file_url text;
ALTER TABLE public.bid_submittals ADD COLUMN IF NOT EXISTS drive_filed_at timestamptz;
COMMENT ON COLUMN public.bid_submittals.drive_file_url IS 'Submittals 6c: the Drive link of the filed package PDF (Submittals/Rev N · date.pdf in the job folder); NULL until filed. Drafts are never filed.';

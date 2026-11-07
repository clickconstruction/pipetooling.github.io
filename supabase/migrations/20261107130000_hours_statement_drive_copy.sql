SET lock_timeout = '3s';

-- Signed hours statement (punch list #212, residual C, v2.6634): where a signed statement's PDF was put in the job's
-- Drive folder — Team only → Sent by us, through drive-link's `put` — so the Hours statements section offers the press
-- once and Open in Drive after. Both stay null until the office presses Put in Sent by us. The table's own policies
-- (can_touch_hours_statement) already cover the update.

ALTER TABLE public.hours_statements
  ADD COLUMN IF NOT EXISTS drive_file_id text CHECK (length(drive_file_id) <= 200),
  ADD COLUMN IF NOT EXISTS drive_filed_at timestamptz;

COMMENT ON COLUMN public.hours_statements.drive_file_id IS 'The Drive file id of the signed PDF''s copy in the job''s Team only → Sent by us folder (v2.6634); null until the office puts it there.';
COMMENT ON COLUMN public.hours_statements.drive_filed_at IS 'When the signed PDF''s copy was put in Sent by us (v2.6634).';

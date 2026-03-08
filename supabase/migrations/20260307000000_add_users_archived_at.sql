-- Add archived_at column for soft-delete (archive) flow.
-- NULL = active user. Non-null = archived; user is hidden and cannot sign in.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
COMMENT ON COLUMN public.users.archived_at IS 'When user was archived. NULL = active. Set with banned_until to soft-deactivate.';

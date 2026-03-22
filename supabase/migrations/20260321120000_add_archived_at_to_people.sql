-- Add archived_at for soft delete (like users.archived_at)
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.people.archived_at IS 'When set, person is archived (hidden from roster). Can be restored.';

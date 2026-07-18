-- Customer soft archive (v2.736).
-- Adds nullable archive markers to public.customers. No delete, no RLS change:
-- archiving is a same-row UPDATE already covered by the existing customers
-- UPDATE policies (masters own rows, assistants of adopted masters, estimators).
-- Archived customers are hidden from the Customers page list by default and
-- excluded from pickers that link NEW records (job form, estimates, bids,
-- new-project, create-job-from-estimate); existing links keep working and
-- archived customers still render wherever they are already referenced.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.customers.archived_at IS
  'Soft archive marker. NULL = active. Non-NULL = archived: hidden from the Customers list by default and excluded from pickers/searches used to link new jobs/estimates/bids/projects. Existing links keep working and the customer still renders wherever already referenced. Never implies deletion.';

COMMENT ON COLUMN public.customers.archived_by IS
  'User who archived this customer (informational). Cleared to NULL on unarchive; ON DELETE SET NULL if that user is ever deleted.';

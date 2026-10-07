SET lock_timeout = '3s';

-- Records for an owner (v2.4544): the Lien desk's trail of one owner asking for our records
-- on their property. An owner whose GC has not paid us asks what was billed and what was
-- paid; the desk answers with one packet per property, behind four checks: their request in
-- writing, our contract with the GC read for a clause that stops it, the numbers agreeing
-- with the notices, and their signed acknowledgment. One row per request holds who asked
-- about which property, the jobs the packet covered, and the checks as they were met.
-- A request is not kept on a notice's `fields`: a draft's fields are rewritten whole when it
-- is approved again, and this trail has to outlive that.
CREATE TABLE IF NOT EXISTS public.lien_owner_record_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The owner and the property the packet is for, and the GC those jobs are billed to.
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_address_id uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  gc_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  -- The job the window was opened on, and every job the packet covers.
  seed_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  job_ids uuid[] NOT NULL DEFAULT '{}',
  -- As the packet named them, kept as text so the trail reads after a customer is renamed.
  owner_name text NOT NULL DEFAULT '',
  property_address text NOT NULL DEFAULT '',
  -- The checks and the send, as the window keeps them (src/lib/jobs/ownerRecords.ts, OwnerRecordsFile):
  -- { request, contractChecked, acknowledgment, sent }.
  file jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT lien_owner_record_requests_file_object CHECK (jsonb_typeof(file) = 'object'),
  -- When the packet was recorded as sent (file.sent.at), for sorting and for "open requests".
  sent_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lien_owner_record_requests IS
  'Records for an owner (v2.4544): one row per owner''s request for our records on their property — who asked, the property, the jobs the packet covered, and the four checks as they were met (file: request in writing, the GC contract check, the signed acknowledgment, the send). The Lien desk''s "An owner asked for records" window reads and writes it.';

CREATE INDEX IF NOT EXISTS lien_owner_record_requests_address_idx ON public.lien_owner_record_requests (customer_address_id);
CREATE INDEX IF NOT EXISTS lien_owner_record_requests_gc_idx ON public.lien_owner_record_requests (gc_customer_id);
CREATE INDEX IF NOT EXISTS lien_owner_record_requests_seed_job_idx ON public.lien_owner_record_requests (seed_job_id);

ALTER TABLE public.lien_owner_record_requests ENABLE ROW LEVEL SECURITY;

-- The office set that works the Lien desk (dev, assistant-like, master) — as job_lien_desk_items.
DROP POLICY IF EXISTS lien_owner_record_requests_select_office ON public.lien_owner_record_requests;
CREATE POLICY lien_owner_record_requests_select_office
  ON public.lien_owner_record_requests FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS lien_owner_record_requests_insert_office ON public.lien_owner_record_requests;
CREATE POLICY lien_owner_record_requests_insert_office
  ON public.lien_owner_record_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS lien_owner_record_requests_update_office ON public.lien_owner_record_requests;
CREATE POLICY lien_owner_record_requests_update_office
  ON public.lien_owner_record_requests FOR UPDATE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  )
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician')
  );

-- A trail is not the office's to remove.
DROP POLICY IF EXISTS lien_owner_record_requests_delete_dev ON public.lien_owner_record_requests;
CREATE POLICY lien_owner_record_requests_delete_dev
  ON public.lien_owner_record_requests FOR DELETE TO authenticated
  USING (public.is_dev());

-- Who saved it and when are stamped on the server, whatever the client sends.
CREATE OR REPLACE FUNCTION public.lien_owner_record_requests_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
-- A trigger function is never called by hand.
REVOKE ALL ON FUNCTION public.lien_owner_record_requests_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lien_owner_record_requests_stamp ON public.lien_owner_record_requests;
CREATE TRIGGER lien_owner_record_requests_stamp
  BEFORE INSERT OR UPDATE ON public.lien_owner_record_requests
  FOR EACH ROW EXECUTE FUNCTION public.lien_owner_record_requests_stamp();

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

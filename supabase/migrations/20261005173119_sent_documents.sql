SET lock_timeout = '3s';

-- Sent copies (v2.4554): one row each time the company sends someone something, with the
-- exact copy that went out. Until now about thirty kinds of paper kept a "sent" date and were
-- drawn again from live data when reopened, so a bill or a records packet opened a month
-- later could show other numbers than the one the person received. A row here says what went,
-- to whom, how (a print counts), when and by whom, and points at the page or the PDF as it
-- was, in the private sent-documents bucket. The office reads it from Documents.
-- Rows are never changed: there is no UPDATE policy, here or on the bucket.
CREATE TABLE IF NOT EXISTS public.sent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What it is, as the code names it ('owner_records_packet', 'bill', …). Text, not an enum:
  -- a new kind of paper needs no migration.
  kind text NOT NULL
    CONSTRAINT sent_documents_kind_shape CHECK (kind ~ '^[a-z][a-z0-9_]{1,60}$'),
  -- What it is, as a person reads it ("Records for 9703 Lenox Hill").
  title text NOT NULL DEFAULT '',
  how text NOT NULL
    CONSTRAINT sent_documents_how_known CHECK (how IN ('print', 'email', 'hand', 'mail', 'link', 'download')),
  -- Who it went to, as the send named them: kept as text so the row reads after a rename.
  recipient_name text NOT NULL DEFAULT '',
  recipient_emails text[] NOT NULL DEFAULT '{}',
  -- An email's subject line.
  subject text NOT NULL DEFAULT '',
  -- Where the office finds it: the jobs it is about (one, several for a property or a GC
  -- statement, or none), the customer, the bid, the person.
  job_ids uuid[] NOT NULL DEFAULT '{}',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  -- The record the paper was drawn from (a bill, a filing, a request), so its own row can
  -- link to the copy. No foreign key: it names any table.
  source_table text NOT NULL DEFAULT '',
  source_id uuid,
  -- The copy in the sent-documents bucket: its path, its type, a SHA-256 of its bytes (a
  -- second print of the same page points at the first copy), its size. A null path means
  -- the copy could not be kept; the row still says it went.
  copy_path text,
  copy_type text NOT NULL DEFAULT '',
  copy_hash text NOT NULL DEFAULT '',
  copy_bytes integer,
  -- An email's attachments, each kept beside the copy: [{ name, path, type, bytes }].
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT sent_documents_attachments_array CHECK (jsonb_typeof(attachments) = 'array'),
  resend_email_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sent_by_name text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.sent_documents IS
  'Sent copies (v2.4554): one row each time the company sends someone something — what, to whom, how (print, email, hand, mail, link, download), when, by whom — with the exact copy in the sent-documents bucket (copy_path; attachments for an email). Append-only. Written by the client (src/lib/sent/sentCopiesIo.ts) and by the email functions; read by the Documents tab''s "Sent from this job".';

CREATE INDEX IF NOT EXISTS sent_documents_job_ids_idx ON public.sent_documents USING gin (job_ids);
CREATE INDEX IF NOT EXISTS sent_documents_customer_idx ON public.sent_documents (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sent_documents_bid_idx ON public.sent_documents (bid_id) WHERE bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sent_documents_person_idx ON public.sent_documents (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sent_documents_source_idx ON public.sent_documents (source_table, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sent_documents_kind_hash_idx ON public.sent_documents (kind, copy_hash) WHERE copy_hash <> '';
CREATE INDEX IF NOT EXISTS sent_documents_sent_at_idx ON public.sent_documents (sent_at DESC);

ALTER TABLE public.sent_documents ENABLE ROW LEVEL SECURITY;

-- The office reads every copy (the owner, 2026-10-05: "office can find it in documents when
-- they need it"): dev, master, assistant, controller.
DROP POLICY IF EXISTS sent_documents_select_office ON public.sent_documents;
CREATE POLICY sent_documents_select_office
  ON public.sent_documents FOR SELECT TO authenticated
  USING (public.is_office_staff());

-- Whoever on staff sends it files it: the office, an estimator printing a bid letter, a
-- primary or a superintendent printing a sheet. Subs and customers never write here.
DROP POLICY IF EXISTS sent_documents_insert_staff ON public.sent_documents;
CREATE POLICY sent_documents_insert_staff
  ON public.sent_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_office_or_estimator()
    OR public.is_primary()
    OR public.is_superintendent()
  );

-- A record of what went out is not the office's to remove.
DROP POLICY IF EXISTS sent_documents_delete_dev ON public.sent_documents;
CREATE POLICY sent_documents_delete_dev
  ON public.sent_documents FOR DELETE TO authenticated
  USING (public.is_dev());

-- Who sent it and when are stamped on the server for a signed-in sender, whatever the client
-- says. An email function writes with the service role (no auth.uid()) and names the sender
-- itself, or leaves it empty for a scheduled send.
CREATE OR REPLACE FUNCTION public.sent_documents_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    NEW.sent_by := v_uid;
    NEW.sent_at := now();
    NEW.sent_by_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '');
  ELSIF NEW.sent_by IS NOT NULL AND NEW.sent_by_name = '' THEN
    NEW.sent_by_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = NEW.sent_by), '');
  END IF;
  RETURN NEW;
END;
$$;
-- A trigger function is never called by hand.
REVOKE ALL ON FUNCTION public.sent_documents_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sent_documents_stamp ON public.sent_documents;
CREATE TRIGGER sent_documents_stamp
  BEFORE INSERT ON public.sent_documents
  FOR EACH ROW EXECUTE FUNCTION public.sent_documents_stamp();

-- The bucket: <sent_documents.id>/<file>, private. The office reads; staff who send add a
-- file (never a training-mode user or a twin: the table's fences do not reach storage). No
-- UPDATE and no DELETE policy: a copy is never replaced.
INSERT INTO storage.buckets (id, name, public)
VALUES ('sent-documents', 'sent-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS sent_documents_copies_select ON storage.objects;
CREATE POLICY sent_documents_copies_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sent-documents'
    AND public.is_office_staff()
  );

DROP POLICY IF EXISTS sent_documents_copies_insert ON storage.objects;
CREATE POLICY sent_documents_copies_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sent-documents'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_office_or_estimator()
      OR public.is_primary()
      OR public.is_superintendent()
    )
    AND NOT public.is_read_only()
    AND NOT public.is_digital_twin()
  );

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

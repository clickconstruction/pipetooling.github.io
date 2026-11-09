SET lock_timeout = '3s';

-- A photo of the supply house ticket, taken at the counter (punch list #295, PR 1 of four, v2.6812). The owner's ask
-- of 2026-11-09: a tech takes a photo of the ticket or the receipt right there in the app. Two papers leave a counter.
-- A card receipt is the only itemised record of that purchase and no bill ever follows it, and the office sorted its
-- charge to a job from the clock's guess. An account ticket is followed days later by the bill, and the paper the tech
-- signed never reached the app. This file is the ground under the press: no screen reads it yet (PR 2 is the press).
--
--   1. counter_tickets: one row a ticket. Who took it and when, the job it is for (or a second job, or no one job),
--      the PO code it was bought on, a typed total and a note, and how it met its money: the card charge it is matched
--      to and how the match was made, the charges it was said not to be, another way it was paid, or the bill it became.
--      Never deleted: removed_at keeps a ticket taken by mistake out of sight.
--   2. counter_ticket_pages: one row a page (a long receipt, a two-page ticket, a PDF the store sent). The phone puts
--      the page in the counter-tickets bucket; the photo-save sweep files a saved ticket's pages under Team only ›
--      Tickets in the job's Drive folder, never Customer Pictures, since a ticket shows prices. The bucket copy stays,
--      the app's own picture of the ticket (the task photo's rule).
--   3. The gates. A ticket is read by the person who took it, the office (is_office_staff: dev, leader, assistant,
--      controller) and the holder of the card its charge is on. The taker writes their own; the office writes any.
--      counter_tickets_guard holds what a taker may not do: match a charge that is not on a card of theirs, change the
--      job or remove a ticket the office has already used, or write the office's own columns.
--   4. A ticket whose job changes has its filed pages marked to file again, and the sweep moves the Drive file.
--   5. The bucket, private, 10 MB a file, pictures and PDFs.
--   6. The photo-save cron gains a ninth clause; every earlier clause is written again (20261030070000's rule).
--
-- Additive and idempotent. Two tables are created, so the four fences close the file. No client reads either table
-- until PR 2, so this is harmless on either side of the Pages deploy.

-- 1. The ticket.
CREATE TABLE IF NOT EXISTS public.counter_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taken_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  taken_by_name text NOT NULL DEFAULT '' CHECK (length(taken_by_name) <= 120),
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_at_from text NOT NULL DEFAULT 'press' CHECK (taken_at_from IN ('press', 'photo', 'none')),
  source text NOT NULL DEFAULT 'camera' CHECK (source IN ('camera', 'file', 'office')),
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  also_job_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(also_job_ids) <= 5),
  no_one_job boolean NOT NULL DEFAULT false,
  po_entry_id uuid REFERENCES public.material_po_generator_entries(id) ON DELETE SET NULL,
  total numeric(12, 2) CHECK (total IS NULL OR (total >= 0 AND total < 10000000)),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  added_at timestamptz,
  mercury_transaction_id uuid REFERENCES public.mercury_transactions(id) ON DELETE SET NULL,
  match_kind text CHECK (match_kind IN ('minute', 'total', 'asked', 'picked')),
  matched_at timestamptz,
  matched_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  declined_transaction_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(declined_transaction_ids) <= 50),
  paid_other text CHECK (paid_other IN ('cash', 'own_money', 'another_card', 'other')),
  paid_other_note text NOT NULL DEFAULT '' CHECK (length(paid_other_note) <= 300),
  supply_house_invoice_id uuid REFERENCES public.supply_house_invoices(id) ON DELETE SET NULL,
  used_at timestamptz,
  used_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT counter_tickets_no_one_job_has_no_job CHECK (NOT (no_one_job AND (job_id IS NOT NULL OR cardinality(also_job_ids) > 0))),
  CONSTRAINT counter_tickets_match_is_whole CHECK ((mercury_transaction_id IS NULL) = (match_kind IS NULL)),
  CONSTRAINT counter_tickets_one_way_paid CHECK (NOT (mercury_transaction_id IS NOT NULL AND paid_other IS NOT NULL))
);
-- One live ticket a charge: a second photo of the same paper waits, and the tech removes it.
CREATE UNIQUE INDEX IF NOT EXISTS counter_tickets_one_per_charge ON public.counter_tickets (mercury_transaction_id) WHERE mercury_transaction_id IS NOT NULL AND removed_at IS NULL;
CREATE INDEX IF NOT EXISTS counter_tickets_taker_idx ON public.counter_tickets (taken_by, taken_at DESC);
CREATE INDEX IF NOT EXISTS counter_tickets_job_idx ON public.counter_tickets (job_id, taken_at DESC) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS counter_tickets_open_idx ON public.counter_tickets (taken_at DESC) WHERE removed_at IS NULL AND added_at IS NOT NULL AND mercury_transaction_id IS NULL;
CREATE INDEX IF NOT EXISTS counter_tickets_po_entry_idx ON public.counter_tickets (po_entry_id) WHERE po_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS counter_tickets_invoice_idx ON public.counter_tickets (supply_house_invoice_id) WHERE supply_house_invoice_id IS NOT NULL;
COMMENT ON TABLE public.counter_tickets IS 'A photo of a supply house ticket or a receipt, taken at the counter (punch list #295). One row a ticket: who took it and when, the job it is for, the PO code it was bought on, a typed total, and how it met its money (the card charge it is matched to, another way it was paid, or the bill it became). Its pages are counter_ticket_pages. Never deleted: removed_at hides one taken by mistake.';
COMMENT ON COLUMN public.counter_tickets.taken_at IS 'When the ticket was taken. With taken_at_from = press it is the shutter at the counter, minutes after the swipe, and the match reads it; photo is the time the picture itself carries; none is a PDF or a paper handed in, where the time says nothing about the purchase.';
COMMENT ON COLUMN public.counter_tickets.also_job_ids IS 'More jobs the one ticket was bought for (a second tap on the sheet). Plain ids, no key: the office splits the charge across job_id and these.';
COMMENT ON COLUMN public.counter_tickets.no_one_job IS 'The taker pressed Not for one job (stock, the shop, a tool). The office places it.';
COMMENT ON COLUMN public.counter_tickets.added_at IS 'When the taker pressed Save; null while the sheet is still open. The sweep files, and the lists show, only a ticket with it.';
COMMENT ON COLUMN public.counter_tickets.match_kind IS 'How the ticket met its charge: minute (the only swipe on the taker''s card in the half hour before the photo, made with no press), total (a typed total equal to the charge within a day, made with no press), asked (a person answered Yes to the one charge that fits), picked (the office picked the charge).';
COMMENT ON COLUMN public.counter_tickets.declined_transaction_ids IS 'Charges a person said this ticket is not; never offered for it again.';
COMMENT ON COLUMN public.counter_tickets.paid_other IS 'No card charge will ever fit: the office recorded how it was paid (cash, the tech''s own money, another card, other).';
COMMENT ON COLUMN public.counter_tickets.used_at IS 'When the office first acted on the ticket (sorted its charge with it, recorded it as a bill, placed it). From then the taker no longer changes its job or removes it.';

-- 2. Its pages.
CREATE TABLE IF NOT EXISTS public.counter_ticket_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.counter_tickets(id) ON DELETE CASCADE,
  page_no integer NOT NULL DEFAULT 1 CHECK (page_no BETWEEN 1 AND 20),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  mime text NOT NULL DEFAULT 'image/jpeg' CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  bytes integer NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  original_bytes integer NOT NULL DEFAULT 0 CHECK (original_bytes >= 0),
  width integer NOT NULL DEFAULT 0 CHECK (width >= 0),
  height integer NOT NULL DEFAULT 0 CHECK (height >= 0),
  storage_path text CHECK (length(storage_path) <= 300),
  drive_file_id text CHECK (length(drive_file_id) <= 120),
  drive_folder_id text CHECK (length(drive_folder_id) <= 120),
  filed_at timestamptz,
  fail_why text CHECK (length(fail_why) <= 300),
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS counter_ticket_pages_ticket_idx ON public.counter_ticket_pages (ticket_id, page_no);
CREATE INDEX IF NOT EXISTS counter_ticket_pages_unfiled_idx ON public.counter_ticket_pages (taken_at) WHERE filed_at IS NULL AND storage_path IS NOT NULL;
COMMENT ON TABLE public.counter_ticket_pages IS 'A page of a counter ticket (punch list #295): a photo the phone shrank, or a PDF. It waits in the counter-tickets bucket; the photo-save sweep files a saved ticket''s pages under Team only › Tickets in the job''s Drive folder and writes drive_file_id, drive_folder_id and filed_at. The bucket copy stays, the app''s own picture of the ticket.';
COMMENT ON COLUMN public.counter_ticket_pages.drive_folder_id IS 'The Drive folder the page was filed into, so a ticket moved to another job moves its file from here.';
COMMENT ON COLUMN public.counter_ticket_pages.filed_at IS 'When the page reached the job''s folder. Cleared when the ticket''s job changes; a page with a drive_file_id and no filed_at is one the sweep moves.';
COMMENT ON COLUMN public.counter_ticket_pages.fail_why IS 'Why the sweep could not file it yet (the job has no Drive folder, Drive refused); read as not in Drive yet.';

-- 3. The gates.
-- A charge on a card of the caller's: the card id read from the charge as the Tally doors read it.
CREATE OR REPLACE FUNCTION public.counter_ticket_charge_is_mine(p_transaction_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_transaction_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.mercury_transactions t
    JOIN public.mercury_debit_card_user_links l ON l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
    WHERE t.id = p_transaction_id AND l.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.counter_ticket_charge_is_mine(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.counter_ticket_charge_is_mine(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.counter_ticket_charge_is_mine(uuid) IS 'Counter tickets (punch list #295): whether a card charge is on a card linked to the caller (mercury_debit_card_user_links).';

-- Whether the caller may see a ticket: the taker, the office, the holder of the card its charge is on. The pages and
-- the bucket read through it, so a page is seen exactly where its ticket is.
CREATE OR REPLACE FUNCTION public.counter_ticket_visible(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_office_staff() OR EXISTS (
    SELECT 1 FROM public.counter_tickets t
    WHERE t.id = p_ticket_id AND (t.taken_by = auth.uid() OR public.counter_ticket_charge_is_mine(t.mercury_transaction_id))
  );
$$;
REVOKE ALL ON FUNCTION public.counter_ticket_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.counter_ticket_visible(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.counter_ticket_visible(uuid) IS 'Counter tickets (punch list #295): whether the caller may see a ticket and its pages: the taker, the office (is_office_staff) or the holder of the card its charge is on.';

ALTER TABLE public.counter_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS counter_tickets_select ON public.counter_tickets;
CREATE POLICY counter_tickets_select ON public.counter_tickets FOR SELECT TO authenticated
  USING (taken_by = auth.uid() OR public.is_office_staff() OR public.counter_ticket_charge_is_mine(mercury_transaction_id));
DROP POLICY IF EXISTS counter_tickets_insert_own_or_office ON public.counter_tickets;
CREATE POLICY counter_tickets_insert_own_or_office ON public.counter_tickets FOR INSERT TO authenticated
  WITH CHECK (taken_by = auth.uid() OR public.is_office_staff());
DROP POLICY IF EXISTS counter_tickets_update_own_or_office ON public.counter_tickets;
CREATE POLICY counter_tickets_update_own_or_office ON public.counter_tickets FOR UPDATE TO authenticated
  USING (taken_by = auth.uid() OR public.is_office_staff())
  WITH CHECK (taken_by = auth.uid() OR public.is_office_staff());
REVOKE ALL ON TABLE public.counter_tickets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.counter_tickets TO authenticated;
GRANT ALL ON TABLE public.counter_tickets TO service_role;

ALTER TABLE public.counter_ticket_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS counter_ticket_pages_select ON public.counter_ticket_pages;
CREATE POLICY counter_ticket_pages_select ON public.counter_ticket_pages FOR SELECT TO authenticated
  USING (public.counter_ticket_visible(ticket_id));
DROP POLICY IF EXISTS counter_ticket_pages_insert ON public.counter_ticket_pages;
CREATE POLICY counter_ticket_pages_insert ON public.counter_ticket_pages FOR INSERT TO authenticated
  WITH CHECK (
    by_user_id = auth.uid()
    AND (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.counter_tickets t WHERE t.id = ticket_id AND t.taken_by = auth.uid() AND t.removed_at IS NULL))
  );
REVOKE ALL ON TABLE public.counter_ticket_pages FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.counter_ticket_pages TO authenticated;
GRANT ALL ON TABLE public.counter_ticket_pages TO service_role;

-- What a taker may not do, and the stamps no client is trusted to write. The service role (the sweep, auth.uid() null)
-- passes untouched.
CREATE OR REPLACE FUNCTION public.counter_tickets_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_office boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  v_office := public.is_office_staff();

  IF TG_OP = 'INSERT' THEN
    IF NOT v_office THEN
      NEW.used_at := NULL;
      NEW.used_by := NULL;
      NEW.supply_house_invoice_id := NULL;
      NEW.paid_other := NULL;
      NEW.paid_other_note := '';
    END IF;
    NEW.removed_at := NULL;
    NEW.removed_by := NULL;
  ELSE
    IF NOT v_office THEN
      -- The office's own columns, and who took it, stay as they were.
      NEW.taken_by := OLD.taken_by;
      NEW.used_at := OLD.used_at;
      NEW.used_by := OLD.used_by;
      NEW.supply_house_invoice_id := OLD.supply_house_invoice_id;
      NEW.paid_other := OLD.paid_other;
      NEW.paid_other_note := OLD.paid_other_note;
      IF OLD.used_at IS NOT NULL AND (
        NEW.job_id IS DISTINCT FROM OLD.job_id
        OR NEW.also_job_ids IS DISTINCT FROM OLD.also_job_ids
        OR NEW.no_one_job IS DISTINCT FROM OLD.no_one_job
        OR (NEW.removed_at IS NULL) IS DISTINCT FROM (OLD.removed_at IS NULL)
      ) THEN
        RAISE EXCEPTION 'The office has already used this ticket. Ask the office to change it.' USING ERRCODE = '42501';
      END IF;
    END IF;
    -- Removed, or put back: stamped here.
    IF NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
      NEW.removed_at := now();
      NEW.removed_by := auth.uid();
    ELSIF NEW.removed_at IS NULL THEN
      NEW.removed_by := NULL;
    ELSE
      NEW.removed_at := OLD.removed_at;
      NEW.removed_by := OLD.removed_by;
    END IF;
    IF v_office AND NEW.used_at IS NOT NULL AND OLD.used_at IS NULL THEN
      NEW.used_at := now();
      NEW.used_by := auth.uid();
    END IF;
  END IF;

  -- The match: a taker ties a ticket only to a charge on a card of their own; the office ties any. Stamped here.
  IF NEW.mercury_transaction_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.mercury_transaction_id IS DISTINCT FROM OLD.mercury_transaction_id) THEN
    IF NOT v_office AND NOT public.counter_ticket_charge_is_mine(NEW.mercury_transaction_id) THEN
      RAISE EXCEPTION 'That charge is on another person''s card. The office matches it.' USING ERRCODE = '42501';
    END IF;
    IF NOT v_office AND NEW.match_kind = 'picked' THEN
      NEW.match_kind := 'asked';
    END IF;
    NEW.matched_at := now();
    NEW.matched_by := auth.uid();
  ELSIF NEW.mercury_transaction_id IS NULL THEN
    NEW.match_kind := NULL;
    NEW.matched_at := NULL;
    NEW.matched_by := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.counter_tickets_guard() FROM PUBLIC, anon;
COMMENT ON FUNCTION public.counter_tickets_guard() IS 'Counter tickets (punch list #295): a taker matches only a charge on a card of their own, never changes the job of or removes a ticket the office has used, and never writes the office''s columns; the match, the removal and the first use are stamped here.';
DROP TRIGGER IF EXISTS counter_tickets_guard ON public.counter_tickets;
CREATE TRIGGER counter_tickets_guard BEFORE INSERT OR UPDATE ON public.counter_tickets
  FOR EACH ROW EXECUTE FUNCTION public.counter_tickets_guard();

-- 4. A ticket moved to another job: its filed pages file again, and the sweep moves the Drive file to the new folder.
CREATE OR REPLACE FUNCTION public.counter_tickets_job_change_refiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.counter_ticket_pages SET filed_at = NULL, fail_why = NULL WHERE ticket_id = NEW.id AND filed_at IS NOT NULL;
  RETURN NULL;
END
$$;
REVOKE ALL ON FUNCTION public.counter_tickets_job_change_refiles() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS counter_tickets_job_change_refiles ON public.counter_tickets;
CREATE TRIGGER counter_tickets_job_change_refiles AFTER UPDATE OF job_id ON public.counter_tickets
  FOR EACH ROW WHEN (OLD.job_id IS DISTINCT FROM NEW.job_id) EXECUTE FUNCTION public.counter_tickets_job_change_refiles();

-- 5. The bucket: private, 10 MB a file, pictures and PDFs. Objects are named <uploader>/<ticket_id>/<page_id>.<ext>:
--    a person writes under their own id, and a page is read exactly where its ticket is.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('counter-tickets', 'counter-tickets', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS counter_tickets_files_insert ON storage.objects;
CREATE POLICY counter_tickets_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'counter-tickets' AND (storage.foldername(name))[1] = (auth.uid())::text);
DROP POLICY IF EXISTS counter_tickets_files_select ON storage.objects;
CREATE POLICY counter_tickets_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'counter-tickets'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_office_staff()
      OR ((storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' AND public.counter_ticket_visible(((storage.foldername(name))[2])::uuid))
    )
  );
DROP POLICY IF EXISTS counter_tickets_files_update_own ON storage.objects;
CREATE POLICY counter_tickets_files_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'counter-tickets' AND (storage.foldername(name))[1] = (auth.uid())::text)
  WITH CHECK (bucket_id = 'counter-tickets' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- 6. The cron: photo-save calls while any source waits; a ninth clause for a saved ticket's page that is not in its
--    job's folder. Every earlier clause is written again (20261106230000 held eight). Unscheduled first, so a second
--    run leaves one row.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'photo-save';

SELECT cron.schedule(
  'photo-save',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/photo-save',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.photo_saves WHERE on_since IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.report_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL AND report_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_answers WHERE photo_filed_at IS NULL AND photo_storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_photo_notes WHERE filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.machine_check_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_records WHERE pdf_filed_at IS NULL AND pdf_tries < 5)
     OR EXISTS (SELECT 1 FROM public.task_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (
       SELECT 1 FROM public.counter_ticket_pages p
       JOIN public.counter_tickets t ON t.id = p.ticket_id
       WHERE p.filed_at IS NULL AND p.storage_path IS NOT NULL
         AND t.job_id IS NOT NULL AND t.added_at IS NOT NULL AND t.removed_at IS NULL
     );
  $$
);

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();

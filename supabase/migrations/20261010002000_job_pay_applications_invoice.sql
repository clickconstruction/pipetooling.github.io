SET lock_timeout = '3s';

-- AIA G702-G703 (v2.5032, the owner's call of 2026-10-09): the office picks the bill an application
-- became. `invoice_id` is set from the application's line in the window's history, or from Bill
-- Customer when the office sends a bill on a job with saved applications; an amount-and-date match
-- only pre-fills the pick. The history reads the bill's payments under the application
-- ("Paid $13,588.20 · Aug 22"). Additive: a nullable column, its index, and the stamp trigger
-- restated with two additions. No new table, so no read-only or digital-twin fences to re-apply.

ALTER TABLE public.job_pay_applications
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL;

-- One bill is the bill of at most one live application. Also the index for the foreign key.
CREATE UNIQUE INDEX IF NOT EXISTS job_pay_applications_invoice_live_uniq
  ON public.job_pay_applications (invoice_id)
  WHERE invoice_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.job_pay_applications.invoice_id IS
  'The bill this application became (v2.5032), picked by the office on the application or in Bill Customer; null until tied. A deleted bill unties it.';

-- The stamp trigger, as 20261006235000 left it, with two additions:
-- 1. A tie, an untie, or a deleted bill's SET NULL changes only invoice_id. That keeps the saved
--    stamps, so the history does not read a tie as "saved again".
-- 2. A tied bill must be on the application's job. A restored application whose bill another live
--    application has since taken comes back untied instead of failing the restore.
-- Replaces the v2.4715 definition in full.
CREATE OR REPLACE FUNCTION public.job_pay_applications_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.invoice_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.id = NEW.invoice_id AND i.job_id = NEW.job_id) THEN
      RAISE EXCEPTION 'That bill is on another job.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    IF NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_at := now();
      NEW.deleted_by := auth.uid();
    ELSE
      NEW.deleted_by := NULL;
    END IF;
    RETURN NEW;
  END IF;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    -- Marked or unmarked: stamp that, keep the saved stamps.
    NEW.updated_by := OLD.updated_by;
    NEW.updated_at := OLD.updated_at;
    IF NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_at := now();
      NEW.deleted_by := auth.uid();
    ELSE
      NEW.deleted_by := NULL;
      IF NEW.invoice_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.job_pay_applications o
        WHERE o.invoice_id = NEW.invoice_id AND o.deleted_at IS NULL AND o.id <> NEW.id
      ) THEN
        NEW.invoice_id := NULL;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  NEW.deleted_by := OLD.deleted_by;
  IF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
     AND (to_jsonb(NEW) - 'invoice_id' - 'updated_at' - 'updated_by') = (to_jsonb(OLD) - 'invoice_id' - 'updated_at' - 'updated_by') THEN
    -- Tied, untied, or the bill was deleted: keep the saved stamps.
    NEW.updated_by := OLD.updated_by;
    NEW.updated_at := OLD.updated_at;
    RETURN NEW;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.job_pay_applications_stamp() FROM PUBLIC, anon, authenticated;

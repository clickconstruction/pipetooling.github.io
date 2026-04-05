-- Global sequential estimate_number for all rows (single sequence).
-- Gaps may appear if draft rows are deleted; numbers are immutable after assignment.

ALTER TABLE public.estimates
  ADD COLUMN estimate_number integer;

UPDATE public.estimates e
SET estimate_number = s.n
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS n
  FROM public.estimates
) s
WHERE e.id = s.id;

ALTER TABLE public.estimates
  ALTER COLUMN estimate_number SET NOT NULL;

CREATE UNIQUE INDEX estimates_estimate_number_unique
  ON public.estimates (estimate_number);

CREATE SEQUENCE public.estimates_estimate_number_seq AS integer;

-- Next nextval() after this will be MAX(estimate_number) + 1 (is_called = true).
SELECT setval(
  'public.estimates_estimate_number_seq',
  COALESCE((SELECT MAX(estimate_number) FROM public.estimates), 0),
  true
);

ALTER SEQUENCE public.estimates_estimate_number_seq OWNED BY public.estimates.estimate_number;

ALTER TABLE public.estimates
  ALTER COLUMN estimate_number SET DEFAULT nextval('public.estimates_estimate_number_seq');

COMMENT ON COLUMN public.estimates.estimate_number IS
  'Monotonic global quote number; assigned on insert; never changes.';

-- Optional path: INSERT with explicit NULL still gets a number.
CREATE OR REPLACE FUNCTION public.estimates_assign_estimate_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estimate_number IS NULL THEN
    NEW.estimate_number := nextval('public.estimates_estimate_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER estimates_assign_estimate_number_trigger
BEFORE INSERT ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.estimates_assign_estimate_number();

CREATE OR REPLACE FUNCTION public.estimates_forbid_estimate_number_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estimate_number IS DISTINCT FROM OLD.estimate_number THEN
    RAISE EXCEPTION 'estimate_number cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER estimates_forbid_estimate_number_change_trigger
BEFORE UPDATE ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.estimates_forbid_estimate_number_change();

CREATE OR REPLACE FUNCTION public.estimates_protect_after_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'customer_accepted' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.master_user_id IS DISTINCT FROM OLD.master_user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.line_items_snapshot IS DISTINCT FROM OLD.line_items_snapshot
      OR NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot
      OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
      OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
      OR NEW.public_token_hash IS DISTINCT FROM OLD.public_token_hash
      OR NEW.public_token_expires_at IS DISTINCT FROM OLD.public_token_expires_at
      OR NEW.acceptor_printed_name IS DISTINCT FROM OLD.acceptor_printed_name
      OR NEW.acceptor_consented_at IS DISTINCT FROM OLD.acceptor_consented_at
      OR NEW.acceptor_ip IS DISTINCT FROM OLD.acceptor_ip
      OR NEW.acceptor_user_agent IS DISTINCT FROM OLD.acceptor_user_agent
      OR NEW.estimate_number IS DISTINCT FROM OLD.estimate_number
    THEN
      RAISE EXCEPTION 'estimate is accepted; only job_ledger_id and internal_notes can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

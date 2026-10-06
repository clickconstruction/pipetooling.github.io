SET lock_timeout = '3s';

-- Punch list #85, item 17, PR 2 (v2.4649): every office event emails the firm.
--
-- Until now the queue carried three events (a release, an office answer, a pull-back). The firm also needs to
-- hear when the office asks it something, adds a note, applies a payment it received, and — in the digest
-- only — sees a fee or cost it added. The answer's event now carries the firm's question, so the email reads
-- as the conversation does. `legal-notify-dispatch` (v2.4649) knows every trigger below and skips any it does
-- not know; DEPLOY IT BEFORE PUSHING THIS, or the old dispatcher words a new event as a pull-back.

-- The queue's trigger CHECK (inline in 20260911204604: legal_notification_queue_trigger_check; found by definition).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.legal_notification_queue'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%trigger%'
      AND conname <> 'legal_notification_queue_trigger_check_v2'
  LOOP
    EXECUTE format('ALTER TABLE public.legal_notification_queue DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
DO $$
BEGIN
  ALTER TABLE public.legal_notification_queue ADD CONSTRAINT legal_notification_queue_trigger_check_v2
    CHECK (trigger IN ('referred', 'answer', 'pulled', 'ask', 'note', 'applied', 'fee_seen')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_notification_queue VALIDATE CONSTRAINT legal_notification_queue_trigger_check_v2;

-- The office's entries: an answer (with the question it answers), an ask, a note, a payment applied.
-- The function keeps its name, so the existing AFTER INSERT trigger (legal_entries_notify_answer) runs it.
CREATE OR REPLACE FUNCTION public.legal_entries_notify_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_firm uuid;
  v_payer text;
  v_question text;
BEGIN
  IF NEW.via_portal OR NEW.kind NOT IN ('answer', 'question', 'note', 'recovery_applied') THEN RETURN NEW; END IF;
  SELECT firm_id, payer_name INTO v_firm, v_payer FROM public.legal_matters WHERE id = NEW.matter_id;
  IF v_firm IS NULL THEN RETURN NEW; END IF;
  IF NEW.kind = 'answer' THEN
    -- A malformed askId must never fail the office's insert (item 17 review): cast only a real uuid.
    IF NEW.meta ? 'askId' AND (NEW.meta->>'askId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT body INTO v_question FROM public.legal_matter_entries
      WHERE id = (NEW.meta->>'askId')::uuid AND matter_id = NEW.matter_id AND via_portal;
    END IF;
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (v_firm, NEW.matter_id, 'answer', jsonb_build_object('payer', v_payer, 'body', NEW.body, 'question', v_question));
  ELSIF NEW.kind = 'question' THEN
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (v_firm, NEW.matter_id, 'ask', jsonb_build_object('payer', v_payer, 'body', NEW.body, 'flavor', COALESCE(NEW.meta->>'flavor', 'question'), 'jobLabel', NEW.meta->>'jobLabel'));
  ELSIF NEW.kind = 'note' THEN
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (v_firm, NEW.matter_id, 'note', jsonb_build_object('payer', v_payer, 'body', NEW.body));
  ELSE
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (v_firm, NEW.matter_id, 'applied', jsonb_build_object('payer', v_payer, 'body', NEW.body, 'amount', NEW.amount));
  END IF;
  RETURN NEW;
END;
$$;

-- The office saw a fee or cost the firm added (it acknowledged it): digest only.
CREATE OR REPLACE FUNCTION public.legal_entries_notify_fee_seen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_firm uuid;
  v_payer text;
BEGIN
  SELECT firm_id, payer_name INTO v_firm, v_payer FROM public.legal_matters WHERE id = NEW.matter_id;
  IF v_firm IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
  VALUES (v_firm, NEW.matter_id, 'fee_seen', jsonb_build_object('payer', v_payer, 'body', NEW.body, 'amount', NEW.amount));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS legal_entries_notify_fee_seen ON public.legal_matter_entries;
CREATE TRIGGER legal_entries_notify_fee_seen
  AFTER UPDATE OF acknowledged_at ON public.legal_matter_entries
  FOR EACH ROW
  WHEN (OLD.acknowledged_at IS NULL AND NEW.acknowledged_at IS NOT NULL AND NEW.via_portal AND NEW.kind IN ('fee', 'cost'))
  EXECUTE FUNCTION public.legal_entries_notify_fee_seen();

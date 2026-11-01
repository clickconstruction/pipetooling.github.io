SET lock_timeout = '3s';

-- Punch list #233, PR 4 (v2.6283): the firm's weekly digest carries every office act.
--
-- Until now the queue heard seven acts (a release, an answer, a pull-back, an ask, a note, a payment
-- applied, a fee seen). The office's own steps, planned steps, what-happened lines, offers and statements,
-- and a paper added to Evidence or released to the firm, left no line in any email. Each now queues a
-- row under its own trigger word; `legal-notify-dispatch` (v2.6283) holds every one of them to the
-- digest (`legalTriggerSendsNow`), so a paralegal entering six things does not get six emails back.
-- DEPLOY THE DISPATCHER BEFORE PUSHING THIS: the old one stamps an unknown trigger with nobody to send
-- to and leaves it out of the digest, so a row written before the deploy is never heard.

-- 1. The queue's trigger CHECK grows (the v2 constraint from 20261006170000 is found by name and dropped).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.legal_notification_queue'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%trigger%'
      AND conname <> 'legal_notification_queue_trigger_check_v3'
  LOOP
    EXECUTE format('ALTER TABLE public.legal_notification_queue DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
DO $$
BEGIN
  ALTER TABLE public.legal_notification_queue ADD CONSTRAINT legal_notification_queue_trigger_check_v3
    CHECK (trigger IN ('referred', 'answer', 'pulled', 'ask', 'note', 'applied', 'fee_seen', 'step', 'plan', 'event', 'offer', 'statement', 'paper', 'released')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_notification_queue VALIDATE CONSTRAINT legal_notification_queue_trigger_check_v3;

-- 2. The office's entries: the four that email now, plus the five that ride the digest. Same function name,
--    so the existing AFTER INSERT trigger (legal_entries_notify_answer) runs it. A step that only echoes a
--    release or a pull-back (its body is the desk's own line for those) is left to the referred / pulled
--    rows. A plan, event, offer or statement the office held back (held_overrides '<kind>:<id>' = true)
--    stays home, as the portal's read keeps it home.
CREATE OR REPLACE FUNCTION public.legal_entries_notify_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_firm uuid;
  v_payer text;
  v_question text;
  v_held jsonb;
BEGIN
  IF NEW.via_portal OR NEW.kind NOT IN ('answer', 'question', 'note', 'recovery_applied', 'step', 'plan', 'event', 'offer', 'statement') THEN RETURN NEW; END IF;
  SELECT firm_id, payer_name, held_overrides INTO v_firm, v_payer, v_held FROM public.legal_matters WHERE id = NEW.matter_id;
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
  ELSIF NEW.kind = 'recovery_applied' THEN
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (v_firm, NEW.matter_id, 'applied', jsonb_build_object('payer', v_payer, 'body', NEW.body, 'amount', NEW.amount));
  ELSIF NEW.kind = 'step' THEN
    IF NEW.body LIKE 'Marked attorney-ready%' OR NEW.body LIKE 'Pulled back from counsel%' THEN RETURN NEW; END IF;
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (v_firm, NEW.matter_id, 'step', jsonb_build_object('payer', v_payer, 'body', NEW.body, 'stage', NEW.meta->>'stage'));
  ELSE
    -- plan, event, offer, statement: skipped while held back.
    IF COALESCE(v_held, '{}'::jsonb) -> (NEW.kind || ':' || NEW.id::text) = 'true'::jsonb THEN RETURN NEW; END IF;
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (v_firm, NEW.matter_id, NEW.kind, jsonb_build_object(
      'payer', v_payer,
      'body', CASE NEW.kind
        WHEN 'plan' THEN NEW.body || ' · planned for ' || to_char(NEW.occurred_on, 'Mon FMDD')
        WHEN 'offer' THEN CASE WHEN NEW.meta->>'direction' = 'received' THEN 'received by the office' ELSE 'made by the office' END || CASE WHEN COALESCE(NEW.body, '') <> '' THEN ' — ' || NEW.body ELSE '' END
        WHEN 'statement' THEN COALESCE(NULLIF(NEW.meta->>'title', ''), NEW.body)
        ELSE NEW.body END,
      'amount', NEW.amount));
  END IF;
  RETURN NEW;
END;
$$;

-- 3. A paper on Evidence: added for the firm, or a held one released to it. Voided papers never queue.
CREATE OR REPLACE FUNCTION public.legal_matter_documents_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_firm uuid;
  v_payer text;
BEGIN
  IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND COALESCE(NEW.held_reason, '') <> '' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NOT (COALESCE(OLD.held_reason, '') <> '' AND COALESCE(NEW.held_reason, '') = '') THEN RETURN NEW; END IF;
  SELECT firm_id, payer_name INTO v_firm, v_payer FROM public.legal_matters WHERE id = NEW.matter_id;
  IF v_firm IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
  VALUES (v_firm, NEW.matter_id, CASE WHEN TG_OP = 'INSERT' THEN 'paper' ELSE 'released' END, jsonb_build_object('payer', v_payer, 'body', NEW.title));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS legal_matter_documents_notify_insert ON public.legal_matter_documents;
CREATE TRIGGER legal_matter_documents_notify_insert
  AFTER INSERT ON public.legal_matter_documents
  FOR EACH ROW EXECUTE FUNCTION public.legal_matter_documents_notify();
DROP TRIGGER IF EXISTS legal_matter_documents_notify_release ON public.legal_matter_documents;
CREATE TRIGGER legal_matter_documents_notify_release
  AFTER UPDATE OF held_reason ON public.legal_matter_documents
  FOR EACH ROW EXECUTE FUNCTION public.legal_matter_documents_notify();

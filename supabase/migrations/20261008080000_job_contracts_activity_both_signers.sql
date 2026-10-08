SET lock_timeout = '3s';

-- Punch list #64, left after v2.4657: the job's activity line for a signed agreement names both
-- signers. v2.4186 gave the agreement a second signature frame (co_signer_*); this trigger, from
-- 20260903141146_job_contracts.sql, still wrote "Contract signed by <first printed name>". The
-- function is the same but for v_signers, which joins the filled frames' printed names the way
-- the app's names line does ("Sam Owner and Alex Owner"). A paper record's line names nobody, as
-- before. Rows already logged keep their words; no two-signer agreement signed online is on prod
-- today, so there is nothing to rewrite. Doc: docs/migrations/.

CREATE OR REPLACE FUNCTION public.job_contracts_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sid text;
  v_amount text;
  v_doc text;
  v_signers text;
BEGIN
  v_doc := coalesce(nullif(trim(NEW.template_name), ''), 'Contract');
  v_amount := CASE
    WHEN (NEW.fields ->> 'amount_cents') ~ '^-?[0-9]+$'
      THEN ' — $' || trim(to_char(((NEW.fields ->> 'amount_cents')::bigint)::numeric / 100, 'FM999,999,990.00'))
    ELSE '' END;

  -- Sent (every send logs; the row's last_sent_at moves per send).
  IF NEW.last_sent_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.last_sent_at IS DISTINCT FROM NEW.last_sent_at) THEN
    v_sid := NEW.id::text || ':sent:' || extract(epoch FROM NEW.last_sent_at)::bigint::text;
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'contract_sent', NEW.last_sent_at, NEW.created_by,
      CASE WHEN NEW.send_count > 1 THEN 'Contract re-sent to ' ELSE 'Contract sent to ' END
        || coalesce(nullif(trim(NEW.recipient_email), ''), 'customer') || ' — ' || v_doc || v_amount,
      jsonb_build_object('source_id', v_sid, 'contract_id', NEW.id::text, 'revision', NEW.revision, 'send_count', NEW.send_count),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'contract_sent' AND e.detail ->> 'source_id' = v_sid
    );
  END IF;

  -- First view by the customer.
  IF NEW.first_viewed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.first_viewed_at IS NULL) THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'contract_viewed', NEW.first_viewed_at, NULL,
      'Contract opened by the customer',
      jsonb_build_object('source_id', NEW.id::text, 'contract_id', NEW.id::text),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'contract_viewed' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  -- Signed (online) or recorded (paper upload) — both land as contract_signed.
  IF NEW.signed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_at IS NULL) THEN
    -- Who signed: each filled frame's printed name, joined with "and" (signerNamesLine in
    -- supabase/functions/_shared/jobContractSigners.ts). The second frame counts once it is
    -- named, stamped and has a printed name.
    v_signers := concat_ws(' and ',
      nullif(trim(NEW.signer_printed_name), ''),
      CASE WHEN nullif(trim(NEW.co_signer_name), '') IS NOT NULL AND NEW.co_signed_at IS NOT NULL
        THEN nullif(trim(NEW.co_signer_printed_name), '') END);
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'contract_signed', NEW.signed_at, NEW.recorded_by,
      CASE WHEN NEW.signer_mode = 'paper'
        THEN 'Signed contract on file (paper) — ' || v_doc || v_amount
        ELSE 'Contract signed by ' || coalesce(nullif(v_signers, ''), 'the customer') || ' — ' || v_doc || v_amount END,
      jsonb_build_object('source_id', NEW.id::text, 'contract_id', NEW.id::text, 'signer_mode', NEW.signer_mode),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'contract_signed' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  -- Voided.
  IF TG_OP = 'UPDATE' AND NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'contract_voided', NEW.voided_at, NEW.voided_by,
      'Contract voided — ' || v_doc || coalesce(' · ' || nullif(trim(NEW.void_reason), ''), ''),
      jsonb_build_object('source_id', NEW.id::text, 'contract_id', NEW.id::text),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'contract_voided' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

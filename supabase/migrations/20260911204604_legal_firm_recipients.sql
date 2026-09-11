SET lock_timeout = '3s';

-- Legal portal train, PR 5 (v2.3325): the firm runs its own inbox.
--
-- Each person at the firm is a recipient row with ONE choice — hear right away or in a
-- weekly digest — plus "only my matters" (the ones they handle). A new address is inert
-- until its confirmation link is clicked; every email carries a one-click unsubscribe.
-- Two guards the firm cannot switch off. The office keeps pause-all and remove.
--
-- Events that reach the firm are queued by triggers (a matter released, an office answer,
-- a matter pulled back); the `legal-notify-dispatch` function drains the queue every five
-- minutes ("now" recipients) and sends each digest recipient one email on their weekday.

ALTER TABLE public.legal_firms ADD COLUMN IF NOT EXISTS paused_at timestamptz;
COMMENT ON COLUMN public.legal_firms.paused_at IS 'Office pause-all: while set, no email reaches anyone at the firm; the portal still works.';

CREATE TABLE IF NOT EXISTS public.legal_firm_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.legal_firms(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'now' CHECK (mode IN ('now', 'digest')),
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'mine')),
  digest_weekday int NOT NULL DEFAULT 1 CHECK (digest_weekday BETWEEN 1 AND 7),
  digest_time text NOT NULL DEFAULT '07:00' CHECK (digest_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  confirm_token_hash text,
  confirmed_at timestamptz,
  unsubscribe_token_hash text,
  paused_at timestamptz,
  last_digest_at timestamptz,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_via_portal boolean NOT NULL DEFAULT false,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS legal_firm_recipients_email_idx ON public.legal_firm_recipients (firm_id, lower(email)) WHERE removed_at IS NULL;
COMMENT ON TABLE public.legal_firm_recipients IS 'People at the collections law firm and their email rule (v2.3325): mode now|digest, scope all|mine, digest weekday (1=Mon) + Central time. Inert until confirmed_at; paused_at = unsubscribed / stopped; removed_at = the office removed them.';

CREATE TABLE IF NOT EXISTS public.legal_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.legal_firms(id) ON DELETE CASCADE,
  matter_id uuid REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  trigger text NOT NULL CHECK (trigger IN ('referred', 'answer', 'pulled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_now_at timestamptz,
  digested_at timestamptz
);
CREATE INDEX IF NOT EXISTS legal_notification_queue_open_idx ON public.legal_notification_queue (firm_id, created_at) WHERE sent_now_at IS NULL OR digested_at IS NULL;
COMMENT ON TABLE public.legal_notification_queue IS 'Events for the firm (v2.3325), written by triggers; legal-notify-dispatch stamps sent_now_at when the "now" recipients were emailed and digested_at when the digest carried it.';

ALTER TABLE public.legal_firm_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_firm_recipients_office_select ON public.legal_firm_recipients;
CREATE POLICY legal_firm_recipients_office_select ON public.legal_firm_recipients FOR SELECT TO authenticated USING (public.legal_office_can_read());
DROP POLICY IF EXISTS legal_notification_queue_office_select ON public.legal_notification_queue;
CREATE POLICY legal_notification_queue_office_select ON public.legal_notification_queue FOR SELECT TO authenticated USING (public.legal_office_can_read());
GRANT SELECT ON TABLE public.legal_firm_recipients TO authenticated;
GRANT SELECT ON TABLE public.legal_notification_queue TO authenticated;

-- Triggers: a release, a pull-back, an office answer.
CREATE OR REPLACE FUNCTION public.legal_matters_notify_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.firm_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.stage = 'referred' AND (OLD.stage IS DISTINCT FROM NEW.stage) AND OLD.stage NOT IN ('referred', 'demand', 'suit', 'judgment') THEN
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (NEW.firm_id, NEW.id, 'referred', jsonb_build_object('payer', NEW.payer_name, 'handling', NEW.handling_name, 'note', NEW.note_to_firm));
  ELSIF NEW.stage = 'review' AND OLD.stage IN ('referred', 'demand', 'suit', 'judgment') THEN
    INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
    VALUES (NEW.firm_id, NEW.id, 'pulled', jsonb_build_object('payer', NEW.payer_name));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS legal_matters_notify_stage ON public.legal_matters;
CREATE TRIGGER legal_matters_notify_stage AFTER UPDATE OF stage ON public.legal_matters FOR EACH ROW EXECUTE FUNCTION public.legal_matters_notify_stage();

CREATE OR REPLACE FUNCTION public.legal_entries_notify_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_firm uuid;
  v_payer text;
BEGIN
  IF NEW.kind <> 'answer' OR NEW.via_portal THEN RETURN NEW; END IF;
  SELECT firm_id, payer_name INTO v_firm, v_payer FROM public.legal_matters WHERE id = NEW.matter_id;
  IF v_firm IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.legal_notification_queue (firm_id, matter_id, trigger, payload)
  VALUES (v_firm, NEW.matter_id, 'answer', jsonb_build_object('payer', v_payer, 'body', NEW.body));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS legal_entries_notify_answer ON public.legal_matter_entries;
CREATE TRIGGER legal_entries_notify_answer AFTER INSERT ON public.legal_matter_entries FOR EACH ROW EXECUTE FUNCTION public.legal_entries_notify_answer();

-- Office overrides: pause everything to the firm, remove a person.
CREATE OR REPLACE FUNCTION public.legal_firm_set_paused(p_firm_id uuid, p_paused boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  UPDATE public.legal_firms SET paused_at = CASE WHEN p_paused THEN now() ELSE NULL END, updated_at = now() WHERE id = p_firm_id;
  RETURN jsonb_build_object('ok', FOUND, 'paused', p_paused);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_firm_set_paused(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_firm_set_paused(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.legal_firm_recipient_remove(p_recipient_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  UPDATE public.legal_firm_recipients SET removed_at = now(), updated_at = now() WHERE id = p_recipient_id AND removed_at IS NULL;
  RETURN jsonb_build_object('ok', FOUND);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_firm_recipient_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_firm_recipient_remove(uuid) TO authenticated;

-- The dispatcher: every five minutes on the :01 lane (co-rides billed-report-email).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'legal-notify-dispatch';
SELECT cron.schedule(
  'legal-notify-dispatch',
  '1-56/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/legal-notify-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();

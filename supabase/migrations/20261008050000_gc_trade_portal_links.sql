SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P1a (to-dos/gc-mode/PORTAL_REAL_BUILD.md on branch spike/gc-mode,
-- "The tables"): one link per company with no password, the sub portal's spine (sub_portal_links)
-- keyed to a company instead of a person, and every email we send a company, kept as it went.
-- The link is the key: the read function (gc-trade-portal) and the submit function resolve it with
-- the service role, and RLS never applies to a trade. Who makes a link: dev only until the door
-- (decision 3). Who opened it, and when, is public_page_views (surface gc_trade_portal), as for the
-- sub portal. Doc: docs/migrations/.

-- A company's portal link (decision 2: the sub portal's token, kept raw so the office can copy it
-- again, and hashed; no expiry; turning it off is the kill switch).
CREATE TABLE IF NOT EXISTS public.gc_trade_portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  token text,
  token_hash text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

COMMENT ON TABLE public.gc_trade_portal_links IS
  'GC mode: a trade partner company''s no-password portal link (the sub portal''s sub_portal_links, keyed to gc_companies). The raw token is the key; revoked_at is the only kill switch (no expiry). Written only by mint_gc_trade_portal_link and revoke_gc_trade_portal_link. Dev only while it is built.';

CREATE UNIQUE INDEX IF NOT EXISTS gc_trade_portal_links_active
  ON public.gc_trade_portal_links (company_id)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gc_trade_portal_links_token
  ON public.gc_trade_portal_links (token)
  WHERE token IS NOT NULL;

CREATE INDEX IF NOT EXISTS gc_trade_portal_links_token_hash
  ON public.gc_trade_portal_links (token_hash)
  WHERE token_hash IS NOT NULL;

-- Every email we sent a company, as it went (decision 5): the portal's Their messages reads this,
-- never what the data says now. Written by gc-trade-email with the service role (P3).
CREATE TABLE IF NOT EXISTS public.gc_trade_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  -- Null: about the company, not one project (the master agreement, insurance).
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  -- The prototype's PortalMessage kinds, and `paper` for a paper sent from the company window.
  kind text NOT NULL
    CONSTRAINT gc_trade_messages_kind_known CHECK (kind IN (
      'invite', 'nudge', 'plans', 'bidTab', 'msa', 'sow', 'start', 'less', 'change', 'paid', 'answer',
      'coi', 'closed', 'vetted', 'preBid', 'changeAsk', 'backCharge', 'dates', 'startSoon', 'paper')),
  -- Who at the company it went to, by the kind's group (mailRecipients).
  mail_group text NOT NULL
    CONSTRAINT gc_trade_messages_group_known CHECK (mail_group IN ('quotes', 'job', 'contracts', 'pay')),
  -- The prototype's message key: one key is sent once; a reminder has its own.
  msg_key text NOT NULL
    CONSTRAINT gc_trade_messages_keyed CHECK (btrim(msg_key) <> ''),
  lang text NOT NULL DEFAULT 'en'
    CONSTRAINT gc_trade_messages_lang_known CHECK (lang IN ('en', 'es')),
  subject text NOT NULL,
  -- The email, one paragraph a line.
  lines jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT gc_trade_messages_lines_list CHECK (jsonb_typeof(lines) = 'array'),
  to_names text[] NOT NULL DEFAULT '{}',
  -- The day in the app's zone, and the moment.
  sent_on date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  CONSTRAINT gc_trade_messages_once UNIQUE (company_id, msg_key)
);

COMMENT ON TABLE public.gc_trade_messages IS
  'GC mode: every email sent to a trade partner company, as it went (subject, lines, language, who). The trade portal''s Their messages reads it. Written by the gc-trade-email edge function with the service role. Dev only while it is built.';

CREATE INDEX IF NOT EXISTS gc_trade_messages_company
  ON public.gc_trade_messages (company_id, sent_at DESC);

ALTER TABLE public.gc_trade_portal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_trade_messages ENABLE ROW LEVEL SECURITY;

-- The office reads them (the company window's Their portal); nothing writes them under RLS.
DROP POLICY IF EXISTS gc_trade_portal_links_dev ON public.gc_trade_portal_links;
CREATE POLICY gc_trade_portal_links_dev ON public.gc_trade_portal_links FOR SELECT TO authenticated
  USING ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_trade_messages_dev ON public.gc_trade_messages;
CREATE POLICY gc_trade_messages_dev ON public.gc_trade_messages FOR SELECT TO authenticated
  USING ((SELECT public.is_dev()));

REVOKE ALL ON TABLE public.gc_trade_portal_links FROM anon;
REVOKE ALL ON TABLE public.gc_trade_messages FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_trade_portal_links FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_trade_messages FROM authenticated;
GRANT SELECT ON TABLE public.gc_trade_portal_links TO authenticated;
GRANT SELECT ON TABLE public.gc_trade_messages TO authenticated;

-- Make a link, or show the one that is on (the office copies it again); p_rotate turns the old one
-- off and makes a new one in the same transaction.
CREATE OR REPLACE FUNCTION public.mint_gc_trade_portal_link(
  p_company_id uuid,
  p_rotate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_raw text;
  v_row record;
BEGIN
  IF NOT COALESCE(public.is_dev(), false) THEN
    RETURN jsonb_build_object('error', 'Only a dev can make a trade portal link for now.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies c WHERE c.id = p_company_id) THEN
    RETURN jsonb_build_object('error', 'That company is not on record.');
  END IF;

  SELECT token, created_at INTO v_row
  FROM public.gc_trade_portal_links
  WHERE company_id = p_company_id AND revoked_at IS NULL;

  IF v_row.token IS NOT NULL AND NOT p_rotate THEN
    RETURN jsonb_build_object('token', v_row.token, 'activeSince', v_row.created_at);
  END IF;

  UPDATE public.gc_trade_portal_links
  SET revoked_at = now()
  WHERE company_id = p_company_id AND revoked_at IS NULL;

  v_raw := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO public.gc_trade_portal_links (company_id, token, token_hash, created_by)
  VALUES (p_company_id, v_raw, encode(digest(v_raw, 'sha256'), 'hex'), auth.uid());

  RETURN jsonb_build_object('token', v_raw, 'activeSince', now());
END;
$$;

COMMENT ON FUNCTION public.mint_gc_trade_portal_link(uuid, boolean) IS
  'GC mode: the company''s trade portal link (the one that is on, or a new one); p_rotate turns the old one off and makes a new one. Dev only until the door.';

REVOKE EXECUTE ON FUNCTION public.mint_gc_trade_portal_link(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mint_gc_trade_portal_link(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.mint_gc_trade_portal_link(uuid, boolean) TO authenticated;

-- Turn it off, with no new one: Turn it off.
CREATE OR REPLACE FUNCTION public.revoke_gc_trade_portal_link(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT COALESCE(public.is_dev(), false) THEN
    RETURN jsonb_build_object('error', 'Only a dev can turn off a trade portal link for now.');
  END IF;

  UPDATE public.gc_trade_portal_links
  SET revoked_at = now()
  WHERE company_id = p_company_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_count);
END;
$$;

COMMENT ON FUNCTION public.revoke_gc_trade_portal_link(uuid) IS
  'GC mode: turn the company''s trade portal link off, with no new one. Dev only until the door.';

REVOKE EXECUTE ON FUNCTION public.revoke_gc_trade_portal_link(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_gc_trade_portal_link(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_gc_trade_portal_link(uuid) TO authenticated;

-- The trade portal is a counted public page, like the sub portal.
ALTER TABLE public.public_page_views
  DROP CONSTRAINT IF EXISTS public_page_views_surface_check;
ALTER TABLE public.public_page_views
  ADD CONSTRAINT public_page_views_surface_check
  CHECK (surface IN ('portal', 'estimate_terms', 'contract_accept', 'hazmat_notice', 'sub_portal', 'legal_portal', 'gc_trade_portal'));

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

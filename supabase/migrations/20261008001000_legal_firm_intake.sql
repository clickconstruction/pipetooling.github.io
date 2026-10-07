SET lock_timeout = '3s';

-- The firm's answers to Start here (v2.4821, the owner's intake flow of 2026-10-07). The firm's portal asks
-- five questions — what else it wants with each matter, where it prefers to file, whether it e-files and
-- serves through the constable, and whether it signs off the Texas lien rules the app follows — and the
-- firm sends its answers with submit-legal-portal (kind 'intake', the service role). They land on the
-- firm's own row, so a replaced firm starts blank. The Legal desk's firm door wears a dot until someone
-- in the office reads them; reading stamps intake_seen_at through legal_firm_intake_seen(), the office's
-- one write here (legal_firms is a dev-only write table). A training-mode user's stamp is refused by the
-- table's read-only statement trigger, as every write is. Additive and idempotent; no CREATE TABLE.

ALTER TABLE public.legal_firms
  ADD COLUMN IF NOT EXISTS intake jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS intake_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS intake_sent_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS intake_seen_at timestamp with time zone;

COMMENT ON COLUMN public.legal_firms.intake IS 'The firm''s answers to Start here''s questions (v2.4821): { needs, fileWhere, efile, constable, rules, rulesNote }, shaped by _shared/legalFirmIntake.ts. Written by submit-legal-portal only.';
COMMENT ON COLUMN public.legal_firms.intake_sent_at IS 'When the firm last sent its answers from its portal.';
COMMENT ON COLUMN public.legal_firms.intake_sent_by IS 'Who at the firm sent them, as the firm wrote it (the firm''s own claim, like an act''s recorded-by).';
COMMENT ON COLUMN public.legal_firms.intake_seen_at IS 'When someone in the office last opened the firm''s window after the answers came in; the desk''s dot shows while it is before intake_sent_at.';

CREATE OR REPLACE FUNCTION public.legal_firm_intake_seen(p_firm_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.legal_office_can_read() THEN
    RAISE EXCEPTION 'Only the office reads the firm''s answers';
  END IF;
  UPDATE public.legal_firms
     SET intake_seen_at = now()
   WHERE id = p_firm_id
     AND intake_sent_at IS NOT NULL
     AND (intake_seen_at IS NULL OR intake_seen_at < intake_sent_at);
END;
$$;

COMMENT ON FUNCTION public.legal_firm_intake_seen(uuid) IS 'The office read the firm''s answers to Start here (v2.4821): stamps legal_firms.intake_seen_at so the Legal desk''s firm door loses its dot. Office only (legal_office_can_read()).';

REVOKE ALL ON FUNCTION public.legal_firm_intake_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_firm_intake_seen(uuid) TO authenticated;

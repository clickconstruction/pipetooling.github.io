SET lock_timeout = '3s';

-- Partnerships train PR 8 (PARTNERSHIPS_PLAN.md): the Agreements tab's spine.
--
-- Agreements already live in person_contract_documents (send-for-signature,
-- clock-in prompts, signed records — the People → Contracts machinery). This
-- adds the partnership lens: a sign-by deadline, a partnership link, and the
-- §8a notice LOG — when signing lapses, the app drafts the written 30-day
-- termination notice and stores it for MANUAL review + send. Nothing is ever
-- served automatically in this PR: modules.auto_notice stays false pending
-- Texas-attorney sign-off on delivery channels, and no cron exists. The
-- notice generator is a dev-triggered draft, logged forever.

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS sign_by date;
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS partnership_id uuid REFERENCES public.partnerships(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.person_contract_documents.sign_by IS
  'Partner agreements (§8a path): sign-by deadline. Unsigned past this date, the Agreements tab drafts the written 30-day notice for manual send. NULL = no deadline.';
COMMENT ON COLUMN public.person_contract_documents.partnership_id IS
  'Partnership this agreement belongs to (Partnerships → Agreements tab lens). NULL for ordinary staff contracts.';

CREATE INDEX IF NOT EXISTS idx_person_contract_documents_partnership
  ON public.person_contract_documents (partnership_id)
  WHERE partnership_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.partner_agreement_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  agreement_doc_id uuid REFERENCES public.person_contract_documents(id) ON DELETE SET NULL,
  sign_by_missed date,
  notice_html text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES public.users(id),
  delivered_via text[] NOT NULL DEFAULT '{}',
  delivered_at timestamptz,
  notes text
);

COMMENT ON TABLE public.partner_agreement_notices IS
  '§8a written-notice log: every drafted 30-day termination notice, with delivery record (delivered_via/delivered_at filled in manually when actually sent). Drafts are never auto-served — modules.auto_notice stays false pending attorney sign-off.';

ALTER TABLE public.partner_agreement_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs manage partner agreement notices" ON public.partner_agreement_notices;
CREATE POLICY "Devs manage partner agreement notices" ON public.partner_agreement_notices
  FOR ALL USING (public.is_dev()) WITH CHECK (public.is_dev());

GRANT SELECT, INSERT, UPDATE ON TABLE public.partner_agreement_notices TO authenticated;

ALTER TABLE public.partnership_events DROP CONSTRAINT IF EXISTS partnership_events_event_type_check;
ALTER TABLE public.partnership_events ADD CONSTRAINT partnership_events_event_type_check
  CHECK (event_type IN ('created', 'config_changed', 'status_changed', 'statement_generated', 'profit_share_posted', 'profit_share_reversed', 'estimating_transferred', 'notice_generated'));

CREATE OR REPLACE FUNCTION public.generate_agreement_notice(p_partnership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.partnerships%ROWTYPE;
  v_person_name text;
  v_doc record;
  v_today date;
  v_effective date;
  v_html text;
  v_id uuid;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'partnership not found'; END IF;
  SELECT name INTO v_person_name FROM public.people WHERE id = v_p.person_id;

  SELECT d.id, d.document_name, d.sign_by, d.status INTO v_doc
  FROM public.person_contract_documents d
  WHERE d.partnership_id = p_partnership_id AND d.status <> 'signed'
  ORDER BY d.sign_by NULLS LAST, d.created_at DESC
  LIMIT 1;

  v_today := (now() AT TIME ZONE 'America/Chicago')::date;
  v_effective := v_today + 30;

  v_html :=
    '<div data-theme="light" style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; padding: 32px; color: #211d16;">'
    || '<p style="font-weight:bold;">CLICK PLUMBING AND ELECTRICAL</p>'
    || '<p>' || to_char(v_today, 'FMMonth DD, YYYY') || '</p>'
    || '<p>To: ' || COALESCE(v_person_name, 'Partner') || COALESCE(' (' || NULLIF(v_p.company_name, '') || ')', '') || '</p>'
    || '<p><b>Re: Thirty (30) days'' written notice of termination of working relationship and tenancy</b></p>'
    || '<p>Per Section 8(a) of the Joint Venture and Tenancy Agreement between you and Click Plumbing and Electrical'
    || CASE WHEN v_doc.id IS NOT NULL AND v_doc.sign_by IS NOT NULL
            THEN ' (presented for signature with a sign-by date of ' || to_char(v_doc.sign_by, 'FMMonth DD, YYYY') || ', which has passed without signature)'
            ELSE '' END
    || ', this letter serves as the Company''s thirty (30) days'' written notice of termination of the working relationship and the tenancy described therein.</p>'
    || '<p>The notice period ends on <b>' || to_char(v_effective, 'FMMonth DD, YYYY') || '</b>. During the notice period both parties shall continue to perform their respective obligations in good faith. Arrangements for your RV, trailers, vehicles, and personal property will follow Section 8(c) of the agreement.</p>'
    || '<p>Signing the current agreement before the end of the notice period may, at the Company''s discretion, withdraw this notice.</p>'
    || '<p style="margin-top:40px;">Robert Douglas<br/>Click Plumbing and Electrical</p>'
    || '</div>';

  INSERT INTO public.partner_agreement_notices (partnership_id, agreement_doc_id, sign_by_missed, notice_html, generated_by)
  VALUES (p_partnership_id, v_doc.id, v_doc.sign_by, v_html, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.partnership_events (partnership_id, event_type, patch, actor_user_id)
  VALUES (p_partnership_id, 'notice_generated',
          jsonb_build_object('notice_id', v_id, 'agreement_doc_id', v_doc.id, 'sign_by_missed', v_doc.sign_by, 'effective', v_effective),
          auth.uid());

  RETURN jsonb_build_object('notice_id', v_id, 'notice_html', v_html, 'effective', v_effective);
END;
$$;
ALTER FUNCTION public.generate_agreement_notice(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.generate_agreement_notice(uuid) IS
  'Dev-only: drafts the §8a written 30-day notice for a partnership (logged in partner_agreement_notices + events). NEVER auto-served — delivery is a manual, recorded act; attorney sign-off gates any automation.';
GRANT ALL ON FUNCTION public.generate_agreement_notice(uuid) TO anon;
GRANT ALL ON FUNCTION public.generate_agreement_notice(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.generate_agreement_notice(uuid) TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();

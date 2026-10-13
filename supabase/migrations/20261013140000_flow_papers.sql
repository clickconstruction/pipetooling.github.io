SET lock_timeout = '3s';

-- Messages, cut 4, the New paper window (to-dos/gc-mode/messages/BUILD_PLAN.md §4, "A new paper from the editor", on
-- branch spike/gc-mode; the prototype's v1.177; cluster 6's F, v2.5306). A paper the flow editor adds is a Contract
-- library document: its id is the flow's paper (doc:<uuid>, src/lib/flows/facts.ts's doc family) and its kind says
-- which facts finish the step (an upload on file and current, a contract signed, a notice sent). Nothing here is a new
-- table: the library and the flow agree on one id.
--
--   * Four columns on contract_template_documents: flow_kind (upload, contract or notice; null on every library
--     document that is not a flow paper), name_es (the Spanish name the trade partner's and the customer's pages show),
--     book_body_es (a notice's Spanish words; its English stays in book_body_html) and renew_ask_days (an upload that
--     runs out: the days before it does that the ask for the next one goes; null means 30, src/lib/gc/promises.ts's
--     INSURANCE_ASK_DAYS).
--   * One packet per audience, seeded once by name: "Flow papers · trade partners" (the library's audience 'sub') and
--     "Flow papers · customers" (audience 'customer', the architect's papers with them). A flow paper files there.
--   * flow_paper_create(): the office team's write of a new flow paper (gc_office_team(), the office and estimators).
--     The library's own insert policy leaves out controllers and estimators, so a definer writes the row, picks the
--     packet, and refuses the signed out, a digital twin and training mode. A contract's clauses are cluster 9's
--     (edit_clause, 20261012150000), written after this returns the paper's id.
-- Additive and idempotent: a second run changes nothing.

ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS flow_kind text;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS name_es text;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS book_body_es text;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS renew_ask_days integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_template_documents_flow_kind_known') THEN
    ALTER TABLE public.contract_template_documents
      ADD CONSTRAINT contract_template_documents_flow_kind_known CHECK (flow_kind IS NULL OR flow_kind IN ('upload', 'contract', 'notice'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_template_documents_renew_ask_days_sane') THEN
    ALTER TABLE public.contract_template_documents
      ADD CONSTRAINT contract_template_documents_renew_ask_days_sane CHECK (renew_ask_days IS NULL OR renew_ask_days BETWEEN 1 AND 365);
  END IF;
END;
$$;

COMMENT ON COLUMN public.contract_template_documents.flow_kind IS
  'Messages cut 4: a paper the flow editor added (its id is the flow''s doc:<uuid> paper). upload: they give it to us; contract: we write it, they sign it; notice: we send it to inform. Null on every library document that is not a flow paper.';
COMMENT ON COLUMN public.contract_template_documents.name_es IS
  'Messages cut 4: a flow paper''s name in Spanish, for the trade partner''s and the customer''s pages. Null: the English name shows.';
COMMENT ON COLUMN public.contract_template_documents.book_body_es IS
  'Messages cut 4: a notice''s words in Spanish; its English is book_body_html. Null: the English shows on the Spanish page.';
COMMENT ON COLUMN public.contract_template_documents.renew_ask_days IS
  'Messages cut 4: for an upload that runs out, the days before it does that the ask for the next one goes. Null: 30, the renewal ask''s (INSURANCE_ASK_DAYS).';

-- The packets the flow papers file in, one per audience, seeded once by name.
INSERT INTO public.contract_templates (name, sequence_order)
SELECT p.name, coalesce((SELECT max(t.sequence_order) FROM public.contract_templates t), 0) + p.n
FROM (VALUES ('Flow papers · trade partners', 1), ('Flow papers · customers', 2)) AS p(name, n)
WHERE NOT EXISTS (SELECT 1 FROM public.contract_templates t WHERE t.name = p.name);

-- A new flow paper, the office's. Returns the library document's id, which is the paper (doc:<id>).
CREATE OR REPLACE FUNCTION public.flow_paper_create(
  p_flow text,
  p_kind text,
  p_name text,
  p_name_es text DEFAULT '',
  p_renew_ask_days integer DEFAULT NULL,
  p_body_en text DEFAULT '',
  p_body_es text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_name_es text := nullif(btrim(coalesce(p_name_es, '')), '');
  v_packet uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to add a paper.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office adds a paper.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot add a paper.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode cannot add a paper.' USING ERRCODE = '42501';
  END IF;
  IF p_flow IS NULL OR p_flow NOT IN ('trade', 'customer', 'arch') THEN
    RAISE EXCEPTION 'That is not one of the flows.' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('upload', 'contract', 'notice') THEN
    RAISE EXCEPTION 'That is not a kind of paper.' USING ERRCODE = 'P0001';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Give it a name.' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_name) > 120 OR length(coalesce(v_name_es, '')) > 120 THEN
    RAISE EXCEPTION 'A paper''s name holds at most 120 characters.' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind = 'notice' AND btrim(coalesce(p_body_en, '')) = '' THEN
    RAISE EXCEPTION 'Write the notice.' USING ERRCODE = 'P0001';
  END IF;
  IF p_renew_ask_days IS NOT NULL AND (p_kind <> 'upload' OR p_renew_ask_days NOT BETWEEN 1 AND 365) THEN
    RAISE EXCEPTION 'Only a paper they give us runs out, from 1 to 365 days ahead.' USING ERRCODE = 'P0001';
  END IF;
  SELECT t.id INTO v_packet FROM public.contract_templates t
  WHERE t.name = CASE WHEN p_flow = 'trade' THEN 'Flow papers · trade partners' ELSE 'Flow papers · customers' END
  ORDER BY t.created_at
  LIMIT 1;
  IF v_packet IS NULL THEN
    RAISE EXCEPTION 'The flow papers'' packet is missing.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.contract_template_documents (
    template_id, document_name, audience, sequence_order, tags, book_body_format, book_body_html, book_version_date,
    flow_kind, name_es, book_body_es, renew_ask_days
  )
  VALUES (
    v_packet,
    v_name,
    CASE WHEN p_flow = 'trade' THEN 'sub' ELSE 'customer' END,
    coalesce((SELECT max(d.sequence_order) + 1 FROM public.contract_template_documents d WHERE d.template_id = v_packet), 0),
    ARRAY['flow-paper'],
    'plain',
    CASE WHEN p_kind = 'notice' THEN btrim(p_body_en) END,
    public.app_today(),
    p_kind,
    v_name_es,
    CASE WHEN p_kind = 'notice' THEN nullif(btrim(coalesce(p_body_es, '')), '') END,
    p_renew_ask_days
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.flow_paper_create(text, text, text, text, integer, text, text) IS
  'Messages cut 4: a paper the flow editor adds, as a Contract library document in its audience''s Flow papers packet. The office team''s (gc_office_team()); refuses the signed out, a digital twin and training mode. Returns the document''s id, the flow''s doc:<id> paper. A contract''s clauses follow through edit_clause.';

REVOKE EXECUTE ON FUNCTION public.flow_paper_create(text, text, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flow_paper_create(text, text, text, text, integer, text, text) TO authenticated, service_role;

SET lock_timeout = '3s';

-- The narrative for the firm (v2.4812, the owner's ask of 2026-10-07): one markdown text on a legal
-- matter, the office's account of it, written on the Legal desk and read by the firm as the first tab
-- of its portal and the first section of the printed packet. Who saved it and when travel with it.
-- Additive, idempotent; no CREATE TABLE (legal_matters already carries the fences). The three ADD
-- COLUMNs with constant defaults are metadata-only but take an instant ACCESS EXCLUSIVE lock.

ALTER TABLE public.legal_matters
  ADD COLUMN IF NOT EXISTS narrative_md text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS narrative_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS narrative_updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.legal_matters.narrative_md IS
  'The office''s account of the matter for the firm, in markdown (v2.4812). The portal renders it sanitized: no raw HTML, absolute http(s) links only. Written through legal_set_narrative.';

-- The office writes it; the portal function reads it as the service role.
CREATE OR REPLACE FUNCTION public.legal_set_narrative(p_matter_id uuid, p_markdown text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_md text := btrim(COALESCE(p_markdown, ''));
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF length(v_md) > 40000 THEN RETURN jsonb_build_object('error', 'The narrative is longer than 40,000 characters'); END IF;
  UPDATE public.legal_matters
    SET narrative_md = v_md, narrative_updated_at = now(), narrative_updated_by = auth.uid(), updated_at = now()
  WHERE id = p_matter_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_set_narrative(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_set_narrative(uuid, text) TO authenticated;

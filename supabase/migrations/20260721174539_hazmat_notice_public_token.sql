-- Hazmat notice public link (v2.851): unguessable per-incident token + an
-- anon-callable read-only RPC so the Stripe invoice footer can link the
-- customer to the Biohazard Remediation Fee Notice (Stripe carries no
-- attachments). Idempotent; additive. Public payload strips testimonial
-- user_ids; access requires the exact uuid token (unique, indexed).

ALTER TABLE public.job_hazmat_incidents
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS job_hazmat_incidents_public_token_idx
  ON public.job_hazmat_incidents (public_token);

CREATE OR REPLACE FUNCTION public.get_hazmat_notice_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'incident_at', i.incident_at,
    'description', i.description,
    'exposed_people', i.exposed_people,
    'stage_label', i.stage_label,
    'photo_links', i.photo_links,
    'testimonials', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
          'name', t->>'name',
          'statement', t->>'statement',
          'given_at', t->>'given_at'
        )),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(i.testimonials) AS t
    ),
    'tos_clause_snapshot', i.tos_clause_snapshot,
    'fee_amount', i.fee_amount,
    'job_number', COALESCE(NULLIF(btrim(j.hcp_number), ''), NULLIF(btrim(j.click_number), ''), '—'),
    'job_name', COALESCE(NULLIF(btrim(j.job_name), ''), 'Job'),
    'job_address', COALESCE(NULLIF(btrim(j.job_address), ''), '—'),
    'customer_name', COALESCE(NULLIF(btrim(j.customer_name), ''), '—')
  )
  FROM public.job_hazmat_incidents i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE i.public_token = p_token
$$;

REVOKE ALL ON FUNCTION public.get_hazmat_notice_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hazmat_notice_by_token(uuid) TO anon, authenticated;

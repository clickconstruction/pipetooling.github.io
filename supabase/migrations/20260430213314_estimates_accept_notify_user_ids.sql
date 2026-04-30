-- Staff email recipients when customer accepts estimate (Edge accept-estimate); draft-editable only via RLS.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS accept_notify_user_ids uuid[] NULL;

COMMENT ON COLUMN public.estimates.accept_notify_user_ids IS
  'Users to email when status becomes customer_accepted; NULL = not yet set (UI defaults to creator until saved); [] = explicitly no recipients; editable on draft only.';

CREATE OR REPLACE FUNCTION public.estimate_accept_notify_filter_eligible_user_ids(
  p_master_user_id uuid,
  p_candidate_ids uuid[]
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT array_agg(s.uid ORDER BY s.uid)
      FROM (
        SELECT DISTINCT c.sub AS uid
        FROM unnest(COALESCE(p_candidate_ids, ARRAY[]::uuid[])) AS c(sub)
        JOIN public.users u ON u.id = c.sub
        WHERE u.archived_at IS NULL
          AND u.email IS NOT NULL
          AND length(trim(u.email)) > 0
          AND (
            u.id = p_master_user_id
            OR EXISTS (
              SELECT 1 FROM public.master_assistants ma
              WHERE ma.master_id = p_master_user_id AND ma.assistant_id = u.id
            )
            OR EXISTS (
              SELECT 1 FROM public.master_assistants ma
              WHERE ma.master_id = u.id AND ma.assistant_id = p_master_user_id
            )
            OR public.assistants_share_master(u.id, p_master_user_id)
            OR u.role = 'dev'::public.user_role
            OR u.role = 'primary'::public.user_role
          )
      ) AS s
    ),
    ARRAY[]::uuid[]
  );
$$;

COMMENT ON FUNCTION public.estimate_accept_notify_filter_eligible_user_ids(uuid, uuid[]) IS
  'Service role / Edge: intersect candidate user ids with org scope of estimate master_user_id; requires non-null non-empty email.';

GRANT EXECUTE ON FUNCTION public.estimate_accept_notify_filter_eligible_user_ids(uuid, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.estimates_protect_after_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'customer_accepted' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.master_user_id IS DISTINCT FROM OLD.master_user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.line_items_snapshot IS DISTINCT FROM OLD.line_items_snapshot
      OR NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot
      OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
      OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
      OR NEW.public_token_hash IS DISTINCT FROM OLD.public_token_hash
      OR NEW.public_token_expires_at IS DISTINCT FROM OLD.public_token_expires_at
      OR NEW.acceptor_printed_name IS DISTINCT FROM OLD.acceptor_printed_name
      OR NEW.acceptor_signature_storage_path IS DISTINCT FROM OLD.acceptor_signature_storage_path
      OR NEW.acceptor_consented_at IS DISTINCT FROM OLD.acceptor_consented_at
      OR NEW.acceptor_ip IS DISTINCT FROM OLD.acceptor_ip
      OR NEW.acceptor_user_agent IS DISTINCT FROM OLD.acceptor_user_agent
      OR NEW.estimate_number IS DISTINCT FROM OLD.estimate_number
      OR NEW.customer_experience_overrides IS DISTINCT FROM OLD.customer_experience_overrides
      OR NEW.customer_experience_sent IS DISTINCT FROM OLD.customer_experience_sent
      OR NEW.customer_attachment_url IS DISTINCT FROM OLD.customer_attachment_url
      OR NEW.customer_attachment_label IS DISTINCT FROM OLD.customer_attachment_label
      OR NEW.customer_attachment_sent IS DISTINCT FROM OLD.customer_attachment_sent
      OR NEW.accept_notify_user_ids IS DISTINCT FROM OLD.accept_notify_user_ids
    THEN
      RAISE EXCEPTION 'estimate is accepted; only job_ledger_id and internal_notes can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

SET lock_timeout = '3s';

-- Punch list #85, item 18, PR 2 (v2.4648): acts a firm can trust — undo with a reason, and one save per act.
--
-- The matter's stream stays append-only: nothing is deleted. An entry is VOIDED — stamped with when, by whom
-- (an office user, or the firm through its portal) and why — and every total leaves it out. Each side voids its
-- own: the office through legal_void_entry (fees, costs, notes it wrote), the firm through submit-legal-portal
-- kind 'void' (its fees, costs and a payment the office has not applied yet), which writes under the service role.
--
-- The one-time key (meta.clientId, v2.4640) gets its unique index, so two requests in the same instant cannot
-- both land; the function reads the conflict as a duplicate.

ALTER TABLE public.legal_matter_entries ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.legal_matter_entries ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.legal_matter_entries ADD COLUMN IF NOT EXISTS voided_via_portal boolean NOT NULL DEFAULT false;
ALTER TABLE public.legal_matter_entries ADD COLUMN IF NOT EXISTS void_reason text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.legal_matter_entries.voided_at IS 'Undone (#85 item 18, v2.4648): the entry stays in the stream, struck through, out of every total. voided_by = the office user, or NULL with voided_via_portal = true when the firm undid its own act; void_reason is required and both sides read it.';

CREATE UNIQUE INDEX IF NOT EXISTS legal_matter_entries_client_id_idx
  ON public.legal_matter_entries (matter_id, (meta->>'clientId'))
  WHERE meta ? 'clientId';

-- Office: undo an entry the office wrote (a fee, cost or note), with a reason the firm reads.
CREATE OR REPLACE FUNCTION public.legal_void_entry(p_entry_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_reason text := COALESCE(NULLIF(TRIM(p_reason), ''), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF v_reason = '' THEN RETURN jsonb_build_object('error', 'Say why: the firm reads the reason'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Entry not found'); END IF;
  IF v_entry.via_portal THEN RETURN jsonb_build_object('error', 'The firm undoes its own entries; ask them in the conversation'); END IF;
  IF v_entry.kind NOT IN ('fee', 'cost', 'note') THEN RETURN jsonb_build_object('error', 'Only a fee, a cost or a note can be undone here. Reverse an applied payment on the job.'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'Already undone'); END IF;
  UPDATE public.legal_matter_entries
    SET voided_at = now(), voided_by = auth.uid(), voided_via_portal = false, void_reason = v_reason
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) TO authenticated;

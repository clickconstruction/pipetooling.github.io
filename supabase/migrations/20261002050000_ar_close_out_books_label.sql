SET lock_timeout = '3s';

-- v2.4363 — Close out books it: a deposit closed out in Accounts Receivable leaves
-- with its Banking label settled in the same press.
--
-- Read Oct 1: of 135 deposits through Accounts Receivable since Apr 1, one was a vendor
-- refund (Texas Mutual, $119.56). Its books were right before anyone closed it — the
-- Banking rule "TEXAS MUTUAL - Insurance" labelled it Insurance on Aug 16 — but the
-- close-out strip could not say so, could not approve a rule match that was still
-- waiting (the org's auto-approve switch is off), and a primary user cannot label at all.
--
--   1. mercury_transaction_ar_close_labels — provenance sidecar: the label a close-out
--      put on a deposit, the label it replaced, and whether it was the rule's own match
--      ('rule') or a label the person chose ('close_out'). Written only by the functions
--      below.
--   2. ar_deposit_booking(tx) — how Banking books the deposit, for the strip: its label
--      and who set it (a rule, a person, Accounts Receivable), a rule match still
--      waiting, the label the payee's own payments carry, the payee's last close-out,
--      and the label list for the picker. SECURITY DEFINER: the AR roles read it,
--      primary included, who cannot read Banking's tables.
--   3. close_out_ar_deposit(tx, reason, note, label) — closes the deposit out through
--      set_mercury_transaction_ar_closed, then books the label: keeps it when it is
--      already the one, approves a waiting rule match when the label is the rule's, or
--      writes the chosen label. One transaction: a refusal rolls the close-out back too.
--   4. set_mercury_transaction_ar_closed — Reopen now also takes off a label the
--      close-out chose (back to the label it replaced, or none). A rule's label and a
--      person's later change stay. Same signature, so old clients get it too.
--
-- The AR roles, as everywhere in Accounts Receivable: office staff and primary.
-- Additive: nothing calls the new functions until the client ships.

-- 1) The sidecar.
CREATE TABLE IF NOT EXISTS public.mercury_transaction_ar_close_labels (
  mercury_transaction_id uuid PRIMARY KEY REFERENCES public.mercury_transactions(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.mercury_drag_sort_labels(id) ON DELETE CASCADE,
  previous_label_id uuid REFERENCES public.mercury_drag_sort_labels(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('close_out', 'rule')),
  suggestion_id uuid REFERENCES public.mercury_accounting_label_suggestions(id) ON DELETE SET NULL,
  labelled_at timestamptz NOT NULL DEFAULT now(),
  labelled_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.mercury_transaction_ar_close_labels IS
  'v2.4363: one row per deposit whose Banking label was set when it was closed out in Accounts Receivable. source ''rule'' = the close-out approved the rule''s own waiting match (Reopen leaves it); ''close_out'' = the label the person chose (Reopen restores previous_label_id, or removes the label, while it still reads label_id). Written only by close_out_ar_deposit and the Reopen branch of set_mercury_transaction_ar_closed.';

ALTER TABLE public.mercury_transaction_ar_close_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mercury_transaction_ar_close_labels_select_ar_roles" ON public.mercury_transaction_ar_close_labels;
CREATE POLICY "mercury_transaction_ar_close_labels_select_ar_roles"
  ON public.mercury_transaction_ar_close_labels
  FOR SELECT
  TO authenticated
  USING (
    public.is_office_staff()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role)
  );

-- 2) The read.
CREATE OR REPLACE FUNCTION public.ar_deposit_booking(p_mercury_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.mercury_transactions%ROWTYPE;
  v_cp text;
  v_label_id uuid;
  v_label jsonb;
  v_label_at timestamptz;
  v_label_by text;
  v_rule_name text;
  v_pending jsonb;
  v_usual jsonb;
  v_last jsonb;
  v_labels jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ar_deposit_booking: not authenticated';
  END IF;
  IF NOT (
    public.is_office_staff()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'ar_deposit_booking: not authorized';
  END IF;

  SELECT * INTO v_tx FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_cp := lower(btrim(coalesce(v_tx.counterparty_name, '')));

  -- The label it carries now, and who put it there.
  SELECT d.label_id, d.assigned_at,
         jsonb_build_object('id', l.id, 'name', l.name, 'default_key', l.default_key, 'account_type', l.account_type)
    INTO v_label_id, v_label_at, v_label
  FROM public.mercury_transaction_drag_sort_assignments d
  JOIN public.mercury_drag_sort_labels l ON l.id = d.label_id
  WHERE d.mercury_transaction_id = p_mercury_transaction_id;

  IF v_label_id IS NOT NULL THEN
    SELECT r.name INTO v_rule_name
    FROM public.mercury_accounting_label_suggestions s
    JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id
    WHERE s.mercury_transaction_id = p_mercury_transaction_id
      AND s.status = 'approved'
      AND s.final_label_id = v_label_id
      AND s.final_label_id = s.suggested_label_id
    ORDER BY s.resolved_at DESC NULLS LAST
    LIMIT 1;

    IF EXISTS (
      SELECT 1 FROM public.mercury_transaction_ar_close_labels c
      WHERE c.mercury_transaction_id = p_mercury_transaction_id AND c.label_id = v_label_id AND c.source = 'close_out'
    ) THEN
      v_label_by := 'close_out';
    ELSIF v_rule_name IS NOT NULL THEN
      v_label_by := 'rule';
    ELSIF EXISTS (
      SELECT 1 FROM public.mercury_transaction_ar_income_labels i WHERE i.mercury_transaction_id = p_mercury_transaction_id
    ) THEN
      v_label_by := 'ar_income';
    ELSE
      v_label_by := 'person';
    END IF;
  END IF;

  -- A rule match still waiting for someone to approve it.
  SELECT jsonb_build_object(
           'suggestion_id', s.id,
           'rule_name', r.name,
           'label', jsonb_build_object('id', l.id, 'name', l.name, 'default_key', l.default_key, 'account_type', l.account_type)
         )
    INTO v_pending
  FROM public.mercury_accounting_label_suggestions s
  JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id AND r.enabled
  JOIN public.mercury_drag_sort_labels l ON l.id = s.suggested_label_id
  WHERE s.mercury_transaction_id = p_mercury_transaction_id
    AND s.status = 'pending'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_cp <> '' THEN
    -- How this payee's money going out is booked: the label most of its payments carry.
    SELECT jsonb_build_object(
             'label', jsonb_build_object('id', l.id, 'name', l.name, 'default_key', l.default_key, 'account_type', l.account_type),
             'count', u.n
           )
      INTO v_usual
    FROM (
      SELECT d.label_id, count(*) AS n, max(o.posted_at) AS last_at
      FROM public.mercury_transactions o
      JOIN public.mercury_transaction_drag_sort_assignments d ON d.mercury_transaction_id = o.id
      WHERE o.amount < 0
        AND o.id <> p_mercury_transaction_id
        AND o.status IS DISTINCT FROM 'failed'
        AND o.duplicate_of_transaction_id IS NULL
        AND lower(btrim(coalesce(o.counterparty_name, ''))) = v_cp
      GROUP BY d.label_id
      ORDER BY count(*) DESC, max(o.posted_at) DESC NULLS LAST
      LIMIT 1
    ) u
    JOIN public.mercury_drag_sort_labels l ON l.id = u.label_id;

    -- The payee's last deposit that was closed out: the one guess the strip may make.
    SELECT jsonb_build_object('reason', c.reason, 'closed_at', c.closed_at, 'posted_at', o.posted_at, 'amount', o.amount)
      INTO v_last
    FROM public.mercury_transaction_ar_closed c
    JOIN public.mercury_transactions o ON o.id = c.mercury_transaction_id
    WHERE o.id <> p_mercury_transaction_id
      AND lower(btrim(coalesce(o.counterparty_name, ''))) = v_cp
    ORDER BY c.closed_at DESC
    LIMIT 1;
  END IF;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object('id', l.id, 'name', l.name, 'default_key', l.default_key, 'account_type', l.account_type)
           ORDER BY l.sort_order, l.name
         ), '[]'::jsonb)
    INTO v_labels
  FROM public.mercury_drag_sort_labels l;

  RETURN jsonb_build_object(
    'label', v_label,
    'label_by', v_label_by,
    'label_at', v_label_at,
    'rule_name', v_rule_name,
    'pending', v_pending,
    'usual', v_usual,
    'last_close_out', v_last,
    'labels', v_labels
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ar_deposit_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ar_deposit_booking(uuid) TO authenticated;

COMMENT ON FUNCTION public.ar_deposit_booking(uuid) IS
  'Close out books it (v2.4363): how Banking books one deposit — label + label_by (rule | person | close_out | ar_income) + label_at + rule_name, a waiting rule match (pending), the label the payee''s own payments carry (usual), the payee''s last close-out (last_close_out), and the label list (labels). AR roles.';

-- 3) Undo a label a close-out put on. Internal; Reopen calls it.
CREATE OR REPLACE FUNCTION public._ar_close_label_undo(p_mercury_transaction_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.mercury_transaction_ar_close_labels%ROWTYPE;
  v_current uuid;
  v_result text;
BEGIN
  SELECT * INTO v_row
  FROM public.mercury_transaction_ar_close_labels c
  WHERE c.mercury_transaction_id = p_mercury_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- The rule's own match: the rule's label, not the close-out's. It stays.
  IF v_row.source <> 'close_out' THEN
    DELETE FROM public.mercury_transaction_ar_close_labels WHERE mercury_transaction_id = p_mercury_transaction_id;
    RETURN 'left';
  END IF;

  SELECT d.label_id INTO v_current
  FROM public.mercury_transaction_drag_sort_assignments d
  WHERE d.mercury_transaction_id = p_mercury_transaction_id
  FOR UPDATE;

  -- Someone changed it since: theirs now.
  IF v_current IS DISTINCT FROM v_row.label_id THEN
    DELETE FROM public.mercury_transaction_ar_close_labels WHERE mercury_transaction_id = p_mercury_transaction_id;
    RETURN 'left';
  END IF;

  IF v_row.previous_label_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.mercury_drag_sort_labels l WHERE l.id = v_row.previous_label_id) THEN
    UPDATE public.mercury_transaction_drag_sort_assignments
    SET label_id = v_row.previous_label_id, assigned_at = now()
    WHERE mercury_transaction_id = p_mercury_transaction_id;
    v_result := 'restored';
  ELSE
    DELETE FROM public.mercury_transaction_drag_sort_assignments WHERE mercury_transaction_id = p_mercury_transaction_id;
    v_result := 'removed';
  END IF;

  -- A rule match the close-out answered with another label waits again.
  IF v_row.suggestion_id IS NOT NULL THEN
    UPDATE public.mercury_accounting_label_suggestions s
    SET status = 'pending', final_label_id = NULL, resolved_at = NULL, resolved_by = NULL
    WHERE s.id = v_row.suggestion_id
      AND s.status = 'approved'
      AND s.final_label_id = v_row.label_id
      AND NOT EXISTS (
        SELECT 1 FROM public.mercury_transaction_drag_sort_assignments d
        WHERE d.mercury_transaction_id = p_mercury_transaction_id
      );
  END IF;

  DELETE FROM public.mercury_transaction_ar_close_labels WHERE mercury_transaction_id = p_mercury_transaction_id;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public._ar_close_label_undo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ar_close_label_undo(uuid) TO service_role;

COMMENT ON FUNCTION public._ar_close_label_undo(uuid) IS
  'Internal (v2.4363): take off a Banking label a close-out chose — back to the label it replaced, or none — while the deposit still reads it; a rule''s own match and a later change by anyone stay. Returns restored | removed | left | null. Called by the Reopen branch of set_mercury_transaction_ar_closed.';

-- 4) Reopen undoes the close-out's label. Same signature and checks as v2.3529.
CREATE OR REPLACE FUNCTION public.set_mercury_transaction_ar_closed(p_mercury_transaction_id uuid, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 240), '');
  v_tx public.mercury_transactions%ROWTYPE;
  v_applied numeric;
  v_now timestamptz := now();
  v_undo text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: not authenticated';
  END IF;

  IF NOT (
    public.is_office_staff()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: not authorized';
  END IF;

  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: mercury transaction required';
  END IF;

  -- Reopen. v2.4363: a label the close-out chose comes off with it.
  IF v_reason IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.mercury_transaction_ar_closed c WHERE c.mercury_transaction_id = p_mercury_transaction_id) THEN
      v_undo := public._ar_close_label_undo(p_mercury_transaction_id);
    END IF;
    DELETE FROM public.mercury_transaction_ar_closed WHERE mercury_transaction_id = p_mercury_transaction_id;
    RETURN jsonb_build_object('ok', true, 'closed', false, 'label_undone', v_undo);
  END IF;

  IF v_reason NOT IN ('bank_interest', 'vendor_refund', 'owner_deposit', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick a reason from the list.');
  END IF;
  IF v_reason = 'other' AND v_note IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Say what it is — a note is required for Something else.');
  END IF;

  SELECT * INTO v_tx FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bank transaction no longer exists.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mercury_transaction_ar_returned r
    WHERE r.mercury_transaction_id = p_mercury_transaction_id AND r.returned
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This deposit is marked returned. Unmark it first if it did not bounce.');
  END IF;

  SELECT coalesce(sum(p.amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments p
  WHERE p.mercury_transaction_id = p_mercury_transaction_id;
  IF v_applied > 0.0005 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Money from this deposit is already applied to a job, so it is a customer''s payment. Remove that payment first, or record the leftover as a tip.');
  END IF;

  INSERT INTO public.mercury_transaction_ar_closed (mercury_transaction_id, reason, note, closed_at, closed_by)
  VALUES (p_mercury_transaction_id, v_reason, v_note, v_now, auth.uid())
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    reason = excluded.reason,
    note = excluded.note,
    closed_at = excluded.closed_at,
    closed_by = excluded.closed_by;

  RETURN jsonb_build_object('ok', true, 'closed', true, 'reason', v_reason, 'note', v_note, 'closed_at', v_now, 'closed_by', auth.uid());
END;
$function$;

-- 5) Close out and book the label, in one press.
CREATE OR REPLACE FUNCTION public.close_out_ar_deposit(
  p_mercury_transaction_id uuid,
  p_reason text,
  p_note text DEFAULT NULL,
  p_label_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_res jsonb;
  v_label_name text;
  v_current uuid;
  v_sugg uuid;
  v_sugg_label uuid;
  v_booked text;
BEGIN
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick a reason from the list.');
  END IF;

  -- The close-out itself: every check (role, reason, returned, already applied) lives there.
  v_res := public.set_mercury_transaction_ar_closed(p_mercury_transaction_id, p_reason, p_note);
  IF coalesce((v_res->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_res;
  END IF;

  IF p_label_id IS NULL THEN
    RETURN v_res || jsonb_build_object('booked', NULL);
  END IF;

  SELECT l.name INTO v_label_name FROM public.mercury_drag_sort_labels l WHERE l.id = p_label_id;
  IF v_label_name IS NULL THEN
    -- Raise, not return: the close-out above rolls back with it.
    RAISE EXCEPTION 'That Banking label no longer exists. Pick another one.';
  END IF;

  SELECT d.label_id INTO v_current
  FROM public.mercury_transaction_drag_sort_assignments d
  WHERE d.mercury_transaction_id = p_mercury_transaction_id
  FOR UPDATE;

  IF v_current = p_label_id THEN
    RETURN v_res || jsonb_build_object('booked', 'kept', 'label_name', v_label_name);
  END IF;

  SELECT s.id, s.suggested_label_id INTO v_sugg, v_sugg_label
  FROM public.mercury_accounting_label_suggestions s
  JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id AND r.enabled
  WHERE s.mercury_transaction_id = p_mercury_transaction_id
    AND s.status = 'pending'
  ORDER BY s.created_at DESC
  LIMIT 1;

  v_booked := CASE WHEN v_current IS NULL AND v_sugg IS NOT NULL AND v_sugg_label = p_label_id THEN 'approved' ELSE 'set' END;

  INSERT INTO public.mercury_transaction_drag_sort_assignments (mercury_transaction_id, label_id)
  VALUES (p_mercury_transaction_id, p_label_id)
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    label_id = EXCLUDED.label_id,
    assigned_at = now();

  IF v_sugg IS NOT NULL THEN
    -- The rule's own label: the rule's person attribution comes with it, as Approve does.
    IF v_booked = 'approved' THEN
      INSERT INTO public.mercury_transaction_attributions (mercury_transaction_id, person_id, user_id)
      SELECT p_mercury_transaction_id, r.attributed_person_id, r.attributed_user_id
      FROM public.mercury_accounting_label_suggestions s
      JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id
      WHERE s.id = v_sugg
        AND (r.attributed_person_id IS NOT NULL OR r.attributed_user_id IS NOT NULL)
      ON CONFLICT (mercury_transaction_id) DO NOTHING;
    END IF;
    UPDATE public.mercury_accounting_label_suggestions s
    SET status = 'approved', final_label_id = p_label_id, resolved_at = now(), resolved_by = auth.uid()
    WHERE s.id = v_sugg AND s.status = 'pending';
  END IF;

  INSERT INTO public.mercury_transaction_ar_close_labels (
    mercury_transaction_id, label_id, previous_label_id, source, suggestion_id, labelled_at, labelled_by
  )
  VALUES (
    p_mercury_transaction_id, p_label_id, v_current,
    CASE WHEN v_booked = 'approved' THEN 'rule' ELSE 'close_out' END,
    v_sugg, now(), auth.uid()
  )
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    label_id = EXCLUDED.label_id,
    previous_label_id = EXCLUDED.previous_label_id,
    source = EXCLUDED.source,
    suggestion_id = EXCLUDED.suggestion_id,
    labelled_at = EXCLUDED.labelled_at,
    labelled_by = EXCLUDED.labelled_by;

  RETURN v_res || jsonb_build_object('booked', v_booked, 'label_name', v_label_name);
END;
$function$;

REVOKE ALL ON FUNCTION public.close_out_ar_deposit(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_out_ar_deposit(uuid, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.close_out_ar_deposit(uuid, text, text, uuid) IS
  'Close out books it (v2.4363): close a deposit out of Accounts Receivable (set_mercury_transaction_ar_closed, every check there) and book its Banking label in the same transaction — booked kept (already the label), approved (the waiting rule match, as Approve does) or set (the chosen label; the sidecar keeps the one it replaced for Reopen). AR roles.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();

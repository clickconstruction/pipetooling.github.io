SET lock_timeout = '3s';

-- Messages, cut 4b: a change order started from a customer's message (to-dos/gc-mode/messages/BUILD_PLAN.md on branch
-- spike/gc-mode, "A change order from a message"; decision 11 taken as the split: anyone in the office drafts it, and
-- the money team sends it). The kernel is src/lib/changeOrders/fromMessage.ts.
--
--   * gc_change_orders gains who signs it (signer_contact_id) and the message it came from (source_message_id), one
--     change order a message.
--   * gc_change_orders_office, the office's non-money view, gains the two, so the office draws the message's chip
--     ("became CO 2") and the order's line back to the message. Still never cost, price or pct_done.
--   * gc_draft_change_order_from_message is the office's draft: a definer behind its own checks, since the table stays
--     the money team's. Widening its insert policy alone could not work: gc_draft_change_order numbers the next order
--     from the rows its caller sees and returns the new row, and the office sees none. The definer numbers under the
--     job's lock and hands back the id and the number, never a money column. Cost and price may stay 0: the money team
--     prices the draft, and gc_send_change_order refuses one with no price and no days.
--   * gc_change_order_sends keeps each send of a change order to sign, in gc_owner_contract_sends' shape with the change
--     order in place of the price by line; it is the money team's. gc_send_change_order_to_sign writes one, and sends
--     the draft the first time. The file goes in a private bucket, gc-change-orders, under the project's id.
--   * contacts_fold_change_orders: the spine's contacts_fold runs it, so who signs follows a contact that is folded.

-- ---------- 1. Who signs, and the message it came from ----------

ALTER TABLE public.gc_change_orders
  ADD COLUMN IF NOT EXISTS signer_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- A message starts one change order at most: its chip says which.
CREATE UNIQUE INDEX IF NOT EXISTS gc_change_orders_one_per_message
  ON public.gc_change_orders (source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gc_change_orders_signer_idx
  ON public.gc_change_orders (signer_contact_id) WHERE signer_contact_id IS NOT NULL;

COMMENT ON COLUMN public.gc_change_orders.signer_contact_id IS
  'Messages (cut 4b): the customer contact who signs it, when it started from their message. Our record of who; what went to the customer stays as gc_change_orders_keep_what_went keeps it.';
COMMENT ON COLUMN public.gc_change_orders.source_message_id IS
  'Messages (cut 4b): the customer''s message it started from (gc_draft_change_order_from_message), one change order a message. The message''s chip reads "became CO <number>" from it.';

-- ---------- 2. The office's view gains the two ----------

CREATE OR REPLACE VIEW public.gc_change_orders_office WITH (security_barrier = true) AS
  SELECT c.id, c.project_id, c.number, c.description, c.reason, c.schedule_words, c.package_id,
         c.status, c.sent_on, c.answered_on, c.days, c.days_on_chart, c.signer_contact_id, c.source_message_id
  FROM public.gc_change_orders c
  WHERE (SELECT public.gc_office_team());

-- Read only, as before: every grant goes, and SELECT alone comes back.
REVOKE ALL ON public.gc_change_orders_office FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gc_change_orders_office TO authenticated;

COMMENT ON VIEW public.gc_change_orders_office IS
  'GC mode (v2.5156, the schedule''s PR 16b; Owner Billing''s door, call C; Messages cut 4b): a change order''s non-money half, for the office team (gc_office_team()): its number, words, reason, trade, status, sent and answered days, days and days on the chart, who signs it and the message it came from. Never cost, price or pct_done. Its description and schedule_words are the money team''s words, shown as they typed them. Owner''s rights with a security barrier; read only for authenticated, nothing for anon.';

-- ---------- 3. The office's draft from a message ----------

CREATE OR REPLACE FUNCTION public.gc_draft_change_order_from_message(p_message_id uuid, p_draft jsonb)
RETURNS TABLE (change_order_id uuid, change_order_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg record;
  v_job record;
  v_description text := btrim(coalesce(p_draft ->> 'description', ''));
  v_reason text := coalesce(nullif(btrim(coalesce(p_draft ->> 'reason', '')), ''), 'owner');
  v_package uuid;
  v_cost numeric;
  v_price numeric;
  v_days integer;
  v_schedule text;
  v_had integer;
  v_number integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to draft a change order.' USING ERRCODE = 'P0001';
  END IF;
  -- A definer passes the table's read-only blocks and the twin fence, so each is said here.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot draft a change order.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot draft a change order.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office drafts a change order from a message.' USING ERRCODE = '42501';
  END IF;

  SELECT m.project_id, c.id AS contact_id, c.kind INTO v_msg
  FROM public.messages m
  JOIN public.contacts c ON c.id = m.contact_id
  WHERE m.id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That message is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_msg.kind <> 'customer' THEN
    RAISE EXCEPTION 'A change order goes to a customer. This message is with %.',
      CASE v_msg.kind WHEN 'trade' THEN 'a trade partner' WHEN 'arch' THEN 'an architect' ELSE 'a number nobody has named yet' END
      USING ERRCODE = 'P0001';
  END IF;
  IF v_msg.project_id IS NULL THEN
    RAISE EXCEPTION 'Tie the message to a job first. A change order belongs to one job.' USING ERRCODE = 'P0001';
  END IF;

  SELECT g.stage, g.lost_on, p.name INTO v_job
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  WHERE g.project_id = v_msg.project_id
  FOR UPDATE OF g;
  IF v_job.lost_on IS NOT NULL THEN
    RAISE EXCEPTION 'A change order needs a job we won. % was lost.', v_job.name USING ERRCODE = 'P0001';
  END IF;
  IF v_job.stage = 'bidding' THEN
    RAISE EXCEPTION 'A change order needs a job we won. % is still bidding.', v_job.name USING ERRCODE = 'P0001';
  END IF;

  SELECT o.number INTO v_had FROM public.gc_change_orders o WHERE o.source_message_id = p_message_id;
  IF FOUND THEN
    RAISE EXCEPTION 'This message became change order % already.', v_had USING ERRCODE = 'P0001';
  END IF;

  IF v_description = '' THEN
    RAISE EXCEPTION 'Say what is changing.' USING ERRCODE = 'P0001';
  END IF;
  IF v_reason NOT IN ('owner', 'field', 'plans') THEN
    RAISE EXCEPTION 'Pick why it changed: the customer asked, a field condition, or a plan revision.' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    v_cost := coalesce(round((p_draft ->> 'cost')::numeric), 0);
    v_price := coalesce(round((p_draft ->> 'price')::numeric), 0);
    v_days := coalesce(round((p_draft ->> 'days')::numeric)::integer, 0);
    v_package := nullif(p_draft ->> 'packageId', '')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'The cost, the price and the days must be numbers.' USING ERRCODE = 'P0001';
  END;
  IF v_days < 0 THEN
    RAISE EXCEPTION 'The days it adds cannot be below zero.' USING ERRCODE = 'P0001';
  END IF;
  IF v_package IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages t WHERE t.id = v_package AND t.project_id = v_msg.project_id) THEN
    RAISE EXCEPTION 'That trade is not on this project.' USING ERRCODE = 'P0001';
  END IF;
  v_schedule := btrim(coalesce(p_draft ->> 'schedule', ''));
  IF v_schedule = '' THEN
    v_schedule := CASE WHEN v_days > 0 THEN '+' || v_days || CASE WHEN v_days = 1 THEN ' day' ELSE ' days' END ELSE 'none' END;
  END IF;

  SELECT coalesce(max(o.number), 0) + 1 INTO v_number FROM public.gc_change_orders o WHERE o.project_id = v_msg.project_id;
  INSERT INTO public.gc_change_orders (
    project_id, number, description, reason, schedule_words, package_id, cost, price, days, created_by, signer_contact_id, source_message_id)
  VALUES (
    v_msg.project_id, v_number, v_description, v_reason, v_schedule, v_package, v_cost, v_price, v_days, auth.uid(), v_msg.contact_id, p_message_id)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, v_number;
END;
$$;

COMMENT ON FUNCTION public.gc_draft_change_order_from_message(uuid, jsonb) IS
  'Messages (cut 4b): the office''s draft of a change order from a customer''s message: on the job the message is tied to, a job we won, signed by the message''s contact, the message kept as its source. A definer, since the table is the money team''s: it numbers the order under the job''s lock and returns its id and number, never a money column. Cost and price may be 0, for the money team to price before it goes. Refuses, in words, a training account, a digital twin, anyone outside the office, a message that is not a customer''s or has no job, a job still bidding or lost, a message that became a change order already, and the words gc_draft_change_order refuses.';

REVOKE ALL ON FUNCTION public.gc_draft_change_order_from_message(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_draft_change_order_from_message(uuid, jsonb) TO authenticated;

-- ---------- 4. Each send to sign ----------

CREATE TABLE IF NOT EXISTS public.gc_change_order_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id uuid NOT NULL REFERENCES public.gc_change_orders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- The project's customer when it went.
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  -- The first send; later ones are reminders.
  first boolean NOT NULL DEFAULT false,
  sent_on date NOT NULL DEFAULT public.app_today(),
  sign_by date NOT NULL,
  note text NOT NULL DEFAULT '',
  -- The file the money team attached, in the gc-change-orders bucket, and a SHA-256 of its bytes.
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_sha256 text NOT NULL,
  sent_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- Once the customer signs it in their portal (the service role only, with the portal's signing).
  signed_on date,
  signer_printed_name text,
  signer_signature_storage_path text,
  signer_consented_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  -- clock_timestamp, so two sends in one transaction still have an order.
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT gc_change_order_sends_sign_by_ahead CHECK (sign_by >= sent_on),
  CONSTRAINT gc_change_order_sends_note_short CHECK (char_length(note) <= 500),
  CONSTRAINT gc_change_order_sends_file_named CHECK (btrim(file_path) <> '' AND btrim(file_name) <> ''),
  CONSTRAINT gc_change_order_sends_file_hashed CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT gc_change_order_sends_signed_whole CHECK (
    (signed_on IS NULL) = (signer_printed_name IS NULL) AND (signed_on IS NULL) = (signer_consented_at IS NULL))
);

CREATE INDEX IF NOT EXISTS gc_change_order_sends_order_idx ON public.gc_change_order_sends (change_order_id, created_at);

COMMENT ON TABLE public.gc_change_order_sends IS
  'Messages (cut 4b): each send of a change order to sign, in gc_owner_contract_sends'' shape with the change order in place of the price by line: when it went and who sent it, the day to sign by, the line, the file, and once signed, the day, the printed name, the signature''s file and the consent. The money team''s: signed in, read and insert the send''s own columns; no update or delete; the signer''s fields are the service role''s.';

ALTER TABLE public.gc_change_order_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_change_order_sends_money ON public.gc_change_order_sends;
CREATE POLICY gc_change_order_sends_money ON public.gc_change_order_sends FOR ALL TO authenticated
  USING ((SELECT public.gc_money_team())) WITH CHECK ((SELECT public.gc_money_team()));

REVOKE ALL ON public.gc_change_order_sends FROM anon, authenticated;
GRANT SELECT ON public.gc_change_order_sends TO authenticated;
GRANT INSERT (change_order_id, project_id, customer_id, first, sign_by, note, file_path, file_name, file_sha256)
  ON public.gc_change_order_sends TO authenticated;

-- The files: a private bucket, each under its project's id, read and added by the money team. No update or delete
-- policy, so a file a signature binds to is never replaced; the table's fences do not reach storage, so they are said
-- here. The portal reads them through the service role.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gc-change-orders', 'gc-change-orders', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS gc_change_orders_files_select ON storage.objects;
CREATE POLICY gc_change_orders_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'gc-change-orders' AND public.gc_money_team());

DROP POLICY IF EXISTS gc_change_orders_files_insert ON storage.objects;
CREATE POLICY gc_change_orders_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gc-change-orders'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.gc_money_team()
    AND NOT public.is_read_only()
    AND NOT public.is_digital_twin()
  );

-- ---------- 5. The money team's send ----------

CREATE OR REPLACE FUNCTION public.gc_send_change_order_to_sign(
  p_id uuid, p_sign_by date, p_note text, p_file_path text, p_file_name text, p_file_sha256 text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v record;
  v_note text := btrim(coalesce(p_note, ''));
  v_path text := btrim(coalesce(p_file_path, ''));
  v_name text := btrim(coalesce(p_file_name, ''));
  v_sha text := lower(btrim(coalesce(p_file_sha256, '')));
  v_first boolean;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The table's read-only blocks and the twin fence refuse the write too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot send a change order.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot send a change order.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team sends a change order to sign.' USING ERRCODE = '42501';
  END IF;

  SELECT c.number, c.status, c.project_id, p.customer_id INTO v
  FROM public.gc_change_orders c
  JOIN public.projects p ON p.id = c.project_id
  WHERE c.id = p_id
  FOR UPDATE OF c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change order is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status IN ('signed', 'declined') THEN
    RAISE EXCEPTION 'Change order % is answered already.', v.number USING ERRCODE = 'P0001';
  END IF;
  IF p_sign_by IS NULL THEN
    RAISE EXCEPTION 'Pick the day to ask them to sign by.' USING ERRCODE = 'P0001';
  END IF;
  IF p_sign_by < public.app_today() THEN
    RAISE EXCEPTION 'Pick a sign-by day from today on.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'Keep your line under 500 characters.' USING ERRCODE = 'P0001';
  END IF;
  IF v_path = '' OR v_name = '' THEN
    RAISE EXCEPTION 'Attach the change order file first.' USING ERRCODE = 'P0001';
  END IF;
  IF split_part(v_path, '/', 1) <> v.project_id::text THEN
    RAISE EXCEPTION 'That file is not this project''s.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'The file''s fingerprint is not right. Attach it again.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'gc-change-orders' AND o.name = v_path) THEN
    RAISE EXCEPTION 'Upload the change order file first.' USING ERRCODE = 'P0001';
  END IF;

  -- The first send marks the draft sent, with gc_send_change_order's own refusals: one with no price and no days has
  -- nothing to sign. Later sends are reminders.
  IF v.status = 'draft' THEN
    PERFORM public.gc_send_change_order(p_id, public.app_today());
  END IF;
  v_first := NOT EXISTS (SELECT 1 FROM public.gc_change_order_sends s WHERE s.change_order_id = p_id);
  INSERT INTO public.gc_change_order_sends (change_order_id, project_id, customer_id, first, sign_by, note, file_path, file_name, file_sha256)
  VALUES (p_id, v.project_id, v.customer_id, v_first, p_sign_by, v_note, v_path, v_name, v_sha)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_send_change_order_to_sign(uuid, date, text, text, text, text) IS
  'Messages (cut 4b): the money team sends a change order to sign, with its file in gc-change-orders under the project''s id, a sign-by day from today on and a line of 500 characters at most. The first send marks a draft sent through gc_send_change_order; later ones are reminders. Writes a gc_change_order_sends row and returns its id. SECURITY INVOKER: RLS and the money team decide.';

REVOKE ALL ON FUNCTION public.gc_send_change_order_to_sign(uuid, date, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_send_change_order_to_sign(uuid, date, text, text, text, text) TO authenticated;

-- ---------- 6. A fold keeps who signs ----------

-- The spine's contacts_fold runs every contacts_fold_<something>(p_from, p_into) after it moves the lines, numbers and
-- jobs, and before p_from goes; without this, p_from's delete would leave its change orders with no signer. A definer,
-- since the orders are the money team's and a fold runs as whoever names the number or deletes the record. Outside a
-- trigger, a call from someone signed in who is not on the office team, or is a twin, moves nothing, as the fold's own
-- statements move nothing for them.
CREATE OR REPLACE FUNCTION public.contacts_fold_change_orders(p_from uuid, p_into uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_into IS NULL OR p_from = p_into THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 0 AND (NOT public.gc_office_team() OR public.is_digital_twin()) THEN
    RETURN;
  END IF;
  UPDATE public.gc_change_orders SET signer_contact_id = p_into WHERE signer_contact_id = p_from;
END;
$$;

COMMENT ON FUNCTION public.contacts_fold_change_orders(uuid, uuid) IS
  'Messages (cut 4b): the spine''s contacts_fold runs it, so a folded contact''s change orders are signed by the contact it folds into. A definer, since the orders are the money team''s. Outside a trigger, a call from someone signed in off the office team, or a twin, moves nothing.';

REVOKE EXECUTE ON FUNCTION public.contacts_fold_change_orders(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_fold_change_orders(uuid, uuid) TO authenticated, service_role;

-- ---------- The fences on the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

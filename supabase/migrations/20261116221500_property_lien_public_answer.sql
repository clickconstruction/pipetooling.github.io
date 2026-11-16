SET lock_timeout = '3s';

-- Is this public property? The answer on the property record, and the press that takes its jobs off the lien path
-- (Taunya's ask of 2026-11-16, on job 883 sitting in Ready to file: "this job is a government job and we can't lien
-- a government job, how should we amend the flow to handle this going forward?").
--
-- Until now "public" was a guess from the owner's names, made again on every screen (ownerKind in
-- src/lib/jobs/ownerConfirm.ts). The guess holds a paper that is being drafted (v2.6954), but nothing stored an answer,
-- so nothing could take a job off the Lien desk, and a private owner whose name only sounds public had no door.
--
-- 1 · The answer lives on the property, once. NULL means nobody has answered. 'public' takes every job at the address,
--     now and later, off the lien path: the desk derives that from this column, and no flag is copied onto a job, so one
--     change of the answer brings them all back. 'private' overrules the name guess. Who, when and why sit beside it.
-- 2 · One function makes the press's writes in one transaction: the answer, the payment bond on the ticked jobs, and
--     each ticked job onto the attorney's list through the Collections flag that already exists. It acts on what is
--     ready and names what it held, a job at a time.
--
-- Nothing here files, voids or deletes a lien paper. The desk items stay as they are.
--
-- Additive and idempotent. No CREATE TABLE, so no fence calls: customer_addresses and jobs_ledger already carry the
-- read-only blocks, the twin fence and the archived seal, and those triggers fire inside this SECURITY DEFINER
-- function, so training mode is refused here as everywhere. Nothing reads the columns or calls the function until the
-- client that follows, so the push can come any time after the merge.

-- ---------- 1 · the answer on the property record ----------

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS lien_public_answer text,
  ADD COLUMN IF NOT EXISTS lien_public_answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS lien_public_answered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lien_public_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_addresses_lien_public_answer_check') THEN
    ALTER TABLE public.customer_addresses ADD CONSTRAINT customer_addresses_lien_public_answer_check
      CHECK (lien_public_answer IS NULL OR lien_public_answer IN ('public', 'private'));
  END IF;
END $$;

COMMENT ON COLUMN public.customer_addresses.lien_public_answer IS
  'Is this public property? NULL = nobody answered (the Lien desk falls back to the guess from the owner''s names). ''public'' = a person said so: every job at this address is off the lien path, derived from this column. ''private'' = a person said it is private: the name guess is overruled. Written only by set_property_lien_public_answer.';
COMMENT ON COLUMN public.customer_addresses.lien_public_answered_at IS
  'When the public property question was last answered, or the answer last taken back.';
COMMENT ON COLUMN public.customer_addresses.lien_public_answered_by IS
  'Who last answered the public property question, or took the answer back (users.id).';
COMMENT ON COLUMN public.customer_addresses.lien_public_reason IS
  'Why, in the person''s words: why the property is off the lien path, or why it went back on.';

-- ---------- 2 · the press ----------

-- p_answer: 'public', 'private', or 'unanswered' (takes an answer back, which puts a public property's jobs back on
--   the lien path). A reason is required to answer 'public' and to take a 'public' answer back.
-- p_jobs: for 'public' only, the ticked jobs as [{ "job_id": uuid, "note": text }]. The note goes on the Collections
--   flag: the reason plus what already went out on that job. A job not at this property is held, never written.
-- p_payment_bond: for 'public' only, 'yes' | 'no' | 'unknown', written to each ticked job; NULL leaves the jobs' own.
-- Returns { ok, answer, jobs: [{ job_id, bond_set, on_attorney_list, already_on_list, held }] } or { error }.
CREATE OR REPLACE FUNCTION public.set_property_lien_public_answer(
  p_address_id uuid,
  p_answer text,
  p_reason text DEFAULT NULL,
  p_jobs jsonb DEFAULT '[]'::jsonb,
  p_payment_bond text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_old text;
  v_found boolean := false;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_item jsonb;
  v_job_id uuid;
  v_job_found boolean;
  v_job_address uuid;
  v_job_bond text;
  v_collections_at timestamptz;
  v_note text;
  v_flag jsonb;
  v_bond_set boolean;
  v_on_list boolean;
  v_already boolean;
  v_held text;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- The lien office: the seats that draft, send and run lien papers (isLienOffice in src/lib/jobs/lienDesk.ts).
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    RETURN jsonb_build_object('error', 'Not authorized to answer the public property question');
  END IF;

  IF p_answer IS NULL OR p_answer NOT IN ('public', 'private', 'unanswered') THEN
    RETURN jsonb_build_object('error', 'The answer must be public, private or unanswered');
  END IF;
  IF p_payment_bond IS NOT NULL AND p_payment_bond NOT IN ('yes', 'no', 'unknown') THEN
    RETURN jsonb_build_object('error', 'The payment bond must be yes, no or unknown');
  END IF;
  IF p_jobs IS NOT NULL AND jsonb_typeof(p_jobs) <> 'array' THEN
    RETURN jsonb_build_object('error', 'The jobs must be a list');
  END IF;

  SELECT true, ca.lien_public_answer INTO v_found, v_old
  FROM public.customer_addresses ca
  WHERE ca.id = p_address_id
  FOR UPDATE;
  IF NOT COALESCE(v_found, false) THEN
    RETURN jsonb_build_object('error', 'Property record not found');
  END IF;

  IF p_answer = 'public' AND v_reason IS NULL THEN
    RETURN jsonb_build_object('error', 'Say why this property is off the lien path');
  END IF;
  IF v_old = 'public' AND p_answer <> 'public' AND v_reason IS NULL THEN
    RETURN jsonb_build_object('error', 'Say why this property goes back on the lien path');
  END IF;

  UPDATE public.customer_addresses
     SET lien_public_answer = NULLIF(p_answer, 'unanswered'),
         lien_public_answered_at = now(),
         lien_public_answered_by = auth.uid(),
         lien_public_reason = v_reason,
         updated_at = now()
   WHERE id = p_address_id;

  IF p_answer = 'public' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_jobs, '[]'::jsonb)) LOOP
      v_bond_set := false;
      v_on_list := false;
      v_already := false;
      v_held := NULL;
      v_job_found := false;
      BEGIN
        v_job_id := NULLIF(v_item->>'job_id', '')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_job_id := NULL;
      END;

      IF v_job_id IS NULL THEN
        v_held := 'No job was named';
      ELSE
        SELECT true, jl.customer_address_id, jl.lien_payment_bond, jl.collections_at
          INTO v_job_found, v_job_address, v_job_bond, v_collections_at
        FROM public.jobs_ledger jl
        WHERE jl.id = v_job_id
        FOR UPDATE;

        IF NOT COALESCE(v_job_found, false) THEN
          v_held := 'Job not found';
        ELSIF v_job_address IS DISTINCT FROM p_address_id THEN
          v_held := 'This job is not at this property';
        ELSE
          IF p_payment_bond IS NOT NULL AND v_job_bond IS DISTINCT FROM p_payment_bond THEN
            UPDATE public.jobs_ledger SET lien_payment_bond = p_payment_bond, updated_at = now() WHERE id = v_job_id;
            v_bond_set := true;
          END IF;

          IF v_collections_at IS NOT NULL THEN
            v_on_list := true;
            v_already := true;
          ELSE
            v_note := COALESCE(NULLIF(btrim(COALESCE(v_item->>'note', '')), ''), v_reason);
            -- The attorney's list is the Collections flag that already exists: its own rules decide (a job must be
            -- billed), and what it refuses is named for this job while the others go on.
            v_flag := public.set_job_collections_flag(v_job_id, true, v_note);
            IF v_flag ? 'error' THEN
              v_held := v_flag->>'error';
            ELSE
              v_on_list := true;
            END IF;
          END IF;
        END IF;
      END IF;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'job_id', v_job_id,
        'bond_set', v_bond_set,
        'on_attorney_list', v_on_list,
        'already_on_list', v_already,
        'held', v_held
      ));
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'answer', NULLIF(p_answer, 'unanswered'), 'jobs', v_results);
END;
$function$;

ALTER FUNCTION public.set_property_lien_public_answer(uuid, text, text, jsonb, text) OWNER TO postgres;

COMMENT ON FUNCTION public.set_property_lien_public_answer(uuid, text, text, jsonb, text) IS
  'The public property question on a property record (customer_addresses.lien_public_answer), answered by the lien office (dev, master_technician, assistant, controller). ''public'' takes every job at the address off the lien path (the desk derives it), writes the payment bond on the ticked jobs and puts each on the attorney''s list through set_job_collections_flag, in one transaction, naming any job it held. ''private'' overrules the name guess. ''unanswered'' takes an answer back. Nothing is filed, voided or deleted.';

REVOKE ALL ON FUNCTION public.set_property_lien_public_answer(uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_property_lien_public_answer(uuid, text, text, jsonb, text) TO authenticated;

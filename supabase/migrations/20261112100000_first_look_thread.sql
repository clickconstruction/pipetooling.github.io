SET lock_timeout = '3s';

-- First look on a person's thread (punch list #319 PR 1, v2.6999). The spike (20261112060000_first_looks.sql) made the
-- two tables and the bucket, and only the first-look function wrote them, for the owner and the developers. This opens
-- the ask to the office team, from a person's thread. No new table, so no fence call.
--
--   1. mint_first_look(p_contact_id): the office's ask. Makes the look for that thread and answers its id and its
--      ten-letter code, once. The code is minted as an estimate's is (share_estimate_link, 20261108053000): the same
--      31 letters, only the SHA-256 kept. The link takes files for 7 days. The office team only; a training account
--      and a digital twin are refused in words.
--   2. stamp_first_look(p_look_id, p_what): 'looked' the first time someone on the office team opens what came in,
--      'closed' when they close the look. Both keep the first stamp.
--   3. The office team may sign a file in the first-look-files bucket, as it may in message-attachments, so the thread's
--      card draws a photo and plays a video. Still nobody but the service role writes there.

CREATE OR REPLACE FUNCTION public.mint_first_look(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_alphabet CONSTANT text := '23456789abcdefghjkmnpqrstuvwxyz';
  v_length CONSTANT int := 10;
  v_bytes bytea;
  v_i int;
  v_b int;
  v_code text;
  v_tries int := 0;
  v_name text;
  v_label text;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to ask for photos.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot ask for photos.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot ask for photos.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office can ask for photos.' USING ERRCODE = '42501';
  END IF;
  SELECT left(coalesce(c.name, ''), 120) INTO v_label FROM public.contacts c WHERE c.id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  SELECT left(split_part(btrim(coalesce(u.name, '')), ' ', 1), 120) INTO v_name FROM public.users u WHERE u.id = v_me;
  LOOP
    v_code := '';
    v_bytes := extensions.gen_random_bytes(32);
    v_i := 0;
    WHILE length(v_code) < v_length LOOP
      IF v_i >= length(v_bytes) THEN
        v_bytes := extensions.gen_random_bytes(32);
        v_i := 0;
      END IF;
      v_b := get_byte(v_bytes, v_i);
      v_i := v_i + 1;
      -- 248 = 8 × 31: a byte at or past it is thrown away, so no letter is likelier than another.
      IF v_b < 248 THEN
        v_code := v_code || substr(v_alphabet, (v_b % 31) + 1, 1);
      END IF;
    END LOOP;
    BEGIN
      INSERT INTO public.first_looks (contact_id, label, asked_by, asked_by_name, code_hash, expires_at)
      VALUES (p_contact_id, v_label, v_me, coalesce(v_name, ''), encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '7 days')
      RETURNING id INTO v_id;
      RETURN jsonb_build_object('ok', true, 'id', v_id, 'code', v_code);
    EXCEPTION WHEN unique_violation THEN
      -- The same code twice: one chance in 10^14. Mint another; give up only if it keeps happening.
      v_tries := v_tries + 1;
      IF v_tries >= 5 THEN
        RAISE EXCEPTION 'The link was not made. Try again.' USING ERRCODE = 'P0001';
      END IF;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.mint_first_look(uuid) IS
  'First look (punch list #319, v2.6999): the office''s ask for photos from a person''s thread. Makes the look and returns its id and its ten-letter code once; the row keeps only the SHA-256. Good for 7 days. The office team only; refuses a training account and a twin.';

REVOKE ALL ON FUNCTION public.mint_first_look(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mint_first_look(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.stamp_first_look(p_look_id uuid, p_what text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office can do that.' USING ERRCODE = '42501';
  END IF;
  IF p_what = 'looked' THEN
    -- A look by a training account or a twin is not a look by the office: nothing is stamped and nothing is refused.
    IF public.is_read_only() OR public.is_digital_twin() THEN
      RETURN jsonb_build_object('ok', true);
    END IF;
    UPDATE public.first_looks SET looked_at = now(), looked_by = v_me WHERE id = p_look_id AND looked_at IS NULL;
  ELSIF p_what = 'closed' THEN
    IF public.is_read_only() THEN
      RAISE EXCEPTION 'A training account cannot close a look.' USING ERRCODE = '42501';
    END IF;
    IF public.is_digital_twin() THEN
      RAISE EXCEPTION 'A digital twin cannot close a look.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.first_looks SET closed_at = now(), closed_by = v_me WHERE id = p_look_id AND closed_at IS NULL;
  ELSE
    RAISE EXCEPTION 'Unknown stamp.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.stamp_first_look(uuid, text) IS
  'First look (punch list #319, v2.6999): stamps a look looked at (the first time the office opens what came in) or closed. Each keeps its first stamp. The office team only.';

REVOKE ALL ON FUNCTION public.stamp_first_look(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_first_look(uuid, text) TO authenticated;

-- The office team signs a look's file to draw it, as it signs a file that came on a line. No INSERT, UPDATE or DELETE
-- policy: the page uploads through a one-file address the first-look function signs, and only it removes a file.
DROP POLICY IF EXISTS first_look_files_select_office ON storage.objects;
CREATE POLICY first_look_files_select_office ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'first-look-files' AND public.gc_office_team());

-- Function to convert a master_technician user into an assistant or subcontractor
-- while reassigning all of their owned data to another master.
--
-- Usage:
--   SELECT public.convert_master_user(
--     old_master_id := '...',
--     new_master_id := '...',
--     new_role := 'assistant', -- or 'subcontractor'
--     auto_adopt := true       -- if true and new_role = 'assistant', new master adopts them
--   );
--
-- Only devs are allowed to perform this conversion.

CREATE OR REPLACE FUNCTION public.convert_master_user(
  old_master_id uuid,
  new_master_id uuid,
  new_role text,
  auto_adopt boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_dev boolean;
  v_old_role text;
  v_new_master_role text;
  customers_moved integer := 0;
  projects_moved integer := 0;
  people_moved integer := 0;
BEGIN
  -- Ensure caller is a dev
  BEGIN
    v_is_dev := public.is_dev();
  EXCEPTION
    WHEN undefined_function THEN
      RAISE EXCEPTION 'Function public.is_dev() is required for convert_master_user' USING ERRCODE = '42883';
  END;

  IF NOT v_is_dev THEN
    RAISE EXCEPTION 'Only devs can convert masters' USING ERRCODE = '42501';
  END IF;

  -- Basic validations
  IF old_master_id IS NULL OR new_master_id IS NULL THEN
    RAISE EXCEPTION 'Both old_master_id and new_master_id are required' USING ERRCODE = '23502';
  END IF;

  IF old_master_id = new_master_id THEN
    RAISE EXCEPTION 'old_master_id and new_master_id must be different' USING ERRCODE = '22023';
  END IF;

  IF new_role NOT IN ('assistant', 'subcontractor') THEN
    RAISE EXCEPTION 'new_role must be assistant or subcontractor' USING ERRCODE = '22023';
  END IF;

  -- Validate roles of the two users
  SELECT role INTO v_old_role
  FROM public.users
  WHERE id = old_master_id;

  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'Old master user not found' USING ERRCODE = '23503';
  END IF;

  IF v_old_role <> 'master_technician' THEN
    RAISE EXCEPTION 'Old user must currently be a master_technician' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_new_master_role
  FROM public.users
  WHERE id = new_master_id;

  IF v_new_master_role IS NULL THEN
    RAISE EXCEPTION 'New master user not found' USING ERRCODE = '23503';
  END IF;

  IF v_new_master_role <> 'master_technician' THEN
    RAISE EXCEPTION 'New owner must be a master_technician' USING ERRCODE = '22023';
  END IF;

  -- Reassign ownership: customers
  UPDATE public.customers
  SET master_user_id = new_master_id
  WHERE master_user_id = old_master_id;
  GET DIAGNOSTICS customers_moved = ROW_COUNT;

  -- Reassign ownership: projects
  UPDATE public.projects
  SET master_user_id = new_master_id
  WHERE master_user_id = old_master_id;
  GET DIAGNOSTICS projects_moved = ROW_COUNT;

  -- Reassign ownership: people
  UPDATE public.people
  SET master_user_id = new_master_id
  WHERE master_user_id = old_master_id;
  GET DIAGNOSTICS people_moved = ROW_COUNT;

  -- Clean up any adoption relationships where this user was a master
  DELETE FROM public.master_assistants
  WHERE master_id = old_master_id;

  -- Optionally adopt as assistant to new master
  IF new_role = 'assistant' AND auto_adopt THEN
    INSERT INTO public.master_assistants(master_id, assistant_id)
    VALUES (new_master_id, old_master_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Finally, update the user's role
  UPDATE public.users
  SET role = new_role
  WHERE id = old_master_id;

  RETURN jsonb_build_object(
    'customers_moved', customers_moved,
    'projects_moved', projects_moved,
    'people_moved', people_moved,
    'new_role', new_role,
    'auto_adopt', auto_adopt,
    'new_master_id', new_master_id
  );
END;
$$;


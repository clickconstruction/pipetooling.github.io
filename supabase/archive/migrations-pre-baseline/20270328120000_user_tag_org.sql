-- Explicit user -> master for label catalog (People tags). Optional read-only signals use adoption/job data in the app only.

CREATE TABLE public.user_tag_org (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  master_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_tag_org_master_user_id ON public.user_tag_org(master_user_id);

COMMENT ON TABLE public.user_tag_org IS 'Which master org label catalog applies for this login user (tags). Does not change job/bid access.';

CREATE OR REPLACE FUNCTION public.set_user_tag_org_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_tag_org_updated_at
  BEFORE UPDATE ON public.user_tag_org
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_tag_org_updated_at();

-- Allow user_labels rows when label.master matches explicit tag org for this user.
CREATE OR REPLACE FUNCTION public.enforce_user_labels_scope_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  l_master uuid;
  u_role text;
  u_email text;
BEGIN
  SELECT master_user_id INTO l_master FROM public.labels WHERE id = NEW.label_id;
  IF l_master IS NULL THEN
    RAISE EXCEPTION 'user_labels: label not found for label_id %', NEW.label_id;
  END IF;

  SELECT role::text, email INTO u_role, u_email FROM public.users WHERE id = NEW.user_id;
  IF u_role IS NULL THEN
    RAISE EXCEPTION 'user_labels: user not found for user_id %', NEW.user_id;
  END IF;

  IF u_role IN ('master_technician', 'dev') AND NEW.user_id = l_master THEN
    RETURN NEW;
  END IF;

  IF u_role = 'assistant' AND EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE assistant_id = NEW.user_id AND master_id = l_master
  ) THEN
    RETURN NEW;
  END IF;

  IF u_role = 'superintendent' AND EXISTS (
    SELECT 1 FROM public.master_superintendents
    WHERE superintendent_id = NEW.user_id AND master_id = l_master
  ) THEN
    RETURN NEW;
  END IF;

  IF u_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.master_user_id = l_master
      AND p.archived_at IS NULL
      AND lower(trim(p.email)) = lower(trim(u_email))
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_tag_org uto
    WHERE uto.user_id = NEW.user_id AND uto.master_user_id = l_master
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'user_labels: user % is not in scope for label master %', NEW.user_id, l_master;
END;
$$;

ALTER TABLE public.user_tag_org ENABLE ROW LEVEL SECURITY;

-- Devs manage all rows; users can read own row.
CREATE POLICY "user_tag_org_select_dev_or_self"
  ON public.user_tag_org
  FOR SELECT
  TO authenticated
  USING (public.is_dev() OR user_id = auth.uid());

CREATE POLICY "user_tag_org_insert_dev"
  ON public.user_tag_org
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "user_tag_org_update_dev"
  ON public.user_tag_org
  FOR UPDATE
  TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

CREATE POLICY "user_tag_org_delete_dev"
  ON public.user_tag_org
  FOR DELETE
  TO authenticated
  USING (public.is_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tag_org TO authenticated;

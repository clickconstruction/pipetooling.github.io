-- Task Dispatch: assistant-only group (dev-managed), requests from any authenticated user

CREATE TABLE public.dispatch_group_members (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.dispatch_group_members IS 'Assistants who receive Task Dispatch push notifications and see the Dispatch inbox on Dashboard. Dev manages membership in Settings.';

CREATE OR REPLACE FUNCTION public.dispatch_group_members_enforce_assistant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.user_id AND u.role::text = 'assistant'
  ) THEN
    RAISE EXCEPTION 'Dispatch group may only include users with role assistant';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dispatch_group_members_enforce_assistant
  BEFORE INSERT OR UPDATE ON public.dispatch_group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_group_members_enforce_assistant();

-- Defined before RLS so internal lookups are unambiguous; used by dispatch_requests policies.
CREATE OR REPLACE FUNCTION public.is_dispatch_group_member()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dispatch_group_members d
    WHERE d.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_dispatch_group_member() IS 'True if current user is in the Task Dispatch assistant group.';

ALTER TABLE public.dispatch_group_members ENABLE ROW LEVEL SECURITY;

-- Avoid recursion: do not call is_dispatch_group_member() here (it selects this table).
CREATE POLICY "dispatch_group_members_select_dev_or_self"
  ON public.dispatch_group_members FOR SELECT
  TO authenticated
  USING (public.is_dev() OR user_id = auth.uid());

CREATE POLICY "dispatch_group_members_insert_dev"
  ON public.dispatch_group_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "dispatch_group_members_delete_dev"
  ON public.dispatch_group_members FOR DELETE
  TO authenticated
  USING (public.is_dev());

CREATE TABLE public.dispatch_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 2000),
  links text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.dispatch_requests IS 'Task Dispatch messages to the Dispatch group. Any authenticated user may create; dev and dispatch members see inbox and may mark closed.';
COMMENT ON COLUMN public.dispatch_requests.links IS 'URLs for placeholders [1], [2], ... in title; same pattern as checklist_items.links.';

CREATE OR REPLACE FUNCTION public.dispatch_requests_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.from_user_id IS DISTINCT FROM NEW.from_user_id
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.links IS DISTINCT FROM NEW.links
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    IF NOT public.is_dev() THEN
      RAISE EXCEPTION 'Cannot modify dispatch request content';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dispatch_requests_guard_update
  BEFORE UPDATE ON public.dispatch_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_requests_guard_update();

ALTER TABLE public.dispatch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatch_requests_select"
  ON public.dispatch_requests FOR SELECT
  TO authenticated
  USING (
    from_user_id = auth.uid()
    OR public.is_dev()
    OR public.is_dispatch_group_member()
  );

CREATE POLICY "dispatch_requests_insert"
  ON public.dispatch_requests FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "dispatch_requests_update_dispatch_or_dev"
  ON public.dispatch_requests FOR UPDATE
  TO authenticated
  USING (public.is_dev() OR public.is_dispatch_group_member())
  WITH CHECK (public.is_dev() OR public.is_dispatch_group_member());

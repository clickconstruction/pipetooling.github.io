-- user_labels: assign master-scoped labels to users (accounts) when no people row or for user-only scope.
-- Mirrors people_labels RLS; trigger aligns tagged user with label.master (same semantics as resolveManagerUserIdForFeedback).

-- ============================================================================
-- user_labels
-- ============================================================================

CREATE TABLE public.user_labels (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, label_id)
);

CREATE INDEX idx_user_labels_label_id ON public.user_labels(label_id);
CREATE INDEX idx_user_labels_user_id ON public.user_labels(user_id);

COMMENT ON TABLE public.user_labels IS 'Many-to-many: login users and master-scoped labels. Tagged user must be in scope for the label master (master/self, assistant/superintendent adoption, or people email match).';

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

  RAISE EXCEPTION 'user_labels: user % is not in scope for label master %', NEW.user_id, l_master;
END;
$$;

CREATE TRIGGER enforce_user_labels_scope_master_trigger
  BEFORE INSERT OR UPDATE ON public.user_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_labels_scope_master();

ALTER TABLE public.user_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_labels_select_join"
ON public.user_labels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.users u ON u.id = user_labels.user_id
    WHERE l.id = user_labels.label_id
  )
);

CREATE POLICY "user_labels_insert_scope"
ON public.user_labels
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.users u ON u.id = user_labels.user_id
    WHERE l.id = user_labels.label_id
      AND public.user_can_write_labels_for_master(l.master_user_id)
  )
);

CREATE POLICY "user_labels_delete_scope"
ON public.user_labels
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.users u ON u.id = user_labels.user_id
    WHERE l.id = user_labels.label_id
      AND public.user_can_write_labels_for_master(l.master_user_id)
  )
);

CREATE POLICY "user_labels_update_scope"
ON public.user_labels
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.users u ON u.id = user_labels.user_id
    WHERE l.id = user_labels.label_id
      AND public.user_can_write_labels_for_master(l.master_user_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.users u ON u.id = user_labels.user_id
    WHERE l.id = user_labels.label_id
      AND public.user_can_write_labels_for_master(l.master_user_id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_labels TO authenticated;

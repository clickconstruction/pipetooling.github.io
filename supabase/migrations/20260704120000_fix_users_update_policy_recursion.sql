-- The UPDATE policy "Masters assistants devs can update user notes" on public.users
-- (baseline-era) used a raw EXISTS(... FROM users ...) inside a users policy →
-- "infinite recursion detected in policy for relation users" on EVERY users UPDATE
-- (role changes, profile edits, notes). Surfaced 2026-07-04 while testing the Active
-- Accounts modal. Replace the self-referential predicate with a SECURITY DEFINER
-- helper (same three roles — deliberately NOT is_dev_or_master_or_assistant(),
-- which also includes 'primary').

CREATE OR REPLACE FUNCTION public.is_user_notes_editor() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND role IN ('dev','master_technician','assistant')
  );
$$;

COMMENT ON FUNCTION public.is_user_notes_editor() IS 'True when the caller is dev/master_technician/assistant. SECURITY DEFINER so users-table policies can use it without self-referential recursion.';

ALTER POLICY "Masters assistants devs can update user notes" ON public.users
  USING (public.is_user_notes_editor()) WITH CHECK (public.is_user_notes_editor());

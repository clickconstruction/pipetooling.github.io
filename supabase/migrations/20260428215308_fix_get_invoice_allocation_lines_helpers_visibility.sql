-- Out-of-order (before helpers parity bundle): Ensure auth_uid_is_helpers_or_subcontractor() exists before
-- 20270504120001 and other callers. Same definition as migration 20270504120001 (top of file).
CREATE OR REPLACE FUNCTION public.auth_uid_is_helpers_or_subcontractor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('helpers', 'subcontractor')
  );
$$;

COMMENT ON FUNCTION public.auth_uid_is_helpers_or_subcontractor() IS
  'True when the current authenticated user role is helpers or subcontractor.';
REVOKE ALL ON FUNCTION public.auth_uid_is_helpers_or_subcontractor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_is_helpers_or_subcontractor() TO authenticated;

-- Banking Mercury Accounting: per-label assignment counts for SearchableSelect ordering (SECURITY INVOKER + assignments RLS).

CREATE OR REPLACE FUNCTION public.list_mercury_drag_sort_label_assignment_counts()
RETURNS TABLE (label_id uuid, assignment_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT a.label_id, count(*)::bigint AS assignment_count
  FROM public.mercury_transaction_drag_sort_assignments a
  GROUP BY a.label_id;
$$;

REVOKE ALL ON FUNCTION public.list_mercury_drag_sort_label_assignment_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_mercury_drag_sort_label_assignment_counts() TO authenticated;

COMMENT ON FUNCTION public.list_mercury_drag_sort_label_assignment_counts() IS
  'Returns mercury_transaction_drag_sort_assignments counts per label_id for Banking Accounting rule modal ordering (SECURITY INVOKER; banking staff via assignments SELECT RLS).';

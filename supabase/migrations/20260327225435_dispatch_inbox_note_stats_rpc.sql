-- RPC: note count and last activity time per dispatch request for inbox cards (RLS on dispatch_request_notes applies).

CREATE OR REPLACE FUNCTION public.dispatch_inbox_note_stats(p_request_ids uuid[])
RETURNS TABLE (request_id uuid, note_count bigint, last_note_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT n.request_id,
         count(*)::bigint AS note_count,
         max(n.created_at) AS last_note_at
  FROM public.dispatch_request_notes n
  WHERE n.request_id = ANY(p_request_ids)
  GROUP BY n.request_id
$$;

COMMENT ON FUNCTION public.dispatch_inbox_note_stats(uuid[]) IS 'Aggregates thread notes for dashboard dispatch inbox cards; empty input returns no rows.';

GRANT EXECUTE ON FUNCTION public.dispatch_inbox_note_stats(uuid[]) TO authenticated;

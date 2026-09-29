SET lock_timeout = '3s';

-- Submittals robot offers (v2.4136, punch list #59): the tab shows a robot offer only while a
-- robot seat is live, and says when one last ran. twin_credentials is readable by devs only
-- (twin_credentials_select_dev), so the two facts the office needs come through one
-- SECURITY DEFINER reader: how many unrevoked seats exist, and the newest time any was
-- used. No secrets cross (no token, no label). Additive; nothing else changes.

begin;

CREATE OR REPLACE FUNCTION public.submittal_robot_liveness()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'unrevoked_seats', (SELECT count(*) FROM public.twin_credentials WHERE revoked_at IS NULL),
    'last_used_at', (SELECT max(last_used_at) FROM public.twin_credentials WHERE revoked_at IS NULL)
  );
$function$;

REVOKE ALL ON FUNCTION public.submittal_robot_liveness() FROM public;
GRANT EXECUTE ON FUNCTION public.submittal_robot_liveness() TO authenticated, service_role;

commit;

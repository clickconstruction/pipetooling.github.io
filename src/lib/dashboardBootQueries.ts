import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/**
 * Same four queries as Dashboard Phase 1 boot (keep in sync with Dashboard.tsx).
 */
export function fetchDashboardPhase1(
  supabase: SupabaseClient<Database>,
  authUserId: string,
  todayYmd: string,
) {
  return Promise.all([
    supabase.from('users').select('name').eq('id', authUserId).single(),
    supabase.from('users').select('name'),
    supabase
      .from('step_subscriptions')
      .select('step_id, notify_when_started, notify_when_complete, notify_when_reopened')
      .eq('user_id', authUserId)
      .or('notify_when_started.eq.true,notify_when_complete.eq.true,notify_when_reopened.eq.true'),
    supabase
      .from('checklist_instances')
      .select(
        'id, checklist_item_id, scheduled_date, completed_at, notes, completed_by_user_id, created_at, checklist_items(title, links), checklist_instance_assignees!inner(user_id)',
      )
      .eq('checklist_instance_assignees.user_id', authUserId)
      .eq('scheduled_date', todayYmd)
      .order('created_at', { ascending: true }),
  ] as const)
}

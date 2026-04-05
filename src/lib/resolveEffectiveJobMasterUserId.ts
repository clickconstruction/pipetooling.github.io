import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * Same rules as Jobs new-job form: project owner when project-linked, else app_settings job_owner_override_{authUserId}, else auth user.
 */
export async function resolveEffectiveJobMasterUserId(
  supabase: SupabaseClient<Database>,
  authUserId: string,
  projectId: string | null,
): Promise<string> {
  if (projectId) {
    const row = await withSupabaseRetry<{ master_user_id: string } | null>(
      async () =>
        await supabase.from('projects').select('master_user_id').eq('id', projectId).maybeSingle(),
      'resolve job master from project',
    )
    if (row?.master_user_id) return row.master_user_id
    return authUserId
  }
  const overrideRow = await withSupabaseRetry<{ value_text: string | null } | null>(
    async () =>
      await supabase
        .from('app_settings')
        .select('value_text')
        .eq('key', `job_owner_override_${authUserId}`)
        .maybeSingle(),
    'fetch job owner override',
  )
  const v = overrideRow?.value_text?.trim()
  if (v) return v
  return authUserId
}

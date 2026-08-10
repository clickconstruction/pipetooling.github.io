import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'

/** app_settings key for the org-wide fallback (v2.1532): master every user creates jobs as unless they have their own row. */
export const JOB_OWNER_OVERRIDE_DEFAULT_KEY = 'job_owner_override_default'

/**
 * Pick the new-job owner from override rows (pure — v2.1532):
 * the user's own `job_owner_override_<userId>` wins, else the org-wide
 * `job_owner_override_default`, else the user themselves. A personal row
 * pointing at the user themselves is honored (that's how a user is exempted
 * from the default).
 */
export function chooseJobOwnerFromOverrideRows(
  rows: Array<{ key: string; value_text: string | null }>,
  authUserId: string,
): string {
  const personal = rows.find((r) => r.key === `job_owner_override_${authUserId}`)?.value_text?.trim()
  if (personal) return personal
  const fallback = rows.find((r) => r.key === JOB_OWNER_OVERRIDE_DEFAULT_KEY)?.value_text?.trim()
  if (fallback) return fallback
  return authUserId
}

/**
 * Same rules as Jobs new-job form: project owner when project-linked, else
 * app_settings job_owner_override_{authUserId}, else the org-wide
 * job_owner_override_default (v2.1532), else auth user.
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
  const overrideRows = await withSupabaseRetry<Array<{ key: string; value_text: string | null }> | null>(
    async () =>
      await supabase
        .from('app_settings')
        .select('key, value_text')
        .in('key', [`job_owner_override_${authUserId}`, JOB_OWNER_OVERRIDE_DEFAULT_KEY]),
    'fetch job owner override',
  )
  return chooseJobOwnerFromOverrideRows(overrideRows ?? [], authUserId)
}

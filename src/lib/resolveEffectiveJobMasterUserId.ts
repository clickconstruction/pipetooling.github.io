import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { COMPANY_OWNER_USER_ID_KEY, JOB_OWNER_OVERRIDE_DEFAULT_KEY } from './companyOwner'

export { JOB_OWNER_OVERRIDE_DEFAULT_KEY }

/**
 * Pick the new-job owner from settings rows (pure):
 * the company owner account (`company_owner_user_id`, one company v2.2972) wins;
 * while it is unset the v2.1532 chain still runs — the user's own
 * `job_owner_override_<userId>`, else the org-wide `job_owner_override_default`,
 * else the user themselves.
 */
export function chooseJobOwnerFromOverrideRows(
  rows: Array<{ key: string; value_text: string | null }>,
  authUserId: string,
): string {
  const company = rows.find((r) => r.key === COMPANY_OWNER_USER_ID_KEY)?.value_text?.trim()
  if (company) return company
  const personal = rows.find((r) => r.key === `job_owner_override_${authUserId}`)?.value_text?.trim()
  if (personal) return personal
  const fallback = rows.find((r) => r.key === JOB_OWNER_OVERRIDE_DEFAULT_KEY)?.value_text?.trim()
  if (fallback) return fallback
  return authUserId
}

/**
 * Same rules as Jobs new-job form: project owner when project-linked, else the
 * company owner account (v2.2972), else app_settings job_owner_override_{authUserId},
 * else the org-wide job_owner_override_default (v2.1532), else auth user.
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
        .in('key', [COMPANY_OWNER_USER_ID_KEY, `job_owner_override_${authUserId}`, JOB_OWNER_OVERRIDE_DEFAULT_KEY]),
    'fetch job owner override',
  )
  return chooseJobOwnerFromOverrideRows(overrideRows ?? [], authUserId)
}

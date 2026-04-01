import { supabase } from './supabase'
import { payStaffBulkInsertUserTimeOff, type PayStaffBulkTimeOffResult } from './payStaffBulkTimeOff'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

/** Default `user_time_off.note` when marking absence from the team strip (searchable). */
export const NOT_COMING_IN_NOTE = 'Not coming in'

export type RecordNotComingInForUserAsStaffResult =
  | { ok: true; alreadyMarked: false; syncWarning?: string }
  | { ok: true; alreadyMarked: true }
  | { ok: false; message: string; details?: PayStaffBulkTimeOffResult }

async function userHasTimeOffOverlappingDate(userId: string, workDateYmd: string): Promise<boolean> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase
        .from('user_time_off')
        .select('id')
        .eq('user_id', userId)
        .lte('start_date', workDateYmd)
        .gte('end_date', workDateYmd)
        .limit(1),
    'not coming in overlap check',
  )
  return (rows?.length ?? 0) > 0
}

/**
 * Pay-staff path: single-day unpaid `user_time_off` for "not coming in".
 * Uses existing RPC (authz + optional salary sync when Denver today is in range).
 */
export async function recordNotComingInForUserAsStaff(params: {
  subjectUserId: string
  workDateYmd: string
}): Promise<RecordNotComingInForUserAsStaffResult> {
  const { subjectUserId, workDateYmd } = params
  try {
    if (await userHasTimeOffOverlappingDate(subjectUserId, workDateYmd)) {
      return { ok: true, alreadyMarked: true }
    }
    const parsed = await payStaffBulkInsertUserTimeOff({
      userIds: [subjectUserId],
      startDate: workDateYmd,
      endDate: workDateYmd,
      note: NOT_COMING_IN_NOTE,
    })
    if (parsed.error) {
      return { ok: false, message: parsed.error, details: parsed }
    }
    if (parsed.failed.some((f) => f.user_id === subjectUserId)) {
      const msg = parsed.failed.find((f) => f.user_id === subjectUserId)?.message ?? 'Insert failed'
      return { ok: false, message: msg, details: parsed }
    }
    if (!parsed.inserted.includes(subjectUserId)) {
      return {
        ok: false,
        message: 'Time off was not recorded. Check permissions for this team member.',
        details: parsed,
      }
    }
    const syncErr = parsed.sync_failed.find((f) => f.user_id === subjectUserId)?.message
    return { ok: true, alreadyMarked: false, ...(syncErr ? { syncWarning: syncErr } : {}) }
  } catch (e) {
    return { ok: false, message: formatErrorMessage(e, 'Could not save time off') }
  }
}

/** Self-serve insert (RLS: own user only). Returns overlap skip same as staff path. */
export async function recordNotComingInSelf(params: {
  userId: string
  workDateYmd: string
}): Promise<RecordNotComingInForUserAsStaffResult> {
  const { userId, workDateYmd } = params
  try {
    if (await userHasTimeOffOverlappingDate(userId, workDateYmd)) {
      return { ok: true, alreadyMarked: true }
    }
    await withSupabaseRetry(
      async () =>
        supabase.from('user_time_off').insert({
          user_id: userId,
          start_date: workDateYmd,
          end_date: workDateYmd,
          kind: 'unpaid',
          note: NOT_COMING_IN_NOTE,
        }),
      'not coming in self insert',
    )
    return { ok: true, alreadyMarked: false }
  } catch (e) {
    return { ok: false, message: formatErrorMessage(e, 'Could not save time off') }
  }
}

/**
 * No-call-no-show from the Schedule Dispatch hub's assign picker (v2.2540).
 *
 * ORDER MATTERS. The incident RPC runs while the day's schedule blocks still
 * exist — with zero clock sessions it accepts the incident only as "scheduled,
 * no clock time", so clearing the blocks first would make it refuse. When the
 * RPC refuses (open session, already recorded, access denied) nothing else
 * happens: no half-marked day. Once the incident is on record the day is
 * cleared the way "Not coming in" clears it, under the NCNS note so the board
 * chip reads NCNS.
 */
import { NO_CALL_NO_SHOW_NOTE, recordNotComingInForUserAsStaff, type RecordNotComingInForUserAsStaffResult } from '../notComingInTimeOff'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { removePersonDayBlocks } from './removePersonDayBlocks'

export type RecordNcnsForPersonDayResult =
  | { ok: false; message: string }
  | {
      ok: true
      /** Clock sessions the incident rejected. */
      rejectedCount: number
      /** Whether any of them had been approved — their hours were unwound. */
      hadApprovedSessions: boolean
      /** How the day-off marking that follows the incident came out; the incident stands either way. */
      timeOff: RecordNotComingInForUserAsStaffResult
      removed: number
      failed: number
    }

/**
 * Throws when the incident RPC itself errors (the caller toasts the message);
 * a refusal the RPC reports in its row comes back as `{ ok: false }`.
 */
export async function recordNcnsForPersonDay(args: {
  subjectUserId: string
  workDateYmd: string
  /** Sent as written when not empty; left out otherwise. */
  details: string
  /** The person's blocks on the day, read before anything is written. */
  existingBlockIds: readonly string[]
}): Promise<RecordNcnsForPersonDayResult> {
  const { subjectUserId, workDateYmd, details, existingBlockIds } = args
  const data = await withSupabaseRetry(
    async () =>
      supabase.rpc('record_ncns_and_reject_sessions_for_day', {
        p_subject_user_id: subjectUserId,
        p_work_date: workDateYmd,
        ...(details ? { p_details: details } : {}),
      }),
    'record ncns from dispatch',
  )
  const row = (data ?? [])[0] as
    | { rejected_count: number; had_approved_sessions: boolean; error_message: string | null }
    | undefined
  if (!row || row.error_message) {
    return { ok: false, message: row?.error_message ?? 'Could not record NCNS.' }
  }

  const timeOff = await recordNotComingInForUserAsStaff({
    subjectUserId,
    workDateYmd,
    note: NO_CALL_NO_SHOW_NOTE,
  })
  const { removed, failed } = await removePersonDayBlocks(existingBlockIds)
  return {
    ok: true,
    rejectedCount: row.rejected_count,
    hadApprovedSessions: row.had_approved_sessions,
    timeOff,
    removed,
    failed,
  }
}

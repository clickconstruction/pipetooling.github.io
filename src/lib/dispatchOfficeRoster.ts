import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

/** Standing office schedule (v2.1810/v2.1812): the roster of people who get an
 * automatic weekday Office-job block, each with a daily window (default
 * 08:00–16:00). `ensure_office_schedule_blocks` materializes the blocks for a
 * visible date range — idempotent, time-off- and overlap-aware, and a
 * hand-deleted block is never recreated (tombstone ledger). Reads are
 * universal; writes are the schedule-dispatch cohort including controller.
 * (Tables ship ahead of regenerated types — `as never`, the swim-lanes
 * precedent.) */

export const OFFICE_ROSTER_DEFAULT_START = '08:00'
export const OFFICE_ROSTER_DEFAULT_END = '16:00'

export type OfficeRosterEntry = {
  user_id: string
  /** 'HH:MM' or 'HH:MM:SS' as returned by Postgres time. */
  time_start: string
  time_end: string
}

/** Roles the roster picker offers — the dispatch-group cohort plus controller. */
export function isOfficeRosterEligibleRole(role: string | null | undefined): boolean {
  return role === 'assistant' || role === 'controller' || role === 'estimator'
}

/** '08:00:00' → '8:00 AM' (times are Chicago wall-clock, no TZ math needed). */
export function officeRosterTimeLabel(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  if (!m) return t
  const h = Number(m[1])
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${suffix}`
}

export async function fetchDispatchOfficeRoster(): Promise<{ data: OfficeRosterEntry[]; error: string | null }> {
  try {
    const rows = await withSupabaseRetry(
      async () =>
        await supabase
          .from('dispatch_office_roster' as never)
          .select('user_id, time_start, time_end'),
      'fetchDispatchOfficeRoster',
    )
    return { data: ((rows ?? []) as unknown as OfficeRosterEntry[]), error: null }
  } catch (e: unknown) {
    return { data: [], error: formatErrorMessage(e, 'Could not load the office roster') }
  }
}

export async function addToDispatchOfficeRoster(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('dispatch_office_roster' as never).insert({
    user_id: userId,
    time_start: OFFICE_ROSTER_DEFAULT_START,
    time_end: OFFICE_ROSTER_DEFAULT_END,
  } as never)
  return { error: error ? error.message : null }
}

export async function removeFromDispatchOfficeRoster(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('dispatch_office_roster' as never).delete().eq('user_id', userId)
  return { error: error ? error.message : null }
}

export async function updateDispatchOfficeRosterWindow(
  userId: string,
  timeStart: string,
  timeEnd: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('dispatch_office_roster' as never)
    .update({ time_start: timeStart, time_end: timeEnd } as never)
    .eq('user_id', userId)
  return { error: error ? error.message : null }
}

/** Fill the roster's Office blocks over [fromYmd, toYmd] (≤31 days). Returns rows created. */
export async function ensureOfficeScheduleBlocks(
  fromYmd: string,
  toYmd: string,
): Promise<{ created: number; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('ensure_office_schedule_blocks' as never, {
      p_from: fromYmd,
      p_to: toYmd,
    } as never)
    if (error) return { created: 0, error: error.message }
    const res = data as unknown as { ok?: boolean; created?: number; error?: string } | null
    if (!res?.ok) return { created: 0, error: res?.error ?? 'Could not fill the office schedule' }
    return { created: res.created ?? 0, error: null }
  } catch (e: unknown) {
    return { created: 0, error: formatErrorMessage(e, 'Could not fill the office schedule') }
  }
}

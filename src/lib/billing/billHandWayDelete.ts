/**
 * Deleting a way nobody used (punch list #443, row 3): the take-back of **Add to the list** on Bills sent.
 *
 * **Take off** retires a way and keeps its row, so a way a walk added stands under *Taken off* for good. The table
 * has let a dev delete a row since it was made (`bill_hand_ways_delete_dev`), and nothing called it. This is the
 * rule for the press that does. Pure: the reads and the delete are `billHandWayDeleteIo.ts`, the press is in
 * `components/billing/BillHandWays.tsx`.
 *
 * - The press is drawn for a dev and for nobody else. View as a sample account is that account, so it draws nothing.
 * - Only a test way goes: its words start with ZZ (`isZzTestName`), the one mark a way can carry.
 * - Only a way already taken off goes, so no form is offering it while it is deleted.
 * - None of the four ways the form began with goes: the oldest records carry their keys, and the form falls back on them.
 * - A way any bill was recorded with stays. The record keeps its own words, and its way stays on file beside it.
 */
import { isZzTestName } from '../../../supabase/functions/_shared/zzTestJob'
import { BILL_HAND_WAYS_BUILT_IN, type BillHandWay } from './billHandWays'

/** Who is offered the delete: a dev. Every other role sees nothing new. */
export function handWayDeleteDrawn(role: string | null | undefined): boolean {
  return role === 'dev'
}

const BUILT_IN_KEYS: ReadonlySet<string> = new Set(BILL_HAND_WAYS_BUILT_IN.map((w) => w.key))

/** Why this way can never be deleted, whatever is on record; '' when it may be, once its records are counted. */
export function handWayDeleteProblem(way: BillHandWay): string {
  if (!way.id || BUILT_IN_KEYS.has(way.key)) return 'This is one of the four ways the form began with. It stays.'
  if (!way.retiredAtIso) return 'Take this way off the list first.'
  if (!isZzTestName(way.label)) return 'Only a test way can be deleted. Its name must start with ZZ.'
  return ''
}

/**
 * Why this way stays once its records are counted; '' when nobody used it. `records` is how many bills were recorded
 * with the way, and null when the count could not be read: a way is never deleted on no answer.
 */
export function handWayDeleteUsedProblem(way: BillHandWay, records: number | null): string {
  const fixed = handWayDeleteProblem(way)
  if (fixed) return fixed
  if (records == null || !Number.isFinite(records) || records < 0) return 'The bills recorded with this way could not be counted. Nothing was deleted.'
  if (records === 1) return '1 bill was recorded with this way. It stays.'
  if (records > 1) return `${records} bills were recorded with this way. It stays.`
  return ''
}

/** The confirm window's words. The button names the act. */
export function handWayDeleteConfirm(way: BillHandWay): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Delete the way ${way.label}?`,
    message: 'No bill was recorded with this way. It leaves the list for everyone, and it cannot be brought back.',
    confirmLabel: 'Delete the way',
  }
}

/** What the toast says once it is gone. */
export function handWayDeletedWords(way: BillHandWay): string {
  return `${way.label} was deleted.`
}

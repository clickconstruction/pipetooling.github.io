/**
 * The Day book's queue snapshot, written by the Dashboard (to-dos/day-book, decision 6,
 * v2.3736). The counts the Day book wants for history — deposits still to match, jobs
 * still without a contract — are the Needs You card's own figures, computed by client
 * kernels for a signed-in dev or controller. So that Dashboard records them: once a day
 * per device, when every count has resolved, `record_day_book_queue` upserts the day's
 * row (the last look of the day wins). This file decides WHETHER to write; the hook
 * writes. Pure.
 */
import { canOpenDayBook } from './dayBookAccess'

export const DAY_BOOK_QUEUE_RECORDED_KEY = 'pipetooling_day_book_queue_recorded_v1'

export type QueueCounts = { deposits?: number | null; contracts?: number | null; billing?: number | null }

/**
 * The counts to send, or null when nothing should be written: not a Day book role,
 * nothing resolved yet, or already recorded today on this device.
 */
export function planQueueRecord(input: { role: string | null | undefined; today: string; counts: QueueCounts; lastRecordedDay: string | null }): Record<string, number> | null {
  if (!canOpenDayBook(input.role)) return null
  if (input.lastRecordedDay === input.today) return null
  const out: Record<string, number> = {}
  for (const k of ['deposits', 'contracts', 'billing'] as const) {
    const v = input.counts[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v)
  }
  return Object.keys(out).length > 0 ? out : null
}

/** The day this device last recorded, from storage; null when none or storage is unavailable. */
export function readLastRecordedDay(storage: Pick<Storage, 'getItem'> | null | undefined): string | null {
  try {
    const v = storage?.getItem(DAY_BOOK_QUEUE_RECORDED_KEY) ?? null
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  } catch {
    return null
  }
}

export function writeLastRecordedDay(storage: Pick<Storage, 'setItem'> | null | undefined, day: string): void {
  try {
    storage?.setItem(DAY_BOOK_QUEUE_RECORDED_KEY, day)
  } catch {
    /* storage unavailable — the next load records again, which is harmless (an upsert) */
  }
}

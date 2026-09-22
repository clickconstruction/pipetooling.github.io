/**
 * The Day book's queue snapshot, written by the Dashboard (to-dos/day-book, decision 6,
 * v2.3736; per kind since v2.3743). The counts the Day book wants for history — deposits
 * still to match, jobs still without a contract — are the Needs You card's own figures,
 * computed by client kernels for a signed-in dev or controller. So that Dashboard records
 * them: `record_day_book_queue` upserts a kind the day it resolves, once per kind per day
 * per device (the counts resolve at different moments — the contract nudge before the
 * bank count — so a day is not "done" until every kind has landed). The last write of the
 * day wins. This file decides WHAT to write; the hook writes. Pure.
 */
import { canOpenDayBook } from './dayBookAccess'

export const DAY_BOOK_QUEUE_RECORDED_KEY = 'pipetooling_day_book_queue_recorded_v2'

export type QueueCounts = { deposits?: number | null; contracts?: number | null; billing?: number | null }
export type QueueKind = 'deposits' | 'contracts' | 'billing'
export type RecordedToday = { day: string; kinds: QueueKind[] }

const KINDS: readonly QueueKind[] = ['deposits', 'contracts', 'billing']

/**
 * The counts to send now, or null when nothing should be written: not a Day book role,
 * nothing new resolved, or every resolved kind already recorded today on this device.
 */
export function planQueueRecord(input: { role: string | null | undefined; today: string; counts: QueueCounts; recorded: RecordedToday | null }): Partial<Record<QueueKind, number>> | null {
  if (!canOpenDayBook(input.role)) return null
  const done = input.recorded && input.recorded.day === input.today ? new Set(input.recorded.kinds) : new Set<QueueKind>()
  const out: Partial<Record<QueueKind, number>> = {}
  for (const k of KINDS) {
    if (done.has(k)) continue
    const v = input.counts[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v)
  }
  return Object.keys(out).length > 0 ? out : null
}

/** What this device recorded today, from storage; null when none, another day, or storage is unavailable. */
export function readRecordedToday(storage: Pick<Storage, 'getItem'> | null | undefined, today: string): RecordedToday | null {
  try {
    const raw = storage?.getItem(DAY_BOOK_QUEUE_RECORDED_KEY) ?? null
    if (!raw) return null
    const parsed = JSON.parse(raw) as { day?: unknown; kinds?: unknown }
    if (parsed.day !== today || !Array.isArray(parsed.kinds)) return null
    const kinds = parsed.kinds.filter((k): k is QueueKind => (KINDS as readonly string[]).includes(String(k)))
    return { day: today, kinds }
  } catch {
    return null
  }
}

/** Add the kinds just written to today's record (a new day starts over). */
export function writeRecordedToday(storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined, today: string, kinds: readonly QueueKind[]): void {
  try {
    const prior = readRecordedToday(storage, today)
    const merged = [...new Set([...(prior?.kinds ?? []), ...kinds])]
    storage?.setItem(DAY_BOOK_QUEUE_RECORDED_KEY, JSON.stringify({ day: today, kinds: merged }))
  } catch {
    /* storage unavailable — the next load records again, which is harmless (an upsert) */
  }
}

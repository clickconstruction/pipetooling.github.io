/**
 * Where a filed lien's five days stand, in words (punch list #366): Tex. Prop. Code § 53.055 has the copies sent by
 * the fifth day after the filing, and `serve_due` on the filing is that day, weekend-rolled. The To do row, the
 * Board's chip and the window that mails the copies all say it with these words.
 *
 * A late copy is still mailed and still recorded. The desk says the day it was due and nothing about what the law
 * makes of it. Pure, and small on purpose: the list's kernel reads it without the papers' builders.
 */
import { formatYmdMonthDay } from './billedExpectedPay'

function dayDiff(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00`).getTime()
  const b = new Date(`${toYmd}T12:00:00`).getTime()
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / 86_400_000)
}

/** Where a filing's five days stand today. */
export type LienServeClock = { serveDue: string; daysLeft: number; late: boolean; chip: string; words: string }

/**
 * The clock in words. The chip is short, for a row's edge: *3 days left*, *due today*, *2 days late*. The words follow
 * the row's own *copies to mail*: *by Nov 18*, *today*, *were due Nov 11. Mail them today.* A late copy is still
 * mailed and still recorded; the desk says the day it was due and nothing about what the law makes of it.
 */
export function lienServeClock(serveDue: string | null | undefined, todayYmd: string): LienServeClock {
  const due = (serveDue ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { serveDue: '', daysLeft: 0, late: false, chip: '', words: '' }
  const daysLeft = dayDiff(todayYmd, due)
  const day = formatYmdMonthDay(due)
  if (daysLeft < 0) return { serveDue: due, daysLeft, late: true, chip: daysLeft === -1 ? '1 day late' : `${-daysLeft} days late`, words: `were due ${day}. Mail them today.` }
  if (daysLeft === 0) return { serveDue: due, daysLeft, late: false, chip: 'due today', words: 'today' }
  return { serveDue: due, daysLeft, late: false, chip: daysLeft === 1 ? '1 day left' : `${daysLeft} days left`, words: `by ${day}` }
}

/** The To do row's line under the job (punch list #366): what is owed and by when. */
export function lienServeRowWords(clock: Pick<LienServeClock, 'serveDue' | 'late' | 'daysLeft' | 'words'>): string {
  if (!clock.serveDue) return 'Lien filed · mail its copies'
  if (clock.late) return `Lien filed · its copies ${clock.words}`
  return `Lien filed · mail its copies ${clock.words}`
}

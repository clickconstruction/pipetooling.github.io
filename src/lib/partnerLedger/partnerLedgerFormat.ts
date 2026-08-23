/**
 * Partner ledger display helpers (v2.2116) — the words and short dates the
 * partner's card and Full ledger use so both ends of a card speak the same
 * language and a phone-width screen isn't eaten by ISO dates.
 */
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import type { JournalRow } from './partnerLedgerJournal'
import type { WeekCrossing } from './partnerWeeks'

/** Plain-words direction of a signed balance: + means Click owes the partner. */
export function balanceWords(n: number): string {
  if (n > 0) return 'Click owes you'
  if (n < 0) return 'you owe Click'
  return ''
}

function ymdYear(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  return m ? Number(m[1]) : null
}

/** "May 3" — with the year appended only when it isn't `nowYear` ("May 3, 2025").
 * Garbage passes through unchanged. */
export function shortDate(ymd: string, nowYear: number): string {
  const y = ymdYear(ymd)
  if (y == null) return ymd
  const md = formatWorkDateYmdMonthDayShort(ymd)
  return y === nowYear ? md : `${md}, ${y}`
}

/** "Week of May 3" (year only when it differs from `nowYear`). */
export function weekOfLabel(weekStart: string, nowYear: number): string {
  return `Week of ${shortDate(weekStart, nowYear)}`
}

/** Print-friendly range, always with the year: "May 3 – May 9, 2026";
 * open weeks read "May 3, 2026 – in progress". */
export function weekRangeLabel(weekStart: string, weekEnd: string | null): string {
  const ys = ymdYear(weekStart)
  if (ys == null) return weekStart
  if (!weekEnd) return `${formatWorkDateYmdMonthDayShort(weekStart)}, ${ys} – in progress`
  const ye = ymdYear(weekEnd) ?? ys
  return `${formatWorkDateYmdMonthDayShort(weekStart)} – ${formatWorkDateYmdMonthDayShort(weekEnd)}, ${ye}`
}

/** Labels longer than this clamp to two lines on the card with a "more" toggle. */
export const LONG_LABEL_CHARS = 80
export function isLongLabel(label: string): boolean {
  return label.trim().length > LONG_LABEL_CHARS
}

/** The partner's Full ledger posting label: labor rows read "Labor · 12.86 h"
 * (the date column already says which week); everything else keeps its label. */
export function postingLabel(r: Pick<JournalRow, 'kind' | 'label' | 'hours'>): string {
  if (r.kind === 'labor' && r.hours != null && Number.isFinite(r.hours)) return `Labor · ${r.hours.toFixed(2)} h`
  return r.label
}

const usd = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Signed balance for the card's two ends (v2.2125): "+$60.25" when Click owes
 * the partner, "−$546.39" when the partner owes Click, "$0.00" when even —
 * the same convention as the Full ledger's balance column. */
export function signedBalanceLabel(n: number): string {
  if (n > 0) return `+${usd(n)}`
  if (n < 0) return `−${usd(n)}`
  return usd(0)
}

/** The one-line note under the line that carried the balance across $0. */
export function crossingText(c: Pick<WeekCrossing, 'before' | 'after'>): string {
  if (c.before < 0 && c.after > 0) return `crossed $0 — cleared the ${usd(c.before)} you owed and went ${usd(c.after)} ahead`
  if (c.before > 0 && c.after < 0) return `crossed $0 — used up the ${usd(c.before)} you were ahead and went ${usd(c.after)} behind`
  return ''
}

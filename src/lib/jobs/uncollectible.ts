import type { JobWithDetails } from '../../types/jobWithDetails'
import { jobUncollectible } from '../jobsStagesBoard'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatUsdNoCents } from './jobFormatting'

/** The three columns of 20261007170000, read through one cast until the generated types carry them. */
type UncollectibleColumns = { uncollectible_at?: string | null; uncollectible_by?: string | null; uncollectible_reason?: string | null }

export type UncollectibleFacts = {
  /** The day the office gave up, on the company calendar ('' when the stamp has no day). */
  markedYmd: string
  /** The reason the office typed — the stamp's second line, never empty. */
  reason: string
  /** What was open when the row was read: revenue − payments, floored at 0. */
  open: number
}

/**
 * The facts the stamp prints for a job the office gave up on (punch list #94, v2.4792):
 * null for a job that is not Uncollectible, so a row never wears an empty stamp.
 */
export function uncollectibleFactsFor(job: JobWithDetails): UncollectibleFacts | null {
  if (!jobUncollectible(job)) return null
  const cols = job as JobWithDetails & UncollectibleColumns
  const markedYmd = calendarYmdInAppTzFromIso(cols.uncollectible_at ?? '') || ''
  const reason = (cols.uncollectible_reason ?? '').trim() || 'No reason recorded.'
  const open = Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
  return { markedYmd, reason, open }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 6, 2026" from a Y-M-D; the day as given when it does not parse. */
export function uncollectibleDayWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
}

/** The stamp's last two lines (v2.4819, the owner): the day, then the dollars — "Oct 6, 2026" over "$7,502 given up on". */
export function uncollectibleStampLines(facts: Pick<UncollectibleFacts, 'markedYmd' | 'open'>): { day: string; dollars: string } {
  return {
    day: facts.markedYmd ? uncollectibleDayWords(facts.markedYmd) : 'date unknown',
    dollars: `${formatUsdNoCents(facts.open)} given up on`,
  }
}

/** The same two lines as one, for a screen reader: "Oct 6, 2026 · $7,502 given up on". */
export function uncollectibleStampLine(facts: Pick<UncollectibleFacts, 'markedYmd' | 'open'>): string {
  const { day, dollars } = uncollectibleStampLines(facts)
  return `${day} · ${dollars}`
}

/** The phone card's second line: the reason in quotes, then the day. */
export function uncollectiblePhoneLine(facts: Pick<UncollectibleFacts, 'markedYmd' | 'reason'>): string {
  const when = facts.markedYmd ? uncollectibleDayWords(facts.markedYmd) : null
  return when ? `\u201c${facts.reason}\u201d \u2014 ${when}` : `\u201c${facts.reason}\u201d`
}

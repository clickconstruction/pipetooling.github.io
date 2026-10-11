/**
 * Fix the reading (Bridge redraw PR 4): every gap that makes the page read low
 * or thin, each with what it moves and the door that fixes it, ordered by the
 * dollars it moves. Replaces the Data gaps strip and the Truth check's chip
 * rows. Pure: no React, no Supabase.
 */

export type ReadingGapKey = 'unapproved' | 'cash_drift' | 'cash_typed' | 'assumed_half' | 'no_contract' | 'transfers' | 'card' | 'bids_no_value'

export type ReadingGap = {
  key: ReadingGapKey
  /** The amber chip: "585h unapproved". */
  chip: string
  /** What the gap moves, one sentence. */
  moves: string
  /** Dollars the gap moves, for the order; null when unknown. */
  movesUsd: number | null
  count: number
  door: { to: string; label: string } | null
}

export type ReadingGapsInput = {
  pendingClosedHours: number
  pendingClosedSessions: number
  /** The headline (v2.5216) this week: recorded and approved contribution. */
  headlineRecordedUsd: number | null
  headlineApprovedUsd: number | null
  /** Cash on hand: the bank's figure when synced (v2.5218), the typed figure rolled forward, its day and age. */
  bankUsd: number | null
  typedRolledUsd: number | null
  typedLabel: string | null
  typedDaysAgo: number | null
  assumedHalfJobs: number
  assumedHalfEarnedUsd: number
  noContractJobs: ReadonlyArray<{ id: string; label: string }>
  unattributedNoncard: number | null
  unlinkedCard: number | null
  overheadPerDayUsd: number
  bidsNoValue: number
}

export const CASH_DRIFT_MIN_USD = 1000

const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n) >= 100_000 ? `${(Math.abs(n) / 1000).toFixed(0)}k` : Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : `${Math.round(Math.abs(n))}`}`
const signed = (n: number): string => `${n >= 0 ? '+' : ''}${shortK(n)}`
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`
const n = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const plural = (c: number, one: string, many: string): string => (c === 1 ? one : many)

export const READING_GAP_DOORS = {
  approvals: { to: '/people?tab=hours&approvals=1', label: 'Approve' },
  banking: { to: '/banking?tab=accounting', label: 'Sort' },
  tally: { to: '/jobs?tab=parts', label: 'Sort' },
  stages: { to: '/jobs?tab=stages', label: 'Open the jobs' },
  bids: { to: '/bids', label: 'Open the bids' },
} as const

export function buildReadingGaps(input: ReadingGapsInput): ReadingGap[] {
  const gaps: ReadingGap[] = []

  if (input.pendingClosedHours > 0) {
    const r = input.headlineRecordedUsd
    const a = input.headlineApprovedUsd
    const movesUsd = r != null && a != null ? Math.abs(r - a) : null
    gaps.push({
      key: 'unapproved',
      chip: `${hrs(input.pendingClosedHours)} unapproved`,
      moves: r != null && a != null ? `moves the headline from ${signed(a)} to ≈ ${signed(r)} this week; payroll reads low until then` : `${input.pendingClosedSessions} ${plural(input.pendingClosedSessions, 'session', 'sessions')}; the headline and payroll read low until then`,
      movesUsd,
      count: input.pendingClosedSessions,
      door: READING_GAP_DOORS.approvals,
    })
  }

  if (input.bankUsd != null && input.typedRolledUsd != null && Math.abs(input.typedRolledUsd - input.bankUsd) >= CASH_DRIFT_MIN_USD) {
    const drift = input.typedRolledUsd - input.bankUsd
    gaps.push({
      key: 'cash_drift',
      chip: `${shortK(Math.abs(drift))} of bank flows not in the app`,
      moves: `the figure typed ${input.typedLabel ?? 'earlier'} rolled through the ledger reads ${shortK(input.typedRolledUsd)}, the bank says ${shortK(input.bankUsd)}; the net-position history is off by the same`,
      movesUsd: Math.abs(drift),
      count: 1,
      door: READING_GAP_DOORS.banking,
    })
  } else if (input.bankUsd == null && input.typedLabel) {
    const age = n(input.typedDaysAgo)
    gaps.push({
      key: 'cash_typed',
      chip: `cash typed ${input.typedLabel}`,
      moves: age > 0 ? `rolled ${age} ${plural(age, 'day', 'days')} through bank flows${(input.unattributedNoncard ?? 0) > 0 ? ` that include ${n(input.unattributedNoncard).toLocaleString('en-US')} unsorted transfers` : ''}; the bank could not be read` : 'the bank could not be read, so the typed figure stands',
      movesUsd: null,
      count: 1,
      door: null,
    })
  }

  if (input.assumedHalfJobs > 0) {
    gaps.push({
      key: 'assumed_half',
      // "worked this window": the earned jobs are the ones with field hours in the window, a narrower count than the percents strip's open jobs (v2.5245).
      chip: `${input.assumedHalfJobs} ${plural(input.assumedHalfJobs, 'job', 'jobs')} worked this window with no % complete`,
      moves: `${shortK(input.assumedHalfEarnedUsd)} of earned rests on "assumed half done"; set the % and the rate firms up either way`,
      movesUsd: input.assumedHalfEarnedUsd,
      count: input.assumedHalfJobs,
      door: READING_GAP_DOORS.stages,
    })
  }

  if (input.noContractJobs.length > 0) {
    const labels = input.noContractJobs.slice(0, 4).map((j) => j.label)
    const more = input.noContractJobs.length - labels.length
    gaps.push({
      key: 'no_contract',
      chip: `${input.noContractJobs.length} worked ${plural(input.noContractJobs.length, 'job', 'jobs')} with no contract $`,
      moves: `their hours earned $0 and every day on them reads red: ${labels.join(', ')}${more > 0 ? ` and ${more} more` : ''}; put the price on the job`,
      movesUsd: null,
      count: input.noContractJobs.length,
      door: READING_GAP_DOORS.stages,
    })
  }

  if ((input.unattributedNoncard ?? 0) > 0) {
    const c = n(input.unattributedNoncard)
    gaps.push({
      key: 'transfers',
      chip: `${c.toLocaleString('en-US')} bank transfers unsorted`,
      moves: `rent, insurance, trucks and loans in there hit the bank and never the paper; overhead reads ${shortK(input.overheadPerDayUsd)}/day and is not`,
      movesUsd: null,
      count: c,
      door: READING_GAP_DOORS.banking,
    })
  }

  if ((input.unlinkedCard ?? 0) > 0) {
    const c = n(input.unlinkedCard)
    gaps.push({ key: 'card', chip: `${c.toLocaleString('en-US')} card purchases unsorted`, moves: 'job parts on the bank, not on a job; job costs read low', movesUsd: null, count: c, door: READING_GAP_DOORS.tally })
  }

  if (input.bidsNoValue > 0) {
    gaps.push({ key: 'bids_no_value', chip: `${input.bidsNoValue} ${plural(input.bidsNoValue, 'bid', 'bids')} sent with no value`, moves: 'Vectors reads them as $0 sent; put the bid value on each', movesUsd: null, count: input.bidsNoValue, door: READING_GAP_DOORS.bids })
  }

  // Dollars first, biggest first; the rest keep the order above.
  return gaps
    .map((g, i) => ({ g, i }))
    .sort((a, b) => {
      const au = a.g.movesUsd
      const bu = b.g.movesUsd
      if (au != null && bu != null && au !== bu) return bu - au
      if (au != null && bu == null) return -1
      if (au == null && bu != null) return 1
      return a.i - b.i
    })
    .map(({ g }) => g)
}

/**
 * Draft Payroll's Cash Due as bars (punch list #217, people-docs-1, a prototype). Today the window
 * reads *4 of 9 paid · Total: $11,482.50 | Left: $6,210.00* over a Status column, and nothing on a
 * cell says whether its figure is money already sent, a report's net still owed, or a live estimate
 * from the hours with no report yet. This kernel turns the same facts into bars: one per row with
 * up to four parts (paid · owed on the report · withheld · an estimate, hatched), and the period's
 * bar under the dates with the same parts summed, in place of the *Total | Left* sentence. It also
 * says which figures wear the *est.* chip, which rows wear *salary 8h*, and which rows carry an amber
 * dot for clock sessions still waiting on approval. Pure: the modal computes a row's facts the way
 * it always has and the component draws fractions.
 *
 * The figure in the $ column stays `draftPayrollRowCashDue` (the report's gross when one exists,
 * else the live estimate), so the bars never change what the window pays; they say what it is made
 * of. A report's parts are its net split into paid and still owed, plus what the deductions withheld
 * (gross − net); a report whose additional lines lift its net past its gross draws the bar to the
 * larger figure, so no part is hidden.
 */

import { draftPayrollRowCashDue } from '../draftPayrollPreviewCost'
import { formatCurrency } from '../format'
import { isPayStubFullyPaid, remainingPayStubBalance } from '../payStubPayments'

export type DraftPayrollBarPartKind = 'paid' | 'owed' | 'withheld' | 'estimate'

export type DraftPayrollBarPart = {
  kind: DraftPayrollBarPartKind
  amount: number
  /** Share of the bar's width, 0–1. */
  fraction: number
  /** Inside the part when it is wide enough: *paid Fri*, *owed $872*, *no report yet*. */
  label: string
  /** The hover: the whole sentence. */
  title: string
}

/** Today's Status column, kept for the screen reader and the hover. */
export type DraftPayrollRowStatus = 'Paid' | 'Partial' | 'Report only' | 'Review' | 'Ready' | 'No hours'

export type DraftPayrollRowBarInput = {
  person: string
  /** The hours the row prints; zero with no estimate is *No hours*. */
  hours: number
  /** The live estimate from the hours for the period. */
  estGross: number
  /** The report for the period, when one exists. */
  report: {
    gross: number
    /** Net pay: gross less deductions plus additional lines. */
    net: number
    paidSum: number
    /** The last payment's day as `YYYY-MM-DD`, for *paid Fri*; null when nothing is paid yet. */
    paidYmd: string | null
  } | null
  isSalary: boolean
  /** Days in the period that need the Correct row or a job before a report can be made. */
  reviewCount: number
  /** Clock sessions of this person in the period neither approved nor rejected. */
  pendingSessions: number
}

export type DraftPayrollRowBar = {
  person: string
  /** The $ column: `draftPayrollRowCashDue`. */
  cashDue: number
  /** The figure is a live estimate: wears *est.*. */
  estimated: boolean
  /** Flat salaried hours: wears *salary 8h*. */
  salaryFlat: boolean
  pendingSessions: number
  status: DraftPayrollRowStatus
  /** The bar's scale in dollars: the cash due, or the parts when a report's net runs past its gross. */
  scale: number
  parts: DraftPayrollBarPart[]
  /** One sentence for the hover and the screen reader. */
  words: string
}

export type DraftPayrollPeriodBar = {
  /** *This period · $11,482.50 · 4 of 9 paid* — paid against the people with pay due this period, not the roster. */
  caption: string
  /** The hover: the roster's size and how many of them have pay due this period. */
  captionTitle: string
  /** Σ cash due, the figure *Total* printed. */
  total: number
  paidCount: number
  /** People with pay due this period: a report, or hours, or an estimate; the roster's zero-hour people are not here. */
  dueCount: number
  rosterCount: number
  parts: DraftPayrollBarPart[]
}

export type DraftPayrollBars = {
  rows: DraftPayrollRowBar[]
  period: DraftPayrollPeriodBar
}

/** The short chip on a salaried row; the long words and the hover come from the approvals queue. */
export const SALARY_FLAT_HOURS_SHORT_CHIP = 'salary 8h'
export const ESTIMATE_CHIP = 'est.'
export const ESTIMATE_CHIP_TITLE = 'An estimate from the hours and the wage. No report exists yet, so nothing is fixed.'

export const PART_WORDS: Record<DraftPayrollBarPartKind, string> = {
  paid: 'paid',
  owed: 'owed on a report',
  withheld: 'withheld',
  estimate: 'no report yet',
}

/** Inside the period bar's parts, where room is short (the owner, 2026-10-30: *owed $2,309.20*, not *owed on a report $2,309.20*). */
export const PART_SHORT_WORDS: Record<DraftPayrollBarPartKind, string> = {
  paid: 'paid',
  owed: 'owed',
  withheld: 'withheld',
  estimate: 'no report',
}

const EPS = 0.004
const round2 = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => `$${formatCurrency(n)}`
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** `2026-10-23` → `Fri`; '' for anything else. A day, never an instant, so no zone is read. */
export function paidDayWords(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : WEEKDAY[d.getDay()] ?? ''
}

/** How many sessions wait, as the dot's words: *2 waiting*. */
export function pendingDotWords(n: number): string {
  return `${n} waiting`
}

export function pendingDotTitle(n: number): string {
  return `${n} clock session${n === 1 ? '' : 's'} of theirs in this period still need${n === 1 ? 's' : ''} approval, so this cash due is short by ${n === 1 ? 'it' : 'them'}. Hours → Pending sessions.`
}

/** The chip in the button row that replaces the amber banner: *3 sessions await approval ›*. */
export function pendingChipWords(n: number): string {
  return `${n} session${n === 1 ? '' : 's'} await${n === 1 ? 's' : ''} approval ›`
}

export function pendingChipTitle(n: number): string {
  return `${n} clock session${n === 1 ? '' : 's'} in this period still need${n === 1 ? 's' : ''} approval (Hours → Pending sessions). Approve them and the cash due catches up.`
}

function frac(amount: number, scale: number): number {
  return scale > EPS ? Math.max(0, Math.min(1, amount / scale)) : 0
}

export function draftPayrollRowStatus(input: Pick<DraftPayrollRowBarInput, 'estGross' | 'report' | 'reviewCount'>): DraftPayrollRowStatus {
  if (input.report) {
    const paid = isPayStubFullyPaid(input.report.net, input.report.paidSum)
    if (paid) return 'Paid'
    return input.report.paidSum > 0 ? 'Partial' : 'Report only'
  }
  if (input.estGross > EPS) return input.reviewCount > 0 ? 'Review' : 'Ready'
  return 'No hours'
}

export function draftPayrollRowBar(input: DraftPayrollRowBarInput): DraftPayrollRowBar {
  const status = draftPayrollRowStatus(input)
  const cashDue = round2(draftPayrollRowCashDue(input.report?.gross, input.estGross))
  const parts: DraftPayrollBarPart[] = []
  let scale = cashDue
  if (input.report) {
    const r = input.report
    const fullyPaid = isPayStubFullyPaid(r.net, r.paidSum)
    const paid = round2(fullyPaid ? r.net : Math.min(r.paidSum, r.net))
    const owed = round2(fullyPaid ? 0 : remainingPayStubBalance(r.net, r.paidSum))
    const withheld = round2(Math.max(0, r.gross - r.net))
    scale = round2(Math.max(cashDue, paid + owed + withheld))
    if (paid > EPS) {
      const day = paidDayWords(r.paidYmd)
      parts.push({
        kind: 'paid',
        amount: paid,
        fraction: frac(paid, scale),
        label: fullyPaid ? (day ? `paid ${day}` : 'paid') : usd(paid),
        title: `${usd(paid)} paid${day ? ` on ${day}` : ''}`,
      })
    }
    if (owed > EPS) {
      parts.push({
        kind: 'owed',
        amount: owed,
        fraction: frac(owed, scale),
        // *report due* (the owner, 2026-10-30), not *owed on the report*.
        label: paid > EPS ? `owed ${usd(owed)}` : 'report due',
        title: `${usd(owed)} still owed on the report (its net less what is paid)`,
      })
    }
    if (withheld > EPS) {
      parts.push({
        kind: 'withheld',
        amount: withheld,
        fraction: frac(withheld, scale),
        label: usd(withheld),
        title: `${usd(withheld)} withheld by the report's deductions`,
      })
    }
  } else if (input.estGross > EPS) {
    parts.push({
      kind: 'estimate',
      amount: round2(input.estGross),
      fraction: 1,
      label: 'no report yet',
      title: `${usd(input.estGross)} estimated from the hours. No report yet.`,
    })
  }
  const words =
    parts.length === 0
      ? status === 'No hours'
        ? 'No hours in this period'
        : 'Nothing due'
      : parts.map((p) => p.title).join(' · ')
  return {
    person: input.person,
    cashDue,
    estimated: !input.report && input.estGross > EPS,
    salaryFlat: input.isSalary && input.hours > EPS,
    pendingSessions: Math.max(0, Math.floor(input.pendingSessions)),
    status,
    scale,
    parts,
    words: input.pendingSessions > 0 ? `${words}. ${pendingDotTitle(input.pendingSessions)}` : words,
  }
}

const ORDER: DraftPayrollBarPartKind[] = ['paid', 'owed', 'withheld', 'estimate']

/** Whole-number shares that add to 100 (largest remainder), so *69% · 31%* never reads *69% · 30%*. */
export function wholeShares(fractions: ReadonlyArray<number>): number[] {
  const raw = fractions.map((f) => Math.max(0, f) * 100)
  const floors = raw.map((r) => Math.floor(r))
  const total = raw.reduce((s, r) => s + r, 0)
  let left = Math.round(total) - floors.reduce((s, f) => s + f, 0)
  const order = raw
    .map((r, i) => ({ i, rest: r - Math.floor(r) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] = (floors[i] ?? 0) + 1
    left -= 1
  }
  return floors
}

/** A row with pay due this period: a report, or hours, or an estimate. The roster's zero-hour people are not counted. */
export function rowHasPayDue(input: Pick<DraftPayrollRowBarInput, 'report' | 'hours' | 'estGross'>): boolean {
  return input.report != null || input.hours > EPS || input.estGross > EPS
}

/**
 * Every row's bar and the period's bar summed from them. The caption counts paid against the people with pay
 * due this period (the owner, 2026-10-30: *8 of 27 paid* read as if 19 were owed when the roster's other 18 had
 * no hours this week; the honest count is *8 of 9*). `rowsIn` is the whole roster, shown or not.
 */
export function draftPayrollBars(rowsIn: ReadonlyArray<DraftPayrollRowBarInput>): DraftPayrollBars {
  const rows = rowsIn.map(draftPayrollRowBar)
  const rosterCount = rowsIn.length
  const dueCount = rowsIn.filter(rowHasPayDue).length
  const sums = new Map<DraftPayrollBarPartKind, number>()
  for (const row of rows) for (const p of row.parts) sums.set(p.kind, round2((sums.get(p.kind) ?? 0) + p.amount))
  const total = round2(rows.reduce((s, r) => s + r.cashDue, 0))
  const partsTotal = round2(ORDER.reduce((s, k) => s + (sums.get(k) ?? 0), 0))
  const scale = Math.max(total, partsTotal)
  const kinds = ORDER.filter((k) => (sums.get(k) ?? 0) > EPS)
  // The share beside each figure (the owner, 2026-10-30: *paid $X (69%) · no report $Y (31%)*).
  const shares = wholeShares(kinds.map((k) => frac(sums.get(k) ?? 0, scale)))
  const parts: DraftPayrollBarPart[] = kinds.map((k, i) => {
    const amount = sums.get(k) ?? 0
    return {
      kind: k,
      amount,
      fraction: frac(amount, scale),
      label: `${PART_SHORT_WORDS[k]} ${usd(amount)} (${shares[i] ?? 0}%)`,
      title: `${usd(amount)} ${PART_WORDS[k]} · ${shares[i] ?? 0}% of the period`,
    }
  })
  const paidCount = rows.filter((r) => r.status === 'Paid').length
  return {
    rows,
    period: {
      caption: `This period · ${usd(total)} · ${paidCount} of ${dueCount} paid`,
      captionTitle: `${dueCount} of the ${rosterCount} on the roster have pay due this period (a report, hours or an estimate); ${paidCount} of them ${paidCount === 1 ? 'is' : 'are'} paid in full.`,
      total,
      paidCount,
      dueCount,
      rosterCount,
      parts,
    },
  }
}

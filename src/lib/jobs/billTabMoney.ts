/**
 * Edit Job → Bill, the money card and Make a bill (v2.4307): what the card says about the job's
 * money and about each line on it, and what Make a bill's one big button does. Pure; the card
 * (`JobFormMoneyCard`) and Make a bill (`JobFormMakeABill`) are thin renders over it.
 *
 * Read against prod before building (2026-10-01): no line has ever carried its own progress or
 * stage dates, so "done" is the job's % done, drawn as one marker across the line blocks; and a
 * bill made by amount names no line, so a line it pays for reads "covered" from the coverage
 * waterfall (`dollarCoverageForSegments`), the same one the ② strip hatched with.
 */
import type { EditJobBillingBar } from './editJobBillingBar'
import type { JobBarSegment, JobDollarCoverage } from './jobSegmentsCoverage'
import type { StagePlan, StagePlanRow } from './stagePlan'
import { drawRowLabel, upcomingDrawRows } from './stagePlanForm'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

const cents = (n: number | null | undefined): number => {
  const v = Number(n ?? 0)
  return Number.isFinite(v) ? Math.round(v * 100) : 0
}

/** "$3,600" for whole dollars, "$6,077.51" otherwise. */
export function dollarWords(n: number): string {
  const c = cents(n)
  const whole = c % 100 === 0
  return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

export type BillTabFigures = {
  total: number
  /** The job's % done, 0–100; null when nobody has set it. */
  pctDone: number | null
  /** % done × the job total; null without a % done. */
  done: number | null
  paid: number
  billedOpen: number
  drafted: number
  leftToBill: number
  /** Work done past the money already paid or on a bill (never more than is left); null without a % done. */
  doneNotBilled: number | null
}

/** The card's figures, from the same bar the old ① money bar drew (so they add up the same way). */
export function billTabFigures(
  bar: Pick<EditJobBillingBar, 'total' | 'paid' | 'billedUnpaid' | 'draft' | 'remaining'>,
  pctComplete: number | null | undefined,
): BillTabFigures {
  const raw = pctComplete == null ? NaN : Number(pctComplete)
  const pctDone = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : null
  const doneCents = pctDone == null ? null : Math.round((cents(bar.total) * pctDone) / 100)
  const spokenForCents = cents(bar.total) - cents(bar.remaining)
  const doneNotBilledCents = doneCents == null ? null : Math.min(cents(bar.remaining), Math.max(0, doneCents - spokenForCents))
  return {
    total: bar.total,
    pctDone,
    done: doneCents == null ? null : doneCents / 100,
    paid: bar.paid,
    billedOpen: bar.billedUnpaid,
    drafted: bar.draft,
    leftToBill: bar.remaining,
    doneNotBilled: doneNotBilledCents == null ? null : doneNotBilledCents / 100,
  }
}

export type WholeRestKind = 'move_to_ready_to_bill' | 'bill_customer' | 'new_invoice'
export type WholeRestAction = { kind: WholeRestKind; amount: number; label: string; hint: string }

/**
 * Make a bill's big button: everything still carvable, as one move. The moves are the ones the
 * old amount box made when it held the whole remainder: a Working job moves to Ready to Bill, a
 * Ready to Bill job opens Bill Customer, any other job gets one new bill for the rest.
 */
export function wholeRestAction(jobStatus: string | null | undefined, carvable: number): WholeRestAction | null {
  const c = cents(carvable)
  if (!(c > 0)) return null
  const amount = c / 100
  const money = dollarWords(amount)
  if (jobStatus === 'working') {
    return { kind: 'move_to_ready_to_bill', amount, label: `Move to Ready to Bill · ${money}`, hint: 'All of it as one bill. The job moves to Ready to Bill.' }
  }
  if (jobStatus === 'ready_to_bill') {
    return { kind: 'bill_customer', amount, label: `Bill Customer · ${money}`, hint: 'Opens Bill Customer for all of it.' }
  }
  return { kind: 'new_invoice', amount, label: `Bill the rest · ${money}`, hint: 'All of it as one new bill.' }
}

/**
 * Make a bill's heading. `carvable` is what the amount box can still bill (a Ready to Bill draft
 * of the whole rest counts, since a piece can be cut off it); `leftToBill` is the card's figure,
 * which counts that draft as already drafted. When they differ, the money sits on the draft.
 */
export function makeABillHeading(carvable: number, leftToBill: number): string | null {
  if (!(cents(carvable) > 0)) return null
  return cents(carvable) > cents(leftToBill) ? `${dollarWords(carvable)} on the Ready to Bill draft` : `${dollarWords(carvable)} left to bill`
}

export type BillTabLineTone = 'green' | 'blue' | 'draft' | 'amber' | 'muted'

export type BillTabLine = {
  /** The fixture id, or 'riders' for the hazmat fees. */
  key: string
  /** "Draw 2 · Top out", "◆ Repipe", or the plain name. */
  label: string
  amount: number
  /** Where the work stands, only when the job has stage dates or a report on it: "passed Sep 26". */
  workWords: string | null
  /** Where the money stands: "paid Sep 22", "billed Sep 29 · open", "covered", "not billed"… */
  moneyWords: string
  tone: BillTabLineTone
  /** Can be ticked for a bill of picked lines (unbilled and not covered to the cent). */
  selectable: boolean
  /** The stage rule says this one is ready: it gets Bill it. */
  billIt: boolean
  /** Money billed by amount that the waterfall counts against this line. */
  coveredDollars: number
}

const day = (ymd: string | null | undefined): string | null => (ymd ? formatWorkDateYmdMonthDayShort(ymd) : null)
const withDay = (word: string, ymd: string | null | undefined): string => {
  const d = day(ymd)
  return d ? `${word} ${d}` : word
}

/** The work half of a plan row's state line, without its stage number, its draw, or the default "not scheduled". */
function workWordsOf(r: StagePlanRow): string | null {
  if (r.kind === 'order') {
    if (r.work === 'none') return null
    const parts = r.stateParts.slice(1, -1).map((p) => p.text)
    return parts.length ? parts.join(' · ') : null
  }
  if (r.kind === 'any') {
    if (r.work === 'none' && r.badge !== 'any-done') return null
    const parts = r.stateParts.slice(0, -1).map((p) => p.text.replace(/^◆\s*/, ''))
    return parts.length ? parts.join(' · ') : null
  }
  return null
}

/**
 * One row per block on the card's bar, in the bar's order: what the line is, where its work and
 * its money stand, and whether it can be ticked or billed on its own. The same rules the old strip,
 * its rows and Still to bill used: a line on a bill reads that bill's state, a line a bill made by
 * amount covers to the cent reads "covered" and locks, and the Stage Plan decides what is ready.
 */
export function billTabLines(args: {
  segments: ReadonlyArray<JobBarSegment>
  coverage?: JobDollarCoverage | null
  plan?: StagePlan | null
}): BillTabLine[] {
  const { segments, coverage = null, plan = null } = args
  const upcoming = new Map(plan ? upcomingDrawRows(plan, coverage).map((r) => [r.fixtureId, r] as const) : [])
  const hasOrder = (plan?.orderCount ?? 0) > 0
  const fullyCoveredIds = new Set(Object.entries(coverage?.bySegmentKey ?? {}).filter(([, c]) => c.fullyCovered).map(([k]) => k))

  const waitsWords = (r: StagePlanRow): string => {
    const blocker = plan?.rows.find(
      (p) => p.kind === 'order' && p.number != null && r.number != null && p.number < r.number && !p.invoiceId && p.amount > 0 && !fullyCoveredIds.has(p.fixtureId),
    )
    return blocker ? `waits on stage ${blocker.number}` : 'waits on the stage above'
  }

  return segments.map((seg) => {
    const row = plan && seg.kind === 'line' ? (plan.byFixtureId.get(seg.key) ?? null) : null
    const cov = coverage?.bySegmentKey[seg.key]
    const coveredCents = Math.min(cents(seg.dollars), cents(cov?.coveredDollars))
    const fully = !!cov?.fullyCovered
    const up = upcoming.get(seg.key)
    let moneyWords: string
    let tone: BillTabLineTone
    if (seg.status === 'paid') {
      moneyWords = withDay('paid', row?.drawOn)
      tone = 'green'
    } else if (seg.status === 'billed') {
      moneyWords = `${withDay('billed', row?.drawOn)} · open`
      tone = 'blue'
    } else if (seg.status === 'ready_to_bill') {
      moneyWords = 'on a draft'
      tone = 'draft'
    } else if (fully) {
      moneyWords = 'covered'
      tone = 'blue'
    } else {
      let base: string
      if (up?.draw === 'ready') {
        base = 'ready to bill'
        tone = 'amber'
      } else {
        tone = 'muted'
        if (up?.draw === 'waits' && row) base = waitsWords(row)
        else if (row?.kind === 'order') base = row.work === 'passed' ? 'after the stage above' : 'after it passes inspection'
        else if (row && row.kind == null && hasOrder) base = 'with the final draw'
        else base = 'not billed'
      }
      if (coveredCents > 0) {
        moneyWords = `${dollarWords(coveredCents / 100)} of ${dollarWords(seg.dollars)} covered · ${base}`
        if (tone === 'muted') tone = 'blue'
      } else {
        moneyWords = base
      }
    }
    return {
      key: seg.key,
      label: row ? drawRowLabel(row) : seg.label,
      amount: seg.dollars,
      workWords: row ? workWordsOf(row) : null,
      moneyWords,
      tone,
      selectable: seg.selectable && !fully,
      billIt: up?.draw === 'ready',
      coveredDollars: coveredCents / 100,
    }
  })
}

/** A one-line job with nothing to tick or bill needs no line list: the figures already say it all. */
export function showBillTabLines(lines: ReadonlyArray<BillTabLine>): boolean {
  return lines.length >= 2 || lines.some((l) => l.selectable || l.billIt)
}

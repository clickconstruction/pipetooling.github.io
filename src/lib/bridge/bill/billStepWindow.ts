/**
 * The Bill step window's rows and words (spike candidate 9, punch list #303, drawn in
 * `to-dos/bridge-one-story/desks.html`, section 4). The window opens on the dollars with no bill and the
 * few things to do this week, one press each. Everything `billDesk.ts` finds stays, behind a row or a fold.
 * This kernel only picks the rows and writes their words. It reads the desk as built and counts nothing new,
 * except the office's weekly pace, which is the pipe's billed dollars over the pipe's weeks (the page passes
 * the same figure as the pace). Every sentence here is held to the plain-words rule by `billStepWindow.test.ts`.
 * Pure: no React, no Supabase.
 */
import { stageUsd } from '../stageFlow'
import { BILL_SAME_DAY_TOLERANCE_DAYS, BILL_SCORECARD_WEEKS, labelInWords, type BillDesk, type BillDeskFacts, type BillLeak } from './billDesk'

/** How many single jobs lead *Do this week* before the rows that speak for a group. */
export const BILL_STEP_TOP_JOBS = 2

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** Said in *Do this week* when no row stands: what was looked for and not found. */
export const BILL_STEP_NOTHING = 'No job is ready to bill, and none has a part-bill waiting.'

export type BillStepRowKind = 'ready' | 'remainder' | 'never-billed' | 'no-price' | 'hand-marked'

export type BillStepRow = {
  key: string
  kind: BillStepRowKind
  title: string
  sub: string
  /** The press's words. */
  press: string
  /** The press's words while its list is open under the row. */
  pressOpen?: string
  /** The page the press opens. Absent when the press opens a list under the row. */
  to?: string
}

export type BillStepWords = {
  headline: string
  line: string
  /** *Do this week*: the ready jobs as one row, the two largest single jobs, then the jobs with no price as one row. */
  doRows: BillStepRow[]
  /** The jobs behind the no-price row, as the leaks list them. */
  noPrice: BillLeak[]
  /** *Did the customer get these?*: the bills marked billed by hand, as one row. */
  askRows: BillStepRow[]
  /** "52 of 80 bills went out the day the job finished." Null while the desk's reads are in flight. */
  ruleLine: string | null
  /** The leaks behind *Every leak*. Null while the desk's reads are in flight. */
  leakCount: number | null
}

/** "this week", "last week", "4 weeks ago". */
function weeksAgo(days: number): string {
  if (days < 7) return 'this week'
  const w = Math.floor(days / 7)
  return w === 1 ? 'last week' : `${w} weeks ago`
}

const jobName = (l: BillLeak): string => (l.label ? labelInWords(l.label) : 'a job with no name')

/** The headline: the finished work with no bill, ready jobs included. The pipe's own figure, so it shows at once. */
export function billStepHeadline(facts: BillDeskFacts): string {
  const unbilled = facts.pipe.unbilledUsd
  return Math.round(unbilled) > 0 ? `${stageUsd(unbilled)} of finished work has no bill.` : 'Every finished job has a bill.'
}

/** The line under it: the office's weekly pace, and the pile said in weeks of it. */
export function billStepLine(facts: BillDeskFacts): string {
  const { unbilledUsd, billedUsd, windowWeeks } = facts.pipe
  const perWeek = windowWeeks > 0 ? billedUsd / windowWeeks : 0
  if (!(Math.round(perWeek) > 0)) return 'The office sent no bill in this window.'
  const pace = `The office bills ${stageUsd(perWeek)} a week.`
  if (!(Math.round(unbilledUsd) > 0)) return pace
  const n = Math.round(unbilledUsd / perWeek)
  const weeks = n < 1 ? 'under one week' : n === 1 ? 'about one week' : `about ${n} weeks`
  return `${pace} So this is ${weeks} of work.`
}

function jobRow(l: BillLeak): BillStepRow {
  const key = `${l.kind}:${l.jobId}`
  if (l.kind === 'never-billed') {
    const when = l.satDays == null ? 'Finished and never billed.' : `Finished ${weeksAgo(l.satDays)} and never billed.`
    return { key, kind: 'never-billed', title: `Bill ${jobName(l)}`, sub: `${l.amountText}. ${when}`, press: 'Bill it', to: l.door.to }
  }
  const when = l.partBilledDays == null ? 'The rest has no bill.' : `Part-billed ${weeksAgo(l.partBilledDays)}.`
  return { key, kind: 'remainder', title: `Bill the rest of ${jobName(l)}`, sub: `${l.amountText} left. ${when}`, press: 'Open the bill', to: l.door.to }
}

export function billStepWords(facts: BillDeskFacts, desk: BillDesk | null): BillStepWords {
  const headline = billStepHeadline(facts)
  const line = billStepLine(facts)
  if (!desk) return { headline, line, doRows: [], noPrice: [], askRows: [], ruleLine: null, leakCount: null }

  const doRows: BillStepRow[] = []
  const ready = desk.fast.length
  const readyDoor = desk.fast[0]?.door.to
  if (ready > 0 && readyDoor) {
    doRows.push({ key: 'ready', kind: 'ready', title: `Bill ${ready} ${plural(ready, 'job', 'jobs')} marked ready to bill`, sub: `${stageUsd(desk.fastUsd)}. The office already called ${plural(ready, 'it', 'them')} done.`, press: 'Open Billing', to: readyDoor })
  }
  // The leaks arrive biggest dollars first; a job with no price carries none and speaks in the row after these.
  for (const l of desk.leaks.filter((x) => x.kind === 'remainder' || x.kind === 'never-billed').slice(0, BILL_STEP_TOP_JOBS)) doRows.push(jobRow(l))
  const noPrice = desk.leaks.filter((l) => l.kind === 'no-price')
  if (noPrice.length > 0) {
    const n = noPrice.length
    doRows.push({ key: 'no-price', kind: 'no-price', title: `Price ${n} ${plural(n, 'job that has', 'jobs that have')} hours`, sub: `With no price ${plural(n, 'its', 'their')} work never bills.`, press: 'Set prices', pressOpen: 'Hide the jobs' })
  }

  const askRows: BillStepRow[] = []
  const hand = desk.handMarked.length
  if (hand > 0) {
    askRows.push({ key: 'hand-marked', kind: 'hand-marked', title: `${hand} ${plural(hand, 'bill', 'bills')} marked billed by hand`, sub: `${stageUsd(desk.handMarkedUsd)}. Nothing on record went out.`, press: hand === 1 ? 'See it' : `See the ${hand}`, pressOpen: hand === 1 ? 'Hide it' : `Hide the ${hand}` })
  }

  const s = desk.scorecard
  const ruleLine =
    s.withReady === 0
      ? `No bill of the last ${BILL_SCORECARD_WEEKS} pay weeks has a ready day on record.`
      : s.withReady === 1
        ? s.sameDay === 1
          ? 'The one bill sent went out the day the job finished.'
          : 'The one bill sent went out after the day the job finished.'
        : `${s.sameDay} of ${s.withReady} bills went out the day the job finished.`

  return { headline, line, doRows, noPrice, askRows, ruleLine, leakCount: desk.leaks.length }
}

/** *How this is counted*: the old footnote in plain words, with no name a database gives a thing. */
export function billHowCounted(): string[] {
  const tol = BILL_SAME_DAY_TOLERANCE_DAYS
  return [
    'The headline is all finished work with no bill, ready jobs included.',
    "Finished work is each job's percent done times its price.",
    'What bills or payments already cover comes off. The larger of the two is used.',
    'A job the office marked ready to bill counts all it has left.',
    'A job with no price lists here when the crew logged hours on it in this window.',
    "The office's weekly pace is what it billed in this window, split over its weeks.",
    'The ready day is the day the office marked the job ready to bill.',
    'The billed day is the day the bill went to the customer. With no send, it is the day the bill was marked billed.',
    tol === 0 ? 'A bill went out the same day when its billed day is its ready day.' : `A bill went out the same day when it is billed within ${tol} ${plural(tol, 'day', 'days')} of its ready day.`,
    'A late bill costs its dollars times the days it waited.',
    'A bill marked billed by hand counts as billed. So the headline leaves it out.',
    'A bill already paid never lists here.',
    `The bills table reads the last ${BILL_SCORECARD_WEEKS} pay weeks, this one included.`,
    'The days of cash compare a week of waiting with the cash in the bank today.',
    'Nothing is recorded in this window. Each row opens the page where the work is done.',
  ]
}

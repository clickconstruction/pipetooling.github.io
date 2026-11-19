import { countedLabel } from '../batchWords'
import { formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import { lienCommercialClock } from './lienDeadlines'
import { isLienOffice, type LienDeskEntry } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import { describeNoticeMonths } from './lienNoticeMonthWords'
import { lienPublicNotListedWhy } from './lienPublicProperty'

/**
 * A closed window's end on the Lien desk's Board (the owner's ask of 2026-11-18: *if something can no longer be
 * liened, we want to let the user know and then offer the user the opportunity to correct the date if there is a
 * mistake or to let it go*; his pick the same day, a closed end at the foot of each column).
 *
 * Two windows close, and they are not the same end:
 *
 *  - **A month's notice window** (§ 53.056, the app's reading): the day for that month's notice passed and none went.
 *    The lien is not lost while the job's lien day is ahead, since a late notice still counts. The answers are a late
 *    notice, a corrected date, or the month recorded closed. Nobody is asked to let the job go.
 *  - **The job's lien day** (§ 53.052): the last day to file the affidavit passed with nothing filed. As the dates
 *    stand no lien can be filed, so the answers are a corrected date, keep collecting, or let it go.
 *
 * Pure: who stands at a closed end, and every word the window, its presses and its toasts say. The app counts the
 * days and does not judge the law, so the window names the date its count starts from and where that date comes
 * from, and says to ask the attorney. Losing the lien does not make the money uncollectible: *Keep collecting* is the
 * filled press and *Uncollectible* the deliberate one.
 *
 * Nothing new is stored. *Keep collecting* is the job taken off the lien path with its reason
 * (`set_job_lien_path_answer`, `lienJobPath.ts`), *Let it go* is the Uncollectible mark (`set_job_uncollectible`), and
 * *Record it closed* is the noted miss of v2.3679 (`noteLienWindowMissed`). Each keeps who and when.
 */

/** The bins' names at the foot of the two columns, each for what closed. */
export const LIEN_CLOSED_BIN_WORDS = {
  notice: 'Window closed · no notice',
  affidavit: 'Lien day passed · not filed',
} as const

/**
 * An affidavit whose day has passed with nothing filed, whatever pile it stands in. Until this rule the Board called a
 * paper missed only when nobody had drafted it, so an approved paper past its day stood red in *Ready to file* and the
 * print counted it.
 */
export function lienAffidavitDayPassed(e: Pick<LienAffidavitEntry, 'pile' | 'daysLeft'>): boolean {
  return e.pile !== 'filed' && e.daysLeft < 0
}

/**
 * A job at the notices' closed end: every month it had closed with no notice, and at least one of them is not yet on
 * record as closed. Once someone records the months, the job has its answer and leaves the bin.
 */
export function lienNoticeWindowClosed(e: Pick<LienDeskEntry, 'pile' | 'missedUnrecorded'>): boolean {
  return e.pile === 'missed' && e.missedUnrecorded.length > 0
}

/** A late notice can still save the lien: the job's lien day is known and has not passed. */
export function lienLateNoticeStillCounts(e: Pick<LienDeskEntry, 'affidavitDaysLeft'>): boolean {
  return e.affidavitDaysLeft != null && e.affidavitDaysLeft >= 0
}

/** Where the month the days are counted from comes from. */
export type LienClosedSource = 'hours' | 'bill' | 'created' | 'hand'

/** What the window knows of the job, as the desk hands it over. */
export type LienClosedFacts = {
  number: string
  name: string
  gcName: string
  /** What the job still owes. */
  unpaid: number
  /** The closed months nobody recorded, each with the last day its notice could go. */
  months: ReadonlyArray<{ key: string; deadline: string }>
  /** The job's lien day, the last day to file the affidavit, and whole days to it (negative once past); null when unknown. */
  lienDay: string | null
  lienDaysLeft: number | null
  /** The job's last month of work, `YYYY-MM`, and where it comes from. */
  lastMonth: string | null
  source: LienClosedSource
  /** The property is set non-residential, so the later clock applies. */
  commercial: boolean
  /** An affidavit was sent for approval, approved or held: it may have been filed and never recorded. */
  hasPaper: boolean
  /** When the job went to Collections, or null when it is not there. */
  collectionsSince: string | null
  /** The job's status (`jobs_ledger.status`): Collections and Uncollectible take a billed job only. */
  status: string | null
  /** The viewer is the lien office, who may answer. */
  canAnswer: boolean
  /** The viewer has the door to the last day of work. */
  canSetLastWork: boolean
}

export type LienClosedKind = 'gone' | 'month'

/** Which end the job stands at: its lien day has passed, or a month's notice window closed with the lien still open. Null with neither. */
export function lienClosedKind(f: Pick<LienClosedFacts, 'months' | 'lienDaysLeft'>): LienClosedKind | null {
  if (f.lienDaysLeft != null && f.lienDaysLeft < 0) return 'gone'
  return f.months.length > 0 ? 'month' : null
}

export type LienClosedAnswerKey = 'late_notice' | 'date' | 'record' | 'keep' | 'let_go'

export type LienClosedAnswer = {
  key: LienClosedAnswerKey
  title: string
  /** What the answer does, said before it is pressed. */
  words: string
  /** The press, naming its act. */
  press: string
  /** `filled` is the answer most jobs take, `door` opens another window, `plain` is a deliberate press. */
  look: 'filled' | 'door' | 'plain'
  /** Why this viewer cannot press it, or null when the press is live. */
  dead: string | null
  /** A smaller door under the answer: a paper that was filed and never recorded. */
  also?: { key: 'filed'; ask: string; door: string }
}

export type LienClosedWindow = {
  kind: LienClosedKind
  title: string
  /** "4127 · Cedar Park Dental · Ridgeway Builders · $2,918 unpaid". */
  sub: string
  /** What closed, one sentence each. */
  closed: string[]
  /** What is still open, for a month whose lien can be saved; null once the lien day has passed. */
  open: string | null
  /** Where the day comes from, then how the app counts it. */
  from: { words: string; note: string }
  answers: LienClosedAnswer[]
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** "Monday, Nov 16". */
export function lienClosedDayWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const day = WEEKDAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()]
  return `${day}, ${formatYmdMonthDay(ymd)}`
}

const SOURCE_WORDS: Record<LienClosedSource, string> = {
  hours: 'It comes from the job’s approved hours.',
  bill: 'It comes from the job’s bill. Nobody clocked on this job.',
  created: 'It is the month the job was made. The job has no hours and no dated bill.',
  hand: 'It comes from the last day of work, set by hand.',
}

export const LIEN_CLOSED_COUNT_NOTE = 'This is the app’s count. Ask the attorney when it is not clear.'

/** How the app counts the lien day from the last month of work. */
export function lienClosedRuleWords(commercial: boolean): string {
  return commercial ? 'On a commercial property the lien day is the 15th of the fourth month after it.' : 'On a house the lien day is the 15th of the third month after it.'
}

const OFFICE_ONLY = 'The office answers this.'
const DATE_WORDS = 'Set the right last day of work. A later day puts this paper back in the flow by itself.'
const DATE_PRESS = 'Set the last day of work ›'
const DATE_OFFICE_ONLY = 'The office sets the last day of work.'

function dateAnswer(f: Pick<LienClosedFacts, 'canSetLastWork'>, also?: LienClosedAnswer['also']): LienClosedAnswer {
  return { key: 'date', title: 'The date is wrong', words: DATE_WORDS, press: DATE_PRESS, look: 'door', dead: f.canSetLastWork ? null : DATE_OFFICE_ONLY, ...(also ? { also } : {}) }
}

/** What *Keep collecting* does to this job's place in Collections, as the sentence under the answer. */
function keepWords(f: Pick<LienClosedFacts, 'number' | 'collectionsSince' | 'status'>): string {
  const tail = 'Nothing is filed or deleted.'
  if (f.collectionsSince) return `The job stays in Collections and leaves the Lien desk. ${tail}`
  const why = lienPublicNotListedWhy(f.status)
  if (why) return `The job leaves the Lien desk. ${f.number} ${why}, so it does not go to Collections yet. ${tail}`
  return `The job goes to Collections and leaves the Lien desk. ${tail}`
}

function goneAnswers(f: LienClosedFacts): LienClosedAnswer[] {
  const office = f.canAnswer ? null : OFFICE_ONLY
  const notBilled = lienPublicNotListedWhy(f.status)
  return [
    dateAnswer(f, { key: 'filed', ask: 'Was it filed in time?', door: 'Record the filing ›' }),
    { key: 'keep', title: 'Keep collecting', words: keepWords(f), press: `Keep collecting ${f.number}`, look: 'filled', dead: office },
    {
      key: 'let_go',
      title: 'Let it go',
      words: f.collectionsSince ? 'The job is marked Uncollectible. The office stops chasing it.' : 'The job goes to Collections and is marked Uncollectible. The office stops chasing it.',
      press: `Mark ${f.number} Uncollectible`,
      look: 'plain',
      dead: office ?? (notBilled ? `${f.number} ${notBilled}. Only a billed job can be marked Uncollectible.` : null),
    },
  ]
}

function monthAnswers(f: LienClosedFacts): LienClosedAnswer[] {
  const months = describeNoticeMonths(f.months.map((m) => m.key))
  return [
    { key: 'late_notice', title: 'Send a late notice', words: `Draft the notice for ${months} now. It goes through approval, print and mail as every notice does.`, press: 'Draft the late notice ›', look: 'filled', dead: null },
    dateAnswer(f),
    { key: 'record', title: 'Record it closed', words: `No notice goes for ${months}. The job stays on the Lien desk for its lien day.`, press: `Record ${months} closed`, look: 'plain', dead: f.canAnswer ? null : OFFICE_ONLY },
  ]
}

/** The window for a job at a closed end; null for a job that stands at neither. */
export function buildLienClosedWindow(f: LienClosedFacts): LienClosedWindow | null {
  const kind = lienClosedKind(f)
  if (!kind) return null
  const sub = [f.name ? `${f.number} · ${f.name}` : f.number, f.gcName.trim(), `${formatUsdNoCents(f.unpaid)} unpaid`].filter(Boolean).join(' · ')
  const lastMonth = f.lastMonth ? describeNoticeMonths([f.lastMonth]) : ''
  if (kind === 'gone') {
    return {
      kind,
      title: 'The lien day has passed',
      sub,
      closed: [
        f.lienDay ? `The last day to file a lien on this job was ${lienClosedDayWords(f.lienDay)}.` : 'The last day to file a lien on this job has passed.',
        f.hasPaper ? 'An affidavit was made for it, and no filing is on record.' : 'No filing is on record.',
        'As the dates stand, no lien can be filed for this job.',
        'The money is still owed.',
      ],
      open: null,
      from: {
        words: lastMonth ? `The last month of work is ${lastMonth}. ${SOURCE_WORDS[f.source]}` : 'The job has no last month of work on record.',
        note: `${lienClosedRuleWords(f.commercial)} ${LIEN_CLOSED_COUNT_NOTE}`,
      },
      answers: goneAnswers(f),
    }
  }
  const months = f.months.slice().sort((a, b) => (a.key < b.key ? -1 : 1))
  return {
    kind,
    title: months.length === 1 ? 'A notice window closed' : `${months.length} notice windows closed`,
    sub,
    closed: [...months.map((m) => `The last day to send the notice for ${describeNoticeMonths([m.key])} work was ${lienClosedDayWords(m.deadline)}.`), 'No notice went out.'],
    open: f.lienDay ? `A late notice still counts while the lien day is ahead. This job’s lien day is ${formatYmdMonthDay(f.lienDay)}.` : 'A late notice still counts while the lien day is ahead.',
    from: {
      words: `${months.length === 1 ? 'The month is' : 'The months are'} counted from the job’s work. ${SOURCE_WORDS[f.source]}`,
      note: LIEN_CLOSED_COUNT_NOTE,
    },
    answers: monthAnswers(f),
  }
}

/** The reason kept on the job when its lien day has passed: the day, then what the office chose, then the person's own note. */
export function lienClosedReason(f: Pick<LienClosedFacts, 'lienDay'>, answer: 'keep' | 'let_go', note = ''): string {
  const head = f.lienDay ? `The lien day passed on ${formatYmdMonthDay(f.lienDay)} with no lien filed.` : 'The lien day passed with no lien filed.'
  const chose = answer === 'keep' ? 'The office keeps collecting.' : 'The office let it go.'
  const own = note.trim()
  return [head, chose, own ? (/[.!?]$/.test(own) ? own : `${own}.`) : ''].filter(Boolean).join(' ')
}

/** The toast after *Keep collecting*: what happened, and what Collections said when it was asked. */
export function lienClosedKeepToast(f: Pick<LienClosedFacts, 'number' | 'collectionsSince'>, r: { onAttorneyList: boolean; held: string | null }): { words: string; tone: 'success' | 'warning' } {
  const head = `${f.number} is off the Lien desk.`
  if (f.collectionsSince) return { words: `${head} It stays in Collections.`, tone: 'success' }
  if (r.held) return { words: `${head} It did not go to Collections: ${r.held}${/[.!?]$/.test(r.held) ? '' : '.'}`, tone: 'warning' }
  return r.onAttorneyList ? { words: `${head} It is in Collections.`, tone: 'success' } : { words: head, tone: 'success' }
}

/** The toast after *Let it go*: the mark stands, and a Stripe invoice that could not be marked is said, since the mark here is never undone for it. */
export function lienClosedLetGoToast(number: string, stripe: ReadonlyArray<string> = []): { words: string; tone: 'success' | 'warning' } {
  const head = `${number} is marked Uncollectible. It is off the Lien desk.`
  if (stripe.length === 0) return { words: head, tone: 'success' }
  const why = stripe.join('; ')
  return { words: `${head} Stripe could not be marked: ${why}${/[.!?]$/.test(why) ? '' : '.'}`, tone: 'warning' }
}

/** The second step of *Let it go*: the mark is deliberate, so the press asks once more and names the act. */
export function lienClosedLetGoConfirm(number: string): { ask: string; yes: string; no: string } {
  return { ask: `Mark ${number} Uncollectible? It leaves every total. The Pipeline can put it back in Collections.`, yes: `Yes, mark ${number} Uncollectible`, no: 'Not yet' }
}

/** The closed bin's press on its title line: the window opens on its first paper and walks the rest. */
export function lienClosedAnswerPress(n: number): string {
  return `${countedLabel('Answer', n)} ›`
}

/** The person's own words, kept with the answer. */
export const LIEN_CLOSED_NOTE_LABEL = 'A note to keep on the job'
export const LIEN_CLOSED_NOTE_EXAMPLE = 'For example: the builder says the check goes out in January.'
/** Under the answers: what is kept, whoever answers. */
export const LIEN_CLOSED_KEPT_WORDS = 'Your name and today are kept on the job with the answer.'

export function lienClosedRecordToast(number: string, months: ReadonlyArray<string>): string {
  return `Recorded. No notice goes for ${describeNoticeMonths(months)} on ${number}.`
}

/** "1 of 3": where the window stands while it walks a bin's papers; '' for one alone. */
export function lienClosedWalkWords(index: number, count: number): string {
  return count > 1 ? `${index + 1} of ${count}` : ''
}

function sourceOf(flags: { byHand?: boolean; fromBill?: boolean; fromCreation?: boolean }): LienClosedSource {
  if (flags.byHand) return 'hand'
  if (flags.fromBill) return 'bill'
  return flags.fromCreation ? 'created' : 'hours'
}

/** The part of the facts the desk's two entries carry: the closed months, the lien day and where the month comes from. The affidavit's own day wins over the notice's reckoning of it. */
export function lienClosedDates(notice: LienDeskEntry | null | undefined, affidavit: LienAffidavitEntry | null | undefined): Pick<LienClosedFacts, 'months' | 'lienDay' | 'lienDaysLeft' | 'lastMonth' | 'source' | 'commercial' | 'hasPaper'> {
  const deadlineByMonth = new Map((notice?.months ?? []).map((m) => [m.key, m.deadline] as const))
  const months = (notice?.missedUnrecorded ?? []).map((key) => ({ key, deadline: deadlineByMonth.get(key) ?? '' })).filter((m) => m.deadline !== '')
  const status = affidavit?.item && affidavit.item.voided_at == null ? affidavit.item.status : null
  return {
    months,
    lienDay: affidavit ? affidavit.deadline || null : (notice?.affidavitDay ?? null),
    lienDaysLeft: affidavit ? affidavit.daysLeft : (notice?.affidavitDaysLeft ?? null),
    lastMonth: affidavit?.lastMonth ?? notice?.months[notice.months.length - 1]?.key ?? null,
    source: affidavit ? sourceOf({ byHand: affidavit.lastMonthByHand, fromBill: affidavit.lastMonthFromBill, fromCreation: affidavit.lastMonthFromCreation }) : sourceOf({ byHand: notice?.datedByHand, fromBill: notice?.datedFromBill, fromCreation: notice?.datedFromCreation }),
    commercial: lienCommercialClock(affidavit?.propertyKind ?? notice?.propertyKind ?? ''),
    hasPaper: status === 'awaiting_approval' || status === 'approved' || status === 'held',
  }
}

/** The window's facts for one job, off the rows the desk already holds. `role` is the viewer's; `lastWorkDoor` says the desk can open the last day of work. */
export function lienClosedFacts(input: {
  number: string
  name: string
  gcName: string
  unpaid: number
  notice: LienDeskEntry | null | undefined
  affidavit: LienAffidavitEntry | null | undefined
  collectionsSince: string | null | undefined
  status: string | null | undefined
  role: string | null | undefined
  lastWorkDoor: boolean
}): LienClosedFacts {
  const office = isLienOffice(input.role)
  return {
    number: input.number,
    name: input.name.trim(),
    gcName: input.gcName.trim(),
    unpaid: input.unpaid,
    ...lienClosedDates(input.notice, input.affidavit),
    collectionsSince: input.collectionsSince ?? null,
    status: input.status ?? null,
    canAnswer: office,
    canSetLastWork: office && input.lastWorkDoor,
  }
}

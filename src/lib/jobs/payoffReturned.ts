/**
 * A check that comes back knows its releases (punch list #435, piece 6).
 *
 * Accounts Receivable's returned-check case (`arReturnCase.ts`, punch list #76) knew the jobs a check paid and
 * nothing of the liens filed on them. A release of a filed lien rests on that money. So the case now reads every
 * filed lien on the check's jobs and says where its release stands, one of three cases:
 *
 *   - `none`: no release has left the office. None is saved, or one is saved and was never printed. The lien stays
 *     on record and the release waits for a payment that holds.
 *   - `printed`: a release was printed and the county has not recorded it. It reads *Do not record*, with the day
 *     it was printed and by whom, so the paper can be found and kept back.
 *   - `recorded`: the county recorded the release. The app cannot undo that. It reads *Released, money came back*
 *     and sends the office to counsel.
 *
 * **The check's mark.** A check typed once in Payoffs is one payment a bill, each with the check's number and day
 * (`lienPayoffCheckIo.ts`), and none is linked to the bank's deposit. The case finds a hand-typed payment only when
 * it is for the whole check, so a payoff check spread over three bills came back *on no job*. `paymentsOnReturnedCheck`
 * reads the mark: the payments with the deposit's own check number, typed near its day, that add up to no more than
 * the check. Their jobs join the case's jobs here. The case's own **Take it off** does not reach them (that is the
 * database's function): each is named with its job, to be taken off on the job's Bill tab.
 *
 * **Printed** is read from the copy a print files (`sent_documents`, kind `lien_release_of_record`, by job). A copy
 * names its job and not its lien, so a print on a job counts for each of that job's liens the county has not
 * released, from the day the lien was filed. When the copies cannot be read, a saved release reads as printed: the
 * cautious reading.
 *
 * The desk's side is one flag, `releaseOnReturnedCheck`: Payoffs (`lienPayoff.ts`) holds a saved release's county
 * press while the bank says the job's last payment came back, and marks a recorded one. Once the payment is taken
 * off the job the desk no longer has the bank's answer, and the case here is what remembers.
 *
 * **The mark** (the returned check's mark, after piece 6). The desk's flag reads the bank's answer off the job's last
 * payment, so it is gone once that payment is taken off. The case therefore offers one press that keeps a mark on
 * each saved release it lists (`ReleaseMoneyBackMark`, `lienReleaseFacts.ts`; the write is `lienReleaseRunIo.ts`).
 * `releaseMarkHolds` says how long the desk heeds it: until the job's bills read paid by a payment made on or after
 * the day the check came back, and that payment has cleared. No press takes a mark off: a payment that holds does.
 *
 * The view itself writes nothing. Every sentence keeps to `plainWords.ts` and marks its values with `val`. Pure; tested beside
 * it. The reads are `payoffReturnedIo.ts`, the screen `ArReturnCasePane.tsx`. This file imports nothing of
 * `lienPayoff.ts` but types, so that file can read the flag.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { val } from '../valuesInPlace'
import { formatYmdMonthDay } from './billedExpectedPay'
import { bankCheckForPayment, checkName, type BankCheck, type CheckAnswer, type CheckClearedPayment } from './checkCleared'
import { isCheckPayment } from './checkClearing'
import type { LienPayoffAffidavit, LienPayoffRelease } from './lienPayoff'
import { releaseFacts, type ReleaseMoneyBackMark } from './lienReleaseFacts'
import { countedLabel } from '../batchWords'

export type ReturnedReleaseCase = 'none' | 'printed' | 'recorded'

/** The kinds of value a sentence here marks. */
export type PayoffReturnedValueKind = 'day' | 'who' | 'instrument' | 'count' | 'way' | 'job'

export const PAYOFF_RETURNED_WORDS = {
  head: 'Liens on this money',
  onRecord: 'On record',
  held: 'Release held',
  doNotRecord: 'Do not record',
  moneyBack: 'Released, money came back',
  openJob: 'Open the job ›',
  reading: 'Reading the liens on these jobs.',
  unread: 'The liens on these jobs could not be read. Open each job’s Lien window before a release is recorded.',
  printsUnread: 'The app could not read which releases were printed. A saved release is treated as printed.',
  markLead: 'Tell the Lien desk, so each release stays held after the payment is off the job.',
  marked: 'The Lien desk is told. Each release stays held until a payment holds.',
  markFailed: 'The release did not take the mark.',
} as const

/** True when the bank says the job's last payment came back: a release must not rest on it. */
export function releaseOnReturnedCheck(check: Pick<CheckAnswer, 'state'> | null | undefined): boolean {
  return check?.state === 'came_back'
}

/**
 * Whether the desk still heeds a returned check's mark on a release. It holds while the job's bills still owe, while
 * the last payment is older than the day the check came back (the payment that came back is still on the job), and
 * while a newer payment has not cleared. A payment that holds lifts it.
 */
export function releaseMarkHolds(mark: Pick<ReleaseMoneyBackMark, 'ymd'> | null | undefined, input: { open: number; lastPaidYmd: string | null; check: Pick<CheckAnswer, 'cleared'> | null }): boolean {
  if (!mark) return false
  if (Math.round((Number(input.open) || 0) * 100) / 100 > 0.004) return true
  if (!input.lastPaidYmd || input.lastPaidYmd < mark.ymd) return true
  return !(input.check?.cleared ?? true)
}

/** *Check 1184 came back Nov 27.*, with its values marked: what the desk says of a release held on its mark. */
export function releaseMarkWords(mark: Pick<ReleaseMoneyBackMark, 'ymd' | 'check'>): string {
  return `${val('way', checkName(mark.check).replace(/^./, (c) => c.toUpperCase()))} came back ${val('day', formatYmdMonthDay(mark.ymd))}.`
}

// ---------- The check's mark ----------

/** A payment as the mark reads it. */
export type ReturnedMarkPayment = CheckClearedPayment & { id: string; job_id: string }

const cents = (v: number | string | null | undefined): number => Math.round((Number(v) || 0) * 100)
const ymdOf = (s: string | null | undefined): string => (s ?? '').slice(0, 10)
const daysApart = (a: string, b: string): number => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000

/**
 * The payments typed off this check and never linked to its deposit. One check typed once is one group: the same
 * number on the same day. A group counts when it adds up to no more than the check. With two such groups, the one
 * that comes to the check exactly wins, then the one typed nearest the deposit's day, so a second payer's check of
 * the same number is not read as this one.
 */
export function paymentsOnReturnedCheck<P extends ReturnedMarkPayment>(deposit: BankCheck | null, payments: ReadonlyArray<P>): P[] {
  if (!deposit || !deposit.checkNumber.trim()) return []
  const fits = payments.filter((p) => !p.mercury_transaction_id && isCheckPayment(p) && cents(p.amount) > 0 && bankCheckForPayment(p, [deposit])?.id === deposit.id)
  const groups = new Map<string, P[]>()
  for (const p of fits) {
    const day = ymdOf(p.paid_on)
    groups.set(day, [...(groups.get(day) ?? []), p])
  }
  const total = (list: P[]): number => list.reduce((s, p) => s + cents(p.amount), 0)
  const ok = [...groups.entries()].filter(([, list]) => total(list) <= cents(deposit.amount))
  if (ok.length === 0) return []
  const near = (day: string): number => (deposit.depositedYmd ? daysApart(day, deposit.depositedYmd) : 0)
  ok.sort(([dayA, a], [dayB, b]) => Number(total(b) === cents(deposit.amount)) - Number(total(a) === cents(deposit.amount)) || near(dayA) - near(dayB) || dayB.localeCompare(dayA))
  return ok[0]![1]
}

// ---------- The jobs a returned check is on ----------

/**
 * How the check stands on a job. `counted`: a payment the case knows still counts it as paid. `typed`: a payment
 * found by the check's mark still counts it as paid, and the case's own take off does not reach it. `off`: it was
 * taken off.
 */
export type ReturnedJobStand = 'counted' | 'typed' | 'off'

export type ReturnedJobRef = { jobId: string; stand: ReturnedJobStand }

/** What the case already says of its jobs (`ArReturnCaseView`), as this kernel reads it. */
export type ReturnedCaseJobs = {
  takeOff: { jobs: ReadonlyArray<{ jobId: string }> } | null
  recorded: { jobId: string } | null
  billsItPaid: ReadonlyArray<{ jobId: string }>
  promiseJob: { jobId: string } | null
}

/** Every job the check is or was on, each once: a job that still counts it comes before one it came off. */
export function returnedCaseJobs(view: ReturnedCaseJobs, marked: ReadonlyArray<{ job_id: string }>): ReturnedJobRef[] {
  const stand = new Map<string, ReturnedJobStand>()
  const put = (jobId: string | null | undefined, s: ReturnedJobStand) => {
    if (!jobId) return
    const have = stand.get(jobId)
    // `counted` wins, then `typed`, then `off`.
    if (!have || (have === 'off' && s !== 'off') || (have === 'typed' && s === 'counted')) stand.set(jobId, s)
  }
  for (const j of view.takeOff?.jobs ?? []) put(j.jobId, 'counted')
  put(view.recorded?.jobId, 'counted')
  for (const p of marked) put(p.job_id, 'typed')
  for (const b of view.billsItPaid) put(b.jobId, 'off')
  put(view.promiseJob?.jobId, 'off')
  const rank: Record<ReturnedJobStand, number> = { counted: 0, typed: 1, off: 2 }
  return [...stand.entries()].map(([jobId, s]) => ({ jobId, stand: s })).sort((a, b) => rank[a.stand] - rank[b.stand] || a.jobId.localeCompare(b.jobId))
}

// ---------- The three cases ----------

/** One printed copy of a release, as `sent_documents` keeps it. */
export type ReleasePrint = { jobId: string; printedAt: string; by: string }

/** A filed lien with its own release, as `releaseTargets` gives it (`lienReleaseOfRecord.ts`). */
export type ReturnedLienTarget = {
  affidavit: Pick<LienPayoffAffidavit, 'id' | 'job_id' | 'county' | 'recording_number' | 'filed_at'>
  release: Pick<LienPayoffRelease, 'id' | 'created_at' | 'filed_at' | 'fields'> | null
}

export type ReturnedLien = {
  affidavitId: string
  jobId: string
  /** The job as the office says it: *#2071 Larkspur remodel*. */
  jobLabel: string
  /** The lien's own instrument number, or ''. */
  instrument: string
  case: ReturnedReleaseCase
  chip: { text: string; tone: 'red' | 'amber' | 'plain' }
  /** Where the release stands and what to do, with its values marked. */
  say: string
  /** A release of this lien is saved, whether or not it has left. */
  releaseSaved: boolean
  /** The saved release's row, for the mark: its id and its `fields` as read. Null with none saved. */
  release: { id: string; fields: unknown } | null
  /** The release already carries this case's mark. */
  marked: boolean
  /** The check still counts as paid on this job by a payment the case's take off does not reach. Null otherwise. */
  typed: string | null
}

export type PayoffReturnedView = {
  /** The one line over the liens, with its values marked. */
  line: string
  tone: 'red' | 'amber'
  liens: ReturnedLien[]
  /** A release is recorded on this money: it is counsel's now. */
  counsel: boolean
  /** The printed copies could not be read, so a saved release was read as printed. */
  printsUnread: boolean
  /** The saved releases this case has not marked yet, and the press that marks them. Null with none, or when the case is not named. */
  mark: { rows: Array<{ releaseId: string; fields: unknown }>; button: string; change: ReleaseMoneyBackMark } | null
  /** How many of the saved releases already carry this case's mark. */
  marked: number
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const fieldText = (fields: unknown, key: string): string => (fields && typeof fields === 'object' ? text((fields as Record<string, unknown>)[key]) : '')
const day = (ymd: string): string => val('day', formatYmdMonthDay(ymd))
const count = (n: number): string => val('count', String(n))

/** The newest print of a release on a job since its lien was filed, or null. */
function printFor(target: ReturnedLienTarget, prints: ReadonlyArray<ReleasePrint>): { ymd: string; by: string } | null {
  const filedYmd = ymdOf(target.affidavit.filed_at)
  const mine = prints
    .filter((p) => p.jobId === target.affidavit.job_id)
    .map((p) => ({ ymd: calendarYmdInAppTzFromIso(p.printedAt) || ymdOf(p.printedAt), by: text(p.by) }))
    .filter((p) => p.ymd && (!filedYmd || p.ymd >= filedYmd))
    .sort((a, b) => b.ymd.localeCompare(a.ymd))
  return mine[0] ?? null
}

/** Which of the three cases one lien is in. `prints` null means the copies could not be read. */
export function returnedReleaseCase(target: ReturnedLienTarget, prints: ReadonlyArray<ReleasePrint> | null): ReturnedReleaseCase {
  if (target.release?.filed_at) return 'recorded'
  if (prints === null) return target.release ? 'printed' : 'none'
  return printFor(target, prints) ? 'printed' : 'none'
}

function lienWords(target: ReturnedLienTarget, prints: ReadonlyArray<ReleasePrint> | null): Pick<ReturnedLien, 'case' | 'chip' | 'say'> {
  // `releaseSaved` is added by the caller, from the target itself.
  const kind = returnedReleaseCase(target, prints)
  const release = target.release
  if (kind === 'recorded' && release?.filed_at) {
    const own = fieldText(release.fields, 'releaseInstrument')
    const recorded = `The county recorded the release ${day(ymdOf(release.filed_at))}${own ? ` as ${val('instrument', own)}` : ''}.`
    return { case: 'recorded', chip: { text: PAYOFF_RETURNED_WORDS.moneyBack, tone: 'red' }, say: `${recorded} The app cannot undo that. Ask counsel what to do.` }
  }
  if (kind === 'printed') {
    const print = prints ? printFor(target, prints) : null
    const chip = { text: PAYOFF_RETURNED_WORDS.doNotRecord, tone: 'red' as const }
    if (!print) return { case: 'printed', chip, say: 'A release is saved and may have been printed. Do not record it. Keep the paper back from the county.' }
    const who = print.by ? ` by ${val('who', print.by)}` : ''
    const saved = release ? '' : ' It was never saved.'
    return { case: 'printed', chip, say: `A release was printed ${day(print.ymd)}${who}.${saved} Do not record it. Find the paper and keep it back from the county.` }
  }
  if (release) {
    const saved = calendarYmdInAppTzFromIso(release.created_at) || ymdOf(release.created_at)
    return { case: 'none', chip: { text: PAYOFF_RETURNED_WORDS.held, tone: 'amber' }, say: `A release was saved ${day(saved)} and never printed. Do not print it until a payment holds.` }
  }
  return { case: 'none', chip: { text: PAYOFF_RETURNED_WORDS.onRecord, tone: 'plain' }, say: 'No release has been made. The lien stays on record until a payment holds.' }
}

export type PayoffReturnedInput = {
  /** The jobs the check is or was on (`returnedCaseJobs`). */
  jobs: ReadonlyArray<ReturnedJobRef>
  /** Each job as the office says it, by id. */
  labelByJob: Readonly<Record<string, string>>
  /** Every live filed lien on those jobs, each with its own release. */
  targets: ReadonlyArray<ReturnedLienTarget>
  /** The printed copies of releases on those jobs. Null when they could not be read. */
  prints: ReadonlyArray<ReleasePrint> | null
  /** The check's own number, or '' when the bank read none. */
  checkNumber: string
  /** The case, and the day its check came back: with both, the view offers the mark. */
  caseId?: string
  cameBackYmd?: string | null
}

/** Who presses the mark, and when: the view's `mark.change` carries neither until the press. */
export function returnedMarkNow(change: ReleaseMoneyBackMark, who: string, atIso: string): ReleaseMoneyBackMark {
  return { ...change, by: who, at: atIso }
}

/**
 * The filed liens on a returned check's jobs, each in one of the three cases. Null when none of those jobs holds a
 * filed lien: the case then says nothing of liens.
 */
export function payoffReturnedView(input: PayoffReturnedInput): PayoffReturnedView | null {
  const standByJob = new Map(input.jobs.map((j) => [j.jobId, j.stand]))
  const targets = input.targets.filter((t) => t.affidavit.filed_at && standByJob.has(t.affidavit.job_id))
  if (targets.length === 0) return null
  const check = val('way', checkName(input.checkNumber))
  const Check = val('way', checkName(input.checkNumber).replace(/^./, (c) => c.toUpperCase()))
  const rank: Record<ReturnedReleaseCase, number> = { recorded: 0, printed: 1, none: 2 }
  const liens: ReturnedLien[] = targets
    .map((t) => {
      const jobId = t.affidavit.job_id
      const typed = standByJob.get(jobId) === 'typed' ? `${Check} still counts as paid on this job. Take it off on the job’s Bill tab.` : null
      return { affidavitId: t.affidavit.id, jobId, jobLabel: input.labelByJob[jobId] || 'a job', instrument: text(t.affidavit.recording_number), ...lienWords(t, input.prints), releaseSaved: Boolean(t.release), release: t.release ? { id: t.release.id, fields: t.release.fields ?? null } : null, marked: Boolean(t.release && input.caseId && releaseFacts(t.release.fields).moneyBack?.caseId === input.caseId), typed }
    })
    .sort((a, b) => rank[a.case] - rank[b.case] || a.jobLabel.localeCompare(b.jobLabel, undefined, { numeric: true }) || a.instrument.localeCompare(b.instrument))
  const n = (k: ReturnedReleaseCase): number => liens.filter((l) => l.case === k).length
  const recorded = n('recorded')
  const printed = n('printed')
  const saved = liens.filter((l) => l.case === 'none' && l.releaseSaved).length
  let line: string
  let tone: PayoffReturnedView['tone'] = 'red'
  if (recorded) {
    const rest = printed ? ` ${count(printed)} more ${printed === 1 ? 'is' : 'are'} printed. Do not record ${printed === 1 ? 'it' : 'them'}.` : ''
    line = `${count(recorded)} ${recorded === 1 ? 'release is' : 'releases are'} recorded on ${check}. Ask counsel.${rest}`
  } else if (printed) {
    line = `${count(printed)} ${printed === 1 ? 'release is' : 'releases are'} printed on ${check}. Do not record ${printed === 1 ? 'it' : 'them'}.`
  } else {
    tone = 'amber'
    const held = saved ? ` ${count(saved)} saved ${saved === 1 ? 'release waits' : 'releases wait'}.` : ''
    line = `No release has left the office. ${count(liens.length)} filed ${liens.length === 1 ? 'lien stays' : 'liens stay'} on record.${held}`
  }
  const unmarked = liens.filter((l) => l.release && !l.marked)
  const ymd = (input.cameBackYmd ?? '').slice(0, 10)
  const mark =
    input.caseId && /^\d{4}-\d{2}-\d{2}$/.test(ymd) && unmarked.length > 0
      ? {
          rows: unmarked.map((l) => ({ releaseId: l.release!.id, fields: l.release!.fields })),
          button: countedLabel('Hold', unmarked.length, ['release on the Lien desk', 'releases on the Lien desk']),
          change: { ymd, check: input.checkNumber.trim(), caseId: input.caseId, by: '', at: '' },
        }
      : null
  return { line, tone, liens, counsel: recorded > 0, printsUnread: input.prints === null && liens.some((l) => l.case === 'printed'), mark, marked: liens.filter((l) => l.marked).length }
}

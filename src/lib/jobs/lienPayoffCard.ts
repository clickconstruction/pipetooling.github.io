/**
 * The payoff card (punch list #435, piece 4): one place's payoff as five stops on the Lien desk's Payoffs, read from
 * what the app already holds. The card's critique of the first draw: a payoff takes two weeks, so it is
 * a card that stays, named for what it is, with its days in a column, and on a day it needs nothing it says so in
 * one line.
 *
 *   1. Money recorded     — every liened job's bills read paid (`lienPayoffStep` past `money`).
 *   2. Check clears       — the bank's answer (`checkCleared.ts`), or a leader's, a controller's or a dev's word that
 *                           the bank confirmed the funds (`lienPayoffFields.ts`).
 *   3. Releases           — one release of record saved for each lien. The rows keep *Make the release ›*.
 *   4. Recorded at the county — each release carries the county's day (piece 2's stamp).
 *   5. Copies sent        — no fact on record yet: piece 5 gives it one. Until then it reads *after recording*.
 *
 * The two days: a release is due ten days after a written request (§ 53.152(a); the day is kept on each lien), and
 * the check clears on the bank's day. The card does not judge the law: it counts the days and names them.
 *
 * Every sentence keeps to `plainWords.ts` and marks its values with `val`. Pure; tested beside it. The screen is the
 * place card in `LienPayoffs.tsx`, the writes `lienPayoffCardIo.ts`.
 */
import type { UserRole } from '../../hooks/useAuth'
import { ymdAddDays, ymdDaysBetween } from '../../utils/dateUtils'
import { moneyWords } from '../moneyParts'
import { val } from '../valuesInPlace'
import { formatYmdMonthDay } from './billedExpectedPay'
import type { CheckAnswer } from './checkCleared'
import type { LienPayoffRow, LienPayoffStepKey } from './lienPayoff'
import { fundsConfirmedWords, type FundsConfirmed } from './lienPayoffFields'

/** A release is owed within ten days of a written request (Tex. Prop. Code § 53.152(a)). */
export const RELEASE_DUE_DAYS = 10

/** Who may say the bank confirmed the funds: the owner's answer of 2026-11-25, *a leader, a controller or a dev*. */
export const FUNDS_CONFIRM_ROLES: ReadonlyArray<UserRole> = ['dev', 'master_technician', 'controller']

export function canConfirmFunds(role: UserRole | string | null | undefined): boolean {
  return typeof role === 'string' && (FUNDS_CONFIRM_ROLES as ReadonlyArray<string>).includes(role)
}

export type PayoffStopKey = 'money' | 'bank' | 'releases' | 'county' | 'copies'

export type PayoffStopState = 'done' | 'now' | 'later' | 'bad'

export type PayoffStop = {
  key: PayoffStopKey
  label: string
  state: PayoffStopState
  /** What stands at this stop, with its values marked. */
  say: string
}

export const PAYOFF_CARD_WORDS = {
  stops: { money: 'Money recorded', bank: 'Check clears', releases: 'Releases', county: 'Recorded at the county', copies: 'Copies sent' } as Record<PayoffStopKey, string>,
  asked: 'Asked for a release in writing',
  askedLabel: 'the day a release was asked for in writing',
  notYet: 'not yet',
  due: 'Release due',
  dueHint: `${RELEASE_DUE_DAYS} days after the ask`,
  clears: 'Check clears',
  cleared: 'Check cleared',
  /** The press on a place whose check is at the bank. */
  funds: 'The bank confirmed the funds ›',
  fundsHead: 'What the bank said',
  fundsExample: 'called the bank Nov 26, the funds are good',
  fundsConfirm: 'Confirm the funds',
  fundsCancel: 'Cancel',
  fundsNeedsNote: 'Type what the bank said.',
  fundsWho: 'A leader, a controller or a dev may press it.',
  fundsKept: 'The card keeps your name and the day with it.',
  copiesLater: 'After recording.',
} as const

export type PayoffDue = { askedYmd: string; dueYmd: string; daysLeft: number }

export type LienPayoffCard = {
  stops: PayoffStop[]
  /** The one line under the stops: what to do today, or that nothing is owed. */
  line: string
  tone: 'plain' | 'amber' | 'red' | 'green'
  /** The day a release was asked for in writing, as the place's liens hold it, or ''. */
  askedYmd: string
  /** The due day that request gives, while a release is still owed. */
  due: PayoffDue | null
  /** The day the check clears or cleared, when the bank or the seven-day rule names one. */
  clearsYmd: string | null
  /** True once the money has cleared or the funds are confirmed: the clearing day is past. */
  cleared: boolean
  /** The confirmation on record, or null. */
  funds: FundsConfirmed | null
  /** Offer the funds press: a lien waits for the bank on a check that has not come back, and none is confirmed. */
  offerFunds: boolean
  /** The liens the asked day is kept on: every lien not yet released. */
  askedRows: LienPayoffRow[]
  /** The liens the funds press writes to: those waiting for the bank. */
  fundsRows: LienPayoffRow[]
}

const count = (n: number): string => val('count', String(n))
const day = (ymd: string): string => val('day', formatYmdMonthDay(ymd))
const releases = (n: number): string => (n === 1 ? 'release' : 'releases')
const latest = (days: ReadonlyArray<string>): string | null => [...days].sort()[days.length - 1] ?? null

/** The due day a written request gives, and the days left to it (below zero once it has passed). */
export function releaseDue(askedYmd: string, todayYmd: string): PayoffDue | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(askedYmd)) return null
  const dueYmd = ymdAddDays(askedYmd, RELEASE_DUE_DAYS)
  return { askedYmd, dueYmd, daysLeft: ymdDaysBetween(todayYmd, dueYmd) ?? 0 }
}

/** *The releases are due Dec 4. That leaves 3 days.*, *The release is due today.*, *The releases were due Dec 4. That was 2 days ago.* */
export function releaseDueWords(due: PayoffDue, owed: number): string {
  const what = `The ${releases(owed)}`
  const one = owed === 1
  if (due.daysLeft > 0) return `${what} ${one ? 'is' : 'are'} due ${day(due.dueYmd)}. That leaves ${count(due.daysLeft)} ${due.daysLeft === 1 ? 'day' : 'days'}.`
  if (due.daysLeft === 0) return `${what} ${one ? 'is' : 'are'} due today.`
  const ago = -due.daysLeft
  return `${what} ${one ? 'was' : 'were'} due ${day(due.dueYmd)}. That was ${count(ago)} ${ago === 1 ? 'day' : 'days'} ago.`
}

/** The check's clearing day as the second stop says it. */
function clearsWords(check: CheckAnswer | null, clearsYmd: string | null): string {
  if (!clearsYmd) return 'The bank has not named a day.'
  if (check?.state === 'no_deposit') return `About ${day(clearsYmd)}, seven days after the check.`
  if (check?.state === 'late') return `The bank said ${day(clearsYmd)}. It is not posted yet.`
  return `The bank says ${day(clearsYmd)}.`
}

/** One place's payoff as five stops, the line under them, and its two days. */
export function lienPayoffCard(rows: ReadonlyArray<LienPayoffRow>, todayYmd: string): LienPayoffCard {
  const at = (k: LienPayoffStepKey) => rows.filter((r) => r.step.step === k)
  const money = at('money')
  const bank = at('bank')
  const owed = at('release')
  const county = at('county')
  const done = at('done')
  const n = rows.length
  const made = county.length + done.length
  const open = rows.filter((r) => r.step.step !== 'done')
  const checks = rows.map((r) => r.step.check).filter((c): c is CheckAnswer => Boolean(c))
  const cameBack = bank.some((r) => r.step.check?.state === 'came_back')
  const unread = !cameBack && bank.some((r) => r.step.check?.state === 'unread')
  const funds = open.map((r) => r.funds).find((f): f is FundsConfirmed => Boolean(f)) ?? null
  const askedYmd = [...open.map((r) => r.askedYmd).filter(Boolean)].sort()[0] ?? ''
  const paid = rows
    .map((r) => r.step.paid)
    .filter((p): p is NonNullable<LienPayoffRow['step']['paid']> => Boolean(p))
    .sort((a, b) => b.ymd.localeCompare(a.ymd))[0] ?? null
  const waiting = checks.filter((c) => !c.cleared && c.clearsYmd)
  const clearedChecks = checks.filter((c) => c.cleared && c.state !== 'not_check' && c.clearsYmd)
  const clearsYmd = latest(waiting.map((c) => c.clearsYmd as string)) ?? latest(clearedChecks.map((c) => c.clearsYmd as string))
  const paidSome = n - money.length > 0
  const paidWords = paid ? `Paid ${day(paid.ymd)}${paid.way ? ` by ${val('way', paid.way)}` : ''}.` : 'The bills read paid.'

  // 1. Money recorded.
  const stillOpen = money.reduce((s, r) => s + r.open, 0)
  const s1: PayoffStop = money.length
    ? {
        key: 'money',
        label: PAYOFF_CARD_WORDS.stops.money,
        state: 'now',
        say: money.length === n ? `${val('money', moneyWords(stillOpen))} is still open on the ${n === 1 ? 'lien’s' : 'liens’'} bills.` : `${val('money', moneyWords(stillOpen))} is still open on ${count(money.length)} of ${count(n)} liens’ bills.`,
      }
    : { key: 'money', label: PAYOFF_CARD_WORDS.stops.money, state: 'done', say: paidWords }

  // 2. Check clears.
  const s2: PayoffStop = { key: 'bank', label: PAYOFF_CARD_WORDS.stops.bank, state: 'later', say: 'After the money is recorded.' }
  if (cameBack) Object.assign(s2, { state: 'bad', say: 'The check came back.' })
  else if (unread) Object.assign(s2, { state: 'bad', say: 'The bank could not read the check. Deposit it again.' })
  else if (bank.length) Object.assign(s2, { state: 'now', say: clearsWords(waiting[0] ?? null, clearsYmd) })
  else if (paidSome && funds) Object.assign(s2, { state: 'done', say: fundsConfirmedWords(funds) })
  else if (paidSome && clearedChecks.length && clearsYmd) Object.assign(s2, { state: 'done', say: `Cleared ${day(clearsYmd)}.` })
  else if (paidSome) Object.assign(s2, { state: 'done', say: 'No check to wait for.' })

  // 3. Releases.
  const s3: PayoffStop = { key: 'releases', label: PAYOFF_CARD_WORDS.stops.releases, state: 'later', say: bank.length ? 'After the check clears.' : 'After the money is recorded.' }
  if (cameBack) Object.assign(s3, { state: 'bad', say: 'Held. The check came back.' })
  else if (made === n) Object.assign(s3, { state: 'done', say: n === 1 ? 'Made.' : `All ${count(n)} made.` })
  else if (owed.length) Object.assign(s3, { state: 'now', say: made ? `${count(made)} made, ${count(owed.length)} to make.` : `${count(owed.length)} to make.` })

  // 4. Recorded at the county.
  const s4: PayoffStop = { key: 'county', label: PAYOFF_CARD_WORDS.stops.county, state: 'later', say: 'After the notary.' }
  const recordedDay = latest(done.map((r) => r.step.recordedYmd ?? '').filter(Boolean))
  if (done.length === n) Object.assign(s4, { state: 'done', say: recordedDay ? `Recorded ${day(recordedDay)}.` : 'Recorded.' })
  else if (county.length) Object.assign(s4, { state: 'now', say: done.length ? `${count(done.length)} recorded, ${count(county.length)} to record.` : `${count(county.length)} to record, after the notary.` })

  // 5. Copies sent: no fact yet (piece 5).
  const s5: PayoffStop = done.length === n ? { key: 'copies', label: PAYOFF_CARD_WORDS.stops.copies, state: 'now', say: 'Send the stamped copies to the payer.' } : { key: 'copies', label: PAYOFF_CARD_WORDS.stops.copies, state: 'later', say: PAYOFF_CARD_WORDS.copiesLater }

  // The two days.
  const due = done.length < n ? releaseDue(askedYmd, todayYmd) : null
  const late = Boolean(due && due.daysLeft < 0)

  // The one line.
  let line: string
  let tone: LienPayoffCard['tone']
  const notRecorded = n - done.length
  if (cameBack) {
    line = 'The check came back. Open the bills and take the payments off.'
    tone = 'red'
  } else if (unread) {
    line = 'The bank could not read the check. Deposit it again.'
    tone = 'amber'
  } else if (money.length) {
    line = `${val('money', moneyWords(stillOpen))} is still open here. Record it on each bill, or type one check.`
    tone = 'plain'
  } else if (bank.length) {
    const wait = `The ${releases(bank.length)} ${bank.length === 1 ? 'waits' : 'wait'} for the check to clear${clearsYmd ? `, about ${day(clearsYmd)}` : ''}.`
    line = late ? wait : `Nothing to do today. ${wait}`
    tone = 'plain'
  } else if (owed.length) {
    line = `Make ${count(owed.length)} ${releases(owed.length)}. Press Make the release on each lien.`
    tone = 'amber'
  } else if (county.length) {
    line = `Sign ${count(county.length)} ${releases(county.length)} before a notary. Then record ${county.length === 1 ? 'it' : 'them'} at the county.`
    tone = 'amber'
  } else {
    line = `${n === 1 ? 'The lien' : 'Every lien'} here is released. Send the stamped copies to the payer.`
    tone = 'green'
  }
  if (due) {
    line = `${line} ${releaseDueWords(due, notRecorded)}`
    if (late) tone = 'red'
  }

  return {
    stops: [s1, s2, s3, s4, s5],
    line,
    tone,
    askedYmd,
    due,
    clearsYmd,
    cleared: s2.state === 'done',
    funds,
    offerFunds: bank.length > 0 && !cameBack && !unread && !funds,
    askedRows: open,
    fundsRows: bank,
  }
}

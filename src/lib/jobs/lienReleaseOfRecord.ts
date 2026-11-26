/**
 * The release of a filed lien, on the Lien window's Release of record tab (punch list #435, piece 2).
 *
 * Until now the tab took the job's first filed affidavit, saved with no payment recorded, typed its payment date by
 * hand, and had nowhere to put what the county clerk hands back. Four rules, all pure:
 *
 *   - `releaseTargets`: every live filed affidavit on the job with its own release, so a job with two filed liens
 *     releases the one picked and never the first one found. A saved release names its affidavit
 *     (`fields.releasesFilingId`, read by `lienPayoff.ts`).
 *   - `releaseMoneyGate`: money holds the release. While the job's sent bills still owe, the tab holds its print and
 *     its save, and says what is open. A reason typed under *Release it anyway* lifts the hold and is saved on the
 *     release: a lien settled for less is a real case, and the app does not judge it. Since punch list #437,
 *     piece 1, a check the bank has not cleared holds the tab the same way (`checkCleared.ts`), and the same
 *     typed reason lifts it. The owner's rule of 2026-11-24: a release waits until the check clears. Since punch
 *     list #435, piece 4, a leader's, a controller's or a dev's word that the bank confirmed the funds, kept on the
 *     affidavit row (`lienPayoffFields.ts`), lets the release go before the bank's day, and the release saved then
 *     carries that word (`releasedOnConfirmedFunds`).
 *   - `releasePaymentDay`: the paper's payment date starts on the day of the last payment, not on today.
 *   - `releaseStampPatch`: the county's stamp. The day the clerk recorded the release is the row's `filed_at`,
 *     which nothing set before, and the release's own instrument number is `fields.releaseInstrument`. The row's
 *     `recording_number` keeps the affidavit's number, as every older row and reader has it.
 *
 * Since piece 6 a saved release says so when the bank sent back the check it rests on (`releaseMoneyBackWords`):
 * *Do not record this release* while the county has not recorded it, and *the county’s record stands* once it has.
 * The stamp's two values stay open either way, since a stamp the clerk already gave is a fact to keep.
 *
 * No migration: the link and the instrument number live in the `fields` the release already saves.
 * The app counts the days and does not judge the law.
 */
import { moneyWords } from '../moneyParts'
import { val } from '../valuesInPlace'
import { ymdAddDays } from '../../utils/dateUtils'
import { formatYmdMonthDay } from './billedExpectedPay'
import { BANK_CHECK_WINDOW_DAYS, checkAnswerWords, checkName, paymentCheckAnswer, type BankCheck } from './checkCleared'
import { isCheckPayment } from './checkClearing'
import { lastPayment, payWayWords, releaseForAffidavit, releaseOwnInstrument, type LienPayoffAffidavit, type LienPayoffPayment, type LienPayoffRelease } from './lienPayoff'
import { fundsConfirmedWords, type FundsConfirmed } from './lienPayoffFields'
import { releaseOnReturnedCheck } from './payoffReturned'

export const RELEASE_OF_RECORD_WORDS = {
  which: 'Which lien',
  anyway: 'Release it anyway…',
  anywayLabel: 'Why it is released with money still open',
  anywayExample: 'settled for less on Nov 24, per the owner',
  anywayCheckLabel: 'Why it is released before the check clears',
  anywayCheckExample: 'a cashier’s check, per the owner',
  asking: 'Asking the bank about it.',
  bankUnread: 'The bank’s record could not be read. Open this tab again.',
  saved: 'This release is saved. Sign it before a notary. Then record it at the county.',
  stampHead: 'The county’s stamp',
  instrumentLabel: 'the release’s instrument number',
  dayLabel: 'the day the county recorded it',
  notYet: 'not yet',
  stampKept: 'The county’s stamp is on the release.',
  stampFailed: 'The release did not take the change.',
  futureDay: 'The county cannot have recorded it on a day still to come.',
  beforeLien: 'A release cannot be recorded before its lien was filed.',
} as const

export type ReleaseState = 'none' | 'made' | 'recorded'

export type ReleaseTarget<A extends LienPayoffAffidavit, R extends LienPayoffRelease> = { affidavit: A; release: R | null; state: ReleaseState }

/** Every live filed affidavit on a job, oldest filing first, each with its own release of record. */
export function releaseTargets<A extends LienPayoffAffidavit, R extends LienPayoffRelease>(affidavits: ReadonlyArray<A>, releases: ReadonlyArray<R>): ReleaseTarget<A, R>[] {
  const filed = affidavits.filter((a) => a.filed_at).sort((a, b) => (a.filed_at ?? '').localeCompare(b.filed_at ?? '') || (a.recording_number ?? '').localeCompare(b.recording_number ?? '') || a.id.localeCompare(b.id))
  return filed.map((affidavit) => {
    const release = releaseForAffidavit(affidavit, releases, filed.length)
    return { affidavit, release, state: release ? (release.filed_at ? 'recorded' : 'made') : 'none' }
  })
}

/** The lien the tab opens on: the one picked, else the first whose release the county has not recorded, else the first. */
export function pickReleaseTarget<T extends { affidavit: { id: string }; state: ReleaseState }>(targets: ReadonlyArray<T>, pickedId: string | null): T | null {
  return targets.find((t) => t.affidavit.id === pickedId) ?? targets.find((t) => t.state !== 'recorded') ?? targets[0] ?? null
}

/** The payment date the paper starts on: the day of the last payment, or today when the job has none. */
export function releasePaymentDay(payments: ReadonlyArray<LienPayoffPayment>, todayYmd: string): string {
  return (lastPayment(payments)?.paid_on ?? '').slice(0, 10) || todayYmd
}

export type ReleaseMoneyGate = {
  /** True while the tab holds its print and its save. */
  hold: boolean
  tone: 'red' | 'amber' | 'green'
  /** What the money says, with its values marked. */
  say: string
  /** What holds it or held it: money still open, or a check that has not cleared. Null when nothing does. */
  why: 'open' | 'check' | null
}

/** True when the tab needs the bank's check deposits: the bills read paid, last by a check of the last sixty days. */
export function releaseNeedsBank(open: number, payments: ReadonlyArray<LienPayoffPayment>, todayYmd: string): boolean {
  if (Math.round((Number(open) || 0) * 100) / 100 > 0.004) return false
  const paid = lastPayment(payments)
  return Boolean(paid && isCheckPayment(paid) && (paid.paid_on ?? '').slice(0, 10) >= ymdAddDays(todayYmd, -BANK_CHECK_WINDOW_DAYS))
}

/**
 * Whether money holds the release, and what the tab says about it. `bank` is the bank's check deposits: `undefined`
 * while they are being read and `null` when the read failed. Either holds a release that rests on a recent check,
 * so a slow or a failed read never lets one out early.
 */
export function releaseMoneyGate(input: { open: number; payments: ReadonlyArray<LienPayoffPayment>; todayYmd: string; anywayReason: string; bank?: ReadonlyArray<BankCheck> | null; funds?: FundsConfirmed | null }): ReleaseMoneyGate {
  const open = Math.round((Number(input.open) || 0) * 100) / 100
  const anyway = input.anywayReason.trim().length > 0
  if (open > 0.004) {
    const money = val('money', moneyWords(open))
    return anyway
      ? { hold: false, tone: 'amber', say: `${money} is still open on this job’s bills. The release goes out anyway.`, why: 'open' }
      : { hold: true, tone: 'red', say: `${money} is still open on this job’s bills. Record the payment first.`, why: 'open' }
  }
  const paid = lastPayment(input.payments)
  if (!paid) return { hold: false, tone: 'green', say: 'The bills read paid.', why: null }
  const ymd = (paid.paid_on ?? '').slice(0, 10)
  const way = payWayWords(paid)
  const said = `Paid ${val('day', formatYmdMonthDay(ymd))}${way ? ` by ${val('way', way)}` : ''}.`
  const held = (words: string, waits: string, tone: 'red' | 'amber'): ReleaseMoneyGate =>
    anyway ? { hold: false, tone: 'amber', say: `${said} ${words} The release goes out anyway.`, why: 'check' } : { hold: true, tone, say: [said, words, waits].filter(Boolean).join(' '), why: 'check' }
  if (!input.bank && releaseNeedsBank(open, input.payments, input.todayYmd)) return held(input.bank === null ? RELEASE_OF_RECORD_WORDS.bankUnread : RELEASE_OF_RECORD_WORDS.asking, '', 'amber')
  const answer = paymentCheckAnswer(paid, input.bank ?? [], input.todayYmd)
  if (answer.cleared) return { hold: false, tone: 'green', say: said, why: null }
  // The bank confirmed the funds, on a leader's, a controller's or a dev's word (#435, piece 4): the release may go, unless the check came back.
  if (input.funds && answer.state !== 'came_back' && answer.state !== 'unread') return { hold: false, tone: 'green', say: `${said} ${fundsConfirmedWords(input.funds)}`, why: null }
  const words = checkAnswerWords(answer, checkName(paid.reference_number))
  return held(words.say, `The release waits ${words.wait}.`, words.tone === 'red' ? 'red' : 'amber')
}

/**
 * What a saved release says when the bank sent back the check behind the job's last payment (#435, piece 6), with
 * its values marked. Null when that money stands, and while the bank's deposits are unread.
 */
export function releaseMoneyBackWords(input: { recorded: boolean; payments: ReadonlyArray<LienPayoffPayment>; bank: ReadonlyArray<BankCheck> | null | undefined; todayYmd: string }): string | null {
  const paid = lastPayment(input.payments)
  if (!paid || !input.bank) return null
  const answer = paymentCheckAnswer(paid, input.bank, input.todayYmd)
  if (!releaseOnReturnedCheck(answer)) return null
  const said = checkAnswerWords(answer, checkName(paid.reference_number)).say
  return input.recorded ? `${said} The county’s record stands. Ask counsel.` : `Do not record this release. ${said}`
}

/**
 * The fields a release saves: the paper's own, the affidavit it releases, and the reason it went out anyway. The
 * reason is `releasedUnpaidReason` when money was still open, and `releasedBeforeClearedReason` when the bills read
 * paid by a check the bank had not cleared. A release let go on a confirmation of the funds carries it as
 * `releasedOnConfirmedFunds`, so the paper's row says whose word it rested on.
 */
export function releaseSaveFields(paper: Record<string, unknown>, affidavitId: string, anywayReason: string, why: 'open' | 'check' | null = 'open', funds: FundsConfirmed | null = null): Record<string, unknown> {
  const reason = anywayReason.trim()
  return {
    ...paper,
    releasesFilingId: affidavitId,
    ...(reason && why ? { [why === 'check' ? 'releasedBeforeClearedReason' : 'releasedUnpaidReason']: reason } : {}),
    ...(funds ? { releasedOnConfirmedFunds: { by: funds.by, name: funds.name, at: funds.at, note: funds.note } } : {}),
  }
}

/** Why a recorded day cannot be kept, or null. */
export function releaseStampDayCheck(day: string, lienFiledYmd: string, todayYmd: string): string | null {
  if (!day) return null
  if (day > todayYmd) return RELEASE_OF_RECORD_WORDS.futureDay
  if (lienFiledYmd && day < lienFiledYmd.slice(0, 10)) return RELEASE_OF_RECORD_WORDS.beforeLien
  return null
}

/**
 * The county's stamp as a patch for the release row. `day` '' takes the recorded day back off; `instrument` ''
 * clears the number. A part left out is left alone.
 */
export function releaseStampPatch(release: Pick<LienPayoffRelease, 'fields'>, change: { instrument?: string; day?: string }): { filed_at?: string | null; fields?: Record<string, unknown> } {
  const patch: { filed_at?: string | null; fields?: Record<string, unknown> } = {}
  if (change.day !== undefined) patch.filed_at = change.day.trim() || null
  if (change.instrument !== undefined) {
    const base = release.fields && typeof release.fields === 'object' ? { ...(release.fields as Record<string, unknown>) } : {}
    const number = change.instrument.trim()
    if (number) base.releaseInstrument = number
    else delete base.releaseInstrument
    patch.fields = base
  }
  return patch
}

/** The recorded release in one line, its values marked: *Released. The county recorded it Dec 3 as 2026-0431955.* */
export function releaseRecordedSentence(release: Pick<LienPayoffRelease, 'fields' | 'filed_at'>): string | null {
  if (!release.filed_at) return null
  const day = val('day', formatYmdMonthDay(release.filed_at))
  const instrument = releaseOwnInstrument(release)
  return instrument ? `Released. The county recorded it ${day} as ${val('instrument', instrument)}.` : `Released. The county recorded it ${day}.`
}

/**
 * A lien payoff (punch list #435, piece 1): where each filed lien stands once money is in question, and the one
 * press that comes next. The owner's ask of 2026-11-24: the office goes to the Lien desk, sees *this person paid,
 * this is what you do*, and chooses buttons. The app does the thinking.
 *
 * A filed lien walks three steps, each read from what the app already holds:
 *   1. money    — the job's sent bills still owe (`lienBilledOpen`). The press opens the job's Bill tab.
 *   2. release  — the bills read paid and no release of record is saved. The press opens the Release of record tab.
 *   3. county   — a release is saved and the county has not recorded it. The press opens the same tab.
 *   done        — the release carries the day the county recorded it.
 *
 * A release belongs to its affidavit by the link it saves (`fields.releasesFilingId`), then by the instrument
 * number an older release copied from its affidavit, then, on a job with one filed lien, by being the job's only
 * release. The county's day is the release row's `filed_at`, set on the Release of record tab since piece 2
 * (`lienReleaseOfRecord.ts`).
 *
 * Since punch list #437, piece 1, a release waits for the bank (`checkCleared.ts`): bills paid by a check the bank
 * has not cleared stand on a step of their own, `bank`, with no release press. A place also says when a check for
 * exactly what pays its liens off is at the bank, and when it has cleared and is ready to record
 * (`LienPayoffPlace.bank`). The app counts the days and does not judge the law.
 *
 * Every sentence keeps to `plainWords.ts` and marks its values with `val`, so the screen draws them apart
 * (`ValueSentence`). Pure; tested beside it. The reads are `lienPayoffIo.ts`, the screen `LienPayoffs.tsx`.
 *
 * Since piece 3 it also gives each job's sent bills that still owe (`lienPayoffBills`) and the jobs at a place with
 * money open and no filed lien (`LienPayoffPlace.other`), for the check pane in `lienPayoffCheck.ts`.
 *
 * Since piece 4 each row carries the two facts a payoff keeps on the affidavit row (`lienPayoffFields.ts`): the day a
 * release was asked for in writing, and a leader's, a controller's or a dev's word that the bank confirmed the funds.
 * A confirmed check owes its release before the bank's day. Each step also carries the last payment and the bank's
 * answer, which the place's card reads (`lienPayoffCard.ts`).
 */
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../../utils/dateUtils'
import { moneyWords } from '../moneyParts'
import { val } from '../valuesInPlace'
import { formatYmdMonthDay } from './billedExpectedPay'
import { bankCheckAnswer, checkAnswerWords, checkName, paymentCheckAnswer, type BankCheck, type CheckAnswer } from './checkCleared'
import { isCheckPayment } from './checkClearing'
import { lienDeskJobNumber } from './lienJobLabel'
import { fundsConfirmedWords, payoffNote, type FundsConfirmed } from './lienPayoffFields'
import { attributeJobPayments } from './paymentAttribution'

/** `bank`: the bills read paid by a check the bank has not cleared. No release is offered. */
export type LienPayoffStepKey = 'money' | 'bank' | 'release' | 'county' | 'done'

/** Where a press lands: the job's Bill tab, or the Lien window's Release of record tab. */
export type LienPayoffDoor = 'bill' | 'release'

/** The kinds of value a payoff sentence marks. */
export type LienPayoffValueKind = 'money' | 'day' | 'way' | 'instrument' | 'count' | 'who'

/** `fields` holds the payoff's two facts since piece 4 (`lienPayoffFields.ts`); an older reader may leave it out. */
export type LienPayoffAffidavit = { id: string; job_id: string; amount: number | string | null; county: string | null; recording_number: string | null; filed_at: string | null; fields?: unknown }

export type LienPayoffRelease = { id: string; job_id: string; created_at: string; filed_at: string | null; recording_number: string | null; fields: unknown }

export type LienPayoffPayment = { amount: number | string | null; paid_on: string | null; payment_type: string | null; reference_number: string | null; mercury_transaction_id?: string | null }

export type LienPayoffJob = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id: string | null
  customer_name: string | null
}

/** A sent bill that still owes, as the check pane places money on it (`lienPayoffCheck.ts`). */
export type LienPayoffBill = {
  invoiceId: string
  jobId: string
  /** What the bill still owes. */
  open: number
  /** The day it was sent. '' when the bill carries none. */
  billedYmd: string
  /** The bill is a Stripe invoice: a part payment on it is a credit note, made in the bill's own window. */
  stripe: boolean
}

/** A job's sent bills that still owe, oldest first, each net of what it has been paid under the one payment rule. */
export function lienPayoffBills(
  jobId: string,
  invoices: ReadonlyArray<{ id: string; status: string | null; amount: number | string | null; sequence_order?: number | null; billed_at?: string | null; stripe_invoice_id?: string | null }>,
  payments: ReadonlyArray<{ invoice_id: string | null; amount: number | string | null }>,
  revenue: number | string | null,
): LienPayoffBill[] {
  const sent = invoices.filter((i) => i.status === 'billed' || i.status === 'paid')
  const paid = attributeJobPayments(sent, payments, revenue).byBill
  return sent
    .filter((i) => i.status === 'billed')
    .map((i) => ({
      invoiceId: i.id,
      jobId,
      open: Math.max(0, Math.round((num(i.amount) - (paid.get(i.id)?.applied ?? 0)) * 100) / 100),
      billedYmd: (i.billed_at ?? '').slice(0, 10),
      stripe: (i.stripe_invoice_id ?? '').trim().length > 0,
    }))
    .filter((b) => b.open > 0.004)
    .sort((a, b) => a.billedYmd.localeCompare(b.billedYmd) || a.invoiceId.localeCompare(b.invoiceId))
}

export type LienPayoffStep = {
  step: LienPayoffStepKey
  /** What happened and what comes next, with its values marked. */
  say: string
  /** A second line that asks for care, or null. */
  warn: string | null
  warnTone: 'amber' | 'red' | null
  /** The one press. Null once the lien is released, and while it waits for the bank. */
  press: { label: string; door: LienPayoffDoor } | null
  /** The release of record this lien already has, or null. */
  releaseId: string | null
  /** The last payment with a day and an amount: its day and how it came ('' when the row does not say). Null with none. */
  paid: { ymd: string; way: string } | null
  /** What the bank says of that payment (`checkCleared.ts`). Null with no payment. */
  check: CheckAnswer | null
  /** The day the county recorded the release, on `done` alone. */
  recordedYmd: string | null
}

/** The three steps as the window's legend reads them. */
export const LIEN_PAYOFF_STEPS: ReadonlyArray<{ key: Exclude<LienPayoffStepKey, 'done' | 'bank'>; label: string }> = [
  { key: 'money', label: 'Record the payment' },
  { key: 'release', label: 'Make the release and sign it before a notary' },
  { key: 'county', label: 'Record it at the county and save the stamp' },
]

export const LIEN_PAYOFF_WORDS = {
  title: 'Payoffs',
  sub: 'A filed lien stays on record until the county records its release.',
  /** The desk's press that opens the window. */
  open: 'Someone paid ›',
  released: 'Released',
  /** In the press's place while a check has not cleared. */
  waiting: 'Waits for the bank',
  /** The press on a lien whose check came back. */
  cameBack: 'Open the bills ›',
  readFailed: 'The filed liens could not be read.',
} as const

const ORDER: ReadonlyArray<LienPayoffStepKey> = ['money', 'bank', 'release', 'county', 'done']

/** How one of the three steps stands for a lien on `at`: behind it, on it, or ahead of it. */
export function lienPayoffStepState(at: LienPayoffStepKey, key: Exclude<LienPayoffStepKey, 'done' | 'bank'>): 'done' | 'now' | 'later' {
  const a = ORDER.indexOf(at)
  const k = ORDER.indexOf(key)
  return k < a ? 'done' : k === a ? 'now' : 'later'
}

const num = (v: number | string | null | undefined): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const field = (fields: unknown, key: string): string => {
  if (!fields || typeof fields !== 'object') return ''
  const v = (fields as Record<string, unknown>)[key]
  return typeof v === 'string' ? v.trim() : ''
}

/** The affidavit a saved release names, or '' for a release saved before the link existed. */
export function releaseAffidavitId(release: Pick<LienPayoffRelease, 'fields'>): string {
  return field(release.fields, 'releasesFilingId')
}

/** The instrument number the county gave the release itself, or ''. */
export function releaseOwnInstrument(release: Pick<LienPayoffRelease, 'fields'>): string {
  return field(release.fields, 'releaseInstrument')
}

/**
 * The release of record that belongs to this affidavit, the newest when there are two. `affidavitsOnJob` is how
 * many live filed affidavits the job holds: only a job with one may claim a release that names no affidavit.
 */
export function releaseForAffidavit<R extends LienPayoffRelease>(affidavit: LienPayoffAffidavit, releases: ReadonlyArray<R>, affidavitsOnJob: number): R | null {
  const mine = releases.filter((r) => r.job_id === affidavit.job_id)
  const newest = (list: R[]): R | null => (list.length ? [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]! : null)
  const linked = mine.filter((r) => releaseAffidavitId(r) === affidavit.id)
  if (linked.length) return newest(linked)
  const loose = mine.filter((r) => !releaseAffidavitId(r))
  const instrument = (affidavit.recording_number ?? '').trim()
  const byNumber = instrument ? loose.filter((r) => (r.recording_number ?? '').trim() === instrument) : []
  if (byNumber.length) return newest(byNumber)
  return affidavitsOnJob === 1 ? newest(loose) : null
}

/** The newest payment with a day and an amount, or null. */
export function lastPayment<P extends LienPayoffPayment>(payments: ReadonlyArray<P>): P | null {
  let last: P | null = null
  for (const p of payments) {
    const ymd = (p.paid_on ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !(num(p.amount) > 0)) continue
    if (!last || ymd > (last.paid_on ?? '').slice(0, 10)) last = p
  }
  return last
}

/** How a payment came, as the sentence says it: *check 1184*, *cash*, *card*. '' when the row does not say. */
export function payWayWords(p: Pick<LienPayoffPayment, 'payment_type' | 'reference_number'>): string {
  const type = (p.payment_type ?? '').trim()
  if (!type) return ''
  if (isCheckPayment({ payment_type: type })) {
    const ref = (p.reference_number ?? '').trim()
    return ref ? `check ${ref}` : 'check'
  }
  if (/cash/i.test(type)) return 'cash'
  if (/wire/i.test(type)) return 'wire'
  if (/\bach\b|bank/i.test(type)) return 'bank transfer'
  if (/card|stripe/i.test(type)) return 'card'
  return ''
}

export type LienPayoffStepInput = {
  affidavit: LienPayoffAffidavit
  /** Every live release of record on the job. */
  releases: ReadonlyArray<LienPayoffRelease>
  /** How many live filed affidavits the job holds. */
  affidavitsOnJob: number
  /** What the job's sent bills still owe (`lienBilledOpen`). */
  open: number
  /** Every payment on the job. */
  payments: ReadonlyArray<LienPayoffPayment>
  /** The bank's check deposits (`checkClearedIo.ts`). With none, a check waits seven days from the day typed. */
  bank?: ReadonlyArray<BankCheck>
  /** The bank confirmed the funds, on a leader's, a controller's or a dev's word (piece 4): the release is owed before the bank's day. */
  funds?: FundsConfirmed | null
  todayYmd: string
}

/** Where one filed lien stands and the one press that comes next. */
export function lienPayoffStep(input: LienPayoffStepInput): LienPayoffStep {
  const { affidavit, releases, affidavitsOnJob, payments, todayYmd } = input
  const open = Math.round(num(input.open) * 100) / 100
  const owes = open > 0.004
  const stillOpen = `${val('money', moneyWords(open))} is still open on this job’s bills.`
  const release = releaseForAffidavit(affidavit, releases, affidavitsOnJob)
  // The last payment and what the bank says of it ride on every step, for the place's card (piece 4) as much as this row.
  const lastPaid = lastPayment(payments)
  const paid = lastPaid ? { ymd: (lastPaid.paid_on ?? '').slice(0, 10), way: payWayWords(lastPaid) } : null
  const check = lastPaid ? paymentCheckAnswer(lastPaid, input.bank ?? [], todayYmd) : null
  const facts = { paid, check, recordedYmd: null as string | null }

  if (release?.filed_at) {
    const day = val('day', formatYmdMonthDay(release.filed_at))
    const instrument = releaseOwnInstrument(release)
    return {
      step: 'done',
      say: instrument ? `Released. The county recorded it ${day} as ${val('instrument', instrument)}.` : `Released. The county recorded it ${day}.`,
      warn: owes ? stillOpen : null,
      warnTone: owes ? 'red' : null,
      press: null,
      releaseId: release.id,
      ...facts,
      recordedYmd: release.filed_at.slice(0, 10),
    }
  }

  if (release) {
    const made = val('day', formatYmdMonthDay(calendarYmdInAppTzFromIso(release.created_at)))
    return {
      step: 'county',
      say: `The release was made ${made}. Sign it before a notary. Then record it at the county.`,
      warn: owes ? stillOpen : null,
      warnTone: owes ? 'red' : null,
      press: { label: 'Record the county’s stamp ›', door: 'release' },
      releaseId: release.id,
      ...facts,
    }
  }

  if (owes) {
    const partPaid = payments.some((p) => num(p.amount) > 0) && open < num(affidavit.amount) - 0.004
    return {
      step: 'money',
      say: partPaid ? `Part paid. ${stillOpen}` : stillOpen,
      warn: null,
      warnTone: null,
      press: { label: 'Record the payment ›', door: 'bill' },
      releaseId: null,
      ...facts,
    }
  }

  const said = paid ? `Paid ${val('day', formatYmdMonthDay(paid.ymd))}${paid.way ? ` by ${val('way', paid.way)}` : ''}.` : 'The bills read paid.'
  const makeRelease = { label: 'Make the release ›', door: 'release' as const }
  // A release rests on money the bank has made good: a check that has not cleared holds the lien on `bank`.
  if (lastPaid && check && !check.cleared) {
    const bad = check.state === 'came_back' || check.state === 'unread'
    // Unless a leader, a controller or a dev said the bank confirmed the funds (piece 4): then the release is owed now.
    if (input.funds && !bad) {
      return { step: 'release', say: `${said} ${fundsConfirmedWords(input.funds)} The release is owed.`, warn: null, warnTone: null, press: makeRelease, releaseId: null, ...facts }
    }
    const words = checkAnswerWords(check, checkName(lastPaid.reference_number))
    return {
      step: 'bank',
      say: said,
      warn: `${words.say} The release waits ${words.wait}.`,
      warnTone: words.tone === 'red' ? 'red' : 'amber',
      press: check.state === 'came_back' ? { label: LIEN_PAYOFF_WORDS.cameBack, door: 'bill' } : null,
      releaseId: null,
      ...facts,
    }
  }
  return { step: 'release', say: `${said} The release is owed.`, warn: null, warnTone: null, press: makeRelease, releaseId: null, ...facts }
}

// ---------- The rows and their places ----------

export type LienPayoffRow = {
  affidavitId: string
  jobId: string
  jobNumber: string
  jobName: string
  county: string
  instrument: string
  filedYmd: string
  /** The amount the affidavit claimed. */
  lienAmount: number
  /** What the job's sent bills still owe. */
  open: number
  step: LienPayoffStep
  /** The day a release was asked for in writing, or '' (piece 4, `lienPayoffFields.ts`). */
  askedYmd: string
  /** The bank confirmed the funds, on whose word and when, or null. */
  funds: FundsConfirmed | null
  /** The affidavit row's `fields` as read, so a write can keep every other field. */
  fields: unknown
}

export type LienPayoffPlace = {
  key: string
  /** The property's address as the first job writes it. */
  place: string
  /** The customers on the place's jobs, each named once: at a home, the property owner. */
  payer: string
  /** What the office is told about the place, with its values marked. */
  headline: string
  rows: LienPayoffRow[]
  /** Jobs at the place with money open and no filed lien: a release must not be read as covering them. */
  other: LienPayoffOther[]
  /** A check at the bank for exactly what pays the place's liens off, not yet recorded. Null when there is none. */
  bank: LienPlaceCheck | null
}

/** How far back a bank deposit may be and still be read as the check for a place. */
export const PLACE_CHECK_DAYS = 21

/** The bank's check that fits a place, with what the bank says about it. */
export type LienPlaceCheck = { check: BankCheck; answer: CheckAnswer; say: string; tone: 'red' | 'amber' | 'green' }

/**
 * The bank's check for a place: a recent deposit for exactly what its liens' open bills come to, or that plus
 * the money open there with no lien. Once the check is recorded the bills no longer owe that, and the line goes.
 */
export function lienPlaceCheck(rows: ReadonlyArray<LienPayoffRow>, other: ReadonlyArray<LienPayoffOther>, checks: ReadonlyArray<BankCheck>, todayYmd: string): LienPlaceCheck | null {
  const cents = (n: number): number => Math.round(n * 100)
  const openByJob = new Map<string, number>()
  for (const r of rows) if (r.step.step === 'money') openByJob.set(r.jobId, cents(r.open))
  const liens = [...openByJob.values()].reduce((s, c) => s + c, 0)
  if (liens <= 0) return null
  const all = liens + other.reduce((s, o) => s + cents(o.open), 0)
  const since = ymdAddDays(todayYmd, -PLACE_CHECK_DAYS)
  const fits = checks.filter((c) => c.depositedYmd >= since && (cents(c.amount) === liens || cents(c.amount) === all)).sort((a, b) => b.depositedYmd.localeCompare(a.depositedYmd) || b.id.localeCompare(a.id))
  const check = fits[0]
  if (!check) return null
  const answer = bankCheckAnswer(check, todayYmd)
  const words = checkAnswerWords(answer, checkName(check.checkNumber), check.amount)
  const tail = answer.state === 'cleared' ? 'It is ready to record.' : answer.state === 'unread' ? '' : answer.state === 'came_back' ? 'Nothing was recorded.' : `Nothing is recorded ${words.wait}.`
  return { check, answer, say: [words.say, tail].filter(Boolean).join(' '), tone: words.tone }
}

/** A job at a place with bills still open and no filed lien. */
export type LienPayoffOther = { jobId: string; jobNumber: string; jobName: string; open: number }

/** The line under a place's liens for money open there with no lien: *$640.00 more is open here on 2071. It is not liened.* */
export function lienPayoffOtherLine(other: ReadonlyArray<LienPayoffOther>): string | null {
  if (other.length === 0) return null
  const sum = other.reduce((s, o) => s + o.open, 0)
  const jobs = other.map((o) => o.jobNumber).join(', ')
  return `${val('money', moneyWords(sum))} more is open here on ${jobs}. It is not liened.`
}

/**
 * One key for a place however its jobs spell it: the house number and the street's first word.
 * *212 Larkspur Ct, Austin* and *212 Larkspur Court Austin, TX* are one place. A lien sits on the property, so
 * the customer is not part of the key: two jobs at one address under two customers are one place with two payers.
 */
export function lienPlaceKey(address: string | null): string {
  const a = (address ?? '').toLowerCase().replace(/[.,#]/g, ' ').trim()
  const m = /^(\d+[a-z]?)\s+(?:(?:n|s|e|w|north|south|east|west)\s+)?([a-z0-9]+)/.exec(a)
  return m ? `${m[1]} ${m[2]}` : a.replace(/\s+/g, ' ')
}

const lien = (n: number): string => (n === 1 ? 'lien' : 'liens')

/** The line under a place's name: what clears its liens, or what is owed on them. */
export function lienPayoffPlaceHeadline(rows: ReadonlyArray<LienPayoffRow>): string {
  const at = (k: LienPayoffStepKey) => rows.filter((r) => r.step.step === k)
  const money = at('money')
  const owed = at('release').length
  const county = at('county').length
  const bank = at('bank').length
  if (money.length) {
    const sum = money.reduce((s, r) => s + r.open, 0)
    const paid = owed + county + bank
    const rest = paid > 0 ? ` ${val('count', String(paid))} more ${paid === 1 ? 'is' : 'are'} paid.` : ''
    return `${val('count', String(money.length))} ${lien(money.length)} on record here. ${val('money', moneyWords(sum))} pays ${money.length === 1 ? 'it' : 'them'} off.${rest}`
  }
  if (owed) return `Paid. ${val('count', String(owed))} ${owed === 1 ? 'release is' : 'releases are'} owed here.`
  if (bank) return `Paid by a check that has not cleared. ${val('count', String(bank))} ${bank === 1 ? 'release waits' : 'releases wait'} for the bank.`
  if (county) return `${val('count', String(county))} ${county === 1 ? 'release waits' : 'releases wait'} for the county’s stamp.`
  return rows.length === 1 ? 'The lien here is released.' : 'Every lien here is released.'
}

/**
 * Which place comes first: a release owed or a cleared check to record, then one waiting for the bank, then one
 * out for its stamp, then money still owed, then the released.
 */
function placeRank(place: Pick<LienPayoffPlace, 'rows' | 'bank'>): number {
  const has = (k: LienPayoffStepKey) => place.rows.some((r) => r.step.step === k)
  if (has('release') || place.bank?.answer.cleared) return 0
  if (has('bank') || place.bank) return 1
  if (has('county')) return 2
  if (has('money')) return 3
  return 4
}

export type LienPayoffFacts = {
  /** Live filed affidavits and live releases of record. */
  affidavits: ReadonlyArray<LienPayoffAffidavit>
  releases: ReadonlyArray<LienPayoffRelease>
  jobs: ReadonlyArray<LienPayoffJob>
  /** What each job's sent bills still owe, by job id. */
  openByJob: Readonly<Record<string, number>>
  paymentsByJob: Readonly<Record<string, ReadonlyArray<LienPayoffPayment>>>
  /** Each job's sent bills that still owe (piece 3), for the check pane. */
  billsByJob?: Readonly<Record<string, ReadonlyArray<LienPayoffBill>>>
  /** Billed jobs of the same customers with no filed lien (piece 3): those at a liened place show under it. */
  otherJobs?: ReadonlyArray<LienPayoffJob>
  /** The bank's check deposits (#437, piece 1). With none, a check waits seven days from the day typed. */
  bank?: ReadonlyArray<BankCheck>
  todayYmd: string
}

/** Every filed lien as a row under its place, the places that need a press first. */
export function lienPayoffPlaces(facts: LienPayoffFacts): LienPayoffPlace[] {
  const jobById = new Map(facts.jobs.map((j) => [j.id, j]))
  const filed = facts.affidavits.filter((a) => a.filed_at)
  const onJob = new Map<string, number>()
  for (const a of filed) onJob.set(a.job_id, (onJob.get(a.job_id) ?? 0) + 1)
  const byPlace = new Map<string, LienPayoffPlace>()
  for (const a of filed) {
    const job = jobById.get(a.job_id)
    const open = facts.openByJob[a.job_id] ?? 0
    const note = payoffNote(a.fields)
    const row: LienPayoffRow = {
      affidavitId: a.id,
      jobId: a.job_id,
      jobNumber: lienDeskJobNumber(job, a.job_id),
      jobName: (job?.job_name ?? '').trim(),
      county: (a.county ?? '').trim(),
      instrument: (a.recording_number ?? '').trim(),
      filedYmd: (a.filed_at ?? '').slice(0, 10),
      lienAmount: num(a.amount),
      open,
      step: lienPayoffStep({ affidavit: a, releases: facts.releases, affidavitsOnJob: onJob.get(a.job_id) ?? 1, open, payments: facts.paymentsByJob[a.job_id] ?? [], bank: facts.bank, funds: note.funds, todayYmd: facts.todayYmd }),
      askedYmd: note.askedYmd,
      funds: note.funds,
      fields: a.fields ?? null,
    }
    const key = (job && lienPlaceKey(job.job_address)) || `job|${a.job_id}`
    const place = byPlace.get(key) ?? { key, place: (job?.job_address ?? '').trim() || 'A job with no address', payer: '', headline: '', rows: [], other: [], bank: null }
    const name = (job?.customer_name ?? '').trim()
    if (name && !place.payer.split(', ').includes(name)) place.payer = place.payer ? `${place.payer}, ${name}` : name
    place.rows.push(row)
    byPlace.set(key, place)
  }
  // Money open at a liened place on a job with no filed lien: shown, never folded into what pays the liens off.
  const liened = new Set(filed.map((a) => a.job_id))
  for (const job of facts.otherJobs ?? []) {
    if (liened.has(job.id)) continue
    const open = facts.openByJob[job.id] ?? 0
    const place = open > 0.004 ? byPlace.get(lienPlaceKey(job.job_address)) : undefined
    if (place && !place.other.some((o) => o.jobId === job.id)) place.other.push({ jobId: job.id, jobNumber: lienDeskJobNumber(job, job.id), jobName: (job.job_name ?? '').trim(), open })
  }
  const places = [...byPlace.values()]
  for (const p of places) {
    p.other.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }))
    p.rows.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }) || a.instrument.localeCompare(b.instrument))
    p.headline = lienPayoffPlaceHeadline(p.rows)
    p.bank = lienPlaceCheck(p.rows, p.other, facts.bank ?? [], facts.todayYmd)
  }
  return places.sort((a, b) => placeRank(a) - placeRank(b) || a.place.localeCompare(b.place))
}

export type LienPayoffStrip = {
  /** Paid, with no release saved. */
  owed: number
  /** A release saved, the county's stamp not recorded. */
  county: number
  /** Money still owed. */
  onRecord: number
  /** Paid by a check the bank has not cleared. */
  bank: number
  /** Places with a cleared check at the bank that is not recorded yet. */
  toRecord: number
  /** Places with a check at the bank that has not cleared. */
  atBank: number
  released: number
  /** The desk's one line, with its count marked. Null when no lien has been filed. */
  say: string | null
  tone: 'amber' | 'plain'
}

/** The desk's one line over its lists: what waits on a release, or how many liens stand filed. */
export function lienPayoffStrip(places: ReadonlyArray<LienPayoffPlace>): LienPayoffStrip {
  const rows = places.flatMap((p) => p.rows)
  const count = (k: LienPayoffStepKey) => rows.filter((r) => r.step.step === k).length
  const owed = count('release')
  const county = count('county')
  const onRecord = count('money')
  const bank = count('bank')
  const released = count('done')
  const toRecord = places.filter((p) => p.bank?.answer.cleared).length
  const atBank = places.filter((p) => p.bank && !p.bank.answer.cleared && p.bank.answer.state !== 'came_back').length
  let say: string | null = null
  if (owed) say = `${val('count', String(owed))} ${owed === 1 ? 'lien is' : 'liens are'} paid and still on record.`
  else if (toRecord) say = `${val('count', String(toRecord))} ${toRecord === 1 ? 'check has' : 'checks have'} cleared for liens on record. Record ${toRecord === 1 ? 'it' : 'them'}.`
  else if (county) say = `${val('count', String(county))} ${county === 1 ? 'release waits' : 'releases wait'} for the county’s stamp.`
  else if (bank) say = `${val('count', String(bank))} paid ${lien(bank)} ${bank === 1 ? 'waits' : 'wait'} for the bank to clear a check.`
  else if (atBank) say = `${val('count', String(atBank))} ${atBank === 1 ? 'check' : 'checks'} for liens on record ${atBank === 1 ? 'is' : 'are'} at the bank.`
  else if (onRecord) say = `${val('count', String(onRecord))} filed ${lien(onRecord)} on record.`
  else if (released) say = released === 1 ? 'The filed lien is released.' : 'Every filed lien is released.'
  return { owed, county, onRecord, bank, toRecord, atBank, released, say, tone: owed || county || toRecord ? 'amber' : 'plain' }
}

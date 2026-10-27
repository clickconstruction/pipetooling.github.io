/**
 * Money in: this week, and what last week still owes (punch list #191).
 * The week line under the Dashboard's Financials cards: what landed this week,
 * what is still on its way with a day on each chip, and what last week expected
 * that never came. Pure — the loader beside it does the reads; this file only
 * decides where each dollar sits, and makes sure it sits in one place:
 *
 *   landed     money in the bank or in Stripe this week: a Stripe payment on
 *              the day it was paid; a payment matched to a deposit on the day
 *              the deposit posted; a posted deposit nobody has applied yet; a
 *              non-check payment typed in by hand (an ACH, a wire, cash)
 *   at the bank a deposit still pending at Mercury, on the bank day it should post
 *   the drawer checks typed in but not yet seen at the bank — no day yet; after
 *              AR_UNBANKED_CHECK_DAYS they are Accounts Receivable's "never
 *              deposited" cases instead, and the shelf only counts them
 *   came back  an open return case (the Accounts Receivable window's own list),
 *              red on its day; the payments still carrying it never count as landed
 *   expected   an open claim on the day the money should land, a promise on its
 *              day, an open bill on the day its payer's pace says (a guess — a
 *              hosted Stripe bill too: the link says how they will pay, not when)
 *
 * A deposit is matched first to a recorded payment of the same amount (that is
 * the check in the drawer reaching the bank), else to an open bill of the same
 * amount (that is the bill's money arriving) — so the same dollars never show
 * twice. A Stripe payout is drawn on the day it lands but never summed: it is
 * landed card money reaching the bank, and Mercury deposits from Stripe are
 * left out for the same reason. Weeks run Monday–Sunday.
 */
import { isCheckPayment } from './jobs/checkClearing'
import { instrumentWord } from './jobs/billsAndPayments'
import { claimOpen, type PaidClaim } from './jobs/paidClaims'
import { arRowInvoiceId } from './bridge/collect/collectBills'
import { MAILED_CHECK_DAYS, mailedCheckYmd } from './bridge/collect/collectOutcome'
import type { CollectBillRead } from './bridge/collect/collectPile'
import { AR_UNBANKED_CHECK_DAYS } from '../../supabase/functions/_shared/bankReturnedDeposits'
import { ymdAddDays } from '../utils/dateUtils'

/** Business days a pending Mercury deposit usually takes to post: Friday's deposit posts Tuesday. */
export const PENDING_POSTS_BUSINESS_DAYS = 2
/** Days a claimed online payment or bank transfer takes to land, when it was not a mailed check. */
export const CLAIM_OTHER_ARRIVES_DAYS = 2
/** Dollars two amounts may differ by and still be the same money. */
export const MATCH_TOLERANCE_USD = 1
/** A payment typed in up to this many days before a deposit can be that deposit. */
export const MATCH_LOOKBACK_DAYS = 30
/** A check typed in more than this many days ago without reaching the bank leaves the drawer for Accounts Receivable's cases. */
export const DRAWER_DAYS = AR_UNBANKED_CHECK_DAYS

export type MoneyInRowKind = 'landed' | 'drawer' | 'bank' | 'returned' | 'sent-claim' | 'word' | 'pace' | 'stripe-payout'
export type MoneyInDoorKind = 'deposits' | 'job' | 'banking' | 'return-case'

export type MoneyInRow = {
  key: string
  kind: MoneyInRowKind
  /** The chip's small tag: "Landed · check #4417", "Their word · 3 days past". */
  tag: string
  payerName: string
  usd: number
  /** True when usd is the open money a word or claim covers, not a stated figure. */
  coversOpen: boolean
  /** The day column the chip sits on; null in the drawer and in last week's column. */
  dayYmd: string | null
  /** The day the money was really expected, when the chip slid forward to today or into last week's column. */
  wasYmd: string | null
  /** One plain line under the name: "check #4471 · recorded Fri". */
  sub: string
  /** A check number when one is known, without the #. */
  reference: string | null
  /** The day the thing behind the chip happened: recorded, deposited, posted, paid, came back. */
  eventYmd: string | null
  jobId: string | null
  door: MoneyInDoorKind
  /** False on the payout chip and on this week's came-back chips: drawn, never summed. */
  counted: boolean
}

export type MoneyInDay = { ymd: string; isToday: boolean; landedUsd: number; expectedUsd: number; rows: MoneyInRow[] }

export type MoneyInWeekView = {
  weekMondayYmd: string
  todayYmd: string
  cameIn: { usd: number; count: number }
  /** Everything still on its way this week, the drawer included. */
  expected: { usd: number; count: number }
  carried: { stillOutUsd: number; count: number; rows: MoneyInRow[] }
  drawer: { usd: number; count: number; rows: MoneyInRow[]; olderUnbankedCount: number }
  /** Came-back chips this week and last. */
  returnedCount: number
  /** Monday through Sunday, every day present even when empty. */
  days: MoneyInDay[]
}

export type MoneyInPayment = {
  paymentId: string
  jobId: string | null
  usd: number
  paidOnYmd: string | null
  paymentType: string | null
  note: string | null
  referenceNumber: string | null
  payerName: string
  /** The Mercury deposit Accounts Receivable matched this payment to, if any. */
  bankTransactionId: string | null
}

/** A recorded payment no deposit carries yet (`list_unlinked_payments_for_bank_payments`). */
export type MoneyInUnlinkedPayment = {
  paymentId: string
  jobId: string | null
  usd: number
  paidOnYmd: string | null
  paymentType: string | null
  referenceNumber: string | null
  payerName: string
}

export type MoneyInDeposit = {
  mercuryTransactionId: string
  /** Pending: the amount. Posted: what is still not applied to a bill. */
  usd: number
  kind: string | null
  counterpartyName: string | null
  state: 'pending' | 'posted'
  /** Pending: the day it was made. Posted: the day it posted. */
  dayYmd: string | null
}

/** An open return case, in the Accounts Receivable window's own words. */
export type MoneyInReturn = {
  id: string
  payerName: string
  usd: number
  cameBackYmd: string | null
  /** "came back · Insufficient funds", "never reached the bank". */
  chip: string
  /** Payments still carrying the money that came back: they never count as landed. */
  livePaymentIds: ReadonlyArray<string>
  jobId: string | null
}

export type MoneyInStripePayout = { usd: number; arrivalYmd: string | null }

export type MoneyInWeekInput = {
  /** Every payment typed in since a few weeks before last Monday, matched to a deposit or not. */
  payments: ReadonlyArray<MoneyInPayment>
  unlinked: ReadonlyArray<MoneyInUnlinkedPayment>
  /** Customer deposits: pending ones, and posted ones with money not yet applied. */
  deposits: ReadonlyArray<MoneyInDeposit>
  /** Mercury transaction id → the deposit a matched payment sits in: the day it posted and its kind. */
  linkedDeposits: ReadonlyMap<string, { postedYmd: string | null; kind: string | null }>
  returns: ReadonlyArray<MoneyInReturn>
  /** Open "never deposited" cases: checks typed in long ago the bank never saw. */
  unbankedCount: number
  /** Every open bill read against its payer's pace (buildCollectPile). */
  pile: ReadonlyArray<CollectBillRead>
  claims: ReadonlyArray<PaidClaim> | null
  /** Invoice ids whose bill is a live hosted Stripe invoice. */
  stripeOpenInvoiceIds: ReadonlySet<string>
  payout: MoneyInStripePayout | null
  todayYmd: string
}

/** The Monday of the week holding this day (the company's weeks run Mon–Sun). */
export function weekMondayContaining(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return ymdAddDays(ymd, -((day + 6) % 7))
}

const DAY_WORDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function utcDay(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay() : null
}

/** "today", a weekday word inside this week and last, else "Oct 12". */
export function dayWord(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return 'today'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const monday = weekMondayContaining(todayYmd)
  if (monday && ymd >= ymdAddDays(monday, -7) && ymd <= ymdAddDays(monday, 6)) return DAY_WORDS[utcDay(ymd)!]!
  return `${MONTH_WORDS[Number(m[2]) - 1]} ${Number(m[3])}`
}

/** "Mon 26" for a day column's head. */
export function dayColumnLabel(ymd: string): string {
  const d = utcDay(ymd)
  return d == null ? ymd : `${DAY_WORDS[d]} ${Number(ymd.slice(8, 10))}`
}

/** The day `n` bank days after this one (Saturday and Sunday do not count). */
export function addBusinessDays(ymd: string, n: number): string {
  let out = ymd
  let left = n
  while (left > 0) {
    out = ymdAddDays(out, 1)
    const d = utcDay(out)
    if (d !== 0 && d !== 6) left -= 1
  }
  return out
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00Z`)
  const b = Date.parse(`${toYmd}T12:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0
}

/** A recorded Stripe payment: the webhook writes the row with this note. */
export function isStripePayment(p: { note?: string | null }): boolean {
  return (p.note ?? '').trim().toLowerCase() === 'stripe'
}

/** Mercury kinds that are never a customer paying us. */
const NOT_CUSTOMER_KINDS = new Set([
  'internalTransfer',
  'treasuryTransfer',
  'debitCardTransaction',
  'creditCardTransaction',
  'creditCardCredit',
  'outgoingPayment',
  'wireFee',
  'cardInternationalTransactionFee',
])

/** The org's Accounts Receivable deposit filter (`app_settings` bank_payments_sorting_config_v1). */
export type MoneyInDepositFilter = {
  kinds: ReadonlyArray<string>
  excludeCounterpartyContains: ReadonlyArray<string>
  excludeNoteContains: ReadonlyArray<string>
}

/**
 * A Mercury row that is a customer paying us, by the same filter the Accounts
 * Receivable window lists deposits with — and never a Stripe payout, which the
 * payout chip already carries.
 */
export function isCustomerDeposit(tx: { usd: number; kind: string | null; counterpartyName: string | null; note?: string | null }, filter: MoneyInDepositFilter | null): boolean {
  if (!(tx.usd > 0)) return false
  const kind = tx.kind ?? ''
  if (NOT_CUSTOMER_KINDS.has(kind)) return false
  const counterparty = (tx.counterpartyName ?? '').toLowerCase()
  if (counterparty.includes('stripe')) return false
  if (filter) {
    if (filter.kinds.length > 0 && !filter.kinds.includes(kind)) return false
    if (filter.excludeCounterpartyContains.some((p) => p.trim() !== '' && counterparty.includes(p.trim().toLowerCase()))) return false
    const note = (tx.note ?? '').toLowerCase()
    if (filter.excludeNoteContains.some((p) => p.trim() !== '' && note.includes(p.trim().toLowerCase()))) return false
  }
  return true
}

/** "check deposit", "bank transfer", "wire", "deposit". */
export function depositKindWord(kind: string | null): string {
  switch (kind) {
    case 'checkDeposit':
      return 'check deposit'
    case 'externalTransfer':
    case 'ach':
      return 'bank transfer'
    case 'incomingDomesticWire':
    case 'incomingInternationalWire':
      return 'wire'
    default:
      return 'deposit'
  }
}

/** "ACH", "wire", "card", "cash", "payment" — for a non-check payment typed in by hand. */
function paymentWord(paymentType: string | null): string {
  const w = instrumentWord(paymentType)
  if (w === 'ach') return 'ACH'
  return w && w !== 'check' ? w : 'payment'
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

const CLAIM_SAYS: Record<string, string> = {
  check_mailed: 'check mailed',
  paid_online: 'paid online',
  bank_transfer: 'sent a bank transfer',
  card_by_phone: 'paid by card',
  not_sure: 'paid',
}

function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
}

const KIND_ORDER: Record<MoneyInRowKind, number> = {
  returned: 0,
  landed: 1,
  bank: 2,
  drawer: 3,
  'sent-claim': 4,
  word: 5,
  pace: 6,
  'stripe-payout': 7,
}

const byKindThenSize = (a: MoneyInRow, b: MoneyInRow): number => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.usd - a.usd

export function buildMoneyInWeek(input: MoneyInWeekInput): MoneyInWeekView {
  const todayYmd = input.todayYmd
  const weekMonday = weekMondayContaining(todayYmd) ?? todayYmd
  const weekSunday = ymdAddDays(weekMonday, 6)
  const lastMonday = ymdAddDays(weekMonday, -7)
  const lastSunday = ymdAddDays(weekMonday, -1)
  const inThisWeek = (ymd: string | null): ymd is string => ymd != null && ymd >= weekMonday && ymd <= weekSunday
  const inLastWeek = (ymd: string | null): ymd is string => ymd != null && ymd >= lastMonday && ymd <= lastSunday
  /** An expected day that already passed this week reads today: it is still expected. */
  const onLine = (ymd: string): string => (ymd < todayYmd ? todayYmd : ymd)
  const word = (ymd: string): string => dayWord(ymd, todayYmd)

  const dayRows = new Map<string, MoneyInRow[]>()
  for (let i = 0; i < 7; i++) dayRows.set(ymdAddDays(weekMonday, i), [])
  const put = (row: MoneyInRow): void => {
    if (row.dayYmd) dayRows.get(row.dayYmd)?.push(row)
  }
  const carriedRows: MoneyInRow[] = []
  const drawerRows: MoneyInRow[] = []
  const blank = { coversOpen: false, wasYmd: null, reference: null, eventYmd: null, jobId: null, counted: true } as const

  // ── Came back: open return cases, never landed ──────────────────────────
  const returnedPaymentIds = new Set<string>()
  let returnedCount = 0
  for (const r of input.returns) {
    for (const id of r.livePaymentIds) returnedPaymentIds.add(id)
    if (!(r.usd > 0)) continue
    const row: MoneyInRow = {
      ...blank,
      key: `returned:${r.id}`,
      kind: 'returned',
      tag: capitalize(r.chip),
      payerName: r.payerName,
      usd: r.usd,
      dayYmd: null,
      sub: r.cameBackYmd ? `came back ${word(r.cameBackYmd)}` : '',
      eventYmd: r.cameBackYmd,
      jobId: r.jobId,
      door: 'return-case',
    }
    if (inThisWeek(r.cameBackYmd) && r.cameBackYmd <= todayYmd) {
      put({ ...row, dayYmd: r.cameBackYmd, counted: false })
      returnedCount += 1
    } else if (inLastWeek(r.cameBackYmd)) {
      carriedRows.push(row)
      returnedCount += 1
    }
  }

  const landed = (row: Omit<MoneyInRow, 'kind' | 'coversOpen' | 'wasYmd' | 'counted'>): void => {
    put({ ...row, kind: 'landed', coversOpen: false, wasYmd: null, counted: true })
  }

  // ── Landed: Stripe payments, and payments matched to a deposit ──────────
  for (const p of input.payments) {
    if (!(p.usd > 0) || returnedPaymentIds.has(p.paymentId)) continue
    let day: string | null
    let tag: string
    let sub: string
    if (isStripePayment(p)) {
      day = p.paidOnYmd
      tag = 'Landed · Stripe'
      sub = day ? `paid ${word(day)}` : ''
    } else if (p.bankTransactionId) {
      const dep = input.linkedDeposits.get(p.bankTransactionId)
      day = dep?.postedYmd ?? p.paidOnYmd
      const typed = instrumentWord(p.paymentType)
      tag =
        isCheckPayment({ payment_type: p.paymentType }) || (typed == null && dep?.kind === 'checkDeposit')
          ? `Landed · check${p.referenceNumber ? ` #${p.referenceNumber}` : ''}`
          : `Landed · ${typed ? paymentWord(p.paymentType) : depositKindWord(dep?.kind ?? null)}`
      sub = day ? `posted ${word(day)}` : ''
    } else {
      // A payment no deposit carries yet is read from the unlinked list below.
      continue
    }
    if (!inThisWeek(day) || day > todayYmd) continue
    landed({ key: `landed:${p.paymentId}`, tag, payerName: p.payerName, usd: p.usd, dayYmd: day, sub, reference: p.referenceNumber, eventYmd: day, jobId: p.jobId, door: p.jobId ? 'job' : 'deposits' })
  }

  // ── Deposits meet what they pay ─────────────────────────────────────────
  const unlinked = input.unlinked.filter((u) => u.usd > 0 && !returnedPaymentIds.has(u.paymentId))
  const usedPayments = new Set<string>()
  const matchedBillKeys = new Set<string>()
  const matchedBillJobs = new Set<string>()
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= MATCH_TOLERANCE_USD

  const paymentFor = (d: MoneyInDeposit, dDay: string): MoneyInUnlinkedPayment | null => {
    const from = ymdAddDays(dDay, -MATCH_LOOKBACK_DAYS)
    const to = ymdAddDays(dDay, 3)
    const checkDeposit = d.kind === 'checkDeposit'
    const candidates = unlinked.filter((u) => !usedPayments.has(u.paymentId) && near(u.usd, d.usd) && (u.paidOnYmd == null || (u.paidOnYmd >= from && u.paidOnYmd <= to)))
    candidates.sort(
      (a, b) =>
        Number(isCheckPayment({ payment_type: b.paymentType }) === checkDeposit) - Number(isCheckPayment({ payment_type: a.paymentType }) === checkDeposit) ||
        Math.abs(a.usd - d.usd) - Math.abs(b.usd - d.usd) ||
        (b.paidOnYmd ?? '').localeCompare(a.paidOnYmd ?? ''),
    )
    return candidates[0] ?? null
  }

  /** An open bill of the same amount — only when it is the one bill it can be. */
  const billFor = (d: MoneyInDeposit): CollectBillRead | null => {
    const candidates = input.pile.filter((b) => b.usd > 0 && b.state !== 'collections' && !matchedBillKeys.has(b.key) && near(b.usd, d.usd))
    if (candidates.length === 1) return candidates[0]!
    const words = nameWords(d.counterpartyName ?? '')
    const named = words.length ? candidates.filter((b) => nameWords(b.payerName).some((w) => words.includes(w))) : []
    return named.length === 1 ? named[0]! : null
  }

  const deposits = input.deposits
    .filter((d) => isCustomerDeposit({ usd: d.usd, kind: d.kind, counterpartyName: d.counterpartyName }, null))
    .sort((a, b) => (a.dayYmd ?? '').localeCompare(b.dayYmd ?? ''))
  for (const d of deposits) {
    const dDay = d.dayYmd ?? todayYmd
    const pay = paymentFor(d, dDay)
    const bill = pay ? null : billFor(d)
    if (pay) usedPayments.add(pay.paymentId)
    if (bill) {
      matchedBillKeys.add(bill.key)
      if (bill.jobId) matchedBillJobs.add(bill.jobId)
    }
    const payerName = pay?.payerName ?? bill?.payerName ?? ((d.counterpartyName ?? '').trim() || capitalize(depositKindWord(d.kind)))
    const reference = pay?.referenceNumber ?? null
    const what = reference ? `check #${reference}` : depositKindWord(d.kind)
    const jobId = pay?.jobId ?? bill?.jobId ?? null
    if (d.state === 'pending') {
      const posts = onLine(addBusinessDays(dDay, PENDING_POSTS_BUSINESS_DAYS))
      if (posts > weekSunday) continue
      put({
        ...blank,
        key: `bank:${d.mercuryTransactionId}`,
        kind: 'bank',
        tag: 'At the bank',
        payerName,
        usd: d.usd,
        dayYmd: posts,
        sub: `${what} · deposited ${word(dDay)} · posts ~${word(posts)}`,
        reference,
        eventYmd: dDay,
        jobId,
        door: 'deposits',
      })
    } else {
      if (!inThisWeek(dDay) || dDay > todayYmd) continue
      const matched = pay != null || bill != null
      landed({
        key: `deposit:${d.mercuryTransactionId}`,
        tag: matched ? (reference ? `Landed · check #${reference}` : `Landed · ${depositKindWord(d.kind)}`) : 'Landed · not applied yet',
        payerName,
        usd: d.usd,
        dayYmd: dDay,
        sub: matched ? `posted ${word(dDay)} · not applied yet` : `${what} · posted ${word(dDay)}`,
        reference,
        eventYmd: dDay,
        jobId,
        door: 'deposits',
      })
    }
  }

  // ── Payments typed in that no deposit carries yet ───────────────────────
  const drawerFrom = ymdAddDays(todayYmd, -DRAWER_DAYS)
  for (const u of unlinked) {
    if (usedPayments.has(u.paymentId) || !u.paidOnYmd || u.paidOnYmd > todayYmd) continue
    if (isCheckPayment({ payment_type: u.paymentType })) {
      if (u.paidOnYmd < drawerFrom) continue
      drawerRows.push({
        ...blank,
        key: `drawer:${u.paymentId}`,
        kind: 'drawer',
        tag: 'In the drawer',
        payerName: u.payerName,
        usd: u.usd,
        dayYmd: null,
        sub: `check${u.referenceNumber ? ` #${u.referenceNumber}` : ''} · recorded ${word(u.paidOnYmd)}`,
        reference: u.referenceNumber,
        eventYmd: u.paidOnYmd,
        jobId: u.jobId,
        door: 'deposits',
      })
    } else if (inThisWeek(u.paidOnYmd)) {
      landed({
        key: `landed:${u.paymentId}`,
        tag: `Landed · ${paymentWord(u.paymentType)}`,
        payerName: u.payerName,
        usd: u.usd,
        dayYmd: u.paidOnYmd,
        sub: `recorded ${word(u.paidOnYmd)}`,
        reference: u.referenceNumber,
        eventYmd: u.paidOnYmd,
        jobId: u.jobId,
        door: u.jobId ? 'job' : 'deposits',
      })
    }
  }

  // ── They say it's sent: open claims, on the day the money should land ───
  const pileByJob = new Map<string, CollectBillRead[]>()
  for (const b of input.pile) {
    if (!b.jobId || b.state === 'collections' || !(b.usd > 0)) continue
    const list = pileByJob.get(b.jobId) ?? []
    list.push(b)
    pileByJob.set(b.jobId, list)
  }
  const claimedJobs = new Set<string>()
  for (const c of input.claims ?? []) {
    if (!claimOpen(c) || claimedJobs.has(c.jobId) || matchedBillJobs.has(c.jobId)) continue
    const arrives = c.method === 'check_mailed' ? mailedCheckYmd(c.paidYmd, MAILED_CHECK_DAYS) : ymdAddDays(c.paidYmd, CLAIM_OTHER_ARRIVES_DAYS)
    if (arrives < lastMonday || arrives > weekSunday) continue
    const bills = pileByJob.get(c.jobId) ?? []
    const open = bills.reduce((s, b) => s + b.usd, 0)
    // Nothing open on the job: whatever they sent already landed.
    if (!(open > 0)) continue
    const usd = c.amount != null ? Math.min(c.amount, open) : open
    claimedJobs.add(c.jobId)
    const row: MoneyInRow = {
      ...blank,
      key: `claim:${c.id}`,
      kind: 'sent-claim',
      tag: "They say it's sent",
      payerName: bills[0]?.payerName ?? ((c.customerName ?? '').trim() || c.jobName),
      usd,
      coversOpen: c.amount == null,
      dayYmd: null,
      sub: `"${CLAIM_SAYS[c.method ?? 'not_sure'] ?? 'paid'} ${word(c.paidYmd)}"${c.heardByName ? ` · heard by ${c.heardByName}` : ''}`,
      eventYmd: c.paidYmd,
      jobId: c.jobId,
      door: 'job',
    }
    if (inThisWeek(arrives)) {
      const d = onLine(arrives)
      put({ ...row, dayYmd: d, wasYmd: d !== arrives ? arrives : null })
    } else {
      carriedRows.push({ ...row, wasYmd: arrives })
    }
  }

  // ── Their word and their pace: each open bill on its day ───────────────
  for (const b of input.pile) {
    if (!b.expectedYmd || b.state === 'collections' || !(b.usd > 0)) continue
    if (matchedBillKeys.has(b.key) || (b.jobId && claimedJobs.has(b.jobId))) continue
    const invoiceId = arRowInvoiceId(b.key)
    const stripeBill = invoiceId != null && input.stripeOpenInvoiceIds.has(invoiceId)
    const kind: MoneyInRowKind = b.promise ? 'word' : 'pace'
    const sentWords = stripeBill ? `Stripe invoice${b.billedYmd ? ` · sent ${word(b.billedYmd)}` : ''}` : ''
    const base: MoneyInRow = {
      ...blank,
      key: `bill:${b.key}`,
      kind,
      tag: kind === 'word' ? 'Their word' : 'Pace · a guess',
      payerName: b.payerName,
      usd: b.usd,
      coversOpen: kind === 'word',
      dayYmd: null,
      sub: kind === 'word' ? `promised by ${word(b.promise!.promisedYmd)}` : sentWords,
      eventYmd: b.promise?.promisedYmd ?? b.billedYmd,
      jobId: b.jobId,
      door: 'job',
    }
    if (inThisWeek(b.expectedYmd)) {
      const d = onLine(b.expectedYmd)
      put({ ...base, dayYmd: d, wasYmd: d !== b.expectedYmd ? b.expectedYmd : null })
    } else if (inLastWeek(b.expectedYmd)) {
      const past = Math.max(1, daysBetween(b.expectedYmd, todayYmd))
      carriedRows.push({
        ...base,
        tag: kind === 'word' ? `Their word · ${past} day${past === 1 ? '' : 's'} past` : 'Past their pace',
        sub: kind === 'word' ? `promised ${word(b.promise!.promisedYmd)}` : `${stripeBill ? 'Stripe invoice · ' : ''}expected ${word(b.expectedYmd)}`,
        wasYmd: b.expectedYmd,
      })
    }
  }

  // ── The payout: drawn on the day it lands, never summed ─────────────────
  if (input.payout && input.payout.usd > 0 && inThisWeek(input.payout.arrivalYmd)) {
    put({
      ...blank,
      key: 'stripe-payout',
      kind: 'stripe-payout',
      tag: 'Stripe payout',
      payerName: 'Card money',
      usd: input.payout.usd,
      dayYmd: onLine(input.payout.arrivalYmd),
      sub: 'on its way to the bank — not counted again',
      eventYmd: input.payout.arrivalYmd,
      door: 'banking',
      counted: false,
    })
  }

  // ── Assemble ────────────────────────────────────────────────────────────
  const days: MoneyInDay[] = []
  let cameInUsd = 0
  let cameInCount = 0
  let expectedUsd = 0
  let expectedCount = 0
  for (let i = 0; i < 7; i++) {
    const ymd = ymdAddDays(weekMonday, i)
    const rows = (dayRows.get(ymd) ?? []).sort(byKindThenSize)
    let landedUsd = 0
    let dayExpectedUsd = 0
    for (const r of rows) {
      if (!r.counted) continue
      if (r.kind === 'landed') {
        landedUsd += r.usd
        cameInUsd += r.usd
        cameInCount += 1
      } else {
        dayExpectedUsd += r.usd
        expectedUsd += r.usd
        expectedCount += 1
      }
    }
    days.push({ ymd, isToday: ymd === todayYmd, landedUsd, expectedUsd: dayExpectedUsd, rows })
  }
  // The check waiting longest first: it is the one to take to the bank.
  drawerRows.sort((a, b) => (a.eventYmd ?? '').localeCompare(b.eventYmd ?? '') || b.usd - a.usd)
  const drawerUsd = drawerRows.reduce((s, r) => s + r.usd, 0)
  expectedUsd += drawerUsd
  expectedCount += drawerRows.length
  carriedRows.sort(byKindThenSize)

  return {
    weekMondayYmd: weekMonday,
    todayYmd,
    cameIn: { usd: cameInUsd, count: cameInCount },
    expected: { usd: expectedUsd, count: expectedCount },
    carried: { stillOutUsd: carriedRows.reduce((s, r) => s + r.usd, 0), count: carriedRows.length, rows: carriedRows },
    drawer: { usd: drawerUsd, count: drawerRows.length, rows: drawerRows, olderUnbankedCount: Math.max(0, input.unbankedCount) },
    returnedCount,
    days,
  }
}

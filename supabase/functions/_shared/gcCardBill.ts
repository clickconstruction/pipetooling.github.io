/**
 * gc-card-bill's pure half (GC mode, Owner Billing's O8b): the customer pays a certified GC bill by card from their
 * portal, and the turn adds a 3% credit card fee (the owner's word, 2026-10-09; counsel's okay the same day). The
 * database does the turn (`gc_card_bill_begin`, `gc_card_bill_finish`, `gc_card_bill_undo`, O8a, migration
 * 20261010026000); this holds what the function and the portal agree on: the switch, the Stripe mode, the fee, the
 * request, the refusals in the customer's words, the Stripe invoice's lines, and which bills the portal offers.
 * Dependency-free, so the app's tests import it straight from here. The plan: to-dos/gc-mode/mockups/owner-billing-o8.md
 * on branch spike/gc-mode.
 */
import { GC_CUSTOMER_EMAIL_ROLES } from './gcCustomerEmails.ts'

/** The rate, as the database writes it (`gc_owner_card_bills.fee_pct`). */
export const GC_CARD_FEE_PCT = 3
/** The fee's own line, on the Stripe invoice and in the bill's `fee_lines` (`gc_card_bill_finish`'s rider). */
export const GC_CARD_FEE_LINE = 'Credit card fee (3%)'

/**
 * The switch (O8c): one `app_settings` row, `value_text` 'true' or 'false', inserted 'false' by migration
 * 20261010042000. The owner turns it on in Settings → Jobs & billing (dev and the owner write). It replaced O8b's
 * env value `GC_CARD_BILL_ON`. Both functions, `customer-portal`'s offer, `gc-customer-email`'s card lines and Bill
 * the customer's hint read it.
 */
export const GC_CARD_BILL_SETTING_KEY = 'gc_card_bill_on_v1'

/** The switch's `value_text` → on. Only 'true' (trimmed, any case) is on; a missing row is off. */
export function gcCardBillOn(raw: string | null | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === 'true'
}

/** Stripe's test mode unless `GC_CARD_BILL_STRIPE_MODE` says `live`, which waits on the owner's word. */
export function gcCardBillStripeMode(raw: string | null | undefined): 'test' | 'live' {
  return (raw ?? '').trim().toLowerCase() === 'live' ? 'live' : 'test'
}

/** 3% of the bill, rounded to the cent (a half cent up), as `gc_card_bill_begin` rounds it. */
export function gcCardFee(base: number): number {
  const cents = Math.round(base * 100)
  return Math.round((cents * GC_CARD_FEE_PCT) / 100) / 100
}

/** `create-stripe-invoice`'s one refusal for a GC bill: staff never turn one to card (the owner's word). */
export const GC_BILL_PORTAL_CARD_ONLY = "A GC bill goes on card only from the customer's portal."

/** Who may take a bill on card back to a check bill: the money team, the same people who email a GC customer. */
export const GC_CARD_BILL_UNDO_ROLES: readonly string[] = GC_CUSTOMER_EMAIL_ROLES

/** The two doors: the customer's portal turns a bill to card, and the money team takes one back. */
export type GcCardBillRequest = { door: 'portal'; token: string; invoiceId: string } | { door: 'undo'; invoiceId: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What a request may carry, checked before anything is read. */
export function parseGcCardBillRequest(body: unknown): { ok: true; req: GcCardBillRequest } | { ok: false } {
  if (body == null || typeof body !== 'object') return { ok: false }
  const b = body as Record<string, unknown>
  if (typeof b.undo === 'string') {
    return UUID.test(b.undo) && b.token === undefined ? { ok: true, req: { door: 'undo', invoiceId: b.undo } } : { ok: false }
  }
  const token = typeof b.token === 'string' ? b.token.trim() : ''
  const invoiceId = typeof b.invoiceId === 'string' ? b.invoiceId : ''
  if (token.length < 16 || token.length > 128 || !UUID.test(invoiceId)) return { ok: false }
  return { ok: true, req: { door: 'portal', token, invoiceId } }
}

/** Each refusal and its HTTP status. */
export const GC_CARD_BILL_ERRORS = {
  badRequest: 400,
  linkGone: 404,
  notYours: 404,
  off: 403,
  noEmail: 422,
  refused: 409,
  stripeFailed: 502,
  signIn: 401,
  moneyTeamOnly: 403,
  readOnly: 403,
  twin: 403,
  notOnCard: 409,
  paidOnStripe: 409,
  failed: 500,
} as const
export type GcCardBillErrorKey = keyof typeof GC_CARD_BILL_ERRORS

/** What each refusal says. The portal's are the customer's words; the undo door's are the office's. */
export const GC_CARD_BILL_WORDS: Record<GcCardBillErrorKey, string> = {
  badRequest: 'Something went wrong. Please try again, or call our office.',
  linkGone: 'This link is no longer active. Please contact our office.',
  notYours: 'That bill is not on your account.',
  off: 'Paying by card is not open yet. Call our office.',
  noEmail: 'We need an email for you before the card page. Call our office.',
  refused: 'We could not set up the card page. Call our office.',
  stripeFailed: 'We could not set up the card page. Call our office.',
  signIn: 'Sign in to take a bill off card.',
  moneyTeamOnly: 'Only the money team takes a bill off card.',
  readOnly: 'A training account cannot take a bill off card.',
  twin: 'A digital twin cannot take a bill off card.',
  notOnCard: 'That bill is not on card.',
  paidOnStripe: 'Stripe shows a payment. Refund it in Stripe first.',
  failed: 'Something went wrong. Please try again, or call our office.',
}

/**
 * The database's own refusals that may reach the customer or the office as they are (O8a's words). Anything else is
 * not said: the portal reads `refused`, the office `failed`.
 */
const DB_WORDS = [
  'Only a certified bill goes on card.',
  'This bill is paid already.',
  'This bill is on Stripe already.',
  'A payment is on this bill already, so it cannot move to card.',
  'This bill went back to a check bill. Call our office to pay it by card.',
  'This bill is being set up for card. Try again in a minute.',
  'There is nothing to pay on this bill.',
  'That bill is not there.',
  'The bill changed while its card page was made. Call our office.',
  'Sign in to take a bill off card.',
  'A training account cannot take a bill off card.',
  'A digital twin cannot take a bill off card.',
  'Only the money team takes a bill off card.',
  'That bill is not on card.',
  'A payment is on this bill, so it stays on card.',
] as const

/** The database's refusal in words, when it is one of O8a's; null for anything else. */
export function gcCardBillDbWords(message: string | null | undefined): string | null {
  const m = (message ?? '').trim()
  return DB_WORDS.find((w) => m === w || m.endsWith(w)) ?? null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 9" from a YYYY-MM-DD day; the day as given when it does not read. */
export function gcCardShortDate(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return (ymd ?? '').trim()
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`
}

function ymdToUtcMs(ymd: string): number {
  const [y, mo, d] = ymd.split('-').map(Number)
  return Date.UTC(y!, (mo ?? 1) - 1, d ?? 1)
}

function addDays(ymd: string, days: number): string {
  return new Date(ymdToUtcMs(ymd) + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * The Stripe invoice's due day: the day the bill falls due by the contract (the certificate's day plus its days to
 * pay), or today when that has passed or the contract does not say. A card bill is paid on the card page, so today
 * is never wrong.
 */
export function gcCardBillDue(todayYmd: string, certifiedOn: string | null | undefined, ownerPayDays: number | null | undefined): { dueYmd: string; daysUntilDue: number } {
  const byContract = certifiedOn && /^\d{4}-\d{2}-\d{2}$/.test(certifiedOn) && typeof ownerPayDays === 'number' && ownerPayDays >= 0 ? addDays(certifiedOn, ownerPayDays) : null
  const dueYmd = byContract && byContract > todayYmd ? byContract : todayYmd
  return { dueYmd, daysUntilDue: Math.round((ymdToUtcMs(dueYmd) - ymdToUtcMs(todayYmd)) / 86_400_000) }
}

/** What `gc_card_bill_begin` answers, as the function reads it. */
export interface GcCardBillBegun {
  state: 'pending' | 'on_card'
  base: number
  fee: number
  total: number
  hostedInvoiceUrl: string | null
  projectId: string | null
  jobId: string | null
  number: number | null
  final: boolean
  certifiedOn: string | null
  ownerPayDays: number | null
}

export function parseGcCardBillBegun(raw: unknown): GcCardBillBegun | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.state !== 'pending' && r.state !== 'on_card') return null
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
  const base = num(r.base)
  const fee = num(r.fee)
  if (!Number.isFinite(base) || !Number.isFinite(fee)) return null
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null)
  const days = num(r.owner_pay_days)
  const number = num(r.number)
  return {
    state: r.state,
    base,
    fee,
    total: Math.round((base + fee) * 100) / 100,
    hostedInvoiceUrl: str(r.hosted_invoice_url),
    projectId: str(r.project_id),
    jobId: str(r.job_id),
    number: Number.isFinite(number) ? number : null,
    final: r.final === true,
    certifiedOn: str(r.certified_on),
    ownerPayDays: Number.isFinite(days) ? days : null,
  }
}

/** The Stripe invoice's two lines, in cents: the bill as certified, then the fee on its own. */
export function gcCardBillStripeLines(begun: Pick<GcCardBillBegun, 'base' | 'fee' | 'number' | 'final' | 'certifiedOn'>, jobName: string): { amountCents: number; description: string }[] {
  const app = begun.number === null ? 'Pay application' : `Pay application ${begun.number}`
  const job = jobName.trim()
  const certified = begun.certifiedOn ? `, certified ${gcCardShortDate(begun.certifiedOn)}` : ''
  return [
    { amountCents: Math.round(begun.base * 100), description: `${app}${begun.final ? ', final,' : ''}${job ? ` for ${job}` : ''}${certified}`.slice(0, 500) },
    { amountCents: Math.round(begun.fee * 100), description: GC_CARD_FEE_LINE },
  ]
}

/**
 * The card fee an email may offer for a bill (O8c): the switch on, a bill a certificate made, billed, not on Stripe,
 * nothing paid on it and never turned to card (a pending turn is still an offer). Null: no offer.
 */
export function gcEmailCardFee(args: {
  on: boolean
  bill: { amount: number | string; status: string; stripe_invoice_id: string | null } | null
  paid: boolean
  cardStatus: string | null
}): number | null {
  const { on, bill, paid, cardStatus } = args
  if (!on || !bill || paid || bill.status !== 'billed' || (bill.stripe_invoice_id ?? '').trim() !== '') return null
  if (cardStatus === 'on_card' || cardStatus === 'undone') return null
  const amount = Number(bill.amount)
  return amount > 0 ? gcCardFee(amount) : null
}

/** A bill on the portal that can turn to card, or one on card already. */
export interface PortalCardBill {
  invoiceId: string
  state: 'offer' | 'onCard'
  base: number
  fee: number
  total: number
}

/** A bill as the portal lists it, for the offer. */
export interface PortalCardBillInput {
  invoiceId: string | null
  amount: number
  totalPaid: number
  payUrl: string | null
}

/** A card row, as `gc_owner_card_bills` holds it. */
export interface PortalCardRow {
  invoice_id: string
  status: string
  base: number | string
  fee: number | string
}

/**
 * Which of the portal's bills show **PAY BY CARD**, and which are on card already. A bill on card shows its fee
 * whether the switch is on or not. The offer needs the switch on, an email for Stripe's receipt, a certified bill
 * (`certifiedInvoiceIds`, the bills a pay application made), no Stripe page yet and nothing paid on it. A bill taken
 * back to a check bill is offered no more.
 */
export function gcPortalCardBills(args: {
  on: boolean
  hasEmail: boolean
  bills: readonly PortalCardBillInput[]
  certifiedInvoiceIds: ReadonlySet<string>
  cardRows: readonly PortalCardRow[]
}): PortalCardBill[] {
  const rows = new Map(args.cardRows.map((r) => [r.invoice_id, r]))
  const out: PortalCardBill[] = []
  for (const b of args.bills) {
    if (!b.invoiceId) continue
    const row = rows.get(b.invoiceId)
    if (row?.status === 'on_card') {
      const base = Number(row.base)
      const fee = Number(row.fee)
      if (Number.isFinite(base) && Number.isFinite(fee)) out.push({ invoiceId: b.invoiceId, state: 'onCard', base, fee, total: Math.round((base + fee) * 100) / 100 })
      continue
    }
    if (row?.status === 'undone') continue
    if (!args.on || !args.hasEmail || !args.certifiedInvoiceIds.has(b.invoiceId) || b.payUrl || b.totalPaid > 0 || !(b.amount > 0)) continue
    const fee = gcCardFee(b.amount)
    out.push({ invoiceId: b.invoiceId, state: 'offer', base: b.amount, fee, total: Math.round((b.amount + fee) * 100) / 100 })
  }
  return out
}

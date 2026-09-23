/**
 * Pay links (punch list #35, v2.3754): the stable address a QR code carries for one bill —
 * `https://clicktooling.com/pay/<jobs_ledger_invoices.id>`. Stripe's hosted-invoice link
 * expires 30 days after the due date, so a code printed on paper (the lien notice's pay page,
 * a printout from View bill) must not carry it; it carries this address, and the `pay-link`
 * function answers with Stripe's *current* link at scan time. Pure part here — the id check,
 * the state a scan lands in, the payload the page reads — shared with the client through
 * `src/lib/billing/payLink.ts` and tested from `src/lib/billing/payLink.test.ts`.
 */

/** What the scan lands on. `draft` never leaves the function (a billed row is finalized). */
export type PayLinkState = 'open' | 'paid' | 'void'

export type PayLinkRow = {
  id: string
  job_id: string | null
  status: string | null
  stripe_invoice_id: string | null
  stripe_mode: string | null
  hosted_invoice_url: string | null
  stripe_invoice_status: string | null
}

/** What one Stripe retrieve answers, trimmed to what the page needs. Null when Stripe was not asked. */
export type PayLinkStripeFacts = {
  number: string | null
  status: string | null
  hosted_invoice_url: string | null
  /** Cents still owed, Stripe's own number. */
  amount_remaining: number | null
  currency: string | null
}

export type PayLinkPayload = {
  ok: true
  state: PayLinkState
  /** Stripe's current hosted-invoice link; null only when neither Stripe nor the row has one. */
  url: string | null
  /** The number the bill shows (Stripe's), or null when Stripe was not reachable. */
  number: string | null
  jobName: string
  company: string
  phone: string
  /** Cents still owed; null when Stripe was not reachable (the page then shows no amount). */
  amountRemainingCents: number | null
  currency: string
  /** YYYY-MM-DD in the company's calendar, when the bill is paid and Stripe said when. */
  paidOn: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A bill id is a UUID and nothing else — the function refuses anything shorter or longer before touching the database. */
export function isPayLinkId(raw: unknown): raw is string {
  return typeof raw === 'string' && UUID_RE.test(raw.trim())
}

/** A row a code may open: billed or paid, and a Stripe invoice (a paper bill has no payment page). */
export function payLinkRowEligible(row: Pick<PayLinkRow, 'status' | 'stripe_invoice_id'> | null | undefined): row is PayLinkRow {
  if (!row) return false
  const st = (row.status ?? '').trim()
  return (st === 'billed' || st === 'paid') && typeof row.stripe_invoice_id === 'string' && row.stripe_invoice_id.trim() !== ''
}

/**
 * The state a scan lands in. Stripe's word wins when it answered (`paid`, `void`,
 * `uncollectible`, or nothing left to pay); otherwise the row's own status — the webhook keeps
 * `stripe_invoice_status` and `status = 'paid'` current — so a Stripe outage still tells a
 * customer who already paid that they did.
 */
export function payLinkStateFrom(row: Pick<PayLinkRow, 'status' | 'stripe_invoice_status'>, facts: PayLinkStripeFacts | null): PayLinkState {
  const stripeStatus = (facts?.status ?? '').trim()
  if (stripeStatus === 'paid') return 'paid'
  if (stripeStatus === 'void' || stripeStatus === 'uncollectible') return 'void'
  if (facts && typeof facts.amount_remaining === 'number' && facts.amount_remaining <= 0 && stripeStatus === 'open') return 'paid'
  if (stripeStatus === 'open' || stripeStatus === 'draft') return 'open'
  const rowStripe = (row.stripe_invoice_status ?? '').trim()
  if (rowStripe === 'paid' || (row.status ?? '').trim() === 'paid') return 'paid'
  if (rowStripe === 'void' || rowStripe === 'uncollectible') return 'void'
  return 'open'
}

export function buildPayLinkPayload(input: {
  row: PayLinkRow
  facts: PayLinkStripeFacts | null
  jobName: string
  company: string
  phone: string
  paidOn: string | null
}): PayLinkPayload {
  const { row, facts } = input
  const state = payLinkStateFrom(row, facts)
  const url = ((facts?.hosted_invoice_url ?? '').trim() || (row.hosted_invoice_url ?? '').trim()) || null
  return {
    ok: true,
    state,
    url,
    number: (facts?.number ?? '').trim() || null,
    jobName: input.jobName.trim(),
    company: input.company,
    phone: input.phone,
    amountRemainingCents: state === 'paid' ? 0 : facts && typeof facts.amount_remaining === 'number' ? Math.max(0, Math.round(facts.amount_remaining)) : null,
    currency: ((facts?.currency ?? '').trim() || 'usd').toLowerCase(),
    paidOn: state === 'paid' ? input.paidOn : null,
  }
}

/** The client's read of the function's answer; null for anything that is not a payload. */
export function parsePayLinkResponse(body: unknown): PayLinkPayload | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  if (b.ok !== true) return null
  const state = b.state
  if (state !== 'open' && state !== 'paid' && state !== 'void') return null
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const cents = b.amountRemainingCents
  return {
    ok: true,
    state,
    url: str(b.url),
    number: str(b.number),
    jobName: str(b.jobName) ?? '',
    company: str(b.company) ?? '',
    phone: str(b.phone) ?? '',
    amountRemainingCents: typeof cents === 'number' && Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : null,
    currency: str(b.currency)?.toLowerCase() ?? 'usd',
    paidOn: str(b.paidOn),
  }
}

/** "$4,660.00" from cents; the page never shows a currency other than dollars today. */
export function formatPayLinkCents(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

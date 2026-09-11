/**
 * Bill Customer → "What the customer will see", built locally (v2.3288).
 *
 * Stripe's own preview (edge `preview-stripe-invoice`) needs a customer
 * email and the bill row, so before either exists the modal used to show one
 * "Draft line: Custom service." and nothing else — no work lines, no
 * discount line, no total. This kernel builds the same line list the edge
 * function sends Stripe, from the same shared builder over the same scoping,
 * so the modal can show the bill the moment it opens. Stripe's answer still
 * replaces it when it arrives; this is never what gets sent.
 *
 * Parity with the edge function, step by step: amount → cents; extra lines
 * (hazmat folded + rolled in) come off the fixture target; the bill's rows
 * are scoped like `scopeFixturesToInvoice` (a bill that does not exist yet
 * scopes as the primary remainder bundle); `buildStripeInvoiceItemsFromFixtures`
 * prints work lines and the negative discount shares; extras append; the
 * invoice number is the PipeTooling number the edge would compute.
 */
import {
  buildStripeInvoiceItemsFromFixtures,
  type JobFixtureForStripe,
} from '../../../supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts'
import { buildPipetoolingStripeInvoiceNumber } from '../../../supabase/functions/_shared/pipetoolingStripeInvoiceNumber.ts'
import { fixturesForInvoiceBill, type InvoiceScopeFixtureRow } from '../invoiceScopedFixtures'
import type { StripeInvoicePreviewLine, StripeInvoicePreviewSuccess } from '../stripeInvoicePreview'

export type LocalPreviewFixture = InvoiceScopeFixtureRow & { line_description?: string | null }

export type LocalStripeBillPreviewInput = {
  /** Every row on the job — discount shares split over the whole basis. */
  fixtures: readonly LocalPreviewFixture[] | null | undefined
  /** The bill row when it exists; null before the primary is written (scopes as the remainder bundle). */
  invoiceId: string | null
  isPrimaryRtbBundle: boolean
  amountDollars: number
  /** Bill Customer's "Line on bill" override; empty = one line per row. */
  lineDescriptionOverride: string
  /** Hazmat lines exactly as the create / preview calls send them (folded within the amount, rolled in on top). */
  extraLines: readonly { amountCents: number; description: string }[]
  customerName: string | null
  customerEmail: string | null
  jobName: string | null
  /** The job's effective number — HCP, else C# (the invoice number's prefix). */
  jobNumber: string | null
  dueDateYmd: string
  /** Instant for the invoice number's HHmm suffix; defaults to now. */
  now?: number
}

/** Scope id for a bill that does not exist yet — no row links to it, so it scopes as the unlinked remainder. */
export const PENDING_BILL_SCOPE_ID = 'pending-primary-bill'

function toStripeFixture(r: LocalPreviewFixture): JobFixtureForStripe {
  const count = Number(r.count)
  const seq = Number(r.sequence_order)
  return {
    id: r.id,
    name: r.name ?? '',
    count: Number.isFinite(count) && count > 0 ? count : 1,
    line_unit_price: r.line_unit_price ?? null,
    line_description: r.line_description ?? null,
    sequence_order: Number.isFinite(seq) ? seq : 0,
    line_kind: r.line_kind ?? null,
    discount_pct: r.discount_pct ?? null,
    discount_basis_positions: r.discount_basis_positions ?? null,
  }
}

/** Unix seconds for the due date, the way the edge function returns it (noon UTC). */
export function dueDateUnixFromYmd(dueDateYmd: string): number | null {
  const ms = new Date(dueDateYmd.trim() + 'T12:00:00Z').getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

/**
 * The bill as Stripe would print it, or null when there is nothing to show
 * (no positive amount, extras that swallow the amount, a bad override).
 */
export function buildLocalStripeBillPreview(input: LocalStripeBillPreviewInput): StripeInvoicePreviewSuccess | null {
  const amountCents = Math.round(input.amountDollars * 100)
  if (!Number.isFinite(amountCents) || amountCents < 1) return null
  const extras = input.extraLines
    .map((l) => ({ amount: Math.round(l.amountCents), description: l.description.trim().slice(0, 500) }))
    .filter((l) => Number.isFinite(l.amount) && l.amount >= 1 && l.description.length > 0)
  const extrasSum = extras.reduce((a, b) => a + b.amount, 0)
  const fixtureTargetCents = amountCents - extrasSum
  if (extras.length > 0 && fixtureTargetCents < 1) return null

  // Scope over the raw rows (invoice_id lives there), then shape for the builder.
  const rows = [...(input.fixtures ?? [])]
  const scoped = fixturesForInvoiceBill(rows, input.invoiceId ?? PENDING_BILL_SCOPE_ID, {
    is_primary_rtb_bundle: input.isPrimaryRtbBundle,
    amount: fixtureTargetCents / 100,
  })
  const built = buildStripeInvoiceItemsFromFixtures({
    fixtures: scoped.map(toStripeFixture),
    allFixtures: rows.map(toStripeFixture),
    targetAmountCents: extras.length > 0 ? fixtureTargetCents : amountCents,
    lineDescriptionOverride: input.lineDescriptionOverride,
    customerName: (input.customerName ?? '').trim() || 'Customer',
    jobName: input.jobName,
    hcpNumber: input.jobNumber,
  })
  if (!built.ok) return null

  const lines: StripeInvoicePreviewLine[] = [
    ...built.items.map((it) => ({ description: it.description, amount: it.amount, quantity: 1, source: it.source })),
    ...extras.map((ex) => ({ description: ex.description, amount: ex.amount, quantity: 1, source: { kind: 'extra_line' as const } })),
  ]
  const total = lines.reduce((a, l) => a + l.amount, 0)
  const numbered = buildPipetoolingStripeInvoiceNumber(input.jobNumber, input.dueDateYmd, input.now ?? Date.now())
  return {
    success: true,
    currency: 'usd',
    subtotal: total,
    total,
    amount_due: total,
    amount_paid: 0,
    amount_remaining: Math.max(0, total),
    due_date: dueDateUnixFromYmd(input.dueDateYmd),
    seller_name: null,
    lines,
    invoice_number: numbered.ok ? numbered.number : null,
    customer_name: (input.customerName ?? '').trim() || null,
    customer_email: (input.customerEmail ?? '').trim() || null,
  }
}

export type StripePreviewBlocker = 'loading' | 'ensure_error' | 'no_customer' | 'no_email' | 'no_bill_row' | null

/**
 * Why Stripe's own preview is not running, in the order the modal's gate
 * checks them — so the idle hint can name the real blocker instead of always
 * blaming the bill row.
 */
export function stripePreviewBlocker(args: {
  ensureLoading: boolean
  ensureError: boolean
  hasCustomer: boolean
  hasEmail: boolean
  hasBillRow: boolean
}): StripePreviewBlocker {
  if (args.ensureLoading) return 'loading'
  if (args.ensureError) return 'ensure_error'
  if (!args.hasCustomer) return 'no_customer'
  if (!args.hasEmail) return 'no_email'
  if (!args.hasBillRow) return 'no_bill_row'
  return null
}

export function stripePreviewBlockerHint(b: StripePreviewBlocker): string | null {
  switch (b) {
    case 'loading':
      return 'Preparing billing line…'
    case 'ensure_error':
      return 'Fix the billing line error above, then edit due date in What the customer will see when ready.'
    case 'no_customer':
      return 'Link a customer to this job and Stripe\'s exact preview appears here — the lines below are what the bill will list.'
    case 'no_email':
      return 'Add the customer\'s email above and Stripe\'s exact preview appears here — the lines below are what the bill will list.'
    case 'no_bill_row':
      return 'Nothing is saved until you send. Stripe\'s exact layout appears once the bill exists — the lines below are what the customer will see.'
    default:
      return null
  }
}

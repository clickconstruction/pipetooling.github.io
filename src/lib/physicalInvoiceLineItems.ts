import type { Database } from '../types/database'
import { buildScaledFixtureLineDrafts } from './physicalInvoiceFixtureScaling'
import { PORTAL_GENERIC_PAYMENT_METHOD, portalPaymentMethodLabel } from './portal/portalJobGroups'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import {
  discountBillLinesForWorkRows,
  discountRowsFromDb,
  discountSharesByWorkRow,
  netWorkLineCents,
} from '../../supabase/functions/_shared/discountLine.ts'

export type PhysicalInvoiceFixtureInput = Pick<
  Database['public']['Tables']['jobs_ledger_fixtures']['Row'],
  'name' | 'count' | 'line_unit_price' | 'line_description' | 'sequence_order'
> & {
  /** Discount rows (v2.3252+): the id keys the shares; rows built without one are keyed by position. */
  id?: string
  line_kind?: string | null
  discount_pct?: number | string | null
  discount_basis_positions?: number[] | null
}

/** Rows keyed for the discount kernel (an id is synthesized from the position when a caller built the row without one). */
function keyedRows(rows: readonly PhysicalInvoiceFixtureInput[]) {
  return discountRowsFromDb(rows.map((r) => ({ ...r, id: r.id ?? `row-${r.sequence_order}` })))
}

/**
 * The negative Services rows a bill prints for the work rows it covers
 * (v2.3252+): one per discount that touches them, cents-exact. `all` is the
 * whole job (shares split over the full basis); `scoped` is what this bill
 * lists. Empty when the job has no discount rows.
 */
export function discountServiceLinesForFixtures(
  all: readonly PhysicalInvoiceFixtureInput[],
  scoped: readonly PhysicalInvoiceFixtureInput[],
): PhysicalInvoiceServiceLine[] {
  const kernelAll = keyedRows(all)
  const ids = new Set(keyedRows(scoped).filter((r) => r.line_kind !== 'discount' && isBillableFixtureRow(r)).map((r) => r.id))
  return discountBillLinesForWorkRows(kernelAll, ids).map((l) => {
    const amt = -l.cents / 100
    return { description: l.description, qty: 1, unitPrice: amt, amount: amt }
  })
}

/** Scoped work rows with each price replaced by the row's NET dollars (count 1) — what proration allocates over. */
function netPricedRows(all: readonly PhysicalInvoiceFixtureInput[], scoped: readonly PhysicalInvoiceFixtureInput[]): PhysicalInvoiceFixtureInput[] {
  const kernelAll = keyedRows(all)
  const shares = discountSharesByWorkRow(kernelAll)
  return keyedRows(scoped)
    .filter((r) => r.line_kind !== 'discount')
    .map((r) => ({ ...r, count: 1, line_unit_price: netWorkLineCents([], r, shares) / 100 }))
}

export type PhysicalInvoiceMaterialInput = Pick<
  Database['public']['Tables']['jobs_ledger_materials']['Row'],
  'description' | 'amount' | 'sequence_order'
>

export type PhysicalInvoicePaymentInput = Pick<
  Database['public']['Tables']['jobs_ledger_payments']['Row'],
  'amount' | 'paid_on' | 'payment_type' | 'note' | 'invoice_id' | 'sequence_order'
>

export type PhysicalInvoiceServiceLine = {
  description: string
  qty: number
  unitPrice: number
  amount: number
}

export type PhysicalInvoiceMaterialLine = {
  description: string
  qty: number
  unitPrice: number
  amount: number
}

export type PhysicalInvoicePaymentHistoryRow = {
  /** "Paid Jul 17, 2026" — plus " · <method>" when the method says something (v2.2324). */
  label: string
  /** Positive figure ("$871.25"); renderers prefix their own credit minus. */
  amountFormatted: string
}

/** Bill amount vs fixture+material sum: tolerate float noise (dollars). */
export const PHYSICAL_INVOICE_AMOUNT_MATCH_EPSILON = 0.02

/** Same positivity rule as Stripe billable Specific Work rows in SendRecordInvoiceModal. */
export function isBillableFixtureRow(
  row: Pick<PhysicalInvoiceFixtureInput, 'name' | 'count' | 'line_unit_price'> & { line_kind?: string | null },
): boolean {
  if (row.line_kind === 'discount') return false
  if (!(row.name ?? '').trim()) return false
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit =
    row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price))
      ? Number(row.line_unit_price)
      : 0
  const dollars = qty * unit
  return Number.isFinite(dollars) && dollars > 0
}

export function buildBillableServiceLinesFromFixtures(
  fixtures: PhysicalInvoiceFixtureInput[],
): PhysicalInvoiceServiceLine[] {
  const sorted = [...fixtures].sort((a, b) => a.sequence_order - b.sequence_order)
  const out: PhysicalInvoiceServiceLine[] = []
  for (const row of sorted) {
    if (!isBillableFixtureRow(row)) continue
    const c = Number(row.count)
    const qty = Number.isFinite(c) && c > 0 ? c : 1
    const unit =
      row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price))
        ? Number(row.line_unit_price)
        : 0
    const name = (row.name ?? '').trim()
    const extra = (row.line_description ?? '').trim()
    const description = extra ? `${name}\n${extra}` : name
    out.push({
      description,
      qty,
      unitPrice: unit,
      amount: Math.round(qty * unit * 100) / 100,
    })
  }
  return out
}

export function buildMaterialLinesFromMaterials(
  materials: PhysicalInvoiceMaterialInput[],
): PhysicalInvoiceMaterialLine[] {
  return [...materials]
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((m) => {
      const amt = Number(m.amount)
      const amount = Number.isFinite(amt) ? Math.round(amt * 100) / 100 : 0
      return {
        description: (m.description ?? '').trim() || 'Materials',
        qty: 1,
        unitPrice: amount,
        amount,
      }
    })
    .filter((row) => row.amount > 0)
}

export function totalServiceLines(lines: PhysicalInvoiceServiceLine[]): number {
  return lines.reduce((s, x) => s + x.amount, 0)
}

export function totalMaterialLines(lines: PhysicalInvoiceMaterialLine[]): number {
  return lines.reduce((s, x) => s + x.amount, 0)
}

export function fixtureMaterialTotalMatchesBill(
  billDollars: number,
  services: PhysicalInvoiceServiceLine[],
  materials: PhysicalInvoiceMaterialLine[],
): boolean {
  const t = totalServiceLines(services) + totalMaterialLines(materials)
  return Math.abs(t - billDollars) <= PHYSICAL_INVOICE_AMOUNT_MATCH_EPSILON
}

/**
 * Physical Services + Materials rows aligned with Stripe:
 * - Empty **`lineOnBillRaw`** (Bill Customer line-on-bill field): proportional split of
 *   **`billDollars - sum(materials)`** across billable fixtures, same cents allocation as Stripe.
 * - Non-empty **`lineOnBillRaw`**: one service line for the full bill (Stripe override); materials omitted.
 * - **`singleLineNarrative`**: used for synthetic lines when the user left line-on-bill blank (e.g. no fixtures).
 */
export function resolvePhysicalInvoiceLinePresentation(
  billDollars: number,
  /** Trimmed user "line on bill"; empty => multi-line / proportional fixtures like Stripe. */
  lineOnBillRaw: string,
  /** Effective description when synthesizing a single line (blank line-on-bill, no billable fixtures). */
  singleLineNarrative: string,
  fixtures: PhysicalInvoiceFixtureInput[],
  materials: PhysicalInvoiceMaterialInput[],
  /** Every row on the job (v2.3252+) — discount shares split over the whole basis. Defaults to `fixtures`. */
  allFixtures?: PhysicalInvoiceFixtureInput[],
): {
  breakdownMatches: boolean
  serviceLines: PhysicalInvoiceServiceLine[]
  materialLines: PhysicalInvoiceMaterialLine[]
} {
  const billRounded = Math.round(billDollars * 100) / 100
  const materialLines = buildMaterialLinesFromMaterials(materials)
  const matSum = totalMaterialLines(materialLines)
  const EPS = PHYSICAL_INVOICE_AMOUNT_MATCH_EPSILON
  // Discount lines (v2.3252+): with the work at its real prices and each
  // discount as its own negative row, the Services block matches the bill
  // exactly — the same test Stripe's composer makes. Otherwise proration runs
  // over NET row cents (a price the discount already lowered never prints).
  const discountLines = discountServiceLinesForFixtures(allFixtures ?? fixtures, fixtures)
  const hasDiscounts = discountLines.length > 0

  if (lineOnBillRaw.trim().length > 0) {
    const desc = lineOnBillRaw.trim()
    return {
      breakdownMatches: false,
      serviceLines: [
        {
          description: desc,
          qty: 1,
          unitPrice: billRounded,
          amount: billRounded,
        },
      ],
      materialLines: [],
    }
  }

  if (matSum > billRounded + EPS) {
    const narrative = singleLineNarrative.trim() || 'Services'
    return {
      breakdownMatches: false,
      serviceLines: [
        {
          description: narrative,
          qty: 1,
          unitPrice: billRounded,
          amount: billRounded,
        },
      ],
      materialLines: [],
    }
  }

  const serviceTarget = Math.round((billRounded - matSum) * 100) / 100
  if (serviceTarget <= EPS) {
    if (Math.abs(matSum - billRounded) <= EPS) {
      return {
        breakdownMatches: true,
        serviceLines: [],
        materialLines,
      }
    }
    return {
      breakdownMatches: false,
      serviceLines: [],
      materialLines,
    }
  }

  const targetCents = Math.round(serviceTarget * 100)
  if (hasDiscounts) {
    const grossServices = buildBillableServiceLinesFromFixtures(fixtures)
    const netNatural = totalServiceLines(grossServices) + totalServiceLines(discountLines)
    if (grossServices.length > 0 && Math.abs(netNatural - serviceTarget) <= EPS) {
      return { breakdownMatches: true, serviceLines: [...grossServices, ...discountLines], materialLines }
    }
  }
  const scaled = buildScaledFixtureLineDrafts(hasDiscounts ? netPricedRows(allFixtures ?? fixtures, fixtures) : fixtures, targetCents)

  if (!scaled || scaled.drafts.length === 0) {
    const narrative = singleLineNarrative.trim() || 'Services'
    const st = Math.round(serviceTarget * 100) / 100
    return {
      breakdownMatches: false,
      serviceLines: [
        {
          description: narrative,
          qty: 1,
          unitPrice: st,
          amount: st,
        },
      ],
      materialLines,
    }
  }

  const serviceLines: PhysicalInvoiceServiceLine[] = scaled.drafts.map((d) => {
    const amt = Math.round(d.amountCents) / 100
    return {
      description: d.description,
      qty: 1,
      unitPrice: amt,
      amount: amt,
    }
  })

  const rawServices = buildBillableServiceLinesFromFixtures(fixtures)
  const rawMaterials = materialLines
  const naturalBillMatch = fixtureMaterialTotalMatchesBill(billRounded, rawServices, rawMaterials)
  const breakdownMatches = naturalBillMatch && !scaled.proportionalScalingUsed

  return {
    breakdownMatches,
    serviceLines,
    materialLines,
  }
}

/** Prefer payments linked to the current invoice; if none, show all job payments (chronological). */
export function filterPaymentsForPhysicalInvoiceHistory(
  payments: PhysicalInvoicePaymentInput[],
  billingKind: 'job' | 'invoice',
  invoiceId: string | null,
): PhysicalInvoicePaymentInput[] {
  const sorted = [...payments].sort((a, b) => a.sequence_order - b.sequence_order)
  if (billingKind === 'invoice' && invoiceId) {
    const linked = sorted.filter((p) => p.invoice_id === invoiceId)
    if (linked.length > 0) return linked
  }
  return sorted
}

function formatPaymentDateYmd(ymd: string | null | undefined): string {
  const t = (ymd ?? '').trim()
  if (!t) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (!m) return t
  const ref = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
  // "Dec 17, 2025" — no weekday (v2.2324: matches the portal ledger), no
  // time-of-day we don't honestly have (paid_on is date-only).
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(ref)
}

export function formatPaymentHistoryRows(
  payments: PhysicalInvoicePaymentInput[],
  formatUsd: (n: number) => string,
): PhysicalInvoicePaymentHistoryRow[] {
  return payments.map((p) => {
    const amt = Number(p.amount)
    // Customer-facing method is the payment type ONLY (v2.2313): `note` is an
    // internal field and now carries hygiene tags (hcp-paydate-corrected-…)
    // that must never print on customer paper. The generic label is dropped
    // entirely — "Paid Jul 17, 2026" says it all (v2.2322/v2.2324); a real
    // method (a check number) keeps a suffix.
    const method = portalPaymentMethodLabel(p.payment_type ?? '')
    const suffix = method === PORTAL_GENERIC_PAYMENT_METHOD ? '' : ` · ${method}`
    return {
      label: `Paid ${formatPaymentDateYmd(p.paid_on)}${suffix}`,
      amountFormatted: formatUsd(Number.isFinite(amt) ? amt : 0),
    }
  })
}

export type PhysicalInvoicePaymentTotals = {
  /** The document's own billed amount — the ledger's opening line (v2.2324). */
  billedFormatted: string
  totalPaidFormatted: string
  /** Meaningful only when paidInFull is false. */
  balanceDueFormatted: string
  paidInFull: boolean
}

/**
 * Total-paid / balance-due rows under the payment history (v2.2313).
 * `invoiceAmountDollars` is the document's own amount — invoice-scoped when
 * the history is invoice-scoped, the job total for job-level bills.
 */
export function buildPaymentHistoryTotals(
  payments: PhysicalInvoicePaymentInput[],
  invoiceAmountDollars: number,
  formatUsd: (n: number) => string,
): PhysicalInvoicePaymentTotals | null {
  if (payments.length === 0) return null
  const totalPaid = payments.reduce((a, p) => {
    const amt = Number(p.amount)
    return a + (Number.isFinite(amt) ? amt : 0)
  }, 0)
  const balance = invoiceAmountDollars - totalPaid
  return {
    billedFormatted: formatUsd(invoiceAmountDollars),
    totalPaidFormatted: formatUsd(totalPaid),
    balanceDueFormatted: formatUsd(Math.max(balance, 0)),
    paidInFull: balance <= 0.005,
  }
}

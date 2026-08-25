import type { Database } from '../types/database'
import { buildScaledFixtureLineDrafts } from './physicalInvoiceFixtureScaling'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

export type PhysicalInvoiceFixtureInput = Pick<
  Database['public']['Tables']['jobs_ledger_fixtures']['Row'],
  'name' | 'count' | 'line_unit_price' | 'line_description' | 'sequence_order'
>

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
  dateDisplay: string
  method: string
  amountFormatted: string
}

/** Bill amount vs fixture+material sum: tolerate float noise (dollars). */
export const PHYSICAL_INVOICE_AMOUNT_MATCH_EPSILON = 0.02

/** Same positivity rule as Stripe billable Specific Work rows in SendRecordInvoiceModal. */
export function isBillableFixtureRow(
  row: Pick<PhysicalInvoiceFixtureInput, 'name' | 'count' | 'line_unit_price'>,
): boolean {
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
): {
  breakdownMatches: boolean
  serviceLines: PhysicalInvoiceServiceLine[]
  materialLines: PhysicalInvoiceMaterialLine[]
} {
  const billRounded = Math.round(billDollars * 100) / 100
  const materialLines = buildMaterialLinesFromMaterials(materials)
  const matSum = totalMaterialLines(materialLines)
  const EPS = PHYSICAL_INVOICE_AMOUNT_MATCH_EPSILON

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
  const scaled = buildScaledFixtureLineDrafts(fixtures, targetCents)

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
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(ref)
  // "Dec 17, 2025 · Wed" — the weekday HCP shows, minus the time-of-day we
  // don't honestly have (paid_on is date-only; created_at is entry time).
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short' }).format(ref)
  return `${date} · ${weekday}`
}

export function formatPaymentHistoryRows(
  payments: PhysicalInvoicePaymentInput[],
  formatUsd: (n: number) => string,
): PhysicalInvoicePaymentHistoryRow[] {
  return payments.map((p) => {
    const amt = Number(p.amount)
    // Customer-facing method is the payment type ONLY (v2.2313): `note` is an
    // internal field and now carries hygiene tags (hcp-paydate-corrected-…)
    // that must never print on customer paper.
    const method = (p.payment_type ?? '').trim() || 'Payment'
    return {
      dateDisplay: formatPaymentDateYmd(p.paid_on),
      method,
      amountFormatted: formatUsd(Number.isFinite(amt) ? amt : 0),
    }
  })
}

export type PhysicalInvoicePaymentTotals = {
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
    totalPaidFormatted: formatUsd(totalPaid),
    balanceDueFormatted: formatUsd(Math.max(balance, 0)),
    paidInFull: balance <= 0.005,
  }
}

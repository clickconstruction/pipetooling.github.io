/**
 * Which line items belong on a bill (v2.1133; remainder composition v2.2469).
 * Invoices created from segment selection link their fixtures
 * (jobs_ledger_fixtures.invoice_id) — the bill must list exactly those lines,
 * not the whole job.
 *
 * The elastic PRIMARY remainder bundle ("auto") links nothing, but it exists
 * to bill "whatever isn't on another invoice" — so when the still-unlinked
 * segments sum EXACTLY to its amount (cents), the bill lists those segments
 * at their real prices. Any payment, dollar carve, or rider breaks the
 * equality, and the bill falls back to prorating over the still-unlinked rows
 * (v2.2589 — rows on other bills never re-list; before this it prorated the
 * whole job) — composition never guesses at partial coverage.
 *
 * Journey B6 / J3-6: when the remainder is SMALLER than the still-unlinked
 * work, the gap is money the customer already paid (or carved onto a dollar
 * bill) against these very rows — the Edit Job bar pours that pool into the
 * unbilled segments in order (`dollarCoverageForSegments`) and marks them
 * "covered". Rows covered to the last cent are treated exactly like rows on
 * other bills: they never re-list. The first partially covered row and every
 * row after it stay, and the caller's proration runs over those only — the
 * $185 remainder on a $370 two-segment job lists the second segment at $185
 * instead of both at $92.50. Riders or extras that inflate the remainder
 * above the row sum leave the pool empty, so nothing is dropped by mistake.
 *
 * Mirrored in supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts
 * (scopeFixturesToInvoice) — the edge functions are authoritative for what
 * Stripe renders (they match against amount minus extra_line_items, which
 * equals the row amount whenever composition can apply); this client copy
 * keeps previews and physical PDFs aligned.
 */

import {
  discountRowsFromDb,
  discountSharesByWorkRow,
  netWorkLineCents,
  type DiscountShare,
} from '../../supabase/functions/_shared/discountLine.ts'

export type InvoiceScopeFixtureRow = {
  id: string
  invoice_id?: string | null
  name?: string | null
  count?: number | null
  line_unit_price?: number | null
  sequence_order?: number | null
  /** Discount rows (v2.3252+) never list; work rows count NET of their shares. */
  line_kind?: string | null
  discount_pct?: number | string | null
  discount_basis_positions?: number[] | null
}

export type InvoiceScopeInvoiceContext = {
  is_primary_rtb_bundle?: boolean | null
  amount?: unknown
}

/** Cents for one row — EXACT mirror of the edge's scopeLineCents: a work row NET of its discount shares (max(1, …) included). */
function billableLineCents(row: InvoiceScopeFixtureRow, shares: ReadonlyMap<string, DiscountShare[]>): number {
  if (row.line_kind === 'discount') return 0
  if (!(row.name ?? '').trim()) return 0
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit = row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price)) ? Number(row.line_unit_price) : 0
  const dollars = qty * unit
  if (!Number.isFinite(dollars) || dollars <= 0) return 0
  const gross = Math.max(1, Math.round(dollars * 100))
  const workRow = { id: row.id, name: row.name, count: row.count, line_unit_price: row.line_unit_price, line_kind: 'work' as const }
  return Math.max(0, Math.min(gross, netWorkLineCents([], workRow, shares)))
}

/** The discount shares of a whole job's rows (v2.3252+); an empty map when it has no discount rows. */
export function discountSharesForRows(rows: readonly InvoiceScopeFixtureRow[] | null | undefined): Map<string, DiscountShare[]> {
  return discountSharesByWorkRow(discountRowsFromDb(rows ?? []))
}

/**
 * Rows the remainder still bills after payments-coverage (B6 / J3-6). The
 * pool `sumCents − amountCents` fills the billable rows in order; a row the
 * pool swallows whole is dropped, the row it runs out inside — and every row
 * after — is kept. Zero-cent rows (unnamed / unpriced) ride through untouched,
 * as before. Returns the input list when nothing is covered.
 */
export function dropPaymentsCoveredRows<T extends InvoiceScopeFixtureRow>(
  unlinked: readonly T[],
  amountCents: number,
  shares: ReadonlyMap<string, DiscountShare[]> = new Map(),
): T[] {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return [...unlinked]
  const sumCents = unlinked.reduce((s, f) => s + billableLineCents(f, shares), 0)
  let pool = sumCents - amountCents
  if (pool <= 0) return [...unlinked]
  const dropped = new Set<T>()
  for (const f of unlinked) {
    if (pool <= 0) break
    const cents = billableLineCents(f, shares)
    if (cents <= 0) continue
    if (cents <= pool) {
      dropped.add(f)
      pool -= cents
    } else {
      break
    }
  }
  return unlinked.filter((f) => !dropped.has(f))
}

export function fixturesForInvoiceBill<T extends InvoiceScopeFixtureRow>(
  fixtures: T[] | null | undefined,
  invoiceId: string | null | undefined,
  invoice?: InvoiceScopeInvoiceContext | null,
): T[] {
  // Discount rows (v2.3252+) are never scoped as lines — their shares print
  // on the bills of the work they follow; the composers read them from the
  // whole job. Every figure below is a work row NET of those shares.
  const shares = discountSharesForRows(fixtures)
  const all = (fixtures ?? []).filter((f) => f.line_kind !== 'discount')
  if (!invoiceId) return all
  const linked = all.filter((f) => (f.invoice_id ?? null) === invoiceId)
  if (linked.length > 0) return linked
  const unlinked = all.filter((f) => (f.invoice_id ?? null) === null)
  if (invoice?.is_primary_rtb_bundle === true) {
    const amountCents = Math.round(Number(invoice.amount) * 100)
    if (Number.isFinite(amountCents) && amountCents > 0) {
      const unlinkedBillable = unlinked.filter((f) => billableLineCents(f, shares) > 0)
      const sumCents = unlinkedBillable.reduce((s, f) => s + billableLineCents(f, shares), 0)
      if (unlinkedBillable.length > 0 && sumCents === amountCents) return unlinkedBillable
      // B6 / J3-6: a remainder smaller than the unlinked work means payments
      // (or dollar carves) already cover the first rows — those never re-list.
      if (unlinkedBillable.length > 0 && sumCents > amountCents) return dropPaymentsCoveredRows(unlinked, amountCents, shares)
    }
  }
  // v2.2589: a row linked to ANOTHER invoice is already listed on that bill —
  // re-listing it here (Taunya, job 978: the remainder bundle prorated across
  // an already-billed change order) misstates what the customer is paying for.
  // Proration happens over the unlinked rows only; when every row is linked
  // elsewhere the builders fall back to their single-line modes.
  return unlinked
}

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
 * Mirrored in supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts
 * (scopeFixturesToInvoice) — the edge functions are authoritative for what
 * Stripe renders (they match against amount minus extra_line_items, which
 * equals the row amount whenever composition can apply); this client copy
 * keeps previews and physical PDFs aligned.
 */

export type InvoiceScopeFixtureRow = {
  invoice_id?: string | null
  name?: string | null
  count?: number | null
  line_unit_price?: number | null
}

export type InvoiceScopeInvoiceContext = {
  is_primary_rtb_bundle?: boolean | null
  amount?: unknown
}

/** Cents for one row — EXACT mirror of the edge's lineExtendedCents (max(1, …) included). */
function billableLineCents(row: InvoiceScopeFixtureRow): number {
  if (!(row.name ?? '').trim()) return 0
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit = row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price)) ? Number(row.line_unit_price) : 0
  const dollars = qty * unit
  if (!Number.isFinite(dollars) || dollars <= 0) return 0
  return Math.max(1, Math.round(dollars * 100))
}

export function fixturesForInvoiceBill<T extends InvoiceScopeFixtureRow>(
  fixtures: T[] | null | undefined,
  invoiceId: string | null | undefined,
  invoice?: InvoiceScopeInvoiceContext | null,
): T[] {
  const all = fixtures ?? []
  if (!invoiceId) return all
  const linked = all.filter((f) => (f.invoice_id ?? null) === invoiceId)
  if (linked.length > 0) return linked
  const unlinked = all.filter((f) => (f.invoice_id ?? null) === null)
  if (invoice?.is_primary_rtb_bundle === true) {
    const amountCents = Math.round(Number(invoice.amount) * 100)
    if (Number.isFinite(amountCents) && amountCents > 0) {
      const unlinkedBillable = unlinked.filter((f) => billableLineCents(f) > 0)
      const sumCents = unlinkedBillable.reduce((s, f) => s + billableLineCents(f), 0)
      if (unlinkedBillable.length > 0 && sumCents === amountCents) return unlinkedBillable
    }
  }
  // v2.2589: a row linked to ANOTHER invoice is already listed on that bill —
  // re-listing it here (Taunya, job 978: the remainder bundle prorated across
  // an already-billed change order) misstates what the customer is paying for.
  // Proration happens over the unlinked rows only; when every row is linked
  // elsewhere the builders fall back to their single-line modes.
  return unlinked
}

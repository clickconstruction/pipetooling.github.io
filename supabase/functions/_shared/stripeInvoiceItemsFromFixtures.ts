import {
  resolveInvoiceLineDescription,
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
} from './stripeLineDescription.ts'

export type JobFixtureForStripe = {
  id: string
  name: string
  count: number
  line_unit_price: number | null
  line_description: string | null
  sequence_order: number
}

/**
 * Which fixtures belong on THIS invoice's bill (v2.1133; remainder
 * composition v2.2469): rows linked via jobs_ledger_fixtures.invoice_id when
 * any exist (segment invoices bill exactly their items). With no links, the
 * elastic PRIMARY remainder bundle bills the still-unlinked billable rows at
 * their real prices WHEN they sum exactly to the target cents — it exists to
 * bill "whatever isn't on another invoice", and the cents-exact equality
 * guarantees that reading is true (any payment, dollar carve, rider, or
 * extra_line_item breaks it). Everything else prorates over the still-unlinked
 * rows (v2.2589 — rows on other bills never re-list; the whole-job proration
 * survives only on jobs with no links at all, where the sets are identical).
 * Mirrored client-side in src/lib/invoiceScopedFixtures.ts.
 */
export function scopeFixturesToInvoice<
  T extends { invoice_id?: string | null; name?: string | null; count?: number | null; line_unit_price?: number | null },
>(
  rows: T[],
  invoiceId: string,
  invoice?: { isPrimaryRtbBundle: boolean; targetAmountCents: number } | null,
): T[] {
  const linked = rows.filter((r) => (r.invoice_id ?? null) === invoiceId)
  if (linked.length > 0) return linked
  const unlinked = rows.filter((r) => (r.invoice_id ?? null) === null)
  if (invoice?.isPrimaryRtbBundle === true && Number.isFinite(invoice.targetAmountCents) && invoice.targetAmountCents > 0) {
    const unlinkedBillable = unlinked.filter((r) => scopeLineCents(r) > 0)
    const sumCents = unlinkedBillable.reduce((s, r) => s + scopeLineCents(r), 0)
    if (unlinkedBillable.length > 0 && sumCents === invoice.targetAmountCents) return unlinkedBillable
  }
  // v2.2589: a row linked to ANOTHER invoice is already listed on that bill —
  // never re-list it here. Proration happens over the unlinked rows only; when
  // every row is linked elsewhere the caller's single-line fallback applies.
  return unlinked
}

/** Cents for one row in the scoping equality — same math as lineExtendedCents below. */
function scopeLineCents(row: { name?: string | null; count?: number | null; line_unit_price?: number | null }): number {
  if (!(row.name ?? '').trim()) return 0
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit = row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price)) ? Number(row.line_unit_price) : 0
  const dollars = qty * unit
  if (!Number.isFinite(dollars) || dollars <= 0) return 0
  return Math.max(1, Math.round(dollars * 100))
}

/** Client/Edge JSON: maps preview line to DB row or single-line modes (override / fallback). */
export type StripeInvoiceLineSource =
  | { kind: 'fixture'; jobs_ledger_fixture_id: string }
  | { kind: 'single_line' }
  | { kind: 'extra_line' }

export type StripeInvoiceLineItem = {
  amount: number
  description: string
  source?: StripeInvoiceLineSource
}

function clampLineDescription(text: string): string {
  const t = text.trim()
  if (t.length <= STRIPE_INVOICE_LINE_DESCRIPTION_MAX) return t
  return t.slice(0, STRIPE_INVOICE_LINE_DESCRIPTION_MAX)
}

function fixtureStripeDescription(row: JobFixtureForStripe): string {
  const name = (row.name ?? '').trim()
  const scope = (row.line_description ?? '').trim()
  let s = name
  if (scope) s = `${name} — ${scope}`
  if (!s.trim()) s = 'Line item'
  return clampLineDescription(s)
}

function lineExtendedCents(row: JobFixtureForStripe): number {
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit = row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price)) ? Number(row.line_unit_price) : 0
  const dollars = qty * unit
  if (!Number.isFinite(dollars) || dollars <= 0) return 0
  return Math.max(1, Math.round(dollars * 100))
}

/** Largest-remainder allocation of `target` cents across positive raw buckets. */
function allocateProportionalCents(rawCents: number[], target: number): number[] {
  const n = rawCents.length
  const S = rawCents.reduce((a, b) => a + b, 0)
  if (n === 0 || S <= 0) return rawCents.map(() => 0)
  if (target === S) return [...rawCents]

  const exact = rawCents.map((c) => (target * c) / S)
  const floors = exact.map((e) => Math.floor(e))
  let sumFloors = floors.reduce((a, b) => a + b, 0)
  let rem = target - sumFloors
  const frac = exact.map((e, i) => ({ i, f: e - Math.floor(e) }))
  frac.sort((a, b) => (b.f !== a.f ? b.f - a.f : a.i - b.i))
  const out = [...floors]
  for (let k = 0; k < rem && k < n; k++) {
    const f = frac[k]
    if (!f) break
    out[f.i] = (out[f.i] ?? 0) + 1
  }
  return out
}

export function buildStripeInvoiceItemsFromFixtures(params: {
  fixtures: JobFixtureForStripe[]
  targetAmountCents: number
  lineDescriptionOverride?: string | null
  customerName: string
  jobName: string | null
  hcpNumber: string | null
}): { ok: true; items: StripeInvoiceLineItem[] } | { ok: false; error: string } {
  const {
    fixtures,
    targetAmountCents,
    lineDescriptionOverride,
    customerName,
    jobName,
    hcpNumber,
  } = params

  if (!Number.isFinite(targetAmountCents) || targetAmountCents < 1) {
    return { ok: false, error: 'Amount too small' }
  }

  const singleLine = resolveInvoiceLineDescription({
    override: lineDescriptionOverride,
    customerName,
    jobName,
    hcpNumber,
  })
  if (!singleLine.ok) {
    return { ok: false, error: singleLine.error }
  }

  const overrideTrim =
    typeof lineDescriptionOverride === 'string' ? lineDescriptionOverride.trim() : ''
  if (overrideTrim.length > 0) {
    return {
      ok: true,
      items: [
        {
          amount: targetAmountCents,
          description: singleLine.lineDesc,
          source: { kind: 'single_line' },
        },
      ],
    }
  }

  const sorted = [...fixtures].sort((a, b) => {
    const ao = Number(a.sequence_order) || 0
    const bo = Number(b.sequence_order) || 0
    return ao - bo
  })

  const billable = sorted.filter((row) => {
    if (!(row.name ?? '').trim()) return false
    return lineExtendedCents(row) > 0
  })

  if (billable.length === 0) {
    return {
      ok: true,
      items: [
        {
          amount: targetAmountCents,
          description: singleLine.lineDesc,
          source: { kind: 'single_line' },
        },
      ],
    }
  }

  const rawCents = billable.map((row) => lineExtendedCents(row))
  const sumRaw = rawCents.reduce((a, b) => a + b, 0)
  if (sumRaw <= 0) {
    return {
      ok: true,
      items: [
        {
          amount: targetAmountCents,
          description: singleLine.lineDesc,
          source: { kind: 'single_line' },
        },
      ],
    }
  }

  const allocated =
    targetAmountCents === sumRaw ? rawCents : allocateProportionalCents(rawCents, targetAmountCents)

  const items: StripeInvoiceLineItem[] = []
  for (let i = 0; i < billable.length; i++) {
    const row = billable[i]
    if (!row) continue
    const amt = allocated[i] ?? 0
    if (amt <= 0) continue
    items.push({
      amount: amt,
      description: fixtureStripeDescription(row),
      source: { kind: 'fixture', jobs_ledger_fixture_id: row.id },
    })
  }

  let sumItems = items.reduce((s, it) => s + it.amount, 0)
  const drift = targetAmountCents - sumItems
  const lastItem = items[items.length - 1]
  if (drift !== 0 && lastItem) {
    lastItem.amount += drift
    sumItems = items.reduce((s, it) => s + it.amount, 0)
  }

  if (items.length === 0 || sumItems !== targetAmountCents) {
    return {
      ok: true,
      items: [
        {
          amount: targetAmountCents,
          description: singleLine.lineDesc,
          source: { kind: 'single_line' },
        },
      ],
    }
  }

  // Return order matches billable Specific Work: `sequence_order` ascending (same as Physical services).
  // Proportional penny drift is applied to the last row above (last ascending billable line).
  return { ok: true, items }
}

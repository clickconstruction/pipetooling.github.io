import {
  resolveInvoiceLineDescription,
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
} from './stripeLineDescription.ts'
import {
  discountBillLinesForWorkRows,
  discountRowsFromDb,
  discountSharesByWorkRow,
  isDiscountRow,
  netWorkLineCents,
  type DiscountShare,
} from './discountLine.ts'

export type JobFixtureForStripe = {
  id: string
  name: string
  count: number
  line_unit_price: number | null
  line_description: string | null
  sequence_order: number
  /** Discount rows (v2.3252+): never a line of their own — their shares print as negative lines on the bills of the work they follow. */
  line_kind?: string | null
  discount_pct?: number | string | null
  discount_basis_positions?: number[] | null
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
  T extends {
    id: string
    invoice_id?: string | null
    name?: string | null
    count?: number | null
    line_unit_price?: number | null
    sequence_order?: number | null
    line_kind?: string | null
    discount_pct?: number | string | null
    discount_basis_positions?: number[] | null
  },
>(
  rows: T[],
  invoiceId: string,
  invoice?: { isPrimaryRtbBundle: boolean; targetAmountCents: number } | null,
): T[] {
  // Discount rows (v2.3252+) are never scoped as lines of their own: every
  // figure below is a WORK row's cents NET of the discount shares that follow
  // it, so the "sum equals target" reading stays true on a discounted job.
  const shares = discountSharesByWorkRow(discountRowsFromDb(rows))
  const cents = (r: T) => scopeLineCents(r, shares)
  const work = rows.filter((r) => !isDiscountRow(discountRowsFromDb([r])[0]!))
  const linked = work.filter((r) => (r.invoice_id ?? null) === invoiceId)
  if (linked.length > 0) return linked
  const unlinked = work.filter((r) => (r.invoice_id ?? null) === null)
  if (invoice?.isPrimaryRtbBundle === true && Number.isFinite(invoice.targetAmountCents) && invoice.targetAmountCents > 0) {
    const unlinkedBillable = unlinked.filter((r) => cents(r) > 0)
    const sumCents = unlinkedBillable.reduce((s, r) => s + cents(r), 0)
    if (unlinkedBillable.length > 0 && sumCents === invoice.targetAmountCents) return unlinkedBillable
    // B6 / J3-6 (mirrors client dropPaymentsCoveredRows): a remainder smaller
    // than the unlinked work means payments or dollar carves already cover the
    // first rows in order — rows covered to the last cent never re-list; the
    // partially covered row and everything after it stay for proration.
    if (unlinkedBillable.length > 0 && sumCents > invoice.targetAmountCents) {
      let pool = sumCents - invoice.targetAmountCents
      const dropped = new Set<T>()
      for (const r of unlinked) {
        if (pool <= 0) break
        const c = cents(r)
        if (c <= 0) continue
        if (c <= pool) {
          dropped.add(r)
          pool -= c
        } else {
          break
        }
      }
      return unlinked.filter((r) => !dropped.has(r))
    }
  }
  // v2.2589: a row linked to ANOTHER invoice is already listed on that bill —
  // never re-list it here. Proration happens over the unlinked rows only; when
  // every row is linked elsewhere the caller's single-line fallback applies.
  return unlinked
}

/** Cents for one row in the scoping equality — a work row NET of its discount shares (max(1, …) like lineExtendedCents). */
function scopeLineCents(
  row: { id: string; name?: string | null; count?: number | null; line_unit_price?: number | null; line_kind?: string | null },
  shares: ReadonlyMap<string, DiscountShare[]>,
): number {
  if (row.line_kind === 'discount') return 0
  if (!(row.name ?? '').trim()) return 0
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit = row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price)) ? Number(row.line_unit_price) : 0
  const dollars = qty * unit
  if (!Number.isFinite(dollars) || dollars <= 0) return 0
  const gross = Math.max(1, Math.round(dollars * 100))
  const workRow = { id: row.id, name: row.name, count: row.count, line_unit_price: row.line_unit_price, line_kind: 'work' as const }
  const net = netWorkLineCents([], workRow, shares)
  return Math.max(0, Math.min(gross, net))
}

/** Client/Edge JSON: maps preview line to DB row or single-line modes (override / fallback). */
export type StripeInvoiceLineSource =
  | { kind: 'fixture'; jobs_ledger_fixture_id: string }
  /** A discount row's share of the work on this bill (v2.3252+): a negative line. */
  | { kind: 'discount'; jobs_ledger_fixture_id: string }
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
  /** The rows this bill covers (scoped). */
  fixtures: JobFixtureForStripe[]
  /**
   * Every row on the job (v2.3252+) — discount shares are split over the
   * whole basis, so a draw's share needs the rows it does NOT bill too.
   * Defaults to `fixtures` (no discounts: identical output to before).
   */
  allFixtures?: JobFixtureForStripe[]
  targetAmountCents: number
  lineDescriptionOverride?: string | null
  customerName: string
  jobName: string | null
  hcpNumber: string | null
}): { ok: true; items: StripeInvoiceLineItem[] } | { ok: false; error: string } {
  const {
    fixtures,
    allFixtures,
    targetAmountCents,
    lineDescriptionOverride,
    customerName,
    jobName,
    hcpNumber,
  } = params
  const kernelAll = discountRowsFromDb(allFixtures ?? fixtures)
  const shares = discountSharesByWorkRow(kernelAll)

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
    if (row.line_kind === 'discount') return false
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

  // Discount lines (v2.3252+): when the bill is exactly the work it covers
  // minus those rows' discount shares, print the work at its real prices and
  // each discount as its own negative line — Stripe accepts a negative
  // invoice item as a credit. Any other target (a payment took a bite, a
  // dollar carve) keeps the historical proration, run over NET row cents so
  // the customer never sees a price the discount already lowered.
  const discountLines = discountBillLinesForWorkRows(kernelAll, new Set(billable.map((r) => r.id)))
  const grossSum = billable.reduce((a, row) => a + lineExtendedCents(row), 0)
  const discountSum = discountLines.reduce((a, l) => a + l.cents, 0)
  if (discountLines.length > 0 && grossSum - discountSum === targetAmountCents) {
    const items: StripeInvoiceLineItem[] = billable.map((row) => ({
      amount: lineExtendedCents(row),
      description: fixtureStripeDescription(row),
      source: { kind: 'fixture' as const, jobs_ledger_fixture_id: row.id },
    }))
    for (const l of discountLines) {
      items.push({
        amount: -l.cents,
        description: clampLineDescription(l.description),
        source: { kind: 'discount', jobs_ledger_fixture_id: l.discountId },
      })
    }
    return { ok: true, items }
  }

  const rawCents = billable.map((row) =>
    Math.min(
      lineExtendedCents(row),
      netWorkLineCents([], { id: row.id, name: row.name, count: row.count, line_unit_price: row.line_unit_price, line_kind: 'work' }, shares),
    ),
  )
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

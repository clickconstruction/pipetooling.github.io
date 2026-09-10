/**
 * Discount line items (v2.3252+): a discount is a typed row in ① Line Items,
 * not a negative price typed into a work row.
 *
 * The rules, in one breath:
 *   - A discount applies to WORK rows (its basis: every work row on the job,
 *     or a chosen subset). Never to hazmat riders.
 *   - A percent stays live: the dollars are derived from the basis whenever
 *     the form changes. A dollar amount is fixed.
 *   - It follows the work: its dollars are split across the basis rows by
 *     largest remainder (cents-exact), so every draw that bills a basis row
 *     carries that row's share as a labeled negative line. The three draws of
 *     a 10% discount sum to the discount to the cent.
 *   - It can't exceed its basis. The Job Total never goes below zero.
 *   - The signed amount is stored NEGATIVE in `line_unit_price` (count 1), so
 *     `revenueDollarsFromFixtures` and every DB rollup that sums count × price
 *     need no new branch.
 *
 * Pure and dependency-free. Lives in supabase/functions/_shared so the
 * create-stripe-invoice / preview-stripe-invoice edge functions run the same
 * math the form, the segment bar and the PDF builder do (src/lib/jobs/
 * discountLine.ts re-exports it; tested from src/lib/jobs/discountLine.test.ts).
 */

export type DiscountLineKind = 'work' | 'discount'

/** The slice of a line-item row this kernel reads. Form rows and DB rows both satisfy it. */
export type DiscountLineRow = {
  id: string
  name?: string | null
  count?: number | null
  line_unit_price?: number | null
  /** `undefined` / null / 'work' = a work row. */
  line_kind?: DiscountLineKind | null
  /** Percent of the basis; null = a fixed dollar discount. */
  discount_pct?: number | null
  /** Row ids of the work rows the discount applies to; null = every work row. */
  discount_basis_ids?: readonly string[] | null
  discount_reason?: string | null
  invoice_id?: string | null
}

export const DISCOUNT_REASON_PRESETS = ['Negotiated', 'Referral', 'Repeat customer', 'Goodwill', 'Price match'] as const
export type DiscountReasonPreset = (typeof DISCOUNT_REASON_PRESETS)[number]

/** Default row name when a preset chip fills an empty name. */
export function discountNameForReason(reason: DiscountReasonPreset): string {
  switch (reason) {
    case 'Negotiated':
      return 'Negotiated discount'
    case 'Referral':
      return 'Referral thank-you'
    case 'Repeat customer':
      return 'Repeat customer discount'
    case 'Goodwill':
      return 'Goodwill discount'
    case 'Price match':
      return 'Price match'
  }
}

export const isDiscountRow = (r: Pick<DiscountLineRow, 'line_kind'>): boolean => r.line_kind === 'discount'

/** A fresh, empty discount row for the form (no name, no amount, every work row as its basis). */
export function newDiscountFixtureRow(id: string) {
  return {
    id,
    name: '',
    count: 1,
    line_unit_price: null,
    line_description: '',
    invoice_id: null,
    line_kind: 'discount' as const,
    discount_pct: null,
    discount_basis_ids: null,
    discount_reason: null,
    stage_kind: null,
    shared_with_gc: false,
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Gross dollars of one WORK row — same math as revenueDollarsFromFixtures; 0 for discount / unnamed rows. */
export function workLineDollars(r: DiscountLineRow): number {
  if (isDiscountRow(r)) return 0
  if (!(r.name ?? '').trim()) return 0
  const c = Number(r.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit = r.line_unit_price != null && Number.isFinite(Number(r.line_unit_price)) ? Number(r.line_unit_price) : 0
  const d = qty * unit
  return Number.isFinite(d) && d > 0 ? round2(d) : 0
}

/** Dollars a discount row takes off — always ≥ 0 (the stored price is negative). */
export function discountRowDollars(r: DiscountLineRow): number {
  if (!isDiscountRow(r)) return 0
  const unit = r.line_unit_price != null && Number.isFinite(Number(r.line_unit_price)) ? Number(r.line_unit_price) : 0
  return round2(Math.max(0, -unit))
}

/** The work rows a discount applies to, in list order (basis ids that no longer exist are ignored). */
export function discountBasisRows<T extends DiscountLineRow>(rows: readonly T[], discount: DiscountLineRow): T[] {
  const work = rows.filter((r) => !isDiscountRow(r) && workLineDollars(r) > 0)
  const ids = discount.discount_basis_ids
  if (ids == null) return work
  const set = new Set(ids)
  return work.filter((r) => set.has(r.id))
}

export function discountBasisDollars(rows: readonly DiscountLineRow[], discount: DiscountLineRow): number {
  return round2(discountBasisRows(rows, discount).reduce((s, r) => s + workLineDollars(r), 0))
}

/** How the user entered a discount: a percent of the basis, or a fixed dollar amount. */
export type DiscountEntry = { mode: 'pct'; pct: number } | { mode: 'usd'; dollars: number }

/**
 * Read what was typed: `10%` / `10 %` / `%10` → percent; `500` / `$500` /
 * `-500` / `$1,250.50` → dollars. A bare `%` or nothing → null (no discount).
 */
export function parseDiscountEntry(raw: string): DiscountEntry | null {
  const t = raw.trim()
  if (!t) return null
  const isPct = t.includes('%')
  const num = parseFloat(t.replace(/[%$,\s]/g, '').replace(/^-+/, ''))
  if (!Number.isFinite(num) || num < 0) return null
  if (isPct) return { mode: 'pct', pct: Math.min(100, round2(num)) }
  return { mode: 'usd', dollars: round2(num) }
}

/** The dollars a discount row should carry right now, capped at its basis. */
export function derivedDiscountDollars(rows: readonly DiscountLineRow[], discount: DiscountLineRow): number {
  const basis = discountBasisDollars(rows, discount)
  if (discount.discount_pct != null && Number.isFinite(Number(discount.discount_pct))) {
    const pct = Math.min(100, Math.max(0, Number(discount.discount_pct)))
    return round2(Math.min(basis, round2((basis * pct) / 100)))
  }
  return round2(Math.min(basis, discountRowDollars(discount)))
}

/** True when the typed dollar amount had to be held at the basis. */
export function discountExceedsBasis(rows: readonly DiscountLineRow[], discount: DiscountLineRow): boolean {
  if (!isDiscountRow(discount) || discount.discount_pct != null) return false
  return discountRowDollars(discount) > discountBasisDollars(rows, discount) + 0.005
}

/**
 * Keep every discount row's stored fields true to the rules: count 1, no
 * stage kind, not shared with the GC, basis ids pruned to rows that still
 * exist, and the signed price re-derived (a percent follows the work; a
 * dollar amount is capped at the basis). Returns the SAME array when nothing
 * changed so a state setter can short-circuit.
 */
export function syncDiscountRows<T extends DiscountLineRow & { stage_kind?: unknown; shared_with_gc?: unknown }>(
  rows: readonly T[],
): T[] {
  let changed = false
  const workIds = new Set(rows.filter((r) => !isDiscountRow(r)).map((r) => r.id))
  const out = rows.map((r) => {
    if (!isDiscountRow(r)) return r
    let next: T = r
    const basisIds = r.discount_basis_ids
    if (basisIds != null) {
      const pruned = basisIds.filter((id) => workIds.has(id))
      if (pruned.length !== basisIds.length) next = { ...next, discount_basis_ids: pruned.length > 0 ? pruned : null }
    }
    const dollars = derivedDiscountDollars(rows, next)
    const price = dollars > 0 ? -dollars : null
    const priceNow = next.line_unit_price ?? null
    // A typed dollar amount above the basis is kept as typed (the row shows
    // the cap message); only a percent's derived dollars overwrite the price.
    const keepTyped = next.discount_pct == null && discountRowDollars(next) > dollars
    if (!keepTyped && (priceNow ?? null) !== price) next = { ...next, line_unit_price: price }
    if (Number(next.count) !== 1) next = { ...next, count: 1 }
    if (next.stage_kind !== null) next = { ...next, stage_kind: null }
    if (next.shared_with_gc !== false && next.shared_with_gc !== undefined) next = { ...next, shared_with_gc: false }
    if (next !== r) changed = true
    return next
  })
  return changed ? out : (rows as T[])
}

/** Largest-remainder split of `target` cents across positive buckets (mirrors the Stripe allocator). */
export function allocateCentsLargestRemainder(rawCents: readonly number[], target: number): number[] {
  const n = rawCents.length
  const S = rawCents.reduce((a, b) => a + b, 0)
  if (n === 0 || S <= 0 || target <= 0) return rawCents.map(() => 0)
  const exact = rawCents.map((c) => (target * c) / S)
  const floors = exact.map((e) => Math.floor(e))
  const rem = target - floors.reduce((a, b) => a + b, 0)
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

export type DiscountShare = {
  /** The discount row. */
  discountId: string
  name: string
  pct: number | null
  /** Cents this discount takes off the given work row. */
  cents: number
}

/**
 * Every discount's share of every work row, cents-exact: for each discount
 * row, its derived dollars split across its basis rows by largest remainder.
 * The shares of one discount always sum to its dollars, so draws that bill
 * the basis rows in any grouping print the whole discount exactly once.
 */
export function discountSharesByWorkRow(rows: readonly DiscountLineRow[]): Map<string, DiscountShare[]> {
  const out = new Map<string, DiscountShare[]>()
  for (const d of rows) {
    if (!isDiscountRow(d)) continue
    const basis = discountBasisRows(rows, d)
    if (basis.length === 0) continue
    const totalCents = Math.round(derivedDiscountDollars(rows, d) * 100)
    if (totalCents <= 0) continue
    const raw = basis.map((r) => Math.round(workLineDollars(r) * 100))
    const split = allocateCentsLargestRemainder(raw, totalCents)
    basis.forEach((r, i) => {
      const cents = split[i] ?? 0
      if (cents <= 0) return
      const list = out.get(r.id) ?? []
      list.push({ discountId: d.id, name: (d.name ?? '').trim() || 'Discount', pct: d.discount_pct ?? null, cents })
      out.set(r.id, list)
    })
  }
  return out
}

/** Cents every discount takes off one work row. */
export function discountCentsOnWorkRow(shares: ReadonlyMap<string, DiscountShare[]>, workRowId: string): number {
  return (shares.get(workRowId) ?? []).reduce((s, x) => s + x.cents, 0)
}

/** A work row's cents after its discount shares (never below zero). */
export function netWorkLineCents(rows: readonly DiscountLineRow[], row: DiscountLineRow, shares?: ReadonlyMap<string, DiscountShare[]>): number {
  const gross = Math.round(workLineDollars(row) * 100)
  if (gross <= 0) return 0
  const sh = shares ?? discountSharesByWorkRow(rows)
  return Math.max(0, gross - discountCentsOnWorkRow(sh, row.id))
}

export type DiscountBillLine = { discountId: string; description: string; cents: number }

/**
 * The negative lines a bill prints for a set of work rows: one per discount
 * that touches them, summing that discount's shares over exactly those rows.
 * Order = discount rows' order in the list.
 */
export function discountBillLinesForWorkRows(rows: readonly DiscountLineRow[], workRowIds: ReadonlySet<string>): DiscountBillLine[] {
  const shares = discountSharesByWorkRow(rows)
  const byDiscount = new Map<string, DiscountBillLine>()
  for (const id of workRowIds) {
    for (const s of shares.get(id) ?? []) {
      const cur = byDiscount.get(s.discountId)
      if (cur) cur.cents += s.cents
      else byDiscount.set(s.discountId, { discountId: s.discountId, description: discountBillDescription(s.name, s.pct), cents: s.cents })
    }
  }
  const order = new Map(rows.map((r, i) => [r.id, i]))
  return [...byDiscount.values()].sort((a, b) => (order.get(a.discountId) ?? 0) - (order.get(b.discountId) ?? 0))
}

/** "Negotiated discount (10%)" / "Referral thank-you". */
export function discountBillDescription(name: string, pct: number | null | undefined): string {
  const n = name.trim() || 'Discount'
  if (pct == null || !Number.isFinite(Number(pct))) return n
  return `${n} (${formatPct(Number(pct))})`
}

export function formatPct(pct: number): string {
  const r = Math.round(pct * 100) / 100
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(2).replace(/0+$/, '')}%`
}

const fmtUsd = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * The row's second line: "10% off all 3 work lines · follows each draw · not
 * on riders" / "$500 off Rough In, Top Out · follows each draw".
 */
export function discountReadout(rows: readonly DiscountLineRow[], discount: DiscountLineRow): { head: string; basis: string; tail: string } {
  const basis = discountBasisRows(rows, discount)
  const allWork = rows.filter((r) => !isDiscountRow(r) && workLineDollars(r) > 0)
  const head =
    discount.discount_pct != null
      ? `${formatPct(Number(discount.discount_pct))} off`
      : `$${fmtUsd(derivedDiscountDollars(rows, discount))} off`
  let basisText: string
  if (basis.length === 0) basisText = 'nothing yet — add a priced work line'
  else if (discount.discount_basis_ids == null || basis.length === allWork.length)
    basisText = allWork.length === 1 ? ((allWork[0]?.name ?? '').trim() || 'the work line') : `all ${allWork.length} work lines`
  else basisText = basis.map((r) => (r.name ?? '').trim()).join(', ')
  return { head, basis: basisText, tail: 'follows each draw · not on riders' }
}

/** The other form of the entry, shown beside the field: "−$3,774.50" for a percent, "13.3%" for dollars. */
export function discountTwinLabel(rows: readonly DiscountLineRow[], discount: DiscountLineRow): string {
  const dollars = derivedDiscountDollars(rows, discount)
  if (discount.discount_pct != null) return `−$${fmtUsd(dollars)}`
  const basis = discountBasisDollars(rows, discount)
  if (!(basis > 0) || !(dollars > 0)) return '—'
  return formatPct((dollars / basis) * 100)
}

/**
 * A discount locks once any row it applies to is on a bill — that bill
 * already printed its share. (Work rows lock by their own invoice link.)
 */
export function discountRowIsLocked(rows: readonly DiscountLineRow[], discount: DiscountLineRow): boolean {
  return discountBasisRows(rows, discount).some((r) => r.invoice_id != null)
}

/** Total dollars all discounts take off the job (for the footer equation and reporting). */
export function totalDiscountDollars(rows: readonly DiscountLineRow[]): number {
  return round2(rows.reduce((s, r) => (isDiscountRow(r) ? s + derivedDiscountDollars(rows, r) : s), 0))
}

/** Gross work dollars (before discounts). */
export function totalWorkDollars(rows: readonly DiscountLineRow[]): number {
  return round2(rows.reduce((s, r) => s + workLineDollars(r), 0))
}

/**
 * Persisted basis ↔ form ids. The save engine writes named rows with
 * sequence_order = index among named rows; invoice links key on the same
 * positions, so the basis does too.
 */
export function discountBasisPositions(rows: readonly DiscountLineRow[], discount: DiscountLineRow): number[] | null {
  if (discount.discount_basis_ids == null) return null
  const set = new Set(discount.discount_basis_ids)
  const positions: number[] = []
  let i = 0
  for (const r of rows) {
    if (!(r.name ?? '').trim()) continue
    if (set.has(r.id) && !isDiscountRow(r)) positions.push(i)
    i += 1
  }
  return positions.length > 0 ? positions : null
}

/** Positions (as stored) → row ids of a DB-ordered, all-named row list. */
export function discountBasisIdsFromPositions(
  dbRowsInOrder: readonly { id: string; sequence_order: number }[],
  positions: readonly number[] | null | undefined,
): string[] | null {
  if (positions == null) return null
  const set = new Set(positions)
  const ids = [...dbRowsInOrder]
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .filter((r) => set.has(r.sequence_order))
    .map((r) => r.id)
  return ids.length > 0 ? ids : null
}

/**
 * DB rows carry the basis as `sequence_order` positions; the kernel reads
 * row ids. Normalizes a DB-shaped list (loosely typed — rows loaded before the
 * push have none of the columns and read as work rows) into kernel rows.
 */
export type DbDiscountRowLike = {
  id: string
  sequence_order?: number | null
  line_kind?: string | null
  discount_pct?: number | string | null
  discount_basis_positions?: number[] | null
}
export function discountRowsFromDb<T extends DbDiscountRowLike>(
  rows: readonly T[],
): Array<T & { line_kind: DiscountLineKind; discount_pct: number | null; discount_basis_ids: string[] | null }> {
  const ordered = rows.map((r, i) => ({ id: r.id, sequence_order: typeof r.sequence_order === 'number' ? r.sequence_order : i }))
  return rows.map((r) => {
    const kind: DiscountLineKind = r.line_kind === 'discount' ? 'discount' : 'work'
    const pct = r.discount_pct != null && Number.isFinite(Number(r.discount_pct)) ? Number(r.discount_pct) : null
    return {
      ...r,
      line_kind: kind,
      discount_pct: kind === 'discount' ? pct : null,
      discount_basis_ids: kind === 'discount' ? discountBasisIdsFromPositions(ordered, r.discount_basis_positions ?? null) : null,
    }
  })
}

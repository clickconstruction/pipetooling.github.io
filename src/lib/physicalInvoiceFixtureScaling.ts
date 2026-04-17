/**
 * Proportional cent split for physical invoice Services rows — keep in sync with
 * `supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts` (`allocateProportionalCents`,
 * `lineExtendedCents`, billable filter).
 */

export type FixtureRowForScaling = {
  name: string | null
  count: number | null
  line_unit_price: number | null
  line_description: string | null
  sequence_order: number
}

export type ScaledFixtureLineDraft = {
  description: string
  amountCents: number
}

function lineExtendedCents(row: Pick<FixtureRowForScaling, 'name' | 'count' | 'line_unit_price'>): number {
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit =
    row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price))
      ? Number(row.line_unit_price)
      : 0
  const dollars = qty * unit
  if (!Number.isFinite(dollars) || dollars <= 0) return 0
  return Math.max(1, Math.round(dollars * 100))
}

function isBillableFixtureRow(
  row: Pick<FixtureRowForScaling, 'name' | 'count' | 'line_unit_price'>,
): boolean {
  if (!(row.name ?? '').trim()) return false
  return lineExtendedCents(row) > 0
}

/** Largest-remainder allocation of `target` cents across positive raw buckets. */
export function allocateProportionalCents(rawCents: number[], target: number): number[] {
  const n = rawCents.length
  const S = rawCents.reduce((a, b) => a + b, 0)
  if (n === 0 || S <= 0) return rawCents.map(() => 0)
  if (target === S) return [...rawCents]

  const exact = rawCents.map((c) => (target * c) / S)
  const floors = exact.map((e) => Math.floor(e))
  let sumFloors = floors.reduce((a, b) => a + b, 0)
  const rem = target - sumFloors
  const frac = exact.map((e, i) => ({ i, f: e - Math.floor(e) }))
  frac.sort((a, b) => (b.f !== a.f ? b.f - a.f : a.i - b.i))
  const out = [...floors]
  for (let k = 0; k < rem && k < n; k++) {
    const idx = frac[k]?.i
    if (idx !== undefined) out[idx] = (out[idx] ?? 0) + 1
  }
  return out
}

/** Matches physical invoice multi-line display: name + newline + scope when present. */
export function fixturePhysicalDescription(row: FixtureRowForScaling): string {
  const name = (row.name ?? '').trim()
  const extra = (row.line_description ?? '').trim()
  if (extra) return `${name}\n${extra}`
  return name || 'Line item'
}

/**
 * Allocate `targetAmountCents` across billable fixtures (same shape as Stripe line items).
 * Returns null when there are no billable rows or target is too small.
 */
export function buildScaledFixtureLineDrafts(
  fixtures: FixtureRowForScaling[],
  targetAmountCents: number,
): { drafts: ScaledFixtureLineDraft[]; proportionalScalingUsed: boolean } | null {
  if (!Number.isFinite(targetAmountCents) || targetAmountCents < 1) return null

  const sorted = [...fixtures].sort((a, b) => {
    const ao = Number(a.sequence_order) || 0
    const bo = Number(b.sequence_order) || 0
    return ao - bo
  })

  const billable = sorted.filter((row) => isBillableFixtureRow(row))
  if (billable.length === 0) return null

  const rawCents = billable.map((row) => lineExtendedCents(row))
  const sumRaw = rawCents.reduce((a, b) => a + b, 0)
  if (sumRaw <= 0) return null

  const allocated =
    targetAmountCents === sumRaw ? [...rawCents] : allocateProportionalCents(rawCents, targetAmountCents)
  const proportionalScalingUsed = targetAmountCents !== sumRaw

  const drafts: ScaledFixtureLineDraft[] = []
  for (let i = 0; i < billable.length; i++) {
    const row = billable[i]
    if (!row) continue
    const amt = allocated[i] ?? 0
    if (amt <= 0) continue
    drafts.push({
      description: fixturePhysicalDescription(row),
      amountCents: amt,
    })
  }

  let sumItems = drafts.reduce((s, it) => s + it.amountCents, 0)
  const drift = targetAmountCents - sumItems
  if (drift !== 0 && drafts.length > 0) {
    const last = drafts[drafts.length - 1]
    if (last) last.amountCents += drift
    sumItems = drafts.reduce((s, it) => s + it.amountCents, 0)
  }

  if (drafts.length === 0 || sumItems !== targetAmountCents) return null

  return { drafts, proportionalScalingUsed }
}

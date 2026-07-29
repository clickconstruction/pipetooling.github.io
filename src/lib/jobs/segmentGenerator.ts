/**
 * Multiple Segment Generator (v2.1071): pure math for the ① Line Items
 * modal that splits a total dollar amount into named percentage segments.
 *
 * Dollars are cents-exact: each row rounds independently, and when the
 * percentages sum to exactly 100 the LAST dollar-bearing row absorbs the
 * rounding remainder so the segments always add back to the total.
 */

export type SegmentGeneratorRow = {
  id: string
  name: string
  /** Percentage of the total, 0–100; null while the field is empty. */
  pct: number | null
}

export type SegmentGeneratorPreset = {
  key: string
  label: string
  rows: Array<{ name: string; pct: number }>
}

export const SEGMENT_GENERATOR_PRESETS: SegmentGeneratorPreset[] = [
  {
    key: 'commercial',
    label: 'Commercial 30/30/30/10',
    rows: [
      { name: 'Rough In', pct: 30 },
      { name: 'Top Out', pct: 30 },
      { name: 'Trim Set', pct: 30 },
      { name: 'Final', pct: 10 },
    ],
  },
  {
    key: 'residential',
    label: 'Residential 40/40/20',
    rows: [
      { name: 'Rough In', pct: 40 },
      { name: 'Top Out', pct: 40 },
      { name: 'Trim Set', pct: 20 },
    ],
  },
]

/** Sum of entered percentages (nulls count as 0), rounded to 2dp. */
export function segmentGeneratorAllocatedPct(rows: SegmentGeneratorRow[]): number {
  const s = rows.reduce((acc, r) => acc + (r.pct ?? 0), 0)
  return Math.round(s * 100) / 100
}

/**
 * Cents-exact dollars per row id. Rows with no/zero pct map to 0. When the
 * allocated pct is exactly 100, the last row with dollars absorbs the
 * rounding remainder so the values sum to totalDollars.
 */
export function segmentGeneratorDollarsByRowId(
  totalDollars: number,
  rows: SegmentGeneratorRow[],
): Record<string, number> {
  const totalCents = Math.round((totalDollars || 0) * 100)
  const out: Record<string, number> = {}
  let sumCents = 0
  let lastPaidRowId: string | null = null
  for (const r of rows) {
    const pct = r.pct ?? 0
    const cents = totalCents > 0 && pct > 0 ? Math.round((totalCents * pct) / 100) : 0
    out[r.id] = cents / 100
    sumCents += cents
    if (cents > 0) lastPaidRowId = r.id
  }
  const allocated = segmentGeneratorAllocatedPct(rows)
  if (allocated === 100 && lastPaidRowId != null && sumCents !== totalCents) {
    const lastCents = Math.round((out[lastPaidRowId] ?? 0) * 100) + (totalCents - sumCents)
    out[lastPaidRowId] = Math.max(0, lastCents) / 100
  }
  return out
}

export type SegmentGeneratorPayloadLine = {
  name: string
  count: 1
  line_unit_price: number
  line_description: ''
  invoice_id: null
}

/**
 * The line items "Add to Job" appends: named rows with dollars > 0, in row
 * order, count 1, unit price = the row's cents-exact share.
 */
export function segmentGeneratorPayload(
  totalDollars: number,
  rows: SegmentGeneratorRow[],
): SegmentGeneratorPayloadLine[] {
  const dollars = segmentGeneratorDollarsByRowId(totalDollars, rows)
  const out: SegmentGeneratorPayloadLine[] = []
  for (const r of rows) {
    const name = (r.name ?? '').trim()
    const d = dollars[r.id] ?? 0
    if (!name || !(d > 0)) continue
    out.push({ name, count: 1, line_unit_price: d, line_description: '', invoice_id: null })
  }
  return out
}

/**
 * Multiple Segment Generator (v2.1071; Stage Plan PR 3): pure math for the
 * ① Line Items modal that splits a total dollar amount into named percentage
 * segments — and, since the Stage Plan, says what kind of stage each one is.
 *
 * Kinds follow the line item's rule (stagePlan.ts):
 *   order  a numbered stage — a percentage share of the total
 *   any    its own dates — its own dollar amount, outside the split
 *   null   a plain line — its own dollar amount, outside the split
 *
 * Dollars are cents-exact: each Order row rounds independently, and when the
 * percentages sum to exactly 100 the LAST dollar-bearing Order row absorbs the
 * rounding remainder so the shares always add back to the total.
 */
import type { StageKind } from './stagePlan'

export type SegmentGeneratorRow = {
  id: string
  name: string
  /** Percentage of the total, 0–100; null while the field is empty. Order rows only. */
  pct: number | null
  /** `order` = a share of the total; `any` / null = its own amount. */
  kind: StageKind | null
  /** Dollars for an Any / plain row (outside the split); null while empty. */
  amount: number | null
}

export type SegmentGeneratorPreset = {
  key: string
  label: string
  /** "4 in order" — the chip's hint. */
  hint: string
  rows: Array<{ name: string; pct: number; kind: 'order' }>
}

export const SEGMENT_GENERATOR_PRESETS: SegmentGeneratorPreset[] = [
  {
    key: 'commercial',
    label: 'Commercial 30/30/30/10',
    hint: '4 in order',
    rows: [
      { name: 'Rough In', pct: 30, kind: 'order' },
      { name: 'Top Out', pct: 30, kind: 'order' },
      { name: 'Trim Set', pct: 30, kind: 'order' },
      { name: 'Final', pct: 10, kind: 'order' },
    ],
  },
  {
    key: 'residential',
    label: 'Residential 40/40/20',
    hint: '3 in order',
    rows: [
      { name: 'Rough In', pct: 40, kind: 'order' },
      { name: 'Top Out', pct: 40, kind: 'order' },
      { name: 'Trim Set', pct: 20, kind: 'order' },
    ],
  },
]

/** The "+ Change order" preset: one Any row with its own price, appended to whatever is there. */
export const CHANGE_ORDER_ROW: Omit<SegmentGeneratorRow, 'id'> = { name: 'Change order', pct: null, kind: 'any', amount: null }

export const isOrderRow = (r: Pick<SegmentGeneratorRow, 'kind'>): boolean => r.kind === 'order'

/** Sum of entered percentages on Order rows (nulls count as 0), rounded to 2dp. */
export function segmentGeneratorAllocatedPct(rows: SegmentGeneratorRow[]): number {
  const s = rows.reduce((acc, r) => acc + (isOrderRow(r) ? (r.pct ?? 0) : 0), 0)
  return Math.round(s * 100) / 100
}

/**
 * Cents-exact dollars per row id. Order rows share the total by pct (zero
 * when empty); when the allocated pct is exactly 100, the last Order row
 * with dollars absorbs the rounding remainder so the shares sum to
 * totalDollars. Any / plain rows carry their own amount.
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
    if (!isOrderRow(r)) {
      out[r.id] = Math.max(0, Math.round((r.amount ?? 0) * 100)) / 100
      continue
    }
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

export type SegmentGeneratorTotals = {
  /** Dollars the Order rows share (the split). */
  inOrderDollars: number
  /** Dollars on Any / plain rows, outside the split. */
  outsideDollars: number
  /** What lands on the job: split + outside. */
  jobTotalDollars: number
  orderCount: number
  anyCount: number
  plainCount: number
}

/** The allocation line's numbers and the summary line's counts. Counts named rows only. */
export function segmentGeneratorTotals(totalDollars: number, rows: SegmentGeneratorRow[]): SegmentGeneratorTotals {
  const dollars = segmentGeneratorDollarsByRowId(totalDollars, rows)
  let inOrder = 0
  let outside = 0
  let orderCount = 0
  let anyCount = 0
  let plainCount = 0
  for (const r of rows) {
    const d = dollars[r.id] ?? 0
    if (isOrderRow(r)) inOrder += d
    else outside += d
    if (!(r.name ?? '').trim()) continue
    if (r.kind === 'order') orderCount += 1
    else if (r.kind === 'any') anyCount += 1
    else plainCount += 1
  }
  const round = (n: number) => Math.round(n * 100) / 100
  return { inOrderDollars: round(inOrder), outsideDollars: round(outside), jobTotalDollars: round(inOrder + outside), orderCount, anyCount, plainCount }
}

export type SegmentGeneratorPayloadLine = {
  name: string
  count: 1
  line_unit_price: number
  line_description: ''
  invoice_id: null
  /** Stage Plan: the kind the row was given in the generator. */
  stage_kind: StageKind | null
}

/**
 * The line items "Add to Job" appends: named rows with dollars > 0, in row
 * order, count 1, unit price = the row's cents-exact share (or its own
 * amount), each carrying its stage kind.
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
    out.push({ name, count: 1, line_unit_price: d, line_description: '', invoice_id: null, stage_kind: r.kind })
  }
  return out
}

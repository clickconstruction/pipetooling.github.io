/**
 * The other direct costs of a bid, read off the `cost_estimate_direct_costs`
 * view (the Labor refresh PR 2): the five amber tables — equipment, permits,
 * subs, waste, other — as one list with a kind. The tables stay; writes still
 * go to the table the kind names. Pure.
 */
import type { Database } from '../../types/database'

export type CostEstimateDirectCostRow = Database['public']['Views']['cost_estimate_direct_costs']['Row']

export const DIRECT_COST_KINDS = ['equipment', 'permit', 'sub', 'waste', 'other'] as const
export type DirectCostKind = (typeof DIRECT_COST_KINDS)[number]

/** The section names the five amber tables carried (kept for aria labels and the kind chip's title). */
export const DIRECT_COST_KIND_LABELS: Record<DirectCostKind, string> = {
  equipment: 'Equipment & Tool Rental',
  permit: 'Permits, Inspections & Regulatory Fees',
  sub: 'Subcontractor Fees',
  waste: 'Waste Disposal & Site Cleanup',
  other: 'Other',
}

export const DIRECT_COST_KIND_WORDS: Record<DirectCostKind, string> = {
  equipment: 'equipment',
  permit: 'permits',
  sub: 'subs',
  waste: 'waste',
  other: 'other',
}

/** The table behind a kind — the view is read-only. */
export const DIRECT_COST_KIND_TABLE: Record<DirectCostKind, 'cost_estimate_equipment_rows' | 'cost_estimate_permit_rows' | 'cost_estimate_subcontractor_rows' | 'cost_estimate_waste_rows' | 'cost_estimate_other_rows'> = {
  equipment: 'cost_estimate_equipment_rows',
  permit: 'cost_estimate_permit_rows',
  sub: 'cost_estimate_subcontractor_rows',
  waste: 'cost_estimate_waste_rows',
  other: 'cost_estimate_other_rows',
}

export const isDirectCostKind = (k: unknown): k is DirectCostKind => typeof k === 'string' && (DIRECT_COST_KINDS as readonly string[]).includes(k)

const money = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** A row's three stage amounts added up; blanks and negatives count as 0 (same rule as `sumEquipmentRows`). */
export const directCostRowTotal = (r: { rough_in?: unknown; top_out?: unknown; trim_set?: unknown }): number => money(r.rough_in) + money(r.top_out) + money(r.trim_set)

export type DirectCostTotals = {
  byKind: Record<DirectCostKind, number>
  byStage: { rough: number; top: number; trim: number }
  total: number
  rowCount: number
}

/** What the summer reads off a row — the view row, or a table row tagged with its kind. */
export type DirectCostRowInput = { kind: string | null; rough_in?: unknown; top_out?: unknown; trim_set?: unknown }

export function sumDirectCosts(rows: ReadonlyArray<DirectCostRowInput> | null | undefined): DirectCostTotals {
  const byKind: Record<DirectCostKind, number> = { equipment: 0, permit: 0, sub: 0, waste: 0, other: 0 }
  const byStage = { rough: 0, top: 0, trim: 0 }
  let rowCount = 0
  for (const r of rows ?? []) {
    if (!isDirectCostKind(r.kind)) continue
    rowCount += 1
    byKind[r.kind] += directCostRowTotal(r)
    byStage.rough += money(r.rough_in)
    byStage.top += money(r.top_out)
    byStage.trim += money(r.trim_set)
  }
  return { byKind, byStage, total: byStage.rough + byStage.top + byStage.trim, rowCount }
}

/** "subs $6,500 · permits $1,240" — the non-zero kinds, largest first. Empty string when nothing is entered. */
export function directCostKindWords(t: DirectCostTotals, fmt: (n: number) => string): string {
  return (Object.entries(t.byKind) as Array<[DirectCostKind, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${DIRECT_COST_KIND_WORDS[k]} ${fmt(n)}`)
    .join(' · ')
}

/** One row of the one list (v2.3295): a table row with its kind. */
export type DirectCostListRow<R extends { id: string; sequence_order: number }> = { kind: DirectCostKind; row: R }

/** The five tables as one list — kind order (equipment · permit · sub · waste · other), then each table's sequence. */
export function flattenDirectCostTables<R extends { id: string; sequence_order: number }>(tables: Partial<Record<DirectCostKind, ReadonlyArray<R> | null | undefined>>): DirectCostListRow<R>[] {
  const out: DirectCostListRow<R>[] = []
  for (const kind of DIRECT_COST_KINDS) {
    const rows = [...(tables[kind] ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)
    for (const row of rows) out.push({ kind, row })
  }
  return out
}

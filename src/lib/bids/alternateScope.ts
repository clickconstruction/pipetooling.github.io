/**
 * Alternates across the bid tabs (v2.4191, the alternates train PR 3): the bid's
 * `alternate_group_tags` names the count-row groups the customer wants priced with and
 * without. These helpers split any per-row value — a fixture's material cost, its labor
 * hours — into the BASE (every row outside an alternate) and what EACH alternate adds, so
 * Takeoffs, Labor, Pricing and the Cover Letter all say the same two numbers. Membership
 * is the Count Sheet's rule (`isAlternateRow` in countSheet.ts): by group_tag, trimmed and
 * case-insensitive. Pure; no React, no DB.
 */
import { isAlternateRow, normalizeGroupTag } from './countSheet'
import { laborRowHours } from './laborRowHours'

type GroupedRow = { group_tag: string | null }

export type AlternateSplit = {
  /** Every row outside an alternate group. */
  base: number
  /** One entry per alternate group that holds a row, alphabetical, first spelling kept. */
  alternates: { label: string; value: number }[]
  /** base + every alternate — the bid with everything. */
  total: number
}

/** The rows in the base, and each alternate's rows (alphabetical by label; the first spelling on a row is the label). */
export function partitionByAlternate<T extends GroupedRow>(
  rows: readonly T[],
  alternateTags: readonly string[],
): { base: T[]; alternates: { label: string; rows: T[] }[] } {
  const base: T[] = []
  const byKey = new Map<string, { label: string; rows: T[] }>()
  for (const r of rows) {
    if (!isAlternateRow(r, alternateTags)) {
      base.push(r)
      continue
    }
    const key = normalizeGroupTag(r.group_tag)
    const g = byKey.get(key) ?? { label: (r.group_tag ?? '').trim(), rows: [] }
    g.rows.push(r)
    byKey.set(key, g)
  }
  const alternates = [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label))
  return { base, alternates }
}

/**
 * Sum a per-row value into base / each alternate / total. null when no alternate group
 * holds a row, so a surface draws nothing extra on a bid without alternates.
 */
export function sumByAlternate<T extends GroupedRow>(
  rows: readonly T[],
  alternateTags: readonly string[],
  value: (row: T) => number,
): AlternateSplit | null {
  if (alternateTags.length === 0) return null
  const { base, alternates } = partitionByAlternate(rows, alternateTags)
  if (alternates.length === 0) return null
  const sum = (list: readonly T[]) => list.reduce((s, r) => s + (Number(value(r)) || 0), 0)
  const baseValue = sum(base)
  const alts = alternates.map((a) => ({ label: a.label, value: sum(a.rows) }))
  return { base: baseValue, alternates: alts, total: baseValue + alts.reduce((s, a) => s + a.value, 0) }
}

type LaborRowShape = Parameters<typeof laborRowHours>[0] & { fixture?: string | null }
type CountRowShape = GroupedRow & { fixture: string | null; count: number | string | null }

/**
 * Labor hours split by alternate. Labor rows are keyed by fixture NAME and carry the
 * summed count of every count row with that name (v2.4188), so a fixture that sits in
 * the base and in an alternate shares one labor row: its hours split in the ratio of
 * the scoped counts (exact — hours are linear in the count for `each` and `per_100ft`
 * rows). Fixed hours, tasks and sub lines belong to the base. null when no alternate
 * holds a count row.
 */
export function laborHoursByAlternate(args: {
  laborRows: readonly LaborRowShape[]
  countRows: readonly CountRowShape[]
  alternateTags: readonly string[]
}): AlternateSplit | null {
  const { laborRows, countRows, alternateTags } = args
  if (alternateTags.length === 0) return null
  const parts = partitionByAlternate(countRows, alternateTags)
  if (parts.alternates.length === 0) return null
  const nameKey = (f: string | null | undefined) => (f ?? '').trim().toLowerCase()
  const countOf = (list: readonly CountRowShape[], key: string) => list.filter((r) => nameKey(r.fixture) === key).reduce((s, r) => s + (Number(r.count) || 0), 0)
  let base = 0
  const alts = parts.alternates.map((a) => ({ label: a.label, value: 0 }))
  for (const row of laborRows) {
    const hours = laborRowHours(row)
    if (!(hours > 0)) continue
    const linear = !(row.is_fixed || row.kind === 'task' || row.kind === 'sub')
    const key = nameKey(row.fixture)
    const total = linear ? countOf(countRows, key) : 0
    if (!linear || total <= 0) {
      base += hours
      continue
    }
    let placed = 0
    parts.alternates.forEach((a, i) => {
      const share = (countOf(a.rows, key) / total) * hours
      alts[i]!.value += share
      placed += share
    })
    base += hours - placed
  }
  return { base, alternates: alts, total: base + alts.reduce((s, a) => s + a.value, 0) }
}

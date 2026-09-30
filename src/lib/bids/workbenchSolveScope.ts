import { isAlternateRow, normalizeGroupTag } from './countSheet'

/**
 * v2.4202: what the Workbench solver prices on a bid with a with-and-without alternate.
 * 'base' — every row outside an alternate group (the number the letter leads with);
 * { alternate } — one alternate's rows (its normalized group tag); 'whole' — every row.
 * Rows outside the scope keep their prices; the overhead (cost with no row of its own)
 * follows the scope pro rata by fixture cost, so a margin solve on the base means the
 * base's margin.
 */
export type WorkbenchSolveScope = 'base' | 'whole' | { alternate: string }

export type ScopedRow = { id: string; rowCost: number; group_tag: string | null }

export function solveScopeKey(scope: WorkbenchSolveScope): string {
  return scope === 'base' || scope === 'whole' ? scope : `alt:${scope.alternate}`
}

export function sameSolveScope(a: WorkbenchSolveScope, b: WorkbenchSolveScope): boolean {
  return solveScopeKey(a) === solveScopeKey(b)
}

/** The scope that applies: no alternates → whole; an alternate the bid no longer has → base. */
export function effectiveSolveScope(scope: WorkbenchSolveScope, alternateTags: readonly string[], rows: readonly ScopedRow[]): WorkbenchSolveScope {
  if (alternateTags.length === 0 || !rows.some((r) => isAlternateRow(r, alternateTags))) return 'whole'
  if (scope === 'base' || scope === 'whole') return scope
  const key = normalizeGroupTag(scope.alternate)
  return rows.some((r) => isAlternateRow(r, alternateTags) && normalizeGroupTag(r.group_tag) === key) ? { alternate: key } : 'base'
}

/**
 * The rows the solver sees and the overhead they carry. `overhead` is the bid's cost with no
 * row of its own (driving, travel, permits …); the scope takes its share by fixture cost.
 */
export function scopeWorkbenchRows<T extends ScopedRow>(
  rows: readonly T[],
  scope: WorkbenchSolveScope,
  alternateTags: readonly string[],
  overhead: number,
): { scope: WorkbenchSolveScope; rows: T[]; overhead: number; fixtureCost: number } {
  const eff = effectiveSolveScope(scope, alternateTags, rows)
  const inScope = (r: T): boolean => {
    if (eff === 'whole') return true
    const alt = isAlternateRow(r, alternateTags)
    if (eff === 'base') return !alt
    return alt && normalizeGroupTag(r.group_tag) === eff.alternate
  }
  const picked = rows.filter(inScope)
  const costOf = (list: readonly T[]) => list.reduce((s, r) => s + (r.rowCost > 0 ? r.rowCost : 0), 0)
  const allCost = costOf(rows)
  const fixtureCost = costOf(picked)
  const share = eff === 'whole' || allCost <= 0 ? 1 : fixtureCost / allCost
  return { scope: eff, rows: picked, overhead: Math.max(overhead, 0) * share, fixtureCost }
}

/** The pill's word: Base · + Break room · Whole bid. */
export function solveScopeLabel(scope: WorkbenchSolveScope, alternateLabels: ReadonlyMap<string, string> = new Map()): string {
  if (scope === 'base') return 'Base'
  if (scope === 'whole') return 'Whole bid'
  return `+ ${alternateLabels.get(scope.alternate) ?? scope.alternate}`
}

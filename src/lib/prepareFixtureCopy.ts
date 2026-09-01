/**
 * Prepare-before-copy kernel (v2.2612) for the Pricing tab's "Copy fixtures for
 * text": groups the viewed version's count rows by Division 22 section (via the
 * rules ledger), models the vendor scope presets, and renders the exact
 * clipboard text for any selection — the same format `buildBidFixtureCountsTextGrouped`
 * ships, so the preview pane IS the paste.
 *
 * Scope presets ride MasterFormat's own numbering: 22 3x is equipment and
 * 22 4x is fixtures, so "Fixtures & equipment" = sections starting '22 3'/'22 4'
 * and "Pipe & fittings" = every other coded section. The uncoded/no-code tail
 * belongs to "Whole job" only. Selection is per-copy state — never persisted.
 */

import { classifySpecSection, type SpecSectionMatchRule } from './classifySpecSection'
import { buildBidFixtureCountsTextGrouped, type FixtureCountTextRow } from './buildBidFixtureCountsText'

export type PrepareCopyRow = FixtureCountTextRow & { id: string }

export type PrepareCopyGroup = {
  /** null = the "No code yet" tail (unmatched + deliberate no-code rows). */
  sectionCode: string | null
  title: string | null
  rows: PrepareCopyRow[]
}

export type PrepareCopyScope = 'whole' | 'pipe' | 'fixtures' | 'custom'

const FIXTURE_EQUIPMENT_PREFIXES = ['22 3', '22 4']

export function isFixtureEquipmentSection(code: string): boolean {
  return FIXTURE_EQUIPMENT_PREFIXES.some((p) => code.startsWith(p))
}

/** Group usable rows (finite count > 0) by section, ascending code order, tail last. */
export function buildPrepareCopyGroups(
  rows: ReadonlyArray<PrepareCopyRow>,
  rules: ReadonlyArray<SpecSectionMatchRule>,
  sectionTitleByCode: ReadonlyMap<string, string>,
): PrepareCopyGroup[] {
  const byCode = new Map<string, PrepareCopyRow[]>()
  const tail: PrepareCopyRow[] = []
  for (const row of rows) {
    if (!Number.isFinite(row.count) || row.count <= 0) continue
    const match = classifySpecSection((row.fixture ?? '').trim(), rules)
    if (match.outcome === 'matched') {
      const bucket = byCode.get(match.sectionCode)
      if (bucket) bucket.push(row)
      else byCode.set(match.sectionCode, [row])
    } else {
      tail.push(row)
    }
  }
  const groups: PrepareCopyGroup[] = [...byCode.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((code) => ({ sectionCode: code, title: sectionTitleByCode.get(code) ?? null, rows: byCode.get(code) ?? [] }))
  if (tail.length > 0) groups.push({ sectionCode: null, title: null, rows: tail })
  return groups
}

/** Row ids a preset selects. 'custom' is caller-managed and returns null. */
export function rowIdsForScope(groups: ReadonlyArray<PrepareCopyGroup>, scope: PrepareCopyScope): Set<string> | null {
  if (scope === 'custom') return null
  const ids = new Set<string>()
  for (const g of groups) {
    const include =
      scope === 'whole'
        ? true
        : g.sectionCode !== null && (scope === 'fixtures') === isFixtureEquipmentSection(g.sectionCode)
    if (include) for (const r of g.rows) ids.add(r.id)
  }
  return ids
}

/** Which preset a selection corresponds to, or 'custom' when it matches none. */
export function scopeForSelection(groups: ReadonlyArray<PrepareCopyGroup>, selected: ReadonlySet<string>): PrepareCopyScope {
  for (const scope of ['whole', 'pipe', 'fixtures'] as const) {
    const ids = rowIdsForScope(groups, scope)
    if (ids && ids.size === selected.size && [...ids].every((id) => selected.has(id))) return scope
  }
  return 'custom'
}

/** The exact clipboard text for the current selection — identical format to the shipped copy. */
export function buildScopedFixtureCopyText(args: {
  bidLabel: string
  groups: ReadonlyArray<PrepareCopyGroup>
  selected: ReadonlySet<string>
  sectionTitleByCode: ReadonlyMap<string, string>
}): string {
  // Classification is name-based, so identical names always share a section —
  // a name→code map is exact, and spares re-running the rules here.
  const codeByName = new Map<string, string | null>()
  const rows: PrepareCopyRow[] = []
  for (const g of args.groups) {
    for (const r of g.rows) {
      if (!args.selected.has(r.id)) continue
      rows.push(r)
      codeByName.set((r.fixture ?? '').trim(), g.sectionCode)
    }
  }
  return buildBidFixtureCountsTextGrouped({
    bidLabel: args.bidLabel,
    rows,
    sectionCodeForName: (name) => codeByName.get(name.trim()) ?? null,
    sectionTitleByCode: args.sectionTitleByCode,
  })
}

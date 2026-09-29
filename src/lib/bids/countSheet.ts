/**
 * Count Sheet (the Counts tab's "New" view): pure helpers for the summary
 * strip, the by-plan-page audit grouping, and the duplicate-fixture guard.
 * `page` is the existing free-text plan-page field ("5, 26, 38", "A-101", …).
 */

import { emptyUnitTotals, formatUnitTotals, sumByUnit, type UnitTotals } from './countRowUnit'

export type CountSheetRow = {
  id: string
  fixture: string
  count: number
  group_tag: string | null
  page: string | null
  /** Explicit unit (stage 2 column); null/undefined → inferred from the name. */
  unit?: string | null
}

/** Split a free-text plan-page value into display tokens ("5, 26,38" → ['5','26','38']). */
export function parsePlanPageTokens(page: string | null | undefined): string[] {
  if (!page) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of page.split(/[,;]+/)) {
    const t = raw.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

export type CountSheetSummary = {
  items: number
  /** Per-unit items + totals (v2.2113): counts (ea) and line feet (ft) are never summed together. */
  byUnit: UnitTotals
  noPageCount: number
  withGroupTag: number
  /** Alternate groups (v2.4188) that hold at least one row. */
  alternates: number
}

export function countSheetSummary(rows: CountSheetRow[], alternateTags: readonly string[] = []): CountSheetSummary {
  return {
    items: rows.length,
    byUnit: sumByUnit(rows),
    noPageCount: rows.filter((r) => parsePlanPageTokens(r.page).length === 0).length,
    withGroupTag: rows.filter((r) => (r.group_tag ?? '').trim() !== '').length,
    alternates: countSheetAlternateTotals(rows, alternateTags)?.alternates.length ?? 0,
  }
}

export type CountSheetPageGroup<T extends CountSheetRow = CountSheetRow> = {
  label: string
  rows: T[]
  /** Per-unit totals for the group header ("12 ea · 148.5 ft"). */
  byUnit: UnitTotals
}

/**
 * Group rows by plan page for the audit view. A row citing several pages
 * appears under each (it spans those sheets); rows with none land in the
 * `noPage` bucket. Numeric pages sort numerically first, then text labels
 * (A-101 …) alphabetically.
 */
export function buildCountSheetPageGroups<T extends CountSheetRow>(rows: T[]): {
  pages: CountSheetPageGroup<T>[]
  noPage: T[]
} {
  const byPage = new Map<string, T[]>()
  const noPage: T[] = []
  for (const r of rows) {
    const tokens = parsePlanPageTokens(r.page)
    if (tokens.length === 0) {
      noPage.push(r)
      continue
    }
    for (const t of tokens) {
      const list = byPage.get(t) ?? []
      list.push(r)
      byPage.set(t, list)
    }
  }
  const labels = [...byPage.keys()].sort((a, b) => {
    const na = Number(a)
    const nb = Number(b)
    const aNum = Number.isFinite(na) && a.trim() !== ''
    const bNum = Number.isFinite(nb) && b.trim() !== ''
    if (aNum && bNum) return na - nb
    if (aNum) return -1
    if (bNum) return 1
    return a.localeCompare(b)
  })
  return {
    pages: labels.map((label) => {
      const groupRows = byPage.get(label) ?? []
      return { label, rows: groupRows, byUnit: groupRows.length ? sumByUnit(groupRows) : emptyUnitTotals() }
    }),
    noPage,
  }
}

/**
 * Case-insensitive, trimmed match against existing fixtures — the fork-the-takeoff guard.
 * Pass `excludeId` when checking a RENAME, so the row being edited doesn't match itself.
 */
export function findDuplicateFixture<T extends CountSheetRow>(
  rows: T[],
  name: string,
  excludeId?: string,
  /**
   * v2.4188: the same fixture may sit in the base bid AND in an alternate group (WC ×4 in
   * Restroom A, WC ×1 in the Break room alternate) — those are two rows on purpose, so a
   * duplicate is only a row in the SAME scope (the same alternate group, or both base).
   */
  scope?: { alternateTags: readonly string[]; groupTag: string | null },
): T | null {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  const key = scope ? alternateScopeKey({ group_tag: scope.groupTag }, scope.alternateTags) : null
  return (
    rows.find(
      (r) =>
        r.id !== excludeId &&
        r.fixture.trim().toLowerCase() === needle &&
        (key == null || alternateScopeKey(r, scope!.alternateTags) === key),
    ) ?? null
  )
}

// ---- Alternates (v2.4188) --------------------------------------------------
// A bid's `alternate_group_tags` names the count-row groups the customer wants priced with
// and without. Membership is by group_tag, trimmed and case-insensitive; a row with no
// group, or a group not in the list, is the base bid.

export function normalizeGroupTag(tag: string | null | undefined): string {
  return (tag ?? '').trim().toLowerCase()
}

export function isAlternateRow(row: { group_tag: string | null }, alternateTags: readonly string[]): boolean {
  const key = normalizeGroupTag(row.group_tag)
  return key !== '' && alternateTags.some((t) => normalizeGroupTag(t) === key)
}

/** '' for a base row, else the alternate's normalized tag — the scope name-keyed matchers compare within. */
export function alternateScopeKey(row: { group_tag: string | null }, alternateTags: readonly string[]): string {
  return isAlternateRow(row, alternateTags) ? normalizeGroupTag(row.group_tag) : ''
}

/** Add or remove one tag (trimmed; case-insensitive match), keeping the others' spelling and order. */
export function toggleAlternateTag(tags: readonly string[], tag: string, on: boolean): string[] {
  const key = normalizeGroupTag(tag)
  const rest = tags.filter((t) => normalizeGroupTag(t) !== key)
  if (!key) return rest
  return on ? [...rest, tag.trim()] : rest
}

/** The import's alternate names joined onto the bid's list, without duplicates. */
export function mergeAlternateTags(tags: readonly string[], incoming: readonly string[]): string[] {
  let out = [...tags]
  for (const t of incoming) if (normalizeGroupTag(t) && !out.some((x) => normalizeGroupTag(x) === normalizeGroupTag(t))) out = [...out, t.trim()]
  return out
}

export type CountSheetGroupGroup<T extends CountSheetRow = CountSheetRow> = {
  /** The tag as first spelled on a row. */
  label: string
  rows: T[]
  byUnit: UnitTotals
  alternate: boolean
}

/**
 * Group rows by group_tag for the By group view: base groups first (alphabetical), then
 * the alternates (alphabetical), so the base bid reads as one block — the order every
 * CountTooling surface uses. Rows with no group come back apart (`noGroup`); the sheet
 * places them between the two.
 */
export function buildCountSheetGroupGroups<T extends CountSheetRow>(
  rows: T[],
  alternateTags: readonly string[],
): { groups: CountSheetGroupGroup<T>[]; noGroup: T[] } {
  const byKey = new Map<string, { label: string; rows: T[] }>()
  const noGroup: T[] = []
  for (const r of rows) {
    const key = normalizeGroupTag(r.group_tag)
    if (!key) {
      noGroup.push(r)
      continue
    }
    const g = byKey.get(key) ?? { label: (r.group_tag ?? '').trim(), rows: [] }
    g.rows.push(r)
    byKey.set(key, g)
  }
  const groups = [...byKey.entries()].map(([key, g]) => ({
    label: g.label,
    rows: g.rows,
    byUnit: sumByUnit(g.rows),
    alternate: alternateTags.some((t) => normalizeGroupTag(t) === key),
  }))
  groups.sort((a, b) => (a.alternate !== b.alternate ? (a.alternate ? 1 : -1) : a.label.localeCompare(b.label)))
  return { groups, noGroup }
}

export type CountSheetAlternateTotals = {
  /** Every row outside an alternate group — the bid without any alternate. */
  base: UnitTotals
  /** One entry per alternate group that holds a row, alphabetical. */
  alternates: { label: string; byUnit: UnitTotals }[]
}

/** The two numbers the customer asked for; null when no alternate group holds a row. */
export function countSheetAlternateTotals<T extends CountSheetRow>(
  rows: T[],
  alternateTags: readonly string[],
): CountSheetAlternateTotals | null {
  if (alternateTags.length === 0) return null
  const { groups, noGroup } = buildCountSheetGroupGroups(rows, alternateTags)
  const alternates = groups.filter((g) => g.alternate).map((g) => ({ label: g.label, byUnit: g.byUnit }))
  if (alternates.length === 0) return null
  const baseRows = [...noGroup, ...groups.filter((g) => !g.alternate).flatMap((g) => g.rows)]
  return { base: baseRows.length ? sumByUnit(baseRows) : emptyUnitTotals(), alternates }
}

/** "1 alternate: Break room (1 ea · 48.5 ft)" for the import toast; '' when none. */
export function summarizeAlternates<T extends CountSheetRow>(rows: T[], alternateTags: readonly string[]): string {
  const t = countSheetAlternateTotals(rows, alternateTags)
  if (!t) return ''
  const n = t.alternates.length
  return `${n} alternate${n === 1 ? '' : 's'}: ${t.alternates.map((a) => `${a.label} (${formatUnitTotals(a.byUnit)})`).join(', ')}`
}

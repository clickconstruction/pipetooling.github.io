/**
 * Count Sheet (the Counts tab's "New" view): pure helpers for the summary
 * strip, the by-plan-page audit grouping, and the duplicate-fixture guard.
 * `page` is the existing free-text plan-page field ("5, 26, 38", "A-101", …).
 */

export type CountSheetRow = {
  id: string
  fixture: string
  count: number
  group_tag: string | null
  page: string | null
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
  units: number
  noPageCount: number
  withGroupTag: number
}

export function countSheetSummary(rows: CountSheetRow[]): CountSheetSummary {
  return {
    items: rows.length,
    units: rows.reduce((s, r) => s + (Number.isFinite(r.count) ? r.count : 0), 0),
    noPageCount: rows.filter((r) => parsePlanPageTokens(r.page).length === 0).length,
    withGroupTag: rows.filter((r) => (r.group_tag ?? '').trim() !== '').length,
  }
}

export type CountSheetPageGroup<T extends CountSheetRow = CountSheetRow> = {
  label: string
  rows: T[]
  units: number
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
      return { label, rows: groupRows, units: groupRows.reduce((s, r) => s + r.count, 0) }
    }),
    noPage,
  }
}

/** Case-insensitive, trimmed match against existing fixtures — the fork-the-takeoff guard. */
export function findDuplicateFixture<T extends CountSheetRow>(rows: T[], name: string): T | null {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  return rows.find((r) => r.fixture.trim().toLowerCase() === needle) ?? null
}

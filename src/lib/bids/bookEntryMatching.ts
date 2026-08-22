/**
 * Exact-match pairing of count rows to price-book entries for the Workbench's
 * "Fill N matching from book" button (v2.2060). Deliberately conservative:
 * trimmed, case-insensitive EXACT name matches only, already-assigned rows are
 * skipped, and a name carried by more than one entry matches nothing (never
 * guess — the per-row search is for the ambiguous ones).
 */

export type BookEntryMatch = { countRowId: string; entryId: string }

export function matchCountRowsToBookEntries(
  rows: readonly { id: string; fixture: string | null; hasAssignment: boolean }[],
  entries: readonly { id: string; name: string | null }[],
): BookEntryMatch[] {
  const byName = new Map<string, { id: string; ambiguous: boolean }>()
  for (const e of entries) {
    const key = (e.name ?? '').trim().toLowerCase()
    if (!key) continue
    const existing = byName.get(key)
    if (existing) existing.ambiguous = true
    else byName.set(key, { id: e.id, ambiguous: false })
  }
  const out: BookEntryMatch[] = []
  for (const r of rows) {
    if (r.hasAssignment) continue
    const key = (r.fixture ?? '').trim().toLowerCase()
    if (!key) continue
    const hit = byName.get(key)
    if (hit && !hit.ambiguous) out.push({ countRowId: r.id, entryId: hit.id })
  }
  return out
}

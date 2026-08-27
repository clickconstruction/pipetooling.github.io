/**
 * Cross-version count-row pairing (v2.2405): since v2.2132 every bid VERSION
 * owns its own count rows, so anything keyed by `count_row_id` (custom prices,
 * pricing assignments, submission hides) is invisible under another version's
 * grid. Copying a price scenario between GC packets therefore needs a map from
 * the SOURCE version's rows to the TARGET version's rows — and the only shared
 * identity is the fixture name.
 *
 * Deliberately conservative, like matchCountRowsToBookEntries: trimmed,
 * case-insensitive EXACT name matches only, and a name carried by more than
 * one row on EITHER side matches nothing (two priced "WCO" rows collapsing
 * onto one target row would collide — never guess).
 */

export type CountRowRef = { id: string; fixture: string | null }

/** source row id → target row id, for names unique on both sides. */
export function mapCountRowsByFixture(
  source: readonly CountRowRef[],
  target: readonly CountRowRef[],
): Map<string, string> {
  const key = (f: string | null) => (f ?? '').trim().toLowerCase()
  const uniqueByName = (rows: readonly CountRowRef[]) => {
    const byName = new Map<string, { id: string; ambiguous: boolean }>()
    for (const r of rows) {
      const k = key(r.fixture)
      if (!k) continue
      const existing = byName.get(k)
      if (existing) existing.ambiguous = true
      else byName.set(k, { id: r.id, ambiguous: false })
    }
    return byName
  }
  const srcByName = uniqueByName(source)
  const tgtByName = uniqueByName(target)
  const out = new Map<string, string>()
  for (const [name, s] of srcByName) {
    if (s.ambiguous) continue
    const t = tgtByName.get(name)
    if (!t || t.ambiguous) continue
    out.set(s.id, t.id)
  }
  return out
}

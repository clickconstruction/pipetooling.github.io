import { fixtureKey, normalizeFixtureName } from './takeoffFixtureKey'

/**
 * Takeoff-book matching for Combined takeoffs (docs/TAKEOFFS_REFRESH_PLAN.md,
 * decisions 2 and 4). Replaces the exact-only, By-Stage-only loop inside
 * `applyTakeoffBookTemplates`: a count row matches an entry by its primary
 * name or any alias, first on the exact normalized name, then on the
 * plan-tag-stripped key. Entries are tried in sequence order; the first
 * match wins. Pure — the caller decides what "apply" means.
 */

export type BookEntryLike = { id: string; fixture_name: string; alias_names?: string[] | null; sequence_order?: number }
export type BookEntryItemLike = { entry_id: string; template_id: string; stage?: string | null; sequence_order?: number }

export type BookMatch = {
  countRowId: string
  entryId: string
  /** True when the row's exact normalized name matched (not just its stripped key). */
  exact: boolean
  /** Assemblies to apply, in the entry's item order, de-duplicated. */
  templateIds: string[]
}

/** Every name an entry answers to, normalized; `[exact-forms, keys]`. */
function entryNames(e: BookEntryLike): { exact: Set<string>; keys: Set<string> } {
  const raw = [e.fixture_name, ...(e.alias_names ?? [])]
  const exact = new Set<string>()
  const keys = new Set<string>()
  for (const r of raw) {
    const n = normalizeFixtureName(r)
    if (!n) continue
    exact.add(n)
    keys.add(fixtureKey(n))
  }
  return { exact, keys }
}

export function matchBookEntries(
  countRows: ReadonlyArray<{ id: string; fixture: string | null | undefined }>,
  entries: ReadonlyArray<BookEntryLike>,
  items: ReadonlyArray<BookEntryItemLike>,
): Map<string, BookMatch> {
  const ordered = [...entries].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
  const names = ordered.map((e) => ({ e, ...entryNames(e) }))
  const itemsByEntry = new Map<string, string[]>()
  for (const it of [...items].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))) {
    const list = itemsByEntry.get(it.entry_id) ?? []
    if (!list.includes(it.template_id)) list.push(it.template_id)
    itemsByEntry.set(it.entry_id, list)
  }
  const out = new Map<string, BookMatch>()
  for (const row of countRows) {
    const n = normalizeFixtureName(row.fixture)
    if (!n) continue
    const k = fixtureKey(n)
    let hit: { e: BookEntryLike; exact: boolean } | null = null
    for (const cand of names) {
      if (cand.exact.has(n)) { hit = { e: cand.e, exact: true }; break }
    }
    if (!hit) {
      for (const cand of names) {
        if (cand.keys.has(k)) { hit = { e: cand.e, exact: false }; break }
      }
    }
    if (!hit) continue
    const templateIds = itemsByEntry.get(hit.e.id) ?? []
    if (templateIds.length === 0) continue
    out.set(row.id, { countRowId: row.id, entryId: hit.e.id, exact: hit.exact, templateIds })
  }
  return out
}

/** The matches worth offering: rows with no lines yet. Order follows `countRows`. */
export function fillableBookMatches(
  countRows: ReadonlyArray<{ id: string }>,
  matches: ReadonlyMap<string, BookMatch>,
  uncostedIds: ReadonlyArray<string>,
): BookMatch[] {
  const uncosted = new Set(uncostedIds)
  const out: BookMatch[] = []
  for (const r of countRows) {
    const m = matches.get(r.id)
    if (m && uncosted.has(r.id)) out.push(m)
  }
  return out
}

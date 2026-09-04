import { fixtureKey, normalizeFixtureName } from './takeoffFixtureKey'

/**
 * "Remember for the book" (docs/TAKEOFFS_REFRESH_PLAN.md, decision 3):
 * finishing a fixture can teach the takeoff book. The book keeps its schema
 * (entries name assemblies), so remembering = an assembly holding the
 * fixture's part lines + a book entry (or alias) pointing at it. This kernel
 * only PLANS the writes; the hook performs them through the existing
 * Save-as-Assembly and book-entry paths. Book writes are additive: an
 * existing `<key> · book` assembly is never edited in place — a numbered
 * sibling is created and the entry's items append.
 */

export const BOOK_ASSEMBLY_SUFFIX = ' · book'

export type LearnLine = { partId: string | null; quantity: number; sourceTemplateId: string | null }

export type RememberPlan =
  | { kind: 'nothing'; reason: 'no-fixture' | 'no-lines' }
  | {
      kind: 'remember'
      key: string
      /** Bundle lines remember as their own template; part lines become a new assembly. */
      templateIdsToLink: string[]
      newAssembly: { name: string; items: Array<{ part_id: string; quantity: number }> } | null
      entry: { action: 'create'; fixtureName: string } | { action: 'alias'; entryId: string; alias: string } | { action: 'none'; entryId: string }
    }

/** `<key> · book`, or `<key> · book 2`, `… 3` when those names are taken (case-insensitive). */
export function nextBookAssemblyName(key: string, existingAssemblyNames: ReadonlyArray<string>): string {
  const taken = new Set(existingAssemblyNames.map((n) => normalizeFixtureName(n)))
  const base = `${key}${BOOK_ASSEMBLY_SUFFIX}`
  if (!taken.has(normalizeFixtureName(base))) return base
  for (let i = 2; ; i++) {
    const cand = `${base} ${i}`
    if (!taken.has(normalizeFixtureName(cand))) return cand
  }
}

export function planRememberForBook(input: {
  fixture: string | null | undefined
  lines: ReadonlyArray<LearnLine>
  existingEntries: ReadonlyArray<{ id: string; fixture_name: string; alias_names?: string[] | null }>
  existingAssemblyNames: ReadonlyArray<string>
}): RememberPlan {
  const key = fixtureKey(input.fixture)
  const exactName = normalizeFixtureName(input.fixture)
  if (!key) return { kind: 'nothing', reason: 'no-fixture' }
  const parts = new Map<string, number>()
  const bundles: string[] = []
  for (const l of input.lines) {
    if (l.partId) parts.set(l.partId, (parts.get(l.partId) ?? 0) + Number(l.quantity))
    else if (l.sourceTemplateId && !bundles.includes(l.sourceTemplateId)) bundles.push(l.sourceTemplateId)
  }
  if (parts.size === 0 && bundles.length === 0) return { kind: 'nothing', reason: 'no-lines' }

  const newAssembly =
    parts.size === 0
      ? null
      : {
          name: nextBookAssemblyName(key, input.existingAssemblyNames),
          items: [...parts].map(([part_id, quantity]) => ({ part_id, quantity })),
        }

  // The entry that already answers to this fixture: exact name first, then key.
  let entryId: string | null = null
  let entryExact = false
  for (const e of input.existingEntries) {
    const names = [e.fixture_name, ...(e.alias_names ?? [])].map((n) => normalizeFixtureName(n))
    if (names.includes(exactName)) { entryId = e.id; entryExact = true; break }
  }
  if (!entryId) {
    for (const e of input.existingEntries) {
      const keys = [e.fixture_name, ...(e.alias_names ?? [])].map((n) => fixtureKey(n))
      if (keys.includes(key)) { entryId = e.id; break }
    }
  }
  const entry: Extract<RememberPlan, { kind: 'remember' }>['entry'] =
    entryId == null
      ? { action: 'create', fixtureName: key }
      : entryExact
        ? { action: 'none', entryId }
        : { action: 'alias', entryId, alias: exactName }

  return { kind: 'remember', key, templateIdsToLink: bundles, newAssembly, entry }
}

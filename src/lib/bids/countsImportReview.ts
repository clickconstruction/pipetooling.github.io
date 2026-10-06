/**
 * Import review (v2.4699): what "Import from /Tooling" shows when the bid already has count
 * rows. Until now the import appended every pasted line, so a re-copy from CountTooling after a
 * small change doubled the sheet (the SpaceX re-import behind punch list #73). This kernel pairs
 * the pasted rows with the rows on the bid and sorts them into piles the person approves:
 *
 *   changed  — same name and group, a different count or page → Update (keeps every part,
 *              price and submittal row keyed on the count row's id)
 *   added    — in the copy, not on the bid → Add
 *   missing  — on the bid, not in the copy → Remove or Keep
 *   same     — identical → nothing to do, folded away
 *   pairs    — a missing row and an added row that are almost surely one row renamed or moved
 *              between groups in CountTooling (same count, and either the name or the group
 *              held) → offered as "Same row", which becomes an Update instead of a delete and
 *              an insert; never automatic.
 *
 * Pairing is by exact name AND group (trimmed, case-insensitive), the identity CountTooling
 * exports (`[Restroom A] WC`). A name with no exact pair falls back to a name-only pair when it
 * is unique on both sides within the same alternate scope (`alternateScopeKey`), which carries a
 * row whose group changed and the rows imported before v2.4188 lifted groups at all. A key
 * carried by more than one row on either side pairs with nothing, like `mapCountRowsByFixture`.
 * No fuzzy matching: the labor and price books match by exact name, so a guessed pair would
 * quietly re-key a priced row.
 */

import { alternateScopeKey, mergeAlternateTags, normalizeGroupTag, type CountSheetRow } from './countSheet'
import type { CountsImportScope, ParsedCountImportRow } from './parseCountsImportText'

export type ReviewChange = {
  existing: CountSheetRow
  incoming: ParsedCountImportRow
  countChanged: boolean
  pageChanged: boolean
  groupChanged: boolean
}

/** A proposal: `missing` left and `incoming` arrived, and they look like one row. */
export type ReviewPair = {
  missing: CountSheetRow
  incoming: ParsedCountImportRow
  kind: 'renamed' | 'moved'
}

export type CountsImportReview = {
  changed: ReviewChange[]
  added: ParsedCountImportRow[]
  missing: CountSheetRow[]
  same: Array<{ existing: CountSheetRow; incoming: ParsedCountImportRow }>
  pairs: ReviewPair[]
  /** Pasted rows whose name + group is carried more than once (in the paste, or on the bid). */
  ambiguousAdded: Set<ParsedCountImportRow>
  ambiguousMissing: Set<string>
  scope: CountsImportScope
  /** Remove on a copy of every sheet (a row CountTooling no longer has was deleted on purpose); Keep otherwise. */
  missingDefault: 'remove' | 'keep'
}

export type CountsImportChoices = {
  /** Existing row ids from `changed` to update. */
  update: Set<string>
  /** Indexes into `added` to insert. */
  add: Set<number>
  /** Existing row ids from `missing` to delete. */
  remove: Set<string>
  /** Indexes into `pairs` accepted as the same row. */
  pair: Set<number>
}

export type CountRowPatch = { fixture?: string; count?: number; group_tag?: string | null; page?: string | null }

export type CountsImportWritePlan = {
  updates: Array<{ id: string; before: CountRowPatch; patch: CountRowPatch }>
  inserts: ParsedCountImportRow[]
  deletes: CountSheetRow[]
}

const SEP = '\u0001'
const normName = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
const normPage = (s: string | null | undefined) => (s ?? '').trim()
const fullKey = (r: { fixture: string | null; group_tag: string | null }) => normName(r.fixture) + SEP + normalizeGroupTag(r.group_tag)

function countsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

/** The sorted piles for a paste onto a bid that already has rows. */
export function reviewCountsImport(args: {
  incoming: readonly ParsedCountImportRow[]
  existing: readonly CountSheetRow[]
  /** The bid's alternate tags; the paste's own alternate groups are merged in for scope. */
  alternateTags: readonly string[]
  importAlternateGroups?: readonly string[]
  scope: CountsImportScope
}): CountsImportReview {
  const tags = mergeAlternateTags(args.alternateTags, args.importAlternateGroups ?? [])
  const scopeOf = (r: { group_tag: string | null }) => alternateScopeKey(r, tags)

  // Tier 1: exact name + group.
  const byKeyExisting = groupBy(args.existing, fullKey)
  const byKeyIncoming = groupBy(args.incoming, fullKey)

  const changed: ReviewChange[] = []
  const same: CountsImportReview['same'] = []
  const ambiguousAdded = new Set<ParsedCountImportRow>()
  const ambiguousMissing = new Set<string>()
  const leftoverExisting: CountSheetRow[] = []
  const leftoverIncoming: ParsedCountImportRow[] = []

  for (const inc of args.incoming) {
    const k = fullKey(inc)
    const incs = byKeyIncoming.get(k) ?? []
    const exs = byKeyExisting.get(k) ?? []
    if (incs.length > 1 || exs.length > 1) {
      ambiguousAdded.add(inc)
      leftoverIncoming.push(inc)
      continue
    }
    const ex = exs[0]
    if (!ex) {
      leftoverIncoming.push(inc)
      continue
    }
    pushPaired(ex, inc, false)
  }
  for (const ex of args.existing) {
    const k = fullKey(ex)
    const exs = byKeyExisting.get(k) ?? []
    const incs = byKeyIncoming.get(k) ?? []
    if (exs.length > 1 || incs.length > 1) {
      ambiguousMissing.add(ex.id)
      leftoverExisting.push(ex)
      continue
    }
    if (incs.length === 0) leftoverExisting.push(ex)
  }

  // Tier 2: name only, unique on both sides within the same alternate scope.
  const nameKey = (r: { fixture: string | null; group_tag: string | null }) => normName(r.fixture) + SEP + scopeOf(r)
  const byNameExisting = groupBy(leftoverExisting.filter((r) => !ambiguousMissing.has(r.id)), nameKey)
  const byNameIncoming = groupBy(leftoverIncoming.filter((r) => !ambiguousAdded.has(r)), nameKey)
  const pairedExisting = new Set<string>()
  const pairedIncoming = new Set<ParsedCountImportRow>()
  for (const [k, incs] of byNameIncoming) {
    const exs = byNameExisting.get(k) ?? []
    if (incs.length !== 1 || exs.length !== 1) continue
    const ex = exs[0]!
    const inc = incs[0]!
    pushPaired(ex, inc, true)
    pairedExisting.add(ex.id)
    pairedIncoming.add(inc)
  }

  const missing = leftoverExisting.filter((r) => !pairedExisting.has(r.id))
  const added = leftoverIncoming.filter((r) => !pairedIncoming.has(r))

  // Tier 3: proposals. Same count, and the name OR the group held (not both — that was tier 1/2).
  const pairs: ReviewPair[] = []
  const usedMissing = new Set<string>()
  const usedAdded = new Set<ParsedCountImportRow>()
  for (const m of missing) {
    if (ambiguousMissing.has(m.id)) continue
    const candidates = added.filter((a) => {
      if (usedAdded.has(a) || ambiguousAdded.has(a)) return false
      if (!countsEqual(a.count, m.count)) return false
      if (scopeOf(a) !== scopeOf(m)) return false
      const sameName = normName(a.fixture) === normName(m.fixture)
      const sameGroup = normalizeGroupTag(a.group_tag) === normalizeGroupTag(m.group_tag)
      return sameName !== sameGroup
    })
    if (candidates.length !== 1) continue
    const a = candidates[0]!
    usedMissing.add(m.id)
    usedAdded.add(a)
    pairs.push({ missing: m, incoming: a, kind: normName(a.fixture) === normName(m.fixture) ? 'moved' : 'renamed' })
  }

  return {
    changed,
    added,
    missing,
    same,
    pairs,
    ambiguousAdded,
    ambiguousMissing,
    scope: args.scope,
    missingDefault: args.scope === 'all' ? 'remove' : 'keep',
  }

  function pushPaired(ex: CountSheetRow, inc: ParsedCountImportRow, groupChanged: boolean) {
    const countChanged = !countsEqual(ex.count, inc.count)
    const pageChanged = normPage(ex.page) !== normPage(inc.page)
    if (!countChanged && !pageChanged && !groupChanged) same.push({ existing: ex, incoming: inc })
    else changed.push({ existing: ex, incoming: inc, countChanged, pageChanged, groupChanged })
  }
}

function groupBy<T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = out.get(k)
    if (list) list.push(r)
    else out.set(k, [r])
  }
  return out
}

/** True when the paste matches the bid row for row and there is nothing to approve. */
export function countsImportReviewIsEmpty(r: CountsImportReview): boolean {
  return r.changed.length === 0 && r.added.length === 0 && r.missing.length === 0
}

/** Update all, add all, remove all only on a copy of every sheet, no pair accepted until the person says so. */
export function defaultCountsImportChoices(r: CountsImportReview): CountsImportChoices {
  return {
    update: new Set(r.changed.map((c) => c.existing.id)),
    add: new Set(r.added.map((_, i) => i)),
    remove: new Set(r.missingDefault === 'remove' ? r.missing.map((m) => m.id) : []),
    pair: new Set(),
  }
}

function patchFor(existing: CountSheetRow, incoming: ParsedCountImportRow): { before: CountRowPatch; patch: CountRowPatch } {
  const before: CountRowPatch = {}
  const patch: CountRowPatch = {}
  if (existing.fixture !== incoming.fixture) {
    before.fixture = existing.fixture
    patch.fixture = incoming.fixture
  }
  if (!countsEqual(existing.count, incoming.count)) {
    before.count = existing.count
    patch.count = incoming.count
  }
  if ((existing.group_tag ?? null) !== (incoming.group_tag ?? null)) {
    before.group_tag = existing.group_tag ?? null
    patch.group_tag = incoming.group_tag ?? null
  }
  if (normPage(existing.page) !== normPage(incoming.page)) {
    before.page = existing.page ?? null
    patch.page = incoming.page ?? null
  }
  return { before, patch }
}

/**
 * The writes the choices come to. An accepted pair is one update on the missing row (its name,
 * group, count and page from the incoming row) and takes both rows out of the delete and insert
 * lists, whatever their own ticks say.
 */
export function buildCountsImportWritePlan(review: CountsImportReview, choices: CountsImportChoices): CountsImportWritePlan {
  const updates: CountsImportWritePlan['updates'] = []
  const pairedMissing = new Set<string>()
  const pairedAdded = new Set<ParsedCountImportRow>()
  review.pairs.forEach((p, i) => {
    if (!choices.pair.has(i)) return
    pairedMissing.add(p.missing.id)
    pairedAdded.add(p.incoming)
    const { before, patch } = patchFor(p.missing, p.incoming)
    if (Object.keys(patch).length > 0) updates.push({ id: p.missing.id, before, patch })
  })
  for (const c of review.changed) {
    if (!choices.update.has(c.existing.id)) continue
    const { before, patch } = patchFor(c.existing, c.incoming)
    if (Object.keys(patch).length > 0) updates.push({ id: c.existing.id, before, patch })
  }
  const inserts = review.added.filter((row, i) => choices.add.has(i) && !pairedAdded.has(row))
  const deletes = review.missing.filter((row) => choices.remove.has(row.id) && !pairedMissing.has(row.id))
  return { updates, inserts, deletes }
}

export function countsImportWritePlanIsEmpty(p: CountsImportWritePlan): boolean {
  return p.updates.length === 0 && p.inserts.length === 0 && p.deletes.length === 0
}

/** "Will update 5, add 2, remove 2. 25 unchanged." */
export function describeCountsImportWritePlan(p: CountsImportWritePlan, unchanged: number): string {
  const parts: string[] = []
  if (p.updates.length) parts.push(`update ${p.updates.length}`)
  if (p.inserts.length) parts.push(`add ${p.inserts.length}`)
  if (p.deletes.length) parts.push(`remove ${p.deletes.length}`)
  const head = parts.length ? `Will ${parts.join(', ')}.` : 'Nothing to change.'
  return unchanged > 0 ? `${head} ${unchanged} unchanged.` : head
}

/** The toast after Apply: "Updated 5, added 2, removed 2 · 25 unchanged". */
export function describeCountsImportApplied(p: CountsImportWritePlan, unchanged: number): string {
  const parts: string[] = []
  if (p.updates.length) parts.push(`${parts.length ? 'updated' : 'Updated'} ${p.updates.length}`)
  if (p.inserts.length) parts.push(`${parts.length ? 'added' : 'Added'} ${p.inserts.length}`)
  if (p.deletes.length) parts.push(`${parts.length ? 'removed' : 'Removed'} ${p.deletes.length}`)
  const head = parts.join(', ')
  return unchanged > 0 ? `${head} · ${unchanged} unchanged` : head
}

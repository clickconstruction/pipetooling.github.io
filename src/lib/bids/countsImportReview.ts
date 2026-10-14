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

import { alternateScopeKey, mergeAlternateTags, normalizeGroupTag, parsePlanPageTokens, type CountSheetRow } from './countSheet'
import { parseSourceShares, roundCount, shareOf, sharesForNewRow, sharesOrNull, withShare, type CountSourceShares, type CountsImportMode } from './countSources'
import type { CountsImportScope, ParsedCountImportRow } from './parseCountsImportText'

/**
 * v2.5517 (combine two CountTooling counts): the review runs in one of three modes (`countSources.ts` decides):
 *   replace — today's piles;
 *   combine — a second project's copy: every pair is "Both counted" (the counts add, the pages join), nothing is
 *             removed (the other counter's rows are `untouched`), no rename proposals;
 *   recopy  — a new copy of a project already on the bid: a pair moves that project's share of the row and keeps the
 *             others' part; a missing row leaves only its share when others hold the rest (`partialMissing`), or goes
 *             whole when it was that project's alone; rows with no share of that project are `untouched`.
 * Each written row carries its shares (`source_shares`); the arriving project's key is the sentinel until Apply.
 */
export type ReviewChange = {
  existing: CountSheetRow
  incoming: ParsedCountImportRow
  countChanged: boolean
  pageChanged: boolean
  groupChanged: boolean
  /** Combine: the sum the row becomes and the pages joined. */
  combine?: { before: number; add: number; after: number; page: string | null; pageJoined: boolean }
  /** Recopy: this project's share before and after, and what the other projects keep. */
  recopy?: { shareBefore: number; shareAfter: number; othersKeep: number }
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
  /** v2.5517: the mode the review ran in. */
  mode: CountsImportMode
  /** v2.5517: the arriving project's share key (a source id on a recopy, the sentinel otherwise); null = no shares written (a hand paste). */
  incomingKey: string | null
  /** v2.5517: rows on the bid the copy does not touch — another project's (combine), or with no share of this project (recopy). */
  untouched: CountSheetRow[]
  /** v2.5517 recopy: a missing row that other projects also hold — Remove takes this project's share out and leaves the rest. */
  partialMissing: Map<string, { share: number; othersKeep: number }>
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
  /** v2.5517 combine: the ids among `update` that Replace instead of Add to it. */
  replaceInstead?: Set<string>
}

export type CountRowPatch = { fixture?: string; count?: number; group_tag?: string | null; page?: string | null; source_shares?: CountSourceShares | null }

/** v2.5517: an inserted row carries the arriving project's share. */
export type CountsImportInsert = ParsedCountImportRow & { source_shares: CountSourceShares | null }

export type CountsImportWritePlan = {
  updates: Array<{ id: string; before: CountRowPatch; patch: CountRowPatch }>
  inserts: CountsImportInsert[]
  deletes: CountSheetRow[]
  /** v2.5517 combine: how many updates add to the row and how many replace it. */
  combined: number
  replaced: number
}

const SEP = '\u0001'
const normName = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
const normPage = (s: string | null | undefined) => (s ?? '').trim()
const fullKey = (r: { fixture: string | null; group_tag: string | null }) => normName(r.fixture) + SEP + normalizeGroupTag(r.group_tag)

function countsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

/** The pages of two rows joined, the bid's first: "10, 11, 12" + "12" → "10, 11, 12"; "10" + "12" → "10, 12". */
export function joinPlanPages(a: string | null | undefined, b: string | null | undefined): string | null {
  const tokens = parsePlanPageTokens(a)
  const seen = new Set(tokens.map((t) => t.toLowerCase()))
  for (const t of parsePlanPageTokens(b)) {
    if (seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    tokens.push(t)
  }
  return tokens.length ? tokens.join(', ') : null
}

const sharesOfRow = (r: CountSheetRow): CountSourceShares => parseSourceShares(r.source_shares)

/** The sorted piles for a paste onto a bid that already has rows. */
export function reviewCountsImport(args: {
  incoming: readonly ParsedCountImportRow[]
  existing: readonly CountSheetRow[]
  /** The bid's alternate tags; the paste's own alternate groups are merged in for scope. */
  alternateTags: readonly string[]
  importAlternateGroups?: readonly string[]
  scope: CountsImportScope
  /** v2.5517: the mode (`decideCountsImportMode`); replace when absent. */
  mode?: CountsImportMode
  /** v2.5517: the arriving project's share key; absent on a hand paste, and then no shares are written. */
  incomingKey?: string | null
}): CountsImportReview {
  const tags = mergeAlternateTags(args.alternateTags, args.importAlternateGroups ?? [])
  const scopeOf = (r: { group_tag: string | null }) => alternateScopeKey(r, tags)
  const mode: CountsImportMode = args.mode ?? 'replace'
  const incomingKey = args.incomingKey ?? null

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

  const unpaired = leftoverExisting.filter((r) => !pairedExisting.has(r.id))
  const added = leftoverIncoming.filter((r) => !pairedIncoming.has(r))

  // v2.5517: what an unpaired bid row is depends on the mode — combine never removes (the other counter's rows stay);
  // a recopy removes only a row that carries this project's share, and leaves the others' part of a shared one.
  const untouched: CountSheetRow[] = []
  const missing: CountSheetRow[] = []
  const partialMissing = new Map<string, { share: number; othersKeep: number }>()
  for (const r of unpaired) {
    if (mode === 'combine') {
      untouched.push(r)
      continue
    }
    if (mode === 'recopy') {
      const share = incomingKey ? shareOf(sharesOfRow(r), incomingKey) : 0
      if (share <= 0) {
        untouched.push(r)
        continue
      }
      const othersKeep = roundCount(r.count - share)
      if (othersKeep > 0) partialMissing.set(r.id, { share, othersKeep })
    }
    missing.push(r)
  }

  // Tier 3: proposals. Same count, and the name OR the group held (not both — that was tier 1/2). Never on a combine:
  // two counters' rows are not one row renamed.
  const pairs: ReviewPair[] = []
  const usedMissing = new Set<string>()
  const usedAdded = new Set<ParsedCountImportRow>()
  for (const m of mode === 'combine' ? [] : missing) {
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
    missingDefault: mode === 'combine' ? 'keep' : args.scope === 'all' ? 'remove' : 'keep',
    mode,
    incomingKey,
    untouched,
    partialMissing,
  }

  function pushPaired(ex: CountSheetRow, inc: ParsedCountImportRow, groupChanged: boolean) {
    const pageChanged = normPage(ex.page) !== normPage(inc.page)
    if (mode === 'combine') {
      // Both counted: the copy adds to the row, the pages join; the bid's group stays.
      const after = roundCount(ex.count + inc.count)
      const page = joinPlanPages(ex.page, inc.page)
      const pageJoined = normPage(page) !== normPage(ex.page)
      changed.push({ existing: ex, incoming: inc, countChanged: inc.count > 0, pageChanged: pageJoined, groupChanged: false, combine: { before: ex.count, add: inc.count, after, page, pageJoined } })
      return
    }
    if (mode === 'recopy' && incomingKey) {
      // This project's share moves; the other projects' part of the row stays, and so do their pages (the copy's join in).
      const shareBefore = shareOf(sharesOfRow(ex), incomingKey)
      const othersKeep = roundCount(ex.count - shareBefore)
      const after = roundCount(othersKeep + inc.count)
      const countChanged = !countsEqual(after, ex.count)
      const sharedPageChanged = othersKeep > 0 ? normPage(joinPlanPages(ex.page, inc.page)) !== normPage(ex.page) : pageChanged
      if (!countChanged && !sharedPageChanged && !groupChanged) same.push({ existing: ex, incoming: inc })
      else changed.push({ existing: ex, incoming: inc, countChanged, pageChanged: sharedPageChanged, groupChanged, recopy: { shareBefore, shareAfter: inc.count, othersKeep } })
      return
    }
    const countChanged = !countsEqual(ex.count, inc.count)
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

/** Update all (Add to it on a combine), add all, remove all only on a copy of every sheet, no pair accepted until the person says so. */
export function defaultCountsImportChoices(r: CountsImportReview): CountsImportChoices {
  return {
    update: new Set(r.changed.map((c) => c.existing.id)),
    add: new Set(r.added.map((_, i) => i)),
    remove: new Set(r.missingDefault === 'remove' ? r.missing.map((m) => m.id) : []),
    pair: new Set(),
    replaceInstead: new Set(),
  }
}

/** The shares patch when they differ, as before/after; nothing when a hand paste wrote no key. */
function sharesPatch(existing: CountSheetRow, next: CountSourceShares | null, before: CountRowPatch, patch: CountRowPatch): void {
  const prev = sharesOrNull(sharesOfRow(existing))
  if (JSON.stringify(prev) === JSON.stringify(next)) return
  before.source_shares = prev
  patch.source_shares = next
}

/** The whole row becomes the incoming row's (replace, and Replace inside a combine), claimed by the arriving project. */
function patchFor(existing: CountSheetRow, incoming: ParsedCountImportRow, incomingKey: string | null): { before: CountRowPatch; patch: CountRowPatch } {
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
  if (incomingKey) sharesPatch(existing, sharesForNewRow(incoming, incomingKey), before, patch)
  return { before, patch }
}

/** Combine, Add to it: the sum, the joined pages, the arriving project's share beside the others'. */
function combinePatchFor(c: ReviewChange, incomingKey: string | null): { before: CountRowPatch; patch: CountRowPatch } {
  const before: CountRowPatch = {}
  const patch: CountRowPatch = {}
  const k = c.combine
  if (!k) return patchFor(c.existing, c.incoming, incomingKey)
  if (!countsEqual(k.after, c.existing.count)) {
    before.count = c.existing.count
    patch.count = k.after
  }
  if (k.pageJoined) {
    before.page = c.existing.page ?? null
    patch.page = k.page
  }
  if (incomingKey) sharesPatch(c.existing, sharesOrNull(withShare(sharesOfRow(c.existing), incomingKey, c.incoming.count)), before, patch)
  return { before, patch }
}

/** Recopy: this project's share moves to the copy's count; the name, group and page follow the copy as before. */
function recopyPatchFor(c: ReviewChange, incomingKey: string | null): { before: CountRowPatch; patch: CountRowPatch } {
  const k = c.recopy
  if (!k || !incomingKey) return patchFor(c.existing, c.incoming, incomingKey)
  const before: CountRowPatch = {}
  const patch: CountRowPatch = {}
  const after = roundCount(k.othersKeep + c.incoming.count)
  if (c.existing.fixture !== c.incoming.fixture) {
    before.fixture = c.existing.fixture
    patch.fixture = c.incoming.fixture
  }
  if (!countsEqual(c.existing.count, after)) {
    before.count = c.existing.count
    patch.count = after
  }
  if ((c.existing.group_tag ?? null) !== (c.incoming.group_tag ?? null)) {
    before.group_tag = c.existing.group_tag ?? null
    patch.group_tag = c.incoming.group_tag ?? null
  }
  // A row this project holds alone follows the copy's page; a shared row keeps the others' pages and joins the copy's in.
  const page = k.othersKeep > 0 ? joinPlanPages(c.existing.page, c.incoming.page) : (c.incoming.page ?? null)
  if (normPage(c.existing.page) !== normPage(page)) {
    before.page = c.existing.page ?? null
    patch.page = page
  }
  sharesPatch(c.existing, sharesOrNull(withShare(sharesOfRow(c.existing), incomingKey, c.incoming.count)), before, patch)
  return { before, patch }
}

/**
 * The writes the choices come to. An accepted pair is one update on the missing row (its name,
 * group, count and page from the incoming row) and takes both rows out of the delete and insert
 * lists, whatever their own ticks say.
 */
export function buildCountsImportWritePlan(review: CountsImportReview, choices: CountsImportChoices): CountsImportWritePlan {
  const updates: CountsImportWritePlan['updates'] = []
  const key = review.incomingKey
  const pairedMissing = new Set<string>()
  const pairedAdded = new Set<ParsedCountImportRow>()
  let combined = 0
  let replaced = 0
  review.pairs.forEach((p, i) => {
    if (!choices.pair.has(i)) return
    pairedMissing.add(p.missing.id)
    pairedAdded.add(p.incoming)
    const { before, patch } = patchFor(p.missing, p.incoming, key)
    if (Object.keys(patch).length > 0) updates.push({ id: p.missing.id, before, patch })
  })
  for (const c of review.changed) {
    if (!choices.update.has(c.existing.id)) continue
    const replace = review.mode === 'combine' && !!choices.replaceInstead?.has(c.existing.id)
    const { before, patch } =
      review.mode === 'combine' ? (replace ? patchFor(c.existing, c.incoming, key) : combinePatchFor(c, key)) : review.mode === 'recopy' ? recopyPatchFor(c, key) : patchFor(c.existing, c.incoming, key)
    if (review.mode === 'combine') {
      if (replace) replaced += 1
      else combined += 1
    }
    if (Object.keys(patch).length > 0) updates.push({ id: c.existing.id, before, patch })
  }
  const inserts: CountsImportInsert[] = review.added
    .filter((row, i) => choices.add.has(i) && !pairedAdded.has(row))
    .map((row) => ({ ...row, source_shares: key ? sharesForNewRow(row, key) : null }))
  const deletes: CountSheetRow[] = []
  for (const row of review.missing) {
    if (!choices.remove.has(row.id) || pairedMissing.has(row.id)) continue
    const partial = review.partialMissing.get(row.id)
    if (partial && key) {
      // Recopy: the other projects hold the rest of the row — only this project's share leaves.
      const before: CountRowPatch = { count: row.count }
      const patch: CountRowPatch = { count: partial.othersKeep }
      sharesPatch(row, sharesOrNull(withShare(sharesOfRow(row), key, 0)), before, patch)
      updates.push({ id: row.id, before, patch })
      continue
    }
    deletes.push(row)
  }
  return { updates, inserts, deletes, combined, replaced }
}

export function countsImportWritePlanIsEmpty(p: CountsImportWritePlan): boolean {
  return p.updates.length === 0 && p.inserts.length === 0 && p.deletes.length === 0
}

/** The tail of the summary and the toast: what the copy left alone. */
function restWords(unchanged: number, untouched: number, joiner: string): string {
  const bits: string[] = []
  if (unchanged > 0) bits.push(`${unchanged} unchanged`)
  if (untouched > 0) bits.push(`${untouched} untouched`)
  return bits.length ? `${joiner}${bits.join(' · ')}` : ''
}

/** "Will update 5, add 2, remove 2. 25 unchanged." — on a combine "Will add to 6, replace 1, add 4. 30 untouched." */
export function describeCountsImportWritePlan(p: CountsImportWritePlan, unchanged: number, untouched = 0): string {
  const parts: string[] = []
  if (p.combined > 0) parts.push(`add to ${p.combined}`)
  if (p.replaced > 0) parts.push(`replace ${p.replaced}`)
  const plainUpdates = p.updates.length - (p.combined + p.replaced > 0 ? p.updates.filter((u) => u.patch.count != null || u.patch.page != null || u.patch.source_shares !== undefined).length : 0)
  if (p.combined + p.replaced === 0 && p.updates.length) parts.push(`update ${p.updates.length}`)
  else if (plainUpdates > 0) parts.push(`update ${plainUpdates}`)
  if (p.inserts.length) parts.push(`add ${p.inserts.length}`)
  if (p.deletes.length) parts.push(`remove ${p.deletes.length}`)
  const head = parts.length ? `Will ${parts.join(', ')}.` : 'Nothing to change.'
  const rest = restWords(unchanged, untouched, ' ')
  return rest ? `${head}${rest}.` : head
}

/** The toast after Apply: "Updated 5, added 2, removed 2 · 25 unchanged" — on a combine "Added to 6, added 4 · 30 untouched". */
export function describeCountsImportApplied(p: CountsImportWritePlan, unchanged: number, untouched = 0): string {
  const parts: string[] = []
  const word = (w: string) => (parts.length ? w : w.charAt(0).toUpperCase() + w.slice(1))
  if (p.combined > 0) parts.push(`${word('added to')} ${p.combined}`)
  if (p.replaced > 0) parts.push(`${word('replaced')} ${p.replaced}`)
  if (p.combined + p.replaced === 0 && p.updates.length) parts.push(`${word('updated')} ${p.updates.length}`)
  if (p.inserts.length) parts.push(`${word('added')} ${p.inserts.length}`)
  if (p.deletes.length) parts.push(`${word('removed')} ${p.deletes.length}`)
  const head = parts.join(', ')
  return `${head}${restWords(unchanged, untouched, ' · ')}`
}

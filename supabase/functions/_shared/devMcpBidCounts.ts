// A bid's count rows from the dev seat (v2.6967 — the bid train's PR 2, to-dos/mcp-servers.md → The bid train).
// The owner, 2026-11-11: "fill out all of the line items for counts, takeoffs, labor, pricing." plan_bid_counts →
// apply_bid_counts writes the rows the Counts tab writes (src/components/bids/BidsCountsTab.tsx): a row added as the
// Count Sheet's quick add adds it (insertCountRows: the active version, after the bid's last row, the unit pinned),
// a row changed as the sheet's inline edit changes it (count, unit, page, group), a row removed as its delete removes
// it, and an alternate group joined to bids.alternate_group_tags as the import joins it. All as rows under RLS as the
// dev: no RPC exists for a count row and none is owed.
//
// The stable key is the sheet's own rule, not a database key (bids_count_rows has none): ONE ROW A FIXTURE IN A
// SCOPE, where a scope is the base bid or one alternate group (findDuplicateFixture, v2.4188) — "a duplicate forks
// the takeoff assignment", and the labor rows are keyed by the fixture's name. So a fixture named twice in the base
// bid is held, as quick add refuses it, and an area is a label on the row (group), not a second row.
//
// The shaping of a row off the wire — the `[Group] ` prefix lifted off the name, the lengths, the units, a count
// above zero — is the app's own (parseCountsImportText COUNT_GROUP_PREFIX_RE, countRowUnit COUNT_UNITS,
// classifyCountRowUnit), read from the kernel copy. twin-mcp's paste_counts carries the same rule inline;
// devMcpBidCounts.test.ts holds its regex and unit list to these, so the two seats shape a count row one way.
// Pure: no env reads, no network; the reads come in through one small interface (src/lib/devMcp/devMcpBidCounts.test.ts).

import { COUNT_UNIT_LABEL, classifyCountRowUnit, isCountUnit, summarizeRowsByUnit, type CountUnit } from './gcKernels/lib/bids/countRowUnit.ts'
import { alternateScopeKey, mergeAlternateTags, normalizeGroupTag, summarizeAlternates } from './gcKernels/lib/bids/countSheet.ts'
import { COUNT_GROUP_PREFIX_RE } from './gcKernels/lib/bids/parseCountsImportText.ts'
import { pickActiveVersion } from './gcKernels/lib/bids/pickActiveVersion.ts'

export const BID_COUNTS_VERBS = ['plan_bid_counts', 'apply_bid_counts'] as const
export type BidCountsVerb = (typeof BID_COUNTS_VERBS)[number]

export function isBidCountsVerb(name: string): name is BidCountsVerb {
  return (BID_COUNTS_VERBS as readonly string[]).includes(name)
}

/** The history tag every count row insert of the Counts tab carries (src/lib/bids/bidActionHeader.ts BID_ACTIONS.countsImport). */
export const COUNTS_INSERT_ACTION = 'counts-import'
export const COUNTS_MAX_ROWS = 200
const FIXTURE_MAX = 300
const GROUP_MAX = 80
const PAGE_MAX = 40
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

/** One count row off the wire, shaped; `has` says which of the optional fields the ask named. */
export type AskRow = {
  /** 1-based place in the ask, for the words. */
  n: number
  fixture: string
  group: string | null
  alternate: boolean
  count: number
  unit: string | null
  page: string | null
  has: { group: boolean; unit: boolean; page: boolean }
}

/**
 * A row off the wire, as both seats shape it: a `[Group] ` prefix on the fixture is lifted off it and names the group
 * when no group is given, the name is cut at 300, the group at 80, the page at 40.
 */
export function shapeCountRow(raw: Json, n: number): AskRow {
  const rawFixture = String(raw.fixture ?? '').trim().slice(0, FIXTURE_MAX)
  const prefix = rawFixture.match(COUNT_GROUP_PREFIX_RE)
  const explicitGroup = raw.group == null ? null : String(raw.group).trim().slice(0, GROUP_MAX) || null
  const prefixGroup = prefix ? (prefix[1] ?? '').trim().slice(0, GROUP_MAX) || null : null
  return {
    n,
    fixture: prefix ? rawFixture.slice(prefix[0].length).trim() : rawFixture,
    group: explicitGroup ?? prefixGroup,
    alternate: raw.alternate === true,
    count: typeof raw.count === 'string' ? parseFloat(raw.count) : Number(raw.count),
    unit: raw.unit == null ? null : String(raw.unit).trim().toLowerCase(),
    page: raw.page == null ? null : String(raw.page).trim().slice(0, PAGE_MAX) || null,
    has: { group: Object.prototype.hasOwnProperty.call(raw, 'group') || prefixGroup != null, unit: raw.unit != null, page: Object.prototype.hasOwnProperty.call(raw, 'page') },
  }
}

/** Why a shaped row cannot go on the sheet, in the sheet's own words; null when it can. */
export function countRowProblem(row: Pick<AskRow, 'fixture' | 'count' | 'unit' | 'alternate' | 'group'>): string | null {
  if (!row.fixture) return 'a row needs a fixture name'
  if (!Number.isFinite(row.count) || row.count <= 0) return 'the count must be a number above zero'
  if (row.unit != null && !isCountUnit(row.unit)) return `the unit is one of ea, ft, px, sqft${row.unit ? ` (not "${row.unit}")` : ''}`
  if (row.alternate && !row.group) return 'an alternate needs its group\'s name (group)'
  return null
}

export type RemoveAsk = { n: number; fixture: string; group: string | null }
export type BidCountsPayload = { action: 'counts'; bid_id: string; version_id?: string; rows: AskRow[]; remove: RemoveAsk[] }
export type BidCountsInput = { ok: true; p: BidCountsPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs counts — { bid_id (a bids.id — find_bid), rows?: [{ fixture, count (above zero), unit? (ea | ft | px | sqft; read off the name when left out, as quick add does), page? (the plan page), group? (the area, level or alternate the row sits under), alternate? (true: the group is priced with and without) }] (up to ${COUNTS_MAX_ROWS}), remove?: [{ fixture, group? }], version_id? (a bid_versions.id on a bid with versions; its active version when left out) }. One of rows or remove at least.`

/** plan_bid_counts / apply_bid_counts' input, shaped: the bid, the rows as the wire gave them, the hash on apply. A row with a fault is kept and held by the plan, never a refusal of the whole ask. */
export function bidCountsInput(verb: BidCountsVerb, input: Json): BidCountsInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.counts)
  if (!src) return { ok: false, error: shape }
  const bidId = typeof src.bid_id === 'string' ? src.bid_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(bidId)) return { ok: false, error: shape }
  const rawRows = src.rows === undefined ? [] : src.rows
  const rawRemove = src.remove === undefined ? [] : src.remove
  if (!Array.isArray(rawRows) || !Array.isArray(rawRemove)) return { ok: false, error: shape }
  if (rawRows.length > COUNTS_MAX_ROWS || rawRemove.length > COUNTS_MAX_ROWS) return { ok: false, error: `${verb}: at most ${COUNTS_MAX_ROWS} rows a call, and as many removes.` }
  if (!rawRows.length && !rawRemove.length) return { ok: false, error: `${verb}: nothing to do — give rows, remove, or both. ${SHAPE}` }
  const rows: AskRow[] = []
  for (const [i, raw] of rawRows.entries()) {
    const r = obj(raw)
    if (!r) return { ok: false, error: `${verb}: row ${i + 1} is not an object. ${SHAPE}` }
    rows.push(shapeCountRow(r, i + 1))
  }
  const remove: RemoveAsk[] = []
  for (const [i, raw] of rawRemove.entries()) {
    const r = obj(raw)
    if (!r) return { ok: false, error: `${verb}: remove ${i + 1} is not an object: { fixture, group? }.` }
    const shaped = shapeCountRow({ fixture: r.fixture, group: r.group, count: 1 }, i + 1)
    remove.push({ n: i + 1, fixture: shaped.fixture, group: shaped.group })
  }
  const p: BidCountsPayload = { action: 'counts', bid_id: bidId, rows, remove }
  if (src.version_id != null) {
    const v = typeof src.version_id === 'string' ? src.version_id.trim().toLowerCase() : ''
    if (!UUID_RE.test(v)) return { ok: false, error: `${verb}: version_id is a bid_versions.id — get_bid lists the bid's versions.` }
    p.version_id = v
  }
  let planHash: string | null = null
  if (verb === 'apply_bid_counts') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_bid_counts replied with.` }
    planHash = h
  }
  return { ok: true, p, target: bidId, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type CountsReads = {
  /** GET /rest/v1/<table>?<query> as the dev; the rows. Throws on a refused read. */
  rows(table: string, query: string): Promise<Json[]>
}

export type CountsBid = { id: string; bid_number: string | null; project_name: string | null; selected_bid_version_id: string | null; alternate_group_tags: string[] | null; bid_date_sent: string | null; outcome: string | null }
export type CountsVersion = { id: string; name: string | null; sort_order: number; locked_at: string | null; locked_by: string | null }
export type CountRow = { id: string; fixture: string; count: number; unit: string | null; page: string | null; group_tag: string | null; sequence_order: number }
/** How many rows of each table hang on a count row and go with it when it is deleted (ON DELETE CASCADE). */
export type RowChildren = { takeoff_lines: number; price_assignments: number; custom_prices: number; custom_costs: number }
export type BidCountsWorld = {
  bid: CountsBid | null
  versions: CountsVersion[]
  /** The version the rows belong to: null on a bid never split. */
  versionId: string | null
  /** The active version's rows, in the sheet's order. */
  rows: CountRow[]
  /** The bid's highest sequence_order, across versions, as the sheet's insert reads it. */
  maxSequence: number
  /** Whether the bid has a labor estimate yet (the Labor tab mints its rows from these fixtures). */
  hasEstimate: boolean
  /** By count row id, for the rows the ask removes. */
  children: Record<string, RowChildren>
}

const BID_COLS = 'id,bid_number,project_name,selected_bid_version_id,alternate_group_tags,bid_date_sent,outcome'
const ROW_COLS = 'id,fixture,count,unit,page,group_tag,sequence_order'
/** The tables whose rows go with a deleted count row, each by its count_row_id. */
export const CHILD_TABLES: ReadonlyArray<{ table: string; key: keyof RowChildren }> = [
  { table: 'bids_takeoff_rough_part_lines', key: 'takeoff_lines' },
  { table: 'bid_pricing_assignments', key: 'price_assignments' },
  { table: 'bid_count_row_custom_prices', key: 'custom_prices' },
  { table: 'bid_count_row_custom_costs', key: 'custom_costs' },
]

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v))
const fixtureKey = (fixture: string): string => fixture.trim().toLowerCase()

/** The rows of the sheet that wear a fixture in a scope, the sheet's duplicate rule (findDuplicateFixture). */
export function rowsInScope(rows: CountRow[], fixture: string, group: string | null, alternateTags: readonly string[]): CountRow[] {
  const scope = alternateScopeKey({ group_tag: group }, alternateTags)
  return rows.filter((r) => fixtureKey(r.fixture) === fixtureKey(fixture) && alternateScopeKey(r, alternateTags) === scope)
}

/** One row out of several in a scope: the one under the group the ask names, when exactly one is. */
function pickByGroup(matches: CountRow[], group: string | null, named: boolean): CountRow | null {
  if (matches.length === 1) return matches[0] ?? null
  if (!named) return null
  const same = matches.filter((r) => normalizeGroupTag(r.group_tag) === normalizeGroupTag(group))
  return same.length === 1 ? (same[0] ?? null) : null
}

/** The reads the dry run needs, in one place, so the test pins the queries the door will see. */
export async function readBidCountsWorld(reads: CountsReads, p: BidCountsPayload): Promise<BidCountsWorld> {
  const [bidRows, versionRows, maxRows, estimateRows] = await Promise.all([
    reads.rows('bids', `select=${BID_COLS}&id=eq.${p.bid_id}`),
    reads.rows('bid_versions', `select=id,name,sort_order,locked_at,locked_by&bid_id=eq.${p.bid_id}&order=sort_order.asc`),
    reads.rows('bids_count_rows', `select=sequence_order&bid_id=eq.${p.bid_id}&order=sequence_order.desc&limit=1`),
    reads.rows('cost_estimates', `select=id&bid_id=eq.${p.bid_id}&limit=1`),
  ])
  const bid = (bidRows[0] as CountsBid | undefined) ?? null
  const versions = (versionRows as CountsVersion[]).map((v) => ({ ...v, sort_order: num(v.sort_order) }))
  const versionId = p.version_id ?? pickActiveVersion({ savedVersionId: bid?.selected_bid_version_id ?? null, bidVersions: versions })
  // The sheet's own load (useBidPricingEngine loadCountRows): the active version's rows, by sequence then id. A page of
  // 200 is the door's cap; a sheet past it is read on (the door pages by offset here, the order being total).
  const rows: CountRow[] = []
  for (let offset = 0; bid && offset < 2000; offset += 200) {
    const page = await reads.rows('bids_count_rows', `select=${ROW_COLS}&bid_id=eq.${p.bid_id}&bid_version_id=${versionId ? `eq.${versionId}` : 'is.null'}&order=sequence_order.asc,id.asc&limit=200&offset=${offset}`)
    for (const r of page) rows.push({ ...(r as CountRow), count: num(r.count), sequence_order: num(r.sequence_order) })
    if (page.length < 200) break
  }
  // What hangs on a row the ask may remove: read for every row wearing a removed fixture, whatever its scope, so the
  // dry run (which reads the scopes with the ask's alternates in) finds the count for the row it picks.
  const removeNames = new Set(p.remove.map((r) => fixtureKey(r.fixture)).filter(Boolean))
  const removeIds = new Set(rows.filter((r) => removeNames.has(fixtureKey(r.fixture))).map((r) => r.id))
  const children: Record<string, RowChildren> = {}
  if (removeIds.size) {
    const ids = [...removeIds]
    for (const id of ids) children[id] = { takeoff_lines: 0, price_assignments: 0, custom_prices: 0, custom_costs: 0 }
    await Promise.all(CHILD_TABLES.map(async ({ table, key }) => {
      const found = await reads.rows(table, `select=count_row_id&count_row_id=in.(${ids.join(',')})&limit=1000`)
      for (const r of found) {
        const c = children[String(r.count_row_id)]
        if (c) c[key] += 1
      }
    }))
  }
  return { bid, versions, versionId, rows, maxSequence: maxRows.length ? num(maxRows[0]?.sequence_order) || 0 : 0, hasEstimate: estimateRows.length > 0, children }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }
export type RowPatch = Partial<Pick<CountRow, 'count' | 'unit' | 'page' | 'group_tag'>>
export type PlanRow =
  | { status: 'add'; n: number; reads: string; row: Json }
  | { status: 'change'; n: number; id: string; reads: string; patch: RowPatch; before: RowPatch }
  | { status: 'unchanged'; n: number; id: string; reads: string }
  | { status: 'held'; n: number; reads: string; why: string }
export type PlanRemove = { status: 'remove'; n: number; id: string; reads: string; takes_with_it: RowChildren } | { status: 'held'; n: number; reads: string; why: string }

/** A row as the sheet's toast reads it: "4 × Water closet (Restroom A, p. P-101)". */
export function rowWords(row: { fixture: string; count: number; unit: string | null; group_tag: string | null; page: string | null }): string {
  const unit: CountUnit = isCountUnit(row.unit) ? row.unit : classifyCountRowUnit(row.fixture)
  const where = [row.group_tag?.trim(), row.page?.trim() ? `p. ${row.page.trim()}` : ''].filter(Boolean).join(', ')
  return `${row.count}${unit === 'ea' ? ' ×' : ` ${COUNT_UNIT_LABEL[unit]}`} ${row.fixture}${where ? ` (${where})` : ''}`
}

/** The sheet's totals in its own words: "3 counts (9 ea) · 1 line type (48.5 ft) · 1 alternate: Break room (1 ea)". */
export function sheetSummaryWords(list: CountRow[], tags: readonly string[]): string {
  return [summarizeRowsByUnit(list) || 'no rows', summarizeAlternates(list, tags)].filter(Boolean).join(' · ')
}

export function countsBidLabel(bid: { bid_number: string | null; project_name: string | null }): string {
  return [bid.bid_number?.trim() ? `b${bid.bid_number.trim()}` : '', bid.project_name?.trim() ?? ''].filter(Boolean).join(' ') || 'this bid'
}

/**
 * What the plan says and what the hash commits to: the bid and the version the rows belong to, every asked row as
 * add, change, unchanged or held with its reason, every remove with what goes with the row, the alternates that join
 * the bid's, the sheet's totals before and after in its own words, and what the verb does not do. A row with a fault
 * is held and the rest goes on; a plan with nothing ready is refused.
 */
export function bidCountsDryRun(p: BidCountsPayload, world: BidCountsWorld): DryRun {
  const bid = world.bid
  if (!bid) return { ok: false, refused: `No bid ${p.bid_id} is visible to you — find_bid resolves a number or a name.` }
  const label = countsBidLabel(bid)
  if (p.version_id && !world.versions.some((v) => v.id === p.version_id)) return { ok: false, refused: `${label} has no version ${p.version_id}. ${world.versions.length ? `Its versions: ${world.versions.map((v) => `${v.name ?? 'unnamed'} (${v.id})`).join(', ')}.` : 'It has never been split into versions: leave version_id out.'}` }
  const version = world.versions.find((v) => v.id === world.versionId) ?? null
  const tagsBefore = bid.alternate_group_tags ?? []
  // An alternate the ask names joins the bid's alternates (never removed here: the sheet's switch owns that), and the
  // scopes are read with it in, so a row lands in the scope it will sit in.
  const tagsAfter = mergeAlternateTags(tagsBefore, p.rows.filter((r) => r.alternate && r.group && !countRowProblem(r)).map((r) => r.group as string))
  const scopeOf = (group: string | null) => alternateScopeKey({ group_tag: group }, tagsAfter)

  // The same fixture twice in one scope of the ask is the sheet's duplicate: every one of them is held.
  const asked = new Map<string, number[]>()
  for (const r of p.rows) {
    if (countRowProblem(r)) continue
    const key = `${fixtureKey(r.fixture)}|${scopeOf(r.group)}`
    asked.set(key, [...(asked.get(key) ?? []), r.n])
  }
  const removeKeys = new Set(p.remove.map((r) => `${fixtureKey(r.fixture)}|${scopeOf(r.group)}`))

  const rows: PlanRow[] = []
  let next = world.maxSequence
  for (const r of p.rows) {
    const shown = { fixture: r.fixture || '(no fixture)', count: r.count, unit: r.unit, group_tag: r.group, page: r.page }
    const fault = countRowProblem(r)
    if (fault) {
      rows.push({ status: 'held', n: r.n, reads: Number.isFinite(r.count) ? rowWords(shown) : shown.fixture, why: fault })
      continue
    }
    const key = `${fixtureKey(r.fixture)}|${scopeOf(r.group)}`
    const twins = asked.get(key) ?? []
    if (twins.length > 1) {
      rows.push({ status: 'held', n: r.n, reads: rowWords(shown), why: `rows ${twins.join(' and ')} name the same fixture in ${scopeOf(r.group) ? 'the same alternate' : 'the base bid'}: the Count Sheet keeps one row a fixture there, so add the counts into one row (the area is its group)` })
      continue
    }
    if (removeKeys.has(key)) {
      rows.push({ status: 'held', n: r.n, reads: rowWords(shown), why: 'the same row is in remove: ask for one or the other' })
      continue
    }
    const matches = rowsInScope(world.rows, r.fixture, r.group, tagsAfter)
    if (!matches.length) {
      const unit = r.unit ?? classifyCountRowUnit(r.fixture)
      next += 1
      const row = { bid_id: bid.id, bid_version_id: world.versionId, fixture: r.fixture, count: r.count, group_tag: r.group, page: r.page, sequence_order: next, unit, source_shares: null }
      rows.push({ status: 'add', n: r.n, reads: rowWords({ ...row, unit }), row })
      continue
    }
    const hit = pickByGroup(matches, r.group, r.has.group)
    if (!hit) {
      rows.push({ status: 'held', n: r.n, reads: rowWords(shown), why: `${matches.length} rows already wear "${r.fixture}" in ${scopeOf(r.group) ? 'that alternate' : 'the base bid'} (${matches.map((m) => rowWords(m)).join('; ')}): name the group of the one you mean, or merge them on the Count Sheet first` })
      continue
    }
    const patch: RowPatch = {}
    const before: RowPatch = {}
    if (hit.count !== r.count) { patch.count = r.count; before.count = hit.count }
    if (r.has.unit && r.unit !== hit.unit) { patch.unit = r.unit; before.unit = hit.unit }
    if (r.has.page && (r.page ?? '') !== (hit.page ?? '').trim()) { patch.page = r.page; before.page = hit.page }
    if (r.has.group && (r.group ?? '') !== (hit.group_tag ?? '').trim()) { patch.group_tag = r.group; before.group_tag = hit.group_tag }
    const after = { ...hit, ...patch }
    if (!Object.keys(patch).length) rows.push({ status: 'unchanged', n: r.n, id: hit.id, reads: rowWords(hit) })
    else rows.push({ status: 'change', n: r.n, id: hit.id, reads: `${rowWords(hit)} → ${rowWords(after)}`, patch, before })
  }

  const removes: PlanRemove[] = []
  const removing = new Set<string>()
  for (const ask of p.remove) {
    const shown = `${ask.fixture || '(no fixture)'}${ask.group ? ` (${ask.group})` : ''}`
    if (!ask.fixture) { removes.push({ status: 'held', n: ask.n, reads: shown, why: 'a remove names its fixture' }); continue }
    const matches = rowsInScope(world.rows, ask.fixture, ask.group, tagsAfter)
    if (!matches.length) { removes.push({ status: 'held', n: ask.n, reads: shown, why: 'no row on the sheet wears that fixture there' }); continue }
    const hit = pickByGroup(matches, ask.group, ask.group != null)
    if (!hit) { removes.push({ status: 'held', n: ask.n, reads: shown, why: `${matches.length} rows wear that fixture there (${matches.map((m) => rowWords(m)).join('; ')}): name the group of the one you mean` }); continue }
    if (removing.has(hit.id)) { removes.push({ status: 'held', n: ask.n, reads: shown, why: 'that row is already in remove' }); continue }
    removing.add(hit.id)
    removes.push({ status: 'remove', n: ask.n, id: hit.id, reads: rowWords(hit), takes_with_it: world.children[hit.id] ?? { takeoff_lines: 0, price_assignments: 0, custom_prices: 0, custom_costs: 0 } })
  }

  const adds = rows.filter((r): r is Extract<PlanRow, { status: 'add' }> => r.status === 'add')
  const changes = rows.filter((r): r is Extract<PlanRow, { status: 'change' }> => r.status === 'change')
  const gone = removes.filter((r): r is Extract<PlanRemove, { status: 'remove' }> => r.status === 'remove')
  const held = [...rows.filter((r) => r.status === 'held'), ...removes.filter((r) => r.status === 'held')]
  const newTags = tagsAfter.filter((t) => !tagsBefore.some((b) => normalizeGroupTag(b) === normalizeGroupTag(t)))
  // An alternate only joins the bid's when a row under it stands or lands.
  const tagsToWrite = newTags.filter((t) => [...adds, ...changes, ...rows.filter((r) => r.status === 'unchanged')].some((r) => {
    const ask = p.rows.find((a) => a.n === r.n)
    return ask?.alternate && normalizeGroupTag(ask.group) === normalizeGroupTag(t)
  }))
  const ready = adds.length + changes.length + gone.length + tagsToWrite.length
  if (!ready) {
    const why = held.length ? ` Held: ${held.map((h) => `${h.reads} — ${h.why}`).join('; ')}.` : ' Every row already reads that way.'
    return { ok: false, refused: `Nothing ready on ${label}.${why}` }
  }

  // The sheet after, to say its totals in its own words.
  const afterRows = world.rows
    .filter((r) => !removing.has(r.id))
    .map((r) => {
      const c = changes.find((x) => x.id === r.id)
      return c ? { ...r, ...c.patch } : r
    })
    .concat(adds.map((a) => ({ id: `new-${a.n}`, fixture: String(a.row.fixture), count: num(a.row.count), unit: (a.row.unit as string | null) ?? null, page: (a.row.page as string | null) ?? null, group_tag: (a.row.group_tag as string | null) ?? null, sequence_order: num(a.row.sequence_order) })))
  const finalTags = mergeAlternateTags(tagsBefore, tagsToWrite)

  const after_write: string[] = []
  const warnings: string[] = []
  after_write.push('The bid\'s History records every row under your name, the new rows as one import (the Counts tab\'s own tag).')
  if (adds.length || changes.some((c) => c.patch.count !== undefined) || gone.length) {
    after_write.push(world.hasEstimate
      ? 'The Labor tab follows the next time someone opens it: its load sync mints a labor row for a new fixture from the labor book, moves the counts, and sets aside the labor row of a fixture no longer counted.'
      : 'The bid has no labor estimate yet: the Labor tab makes one from these fixtures the first time someone opens it.')
    if (adds.length) after_write.push('A new row prices from the bid\'s price book where the book has an entry of its name. With none, it reads $0 on Pricing until it is priced.')
  }
  const cascade = gone.reduce((s, g) => s + g.takes_with_it.takeoff_lines + g.takes_with_it.price_assignments + g.takes_with_it.custom_prices + g.takes_with_it.custom_costs, 0)
  if (cascade) warnings.push('A removed row takes its takeoff lines and its prices with it (the database deletes them with the row). Recently deleted keeps a copy.')
  if (bid.bid_date_sent) warnings.push(`${label} was sent on ${bid.bid_date_sent}: its counts are what the sent number was priced from.`)
  if (version?.locked_at) warnings.push(`The version "${version.name ?? 'unnamed'}" is locked. A dev's write passes the lock; the person who locked it is not asked.`)

  return {
    ok: true,
    reply: {
      action: 'counts',
      bid: { id: bid.id, label, sent_on: bid.bid_date_sent, outcome: bid.outcome },
      version: world.versionId ? { id: world.versionId, name: version?.name ?? null } : null,
      version_words: world.versionId ? `the version "${version?.name ?? 'unnamed'}"` : 'the bid has never been split into versions',
      counts: { add: adds.length, change: changes.length, unchanged: rows.filter((r) => r.status === 'unchanged').length, remove: gone.length, held: held.length },
      rows,
      remove: removes,
      alternates: { before: tagsBefore, after: finalTags, joined: tagsToWrite },
      sheet: { before: sheetSummaryWords(world.rows, tagsBefore), after: sheetSummaryWords(afterRows, finalTags), rows_before: world.rows.length, rows_after: afterRows.length },
      after_write,
      warnings,
      not_done: [
        'a note on a row — the sheet has none; plan_activity_note leaves one on the bid',
        'a CountTooling import and its sources, and the sheet\'s drag order',
        'taking an alternate off the bid (the group heading\'s switch on the Count Sheet)',
        'a rename: a new name is a new row, and the old one is a remove',
        'takeoff, labor and prices — the train\'s next pairs',
      ],
    },
  }
}

/** The apply's reply: what landed row by row, what failed with its reason, and the sheet as it reads now. */
export function bidCountsAppliedWords(
  label: string,
  done: { added: number; changed: Array<{ n: number; reads: string }>; removed: Array<{ n: number; reads: string }>; alternates: string[] },
  failed: Array<{ n: number | null; what: string; why: string }>,
  held: number,
  sheetNow: string | null,
): Json {
  const parts = [done.added ? `${done.added} added` : '', done.changed.length ? `${done.changed.length} changed` : '', done.removed.length ? `${done.removed.length} removed` : '', done.alternates.length ? `${done.alternates.length} alternate${done.alternates.length === 1 ? '' : 's'} joined (${done.alternates.join(', ')})` : ''].filter(Boolean)
  return {
    label,
    landed: parts.length ? parts.join(', ') : 'nothing',
    added: done.added,
    changed: done.changed,
    removed: done.removed,
    alternates_joined: done.alternates,
    failed,
    held_in_plan: held,
    sheet_now: sheetNow,
    next: failed.length
      ? `${label}: ${parts.join(', ') || 'nothing'} landed and ${failed.length} did not (named in failed, each with its reason). get_bid reads the sheet; plan again for what is left.`
      : `${label}'s Count Sheet reads as planned; get_bid shows the rows. Takeoff, labor and prices are the next pairs.`,
  }
}

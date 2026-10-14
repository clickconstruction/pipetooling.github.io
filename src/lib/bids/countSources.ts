/**
 * The CountTooling projects behind a bid's counts (v2.5517, combine two counts on one bid). A bid keeps one
 * `bid_count_sources` row per project (the link, its token, the name from the copy's heading); each count row keeps
 * each project's share of its count in `bids_count_rows.source_shares`, `{"<source id>": <count>}`. This kernel is
 * the pure half: which review mode a copy opens in, and the share arithmetic. No IO.
 *
 * The rule the mode follows, from the copy's token:
 *   - no token (a hand paste) → replace: today's review;
 *   - the token is a project already on the bid → recopy: the copy moves that project's share of each row and removes
 *     only the rows that are its alone;
 *   - another project is already on the bid (any source, or a legacy link with a different token) → combine: counts add,
 *     pages join, nothing is removed;
 *   - otherwise (no project on the bid yet, or the legacy link is this same project) → replace. A bid with no sources
 *     but a legacy link adopts that link as its first source on this import (`adoptLegacy`), stamping the rows that
 *     carry no share as that project's, the way the bid was before v2.5517.
 */
import type { ParsedCountImportRow } from './parseCountsImportText'

export type CountsImportMode = 'replace' | 'combine' | 'recopy'

/** A share map: each project's part of a row's count, keyed by its `bid_count_sources` id (or the sentinel below). */
export type CountSourceShares = Record<string, number>

/**
 * The key the review uses for the arriving project before its `bid_count_sources` row exists: the tab swaps it for the
 * real id on Apply (`resolveShareKeys`), never at review time, so Cancel leaves nothing behind.
 */
export const INCOMING_SOURCE_KEY = '__incoming__'

export type CountSourceLike = { id: string; token: string | null }

export type CountsImportModeDecision = {
  mode: CountsImportMode
  /** The arriving project's share key: the existing source's id on a recopy, else the sentinel. */
  incomingKey: string
  /** The existing source the copy re-copies; null otherwise. */
  recopySourceId: string | null
  /** The bid has no sources but a legacy link: register it as the first source and stamp the share-less rows as its. */
  adoptLegacy: boolean
}

export function decideCountsImportMode(args: {
  /** The copy's project token (`parseCountsImportText().sourceToken`); null for a hand paste. */
  token: string | null
  /** The bid's sources. */
  sources: ReadonlyArray<CountSourceLike>
  /** The token of `bids.count_tooling_plans_link` when the bid has no sources yet. */
  legacyToken: string | null
  /** Whether the bid already has count rows; with none there is nothing to combine or re-copy. */
  hasRows: boolean
}): CountsImportModeDecision {
  const token = args.token ? args.token.toLowerCase() : null
  const legacy = args.sources.length === 0 && !!args.legacyToken ? args.legacyToken.toLowerCase() : null
  const adoptLegacy = args.hasRows && legacy != null && token != null
  if (!args.hasRows || token == null) return { mode: 'replace', incomingKey: INCOMING_SOURCE_KEY, recopySourceId: null, adoptLegacy: false }
  const known = args.sources.find((s) => s.token != null && s.token.toLowerCase() === token)
  if (known) return { mode: 'recopy', incomingKey: known.id, recopySourceId: known.id, adoptLegacy: false }
  if (args.sources.length > 0 || (legacy != null && legacy !== token)) return { mode: 'combine', incomingKey: INCOMING_SOURCE_KEY, recopySourceId: null, adoptLegacy }
  return { mode: 'replace', incomingKey: INCOMING_SOURCE_KEY, recopySourceId: null, adoptLegacy }
}

/** A row's shares as a clean map: the column's JSON when it is an object of numbers, else empty. */
export function parseSourceShares(raw: unknown): CountSourceShares {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: CountSourceShares = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && k) out[k] = v
  }
  return out
}

/** Counts carry two decimals from CountTooling; the arithmetic must not leave float dust behind. */
export function roundCount(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/** One project's share of a row: its key's value, else 0. */
export function shareOf(shares: CountSourceShares, key: string): number {
  return shares[key] ?? 0
}

/** The shares with one project's part set (a 0 drops the key). */
export function withShare(shares: CountSourceShares, key: string, count: number): CountSourceShares {
  const next: CountSourceShares = { ...shares }
  if (count > 0) next[key] = roundCount(count)
  else delete next[key]
  return next
}

/** The part of a row no project claims: the count less every share. */
export function unclaimedOf(count: number, shares: CountSourceShares): number {
  const claimed = Object.values(shares).reduce((a, b) => a + b, 0)
  return roundCount(Math.max(0, count - claimed))
}

/** True when the row is one project's alone: that project's share is the whole count. */
export function isWhollyOf(count: number, shares: CountSourceShares, key: string): boolean {
  const s = shareOf(shares, key)
  return s > 0 && Math.abs(count - s) < 1e-6
}

/** The shares to write: null when empty (a row with no project), else the map. */
export function sharesOrNull(shares: CountSourceShares): CountSourceShares | null {
  return Object.keys(shares).length === 0 ? null : shares
}

/** The sentinel swapped for the real source id, in one share map. */
export function resolveShareKeys(shares: CountSourceShares | null | undefined, incomingId: string): CountSourceShares | null {
  if (!shares) return null
  const out: CountSourceShares = {}
  for (const [k, v] of Object.entries(shares)) out[k === INCOMING_SOURCE_KEY ? incomingId : k] = v
  return sharesOrNull(out)
}

/**
 * Legacy adoption (`adoptLegacy`): the rows that carry no share belong to the bid's one project from before v2.5517.
 * The patches that say so, by row id, for the tab to write on Apply and to undo with the rest.
 */
export function legacyAdoptionPatches(
  rows: ReadonlyArray<{ id: string; count: number; source_shares?: unknown }>,
  sourceId: string,
): Array<{ id: string; before: { source_shares: null }; patch: { source_shares: CountSourceShares } }> {
  const out: Array<{ id: string; before: { source_shares: null }; patch: { source_shares: CountSourceShares } }> = []
  for (const r of rows) {
    if (Object.keys(parseSourceShares(r.source_shares)).length > 0) continue
    if (!(r.count > 0)) continue
    out.push({ id: r.id, before: { source_shares: null }, patch: { source_shares: { [sourceId]: roundCount(r.count) } } })
  }
  return out
}

/** The shares a new row from the arriving project carries. */
export function sharesForNewRow(row: Pick<ParsedCountImportRow, 'count'>, incomingKey: string): CountSourceShares | null {
  return row.count > 0 ? { [incomingKey]: roundCount(row.count) } : null
}

/** "SpaceX BA · Robert" — a source's label from its name and its importer; the link's host when it has no name. */
export function countSourceLabel(source: { project_name: string | null; link: string }, importerName: string | null | undefined): string {
  let name = (source.project_name ?? '').trim()
  if (!name) {
    try {
      name = new URL(source.link).host
    } catch {
      name = 'CountTooling'
    }
  }
  const who = (importerName ?? '').trim()
  return who ? `${name} · ${who}` : name
}

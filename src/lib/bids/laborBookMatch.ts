/**
 * Matching a bid's count-sheet rows to labor book entries (the Labor refresh PR 1).
 *
 * Count sheets arrive as plan codes and footage — `WC 1&2`, `LAV2`, `WHA-500`,
 * `ft of 3/4IN WATER` — while the book keys on words like "Toilet". The Old
 * view's Apply matched the primary name only (architecture quirk #6); the New
 * view matches in three steps and says which one hit:
 *
 *   exact  — the row's text is an entry's name
 *   alias  — the row's text is one of an entry's aliases
 *   prefix — the letters at the front of a code (`LAV2` → `lav`, `WC 1&2` → `wc`)
 *            equal an entry's name or alias
 *
 * Every comparison is case- and whitespace-insensitive. A prefix needs at
 * least two letters and must be followed by a digit or punctuation-then-digit,
 * so `ft of 3/4IN WATER` (letters followed by a word) never becomes `ft`.
 * Pure; the tab decides what to do with a match.
 */
import type { CostEstimateLaborRow, LaborBookEntryWithFixture } from './bidPricingEngineTypes'

export type LaborBookMatchVia = 'exact' | 'alias' | 'prefix'

/** How a book entry's hours read against a count: per piece, or per 100 ft of a footage row (PR 2). */
export type LaborUnit = 'each' | 'per_100ft'
/** A book entry is a fixture (hours per unit) or a task (fixed hours for the line). */
export type LaborEntryKind = 'fixture' | 'task'
/** A labor row is a fixture, a task, or a sub's line (none of our field hours). */
export type LaborRowKind = 'fixture' | 'task' | 'sub'
/** What the row's `source` column may say. */
export type LaborRowStoredSource = 'book' | 'alias' | 'typed' | 'robot'

export const asLaborUnit = (s: unknown): LaborUnit => (s === 'per_100ft' ? 'per_100ft' : 'each')
export const asLaborEntryKind = (s: unknown): LaborEntryKind => (s === 'task' ? 'task' : 'fixture')
export const asLaborRowKind = (s: unknown): LaborRowKind => (s === 'task' || s === 'sub' ? s : 'fixture')

export const LABOR_UNIT_WORDS: Record<LaborUnit, string> = { each: 'each', per_100ft: 'per 100 ft' }
export const LABOR_ROW_KIND_WORDS: Record<LaborRowKind, string> = { fixture: 'Fixture', task: 'Task · fixed hours', sub: 'Sub' }

export type LaborBookMatchEntry = {
  id: string
  name: string
  aliases: string[]
  rough: number
  top: number
  trim: number
  unit: LaborUnit
  kind: LaborEntryKind
}

export type LaborBookMatch = { entry: LaborBookMatchEntry; via: LaborBookMatchVia }

export const normalizeFixtureKey = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * `LAV2` → `lav` · `WC 1&2` → `wc` · `WHA-500` → `wha` · `Toilets` → null · `ft of 3/4IN WATER` → null.
 * The letters at the front of a code, only when a digit (optionally after a space or a dash) follows them.
 */
export function fixtureCodePrefix(s: string | null | undefined): string | null {
  const m = /^([a-z]{2,})(?:\s*[-_/#.]?\s*)\d/i.exec((s ?? '').trim())
  return m ? m[1]!.toLowerCase() : null
}

/** The shape the matcher reads, built once from the applied book's rows. */
export function laborBookEntriesForMatch(entries: ReadonlyArray<LaborBookEntryWithFixture>): LaborBookMatchEntry[] {
  return entries
    .map((e) => ({
      id: e.id,
      name: (e.fixture_types?.name ?? '').trim(),
      aliases: (e.alias_names ?? []).map((a) => a.trim()).filter(Boolean),
      rough: Number(e.rough_in_hrs) || 0,
      top: Number(e.top_out_hrs) || 0,
      trim: Number(e.trim_set_hrs) || 0,
      unit: asLaborUnit(e.unit),
      kind: asLaborEntryKind(e.kind),
    }))
    .filter((e) => e.name.length > 0)
}

export function matchLaborRow(fixture: string | null | undefined, entries: ReadonlyArray<LaborBookMatchEntry>): LaborBookMatch | null {
  const key = normalizeFixtureKey(fixture)
  if (!key) return null
  for (const entry of entries) if (normalizeFixtureKey(entry.name) === key) return { entry, via: 'exact' }
  for (const entry of entries) if (entry.aliases.some((a) => normalizeFixtureKey(a) === key)) return { entry, via: 'alias' }
  const prefix = fixtureCodePrefix(fixture)
  if (prefix) {
    for (const entry of entries) {
      if (normalizeFixtureKey(entry.name) === prefix || entry.aliases.some((a) => normalizeFixtureKey(a) === prefix)) return { entry, via: 'prefix' }
    }
  }
  return null
}

export function matchLaborRows(rows: ReadonlyArray<CostEstimateLaborRow>, entries: ReadonlyArray<LaborBookMatchEntry>): ReadonlyMap<string, LaborBookMatch | null> {
  return new Map(rows.map((r) => [r.id, matchLaborRow(r.fixture, entries)]))
}

export const laborRowHasHours = (r: Pick<CostEstimateLaborRow, 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit'>): boolean =>
  Number(r.rough_in_hrs_per_unit) > 0 || Number(r.top_out_hrs_per_unit) > 0 || Number(r.trim_set_hrs_per_unit) > 0

/** A sub's line is answered without hours — the money sits under direct costs. */
export const laborRowIsSub = (r: Pick<CostEstimateLaborRow, 'kind'>): boolean => r.kind === 'sub'

/** A row the estimator no longer has to look at: it carries hours, or it is a sub's line. */
export const laborRowAnswered = (r: Pick<CostEstimateLaborRow, 'kind' | 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit'>): boolean => laborRowIsSub(r) || laborRowHasHours(r)

/**
 * Where a row's hours came from, as far as the data can tell: `robot` when the
 * row says so, `book` when they equal the matched entry's, `edited` when a
 * matched row differs, `typed` when an unmatched row carries hours, `none`
 * when it is still zero. (A sub row has no hours and reads `none`; callers
 * check `laborRowIsSub` first.)
 */
export type LaborRowSource = 'book' | 'edited' | 'typed' | 'robot' | 'none'

export function laborRowSource(row: CostEstimateLaborRow, match: LaborBookMatch | null | undefined): LaborRowSource {
  if (!laborRowHasHours(row)) return 'none'
  if (row.source === 'robot') return 'robot'
  if (!match) return 'typed'
  const same = (a: number, b: number) => Math.abs(Number(a) - Number(b)) < 0.0005
  return same(row.rough_in_hrs_per_unit, match.entry.rough) && same(row.top_out_hrs_per_unit, match.entry.top) && same(row.trim_set_hrs_per_unit, match.entry.trim) ? 'book' : 'edited'
}

/** The queue: rows still at zero hours (sub lines excepted), in sheet order. A matched zero row can be filled from the book in one tap; an unmatched one needs a person. */
export function laborRowsNeedingHours(rows: ReadonlyArray<CostEstimateLaborRow>): CostEstimateLaborRow[] {
  return rows.filter((r) => !laborRowAnswered(r))
}

/** The row columns a book match writes — hours, how to read them, and where they came from. */
export type LaborRowPatchFromBook = Pick<CostEstimateLaborRow, 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit' | 'unit' | 'kind' | 'is_fixed' | 'source' | 'source_note'>

const VIA_NOTE: Record<LaborBookMatchVia, string> = { exact: 'by name', alias: 'by alias', prefix: 'by code' }

/**
 * What filling a row from a match writes: the entry's three stage hours, its
 * unit and kind (a task entry makes a task row — `is_fixed` mirrors it for
 * the Old view and the prints), `source` = `book` for a name match and
 * `alias` for an alias or code match, and a note naming the entry and book.
 */
export function laborRowPatchFromMatch(match: LaborBookMatch, bookName?: string | null): LaborRowPatchFromBook {
  const { entry, via } = match
  const isTask = entry.kind === 'task'
  return {
    rough_in_hrs_per_unit: entry.rough,
    top_out_hrs_per_unit: entry.top,
    trim_set_hrs_per_unit: entry.trim,
    unit: isTask ? 'each' : entry.unit,
    kind: isTask ? 'task' : 'fixture',
    is_fixed: isTask,
    source: via === 'exact' ? 'book' : 'alias',
    source_note: `${entry.name}${bookName ? ` · ${bookName}` : ''}${via === 'exact' ? '' : ` (${VIA_NOTE[via]})`}`,
  }
}

/** Does this text already reach the entry (as its name or an alias)? Then there is nothing to learn. */
export function entryAlreadyKnows(entry: LaborBookMatchEntry, fixture: string | null | undefined): boolean {
  const key = normalizeFixtureKey(fixture)
  return !!key && (normalizeFixtureKey(entry.name) === key || entry.aliases.some((a) => normalizeFixtureKey(a) === key))
}

/**
 * A price sheet's fixtures onto the takeoff (punch list #308, PR 6).
 *
 * A quote prices a fixture as a lot: its parts, then one Subtotal EACH. On the bid that is an
 * assembly with the house's bundle price, and one bundle line on the fixture's row. This file
 * decides, for one fixture of a sheet: which of the bid's rows it goes on, what the assembly holds,
 * whether an assembly on file already holds exactly that, and whether it can be placed now. Pure.
 */
import type { BookPart } from '../partMatch'
import type { PlannedGroup, PlannedRow } from './sheetPlan'

/** One of the bid's fixture rows, as Takeoffs lists them, with the area it sits under (`Restroom A`). */
export type CountRow = { id: string; fixture: string; planTag?: string | null; groupTag?: string | null; count: number }

/** A row as the panel names it: `WC · Restroom A`, so two rows called WC can be told apart. */
export function countRowName(row: Pick<CountRow, 'fixture' | 'groupTag'>): string {
  const area = row.groupTag?.trim()
  return area ? `${row.fixture} · ${area}` : row.fixture
}

const fold = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * The tags a heading names, folded: `SK-2` → [SK2]; `WC-1 & WC-2` → [WC1, WC2]; `WC-1 & 2` → [WC1, WC2],
 * the bare number borrowing the letters before it.
 */
export function tagKeys(tag: string): string[] {
  const out: string[] = []
  let letters = ''
  for (const piece of tag.split(/\s*(?:&|\/|,|\band\b)\s*/i)) {
    const key = fold(piece)
    if (!key) continue
    const m = /^([A-Z]+)(\d+[A-Z]?)$/.exec(key)
    if (m) {
      letters = m[1]!
      if (!out.includes(key)) out.push(key)
    } else if (/^\d+[A-Z]?$/.test(key) && letters) {
      if (!out.includes(letters + key)) out.push(letters + key)
    } else if (!out.includes(key)) out.push(key)
  }
  return out
}

/** The tags a row of the bid answers to: its plan tag, and the tag its fixture name opens with. */
export function countRowKeys(row: CountRow): string[] {
  const out = row.planTag ? tagKeys(row.planTag) : []
  const lead = /^\s*([A-Za-z]{1,5}\s?-?\s?\d{1,3}[A-Za-z]?)\b/.exec(row.fixture)
  if (lead) for (const k of tagKeys(lead[1]!)) if (!out.includes(k)) out.push(k)
  return out
}

/** The bid's rows a sheet's fixture goes on, in the bid's order. */
export function rowsForTag(tag: string, countRows: CountRow[]): CountRow[] {
  const keys = new Set(tagKeys(tag))
  return countRows.filter((r) => countRowKeys(r).some((k) => keys.has(k)))
}

export type AssemblyItem = { partId: string; quantity: number }

/** What the fixture's assembly holds: each filed part once, its quantities summed. Charges and left-out rows are not parts. */
export function groupItems<T extends BookPart>(rows: PlannedRow<T>[]): AssemblyItem[] {
  const byPart = new Map<string, number>()
  for (const r of rows) {
    if (r.bucket !== 'filed' || !r.line.partId) continue
    byPart.set(r.line.partId, (byPart.get(r.line.partId) ?? 0) + (r.line.qty ?? 1))
  }
  return [...byPart.entries()].map(([partId, quantity]) => ({ partId, quantity })).sort((a, b) => a.partId.localeCompare(b.partId))
}

export function sameItems(a: AssemblyItem[], b: AssemblyItem[]): boolean {
  if (a.length !== b.length) return false
  const want = new Map(a.map((i) => [i.partId, i.quantity]))
  return b.every((i) => want.get(i.partId) === i.quantity)
}

export type KnownAssembly = { id: string; name: string; items: AssemblyItem[]; /** Holds a nested assembly, so its parts alone do not say what it is. */ nested?: boolean }

/** An assembly on file that holds exactly these parts and quantities, the oldest name first. Never one with a nested assembly. */
export function findSameItemsAssembly(items: AssemblyItem[], assemblies: KnownAssembly[]): KnownAssembly | null {
  if (items.length === 0) return null
  return assemblies.filter((a) => !a.nested && sameItems(items, a.items)).sort((a, b) => a.name.localeCompare(b.name))[0] ?? null
}

/** The name of an assembly the sheet makes: the tag, the fixture's words and the house. No bid in it, since it is reused. */
export function assemblyName(tag: string, label: string, houseName: string): string {
  const words = label.replace(/\s+/g, ' ').trim()
  return [`${tag} ${words}`.trim(), houseName].filter(Boolean).join(' · ').slice(0, 120)
}

export type FixtureState =
  /** On the takeoff already, from this sheet. */
  | 'placed'
  /** Every row is filed and a row of the bid waits for it. */
  | 'ready'
  /** The bid's row has lines a person put there: the sheet waits for a word. */
  | 'costed_by_hand'
  /** No row of the bid answers to this tag. */
  | 'no_row'
  /** A row of the fixture is not filed yet. */
  | 'waits'
  /** Its rows do not add up to the printed subtotal. */
  | 'off'
  /** The paper prints no subtotal and its rows carry no prices to add. */
  | 'no_price'

export type FixtureStatus = {
  state: FixtureState
  /** The bundle price each: the printed subtotal, else the sum of its priced rows. */
  each: number | null
  rows: CountRow[]
  items: AssemblyItem[]
  /** Why it is not ready, or where it will land, in words. */
  why: string
}

export function fixtureStatus<T extends BookPart>(input: {
  group: PlannedGroup<T>
  countRows: CountRow[]
  /** How many lines each of the bid's rows already has, by row id. */
  lineCount: (countRowId: string) => number
  /** Rows a person chose for this fixture, when its tag matched none. */
  chosenRowIds?: string[]
}): FixtureStatus {
  const { group, countRows, lineCount } = input
  const g = group.group
  const each = g.eachPrice ?? group.rowsSum
  const items = groupItems(group.rows)
  const chosen = input.chosenRowIds?.length ? countRows.filter((r) => input.chosenRowIds!.includes(r.id)) : null
  const rows = chosen ?? rowsForTag(g.tag, countRows)
  const names = rows.map(countRowName).join(' and ')
  const base = { each, rows, items }

  if (g.placedAt) return { ...base, state: 'placed', why: `On the takeoff${names ? `, on ${names}` : ''}.` }
  if (group.addsUp === false) return { ...base, state: 'off', why: 'Its rows do not add up to the subtotal the paper prints.' }
  const unfiled = group.rows.filter((r) => r.bucket === 'ready' || r.bucket === 'confirm' || r.bucket === 'needs_you').length
  if (unfiled > 0) return { ...base, state: 'waits', why: unfiled === 1 ? '1 row is not filed yet.' : `${unfiled} rows are not filed yet.` }
  if (each == null) return { ...base, state: 'no_price', why: 'The paper prints no subtotal for it, and its rows carry no prices to add.' }
  if (items.length === 0) return { ...base, state: 'waits', why: 'None of its rows is a part on file yet.' }
  if (rows.length === 0) return { ...base, state: 'no_row', why: `No fixture on this bid is tagged ${g.tag || 'like this one'}.` }
  if (rows.some((r) => lineCount(r.id) > 0)) return { ...base, state: 'costed_by_hand', why: `${names} ${rows.length === 1 ? 'is' : 'are'} costed by hand already.` }
  return { ...base, state: 'ready', why: `Goes on ${names}.` }
}

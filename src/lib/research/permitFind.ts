/**
 * Permits, Find a permit (punch list #302): the pure rules behind one search over every list and
 * every city. A person looking for a permit they answered before knows a street, a permit number,
 * a project's name, a builder or a city, and not which list it sits on. Every word typed must be
 * found somewhere on the permit. A result says where the permit is now and the last thing done to
 * it. No React, no Supabase.
 */
import { plumbingOnFile, shortDay, type ResearchPermitRow } from './permitResearch'
import { placeOf } from './permitBuilders'
import { historyWords } from './permitHistory'

/** Fewer letters than this find too much to read. */
export const FIND_MIN_CHARS = 2
/** The most results drawn; past it the screen says how many more and asks for another word. */
export const FIND_LIMIT = 40

/** The words typed, lower-cased, one per run of letters and digits; "100-a main" is "100-a" and "main". */
export function findTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

/** Whether the query is long enough to search on. */
export function findReady(query: string): boolean {
  return findTokens(query).join('').length >= FIND_MIN_CHARS
}

function haystack(row: ResearchPermitRow): string {
  return [row.address, row.zip, row.city, row.permit_number, row.project_name, row.work_type, row.contact, row.builder_name, row.plumber]
    .filter((v): v is string => typeof v === 'string' && v !== '')
    .join(' \u0001 ')
    .toLowerCase()
}

/** Every word typed is somewhere on the permit: its street, zip, city, number, project, work, who pulled it or its plumber. */
export function matchesFind(row: ResearchPermitRow, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false
  const hay = haystack(row)
  return tokens.every((t) => hay.includes(t))
}

/** How well a row answers the query: its number typed whole, its number begun, its street begun, anything else. */
function rank(row: ResearchPermitRow, tokens: readonly string[]): number {
  const whole = tokens.join(' ')
  const number = row.permit_number.toLowerCase()
  if (number === whole) return 0
  if (tokens.some((t) => number.startsWith(t) && t.length >= 4)) return 1
  if ((row.address ?? '').toLowerCase().startsWith(whole)) return 2
  return 3
}

/** The day a row last changed hands, for the order among equals: its answer, else its plumbing permit, else its filing. */
function lastDay(row: ResearchPermitRow): string {
  return (row.verdict_at ?? '').slice(0, 10) || row.plumber_permit_on || row.filed_on || ''
}

/** The permits that answer a query, the closest first and the most recently touched among equals, with how many more there are. */
export function findPermits(rows: readonly ResearchPermitRow[], query: string, limit = FIND_LIMIT): { found: ResearchPermitRow[]; more: number } {
  if (!findReady(query)) return { found: [], more: 0 }
  const tokens = findTokens(query)
  const hits = rows
    .filter((r) => matchesFind(r, tokens))
    .sort((a, b) => rank(a, tokens) - rank(b, tokens) || lastDay(b).localeCompare(lastDay(a)) || a.permit_number.localeCompare(b.permit_number))
  return { found: hits.slice(0, limit), more: Math.max(0, hits.length - limit) }
}

/** Where a permit sits now, in the strip's own words. */
export function findPlaceWords(row: ResearchPermitRow): string {
  const p = placeOf(row)
  if (p.place === 'skim') return 'Skim'
  if (p.place === 'kept') return 'Investigating'
  if (p.place === 'pursuing') return 'Pursuing'
  return p.why === 'plumber' ? 'Closed · has a plumber' : p.why === 'not_pursuing' ? 'Closed · not pursuing' : 'Closed · passed'
}

/** The last thing done to a permit: the newest answer with who and when, the plumber who took it, or that it still waits. */
export function findLastMoveWords(row: ResearchPermitRow): string {
  if (row.verdict !== 'taken' && plumbingOnFile(row)) {
    const day = row.plumber_permit_on ? `, ${shortDay(row.plumber_permit_on)}` : ''
    return row.plumber ? `${row.plumber} has it${day}` : `A plumbing permit is on file${day}`
  }
  if (row.verdict && row.verdict_at) {
    return historyWords({ id: row.id, verdict: row.verdict, reason: row.verdict_reason ?? '', reason_code: row.verdict_reason_code ?? null, decided_at: row.verdict_at, by_name: row.verdict_by_name, for_name: row.verdict_for_name ?? null })
  }
  return 'Waiting on a skim'
}

/** "and 12 more. Add a word to narrow it." Null with none. */
export function findMoreWords(more: number): string | null {
  return more > 0 ? `and ${more} more. Add a word to narrow it.` : null
}

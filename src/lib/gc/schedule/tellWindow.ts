/**
 * GC mode, the real build, the schedule's PR 13b: Tell the trades on the Schedule window (to-dos/gc-mode/mockups/
 * schedule-pr13.md on branch spike/gc-mode). Not a lift: `tellTrades.ts` stays the prototype's word for word, and this
 * is the window's. Who is still to tell, company by company (call 3); the lines a tell showed, for its row; the email's
 * key (call 4); the kept line's words after a what-if; and a told move undone, read as a call (call 11).
 */
import { partnerReach, type PartnerReach } from '../followUpSheet'
import { partnerById } from '../lookups'
import type { GcProject, GcState, Partner } from '../types'
import { companiesToTell, movedLines, type CompanyToTell, type MovedLine } from './tellTrades'
import type { ScheduleMove } from './types'

/** "a, b and c" */
function andList(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

const standing = (project: GcProject): ScheduleMove[] => (project.schedule?.moves ?? []).filter((m) => !m.undoneOn)

/**
 * Every company a standing move changed days for and has not told yet, each with those moves and their lines, as
 * `companiesToTell` groups them. Told is by company, not by move (call 3): a company refused at the send stays here for
 * its moves while the others are told. A pull tells only the companies whose dates came in (`movedLines`).
 */
export function companiesNotTold(state: GcState, project: GcProject, moves: ScheduleMove[] = standing(project)): CompanyToTell[] {
  const byPartner = new Map<string, ScheduleMove[]>()
  for (const move of moves) {
    if (move.undoneOn) continue
    for (const c of companiesToTell(state, project, [move])) {
      if (move.toldTo?.includes(c.partner.id)) continue
      byPartner.set(c.partner.id, [...(byPartner.get(c.partner.id) ?? []), move])
    }
  }
  return [...byPartner.entries()].flatMap(([id, ms]) => companiesToTell(state, project, ms).filter((c) => c.partner.id === id))
}

/** The lines a move changed for one company, with the dates its message gives: the tell's `shown`. */
export function tellShown(state: GcState, project: GcProject, move: ScheduleMove, companyId: string): MovedLine[] {
  return movedLines(state, project, move)
    .filter((x) => x.partner?.id === companyId)
    .map((x) => x.line)
}

/**
 * The email's key (call 4): `dates:` and a SHA-256 of the company's moves' ids, sorted. The same moves give the same key,
 * so a second press sends nothing; a move added since gives a new one. 70 letters, under the sender's 200.
 */
export async function datesEmailKey(moveIds: string[]): Promise<string> {
  const bytes = new TextEncoder().encode([...moveIds].sort().join(','))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `dates:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The kept line after a what-if (PR 11's call 8): "2 moves kept from the what-if. Summit Roofing and Cool Breeze
 * Mechanical have not been told." `whatIfKeptWords`'s words, company by company. Null: every kept move's companies were
 * told, or none has any.
 */
export function keptNotToldWords(state: GcState, project: GcProject): { words: string; companies: string[] } | null {
  const kept = standing(project).filter((m) => m.fromWhatIf)
  const toTell = companiesNotTold(state, project, kept)
  const moves = new Set(toTell.flatMap((c) => c.moves.map((m) => m.id)))
  if (moves.size === 0) return null
  const companies = toTell.map((c) => c.partner.company)
  return { words: `${moves.size === 1 ? '1 move' : `${moves.size} moves`} kept from the what-if. ${andList(companies)} ${companies.length === 1 ? 'has' : 'have'} not been told.`, companies }
}

/** A told move undone (call 11): the companies that still hold its dates, the line under it, and who to call. */
export interface ToldThenUndone {
  move: ScheduleMove
  partners: Partner[]
  /** "Told, then undone: Summit Roofing still has the moved dates. Call them." */
  words: string
  calls: PartnerReach[]
}

/**
 * Every undone move a company was told of: its dates no longer stand, and nothing tells the company yet (13c). The
 * office reads it under the move, and calls.
 */
export function toldThenUndone(state: GcState, project: GcProject): ToldThenUndone[] {
  return (project.schedule?.moves ?? []).flatMap((move) => {
    if (!move.undoneOn || !move.toldTo?.length) return []
    const partners = move.toldTo.map((id) => partnerById(state, id)).filter((p): p is Partner => Boolean(p))
    if (partners.length === 0) return []
    const names = partners.map((p) => p.company)
    const words = `Told, then undone: ${andList(names)} ${names.length === 1 ? 'still has' : 'still have'} the moved dates. Call them.`
    return [{ move, partners, words, calls: partners.map(partnerReach) }]
  })
}

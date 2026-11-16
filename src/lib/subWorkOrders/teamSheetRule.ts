/**
 * Who a sheet's money is owed to (punch list #346). Taunya's pick of 2026-11-15: a sheet that names one teammate and
 * no sub is owed to that teammate.
 *
 * `sheetParties` sorts a sheet's people into the roster sub and the teammates. What it cannot say is whether a
 * teammate is paid from the sheet. Until now every screen answered no: a teammate "is paid through payroll", and a
 * sheet with teammates and no sub ("crew pay") is owed to nobody. Nothing in payroll reads a sheet, though, and
 * Taunya's word of 2026-11-15 is that a teammate is sometimes paid as sub labor: an incentive bonus.
 *
 * Two rules. `owed` is the app's. `payroll` is what every screen did before, kept so the spike can draw both:
 *
 *  - `payroll` (before): a sheet with no sub on it is owed to nobody.
 *  - `owed` (her pick): a sheet with no sub and ONE teammate is that teammate's, owed like any sheet. With several teammates
 *    and no sub it is shared, on nobody's row, until it names one person, as a sheet with two subs is.
 *
 * Under both, a teammate on a SUB's sheet is not paid from it: the sheet is the sub's, whole, once. The app has no
 * place to say how a sheet splits between people, so a bonus for a teammate is a sheet of their own.
 *
 * Pure: no React, no Supabase.
 */
import { normalizePersonNameKey } from '../personNameKey'
import type { SheetParties, SheetParty } from './sheetParties'

export type TeamSheetRule = 'payroll' | 'owed'

/** The app's rule (Taunya, 2026-11-15). A screen reads the old way only when the spike hands it `payroll`. */
export const TEAM_SHEET_RULE: TeamSheetRule = 'owed'

export type SheetOwedToKind =
  /** One roster sub: the sheet is theirs. */
  | 'sub'
  /** No sub, one teammate, under `owed`: sub labor paid to someone on payroll. */
  | 'team'
  /** Two or more subs, or several teammates and no sub under `owed`: counted once, on nobody's row. */
  | 'shared'
  /** No sub, under `payroll`: owed to nobody. */
  | 'payroll'
  /** No names at all. */
  | 'nobody'

export type SheetOwedTo = {
  kind: SheetOwedToKind
  /** The one person the open money is owed to; null when it is shared, payroll or nobody's. */
  person: SheetParty | null
  /** Groups a person's sheets: `id:<people.id>`, else the name key. '' when nobody is owed. */
  key: string
  /** The names the sheet is for, as the Pay view joins them. */
  label: string
  /** True when the open balance counts as money we owe someone. */
  counts: boolean
}

export function sheetOwedTo(parties: SheetParties, rule: TeamSheetRule = TEAM_SHEET_RULE): SheetOwedTo {
  const people = parties.contractors
  if (people.length === 0) return { kind: 'nobody', person: null, key: '', label: parties.label, counts: false }
  if (parties.crew) {
    if (rule === 'payroll') return { kind: 'payroll', person: null, key: '', label: parties.label, counts: false }
    if (people.length === 1) {
      const person = people[0]!
      return { kind: 'team', person, key: person.id ? `id:${person.id}` : normalizePersonNameKey(person.name), label: parties.label, counts: true }
    }
    return { kind: 'shared', person: null, key: '', label: parties.label, counts: true }
  }
  if (people.length === 1) {
    const person = people[0]!
    return { kind: 'sub', person, key: parties.key, label: parties.label, counts: true }
  }
  return { kind: 'shared', person: null, key: '', label: parties.label, counts: true }
}

/**
 * True when the sheet's open money is owed to nobody: what the Pay view and the ledger called crew pay. Under `owed`
 * that is only a sheet with no name on it. A teammate's own sheet is owed, and so is one several teammates share.
 */
export function sheetOwedToNobody(parties: SheetParties, rule: TeamSheetRule = TEAM_SHEET_RULE): boolean {
  return parties.crew && !sheetOwedTo(parties, rule).counts
}

/** The chip a sheet or a person wears for who is owed. '' for a sub, who needs none. */
export function sheetOwedToChip(kind: SheetOwedToKind): string {
  switch (kind) {
    case 'team':
      return 'Team · sub labor'
    case 'shared':
      return 'Shared'
    case 'payroll':
      return 'Crew sheet'
    default:
      return ''
  }
}

/**
 * What a teammate riding along on a sub's sheet reads. It used to say "is paid through payroll", which claims
 * something no table holds. This says only what the sheet says.
 */
export function rodeAlongWords(teammates: readonly string[], subName: string): string {
  const names = teammates.filter(Boolean)
  if (names.length === 0) return ''
  const who = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${who} ${names.length === 1 ? 'is' : 'are'} named on this sheet and not paid from it. The whole sheet is ${subName}'s.`
}

/** The line under the roster for sheets with no sub, under each rule. */
export function teamSheetsLineWords(count: number, open: number, rule: TeamSheetRule): string {
  if (count <= 0) return ''
  const sheets = `${count} ${count === 1 ? 'sheet names' : 'sheets name'} a teammate and no sub.`
  const money = `$${open.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (rule === 'owed') return open > 0 ? `${sheets} ${money} is open on ${count === 1 ? 'it' : 'them'}, owed to the teammate as sub labor.` : `${sheets} Nothing is open on ${count === 1 ? 'it' : 'them'}.`
  return open > 0 ? `${sheets} ${money} is open on ${count === 1 ? 'it' : 'them'} and is in nobody's Balance due.` : `${sheets} Nothing is open on ${count === 1 ? 'it' : 'them'}.`
}

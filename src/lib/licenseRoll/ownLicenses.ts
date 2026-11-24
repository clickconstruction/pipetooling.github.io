/**
 * State roll, the Our own view (punch list #411): each plumbing license we hold on People → Licenses, or on a
 * person's own record, beside the row the state's roll keeps under the same number. Pure: the screen reads the
 * rows and this says how each one reads. A license is matched by its number within its rank, never by a name. The
 * state's name is only checked against ours, so a number typed wrong does not pass as a match.
 * Each value in a sentence is marked with `val`, so the screen draws it apart from its words (`ValueSentence`).
 */
import { rollNumberKey, type RollClass } from '../../../supabase/functions/_shared/licenseRoll'
import { formatWorkDateYmdFriendly, ymdDaysBetween } from '../../utils/dateUtils'
import { parseLicenseType } from '../logbook/logbook'
import { val } from '../valuesInPlace'

/** A license we hold, as the app's own tables keep it. */
export type OwnRecord = {
  /** Stable on the page: `pl:<id>` for a row of People → Licenses, `p:<id>` for a person's own record. */
  key: string
  /** The `person_licenses` row whose date can be saved. Null for a license kept on the person's record. */
  licenseId: string | null
  personName: string
  /** The license in the words it was typed in: *Journeyman Plumber #12345*. */
  text: string
  expiryYmd: string | null
  sub: boolean
}

/** A row of `license_roll` marked as ours, as the view reads it. */
export type OwnStateRow = {
  id: string
  license_class: RollClass
  license_number: string
  status: 'current' | 'expired'
  expires_on: string | null
  last_name: string
  first_name: string
  county: string
  insurance_ends_on: string | null
  gone_on: string | null
}

export type OwnVerdict = 'no_number' | 'no_rank' | 'not_found' | 'other_name' | 'gone' | 'lapsed' | 'state_later' | 'state_earlier' | 'lapses_soon' | 'matches'
export type OwnTone = 'red' | 'amber' | 'green'

export type OwnLine = {
  key: string
  licenseId: string | null
  personName: string
  sub: boolean
  /** The license's name without its number: *Journeyman Plumber*. */
  holds: string
  /** The number as we wrote it. */
  number: string | null
  ourDate: string | null
  verdict: OwnVerdict
  tone: OwnTone
  /** How the line reads, in a few words: *Lapses in 23 days*. */
  pill: string
  /** What the state says of the license, its values marked. Null when the state has no row for it. */
  stateSays: string | null
  /** Who the state lists under the number: *Okafor, Silas · Bexar*. */
  stateName: string | null
  /** A sentence for a line that needs more than its pill. */
  why: string | null
  /** The insurance on file with the board, for a master who contracts with the public. */
  insurance: { tone: 'red' | 'amber' | null; pill: string; words: string } | null
  /** The day **Use the state's date** would save. Null when there is nothing to take, or nowhere to save it. */
  useStateDate: string | null
  needsLook: boolean
}

/** A license or its insurance ending inside this many days is said out loud. */
export const SOON_DAYS = 60

const RANKS: readonly RollClass[] = ['apprentice', 'tradesman', 'journeyman', 'master']

/** The ranks of state file a license of ours may be found under. A master may be on either master file. */
function rollClassesFor(cls: string | null): RollClass[] {
  if (cls === 'master') return ['responsible_master', 'master']
  return RANKS.includes(cls as RollClass) ? [cls as RollClass] : []
}

/** `SMITH-JONES` as *Smith-Jones*. The state writes every name in capitals. */
export function nameCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase())
}

const nameTokens = (text: string): string[] => text.toLowerCase().split(/[^a-z]+/).filter((t) => t.length >= 2)

/** *Chris* beside *Christopher*: one name opens the other, from three letters up. */
const sameName = (a: string, b: string): boolean => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)))

/**
 * True when one of our words for the person is one of the state's names for them, first or last. People → Licenses
 * often holds a first name alone, so a last name cannot be asked for. A number typed wrong lands on a stranger,
 * whose first and last names are both someone else's, and that is what this catches. A state row with no name has
 * nothing to disagree with.
 */
export function stateNameAgrees(personName: string, stateLastName: string, stateFirstName = ''): boolean {
  const theirs = [...nameTokens(stateLastName), ...nameTokens(stateFirstName)]
  if (theirs.length === 0) return true
  const ours = nameTokens(personName)
  if (ours.some((o) => theirs.some((t) => sameName(o, t)))) return true
  // *Mike Z.* beside *Zamora, Michael*: an initial of ours opens one of the state's names, and another word of ours
  // shares its first two letters with a different one.
  const initials = personName.toLowerCase().split(/[^a-z]+/).filter((t) => t.length === 1)
  return initials.some((i) => theirs.some((t, ti) => t.startsWith(i) && ours.some((o) => theirs.some((u, ui) => ui !== ti && o.slice(0, 2) === u.slice(0, 2)))))
}

/** *in 23 days*, *in 1 day*, *today*. */
export function daysAwayWords(days: number): string {
  if (days <= 0) return 'today'
  return days === 1 ? 'in 1 day' : `in ${days} days`
}

const dateVal = (ymd: string): string => val('date', formatWorkDateYmdFriendly(ymd))

function insuranceOf(row: OwnStateRow, today: string): OwnLine['insurance'] {
  if (!row.insurance_ends_on) return null
  const days = ymdDaysBetween(today, row.insurance_ends_on)
  if (days == null) return null
  if (days < 0) return { tone: 'red', pill: 'Insurance ended', words: `Ended on ${dateVal(row.insurance_ends_on)}` }
  if (days <= SOON_DAYS) return { tone: 'amber', pill: `Insurance ends ${daysAwayWords(days)}`, words: `Ends ${val('days', daysAwayWords(days))}, on ${dateVal(row.insurance_ends_on)}` }
  return { tone: null, pill: '', words: `On file until ${dateVal(row.insurance_ends_on)}` }
}

/** Of the state rows a license could be, the one to read: still on the file, then current, then the one with insurance. */
function pickRow(rows: readonly OwnStateRow[]): OwnStateRow | null {
  const rank = (r: OwnStateRow) => (r.gone_on ? 4 : 0) + (r.status === 'expired' ? 2 : 0) + (r.license_class === 'responsible_master' ? 0 : 1)
  return [...rows].sort((a, b) => rank(a) - rank(b))[0] ?? null
}

const TONE_ORDER: Record<OwnTone, number> = { red: 0, amber: 1, green: 2 }

export type OwnRead = {
  /** A line a plumbing license, the ones that need a look first. */
  lines: OwnLine[]
  /** Licenses of another trade, or of none. They are not checked. */
  otherTrades: number
}

export function ownLines(input: { records: readonly OwnRecord[]; roll: readonly OwnStateRow[]; today: string }): OwnRead {
  const { records, roll, today } = input
  const byKey = new Map<string, OwnStateRow[]>()
  for (const row of roll) {
    const key = `${row.license_class}|${rollNumberKey(row.license_number)}`
    byKey.set(key, [...(byKey.get(key) ?? []), row])
  }

  const lines: OwnLine[] = []
  let otherTrades = 0
  for (const rec of records) {
    const parsed = parseLicenseType(rec.text, rec.expiryYmd)
    if (parsed.trade !== 'plumbing') {
      otherTrades += 1
      continue
    }
    const base = { key: rec.key, licenseId: rec.licenseId, personName: rec.personName, sub: rec.sub, holds: parsed.name || rec.text, number: parsed.number, ourDate: rec.expiryYmd }
    const bare = { stateSays: null, stateName: null, insurance: null, useStateDate: null, needsLook: true } as const
    const numberKey = rollNumberKey(parsed.number)
    if (!numberKey) {
      lines.push({ ...base, ...bare, verdict: 'no_number', tone: 'amber', pill: 'No number', why: 'This license has no number on file, so the state’s roll cannot be checked.' })
      continue
    }
    const classes = rollClassesFor(parsed.cls)
    if (classes.length === 0) {
      lines.push({ ...base, ...bare, verdict: 'no_rank', tone: 'amber', pill: 'No rank', why: 'This license does not say apprentice, tradesman, journeyman or master, so it cannot be looked up.' })
      continue
    }
    const row = pickRow(classes.flatMap((c) => byKey.get(`${c}|${numberKey}`) ?? []))
    if (!row) {
      lines.push({ ...base, ...bare, verdict: 'not_found', tone: 'amber', pill: 'Not on the roll', why: 'The state’s file for this rank holds no license with this number. Each pull looks again.' })
      continue
    }

    const stateName = `${[nameCase(row.last_name), nameCase(row.first_name)].filter(Boolean).join(', ')}${row.county ? ` · ${nameCase(row.county)}` : ''}`
    const lapsedDays = row.expires_on ? ymdDaysBetween(today, row.expires_on) : null
    const lapsed = row.status === 'expired' || (lapsedDays != null && lapsedDays < 0)
    const stateSays = row.expires_on ? `${lapsed ? 'Lapsed on' : 'Current until'} ${dateVal(row.expires_on)}` : lapsed ? 'Lapsed' : 'Current'
    const insurance = insuranceOf(row, today)
    const seen = { stateSays, stateName, insurance }

    if (!stateNameAgrees(rec.personName, row.last_name, row.first_name)) {
      lines.push({ ...base, ...seen, insurance: null, useStateDate: null, needsLook: true, verdict: 'other_name', tone: 'amber', pill: 'Another name', why: 'The state lists this number under another name. Check the number we hold.' })
      continue
    }
    if (row.gone_on) {
      lines.push({ ...base, ...seen, useStateDate: null, needsLook: true, verdict: 'gone', tone: 'red', pill: 'Left the roll', why: `The state’s file stopped listing this license on ${dateVal(row.gone_on)}.` })
      continue
    }

    const differs = rec.licenseId != null && row.expires_on != null && rec.expiryYmd != null && row.expires_on !== rec.expiryYmd
    const useStateDate = differs ? row.expires_on : null
    const stateIsLater = differs && row.expires_on! > rec.expiryYmd!
    let verdict: OwnVerdict
    let tone: OwnTone
    let pill: string
    let why: string | null = null
    if (lapsed) {
      verdict = 'lapsed'
      tone = 'red'
      pill = 'Lapsed'
      why = differs ? `We hold ${dateVal(rec.expiryYmd!)}.` : null
    } else if (differs) {
      verdict = stateIsLater ? 'state_later' : 'state_earlier'
      tone = 'amber'
      pill = stateIsLater ? 'The state has a later date' : 'The state has an earlier date'
    } else if (lapsedDays != null && lapsedDays <= SOON_DAYS) {
      verdict = 'lapses_soon'
      tone = 'amber'
      pill = `Lapses ${daysAwayWords(lapsedDays)}`
    } else {
      verdict = 'matches'
      tone = 'green'
      pill = 'Matches'
    }
    // A license that matches may still carry insurance about to end, and then that is how the line reads.
    const flagged = verdict === 'matches' && insurance?.tone != null ? insurance : null
    lines.push({ ...base, ...seen, useStateDate, verdict, tone: flagged?.tone ?? tone, pill: flagged?.pill ?? pill, why, needsLook: verdict !== 'matches' || insurance?.tone != null })
  }

  lines.sort((a, b) => Number(b.needsLook) - Number(a.needsLook) || TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.personName.localeCompare(b.personName) || a.key.localeCompare(b.key))
  return { lines, otherTrades }
}

/** The chips over the list. */
export type OwnFilter = 'look' | 'matches' | 'all'

export function filterOwnLines(lines: readonly OwnLine[], filter: OwnFilter): OwnLine[] {
  if (filter === 'all') return [...lines]
  return lines.filter((l) => l.needsLook === (filter === 'look'))
}

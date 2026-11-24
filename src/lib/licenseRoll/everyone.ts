/**
 * State roll, the Everyone view and the person's sheet (punch list #411, step three). Pure: the screen reads
 * `license_roll`, `license_roll_changes`, `license_roll_notes` and `license_roll_left_off`, and this says what the
 * chips ask for, how a row and a sheet read, and what each change the pulls saw means in words.
 *
 * Each value in a sentence is marked with `val`, so the screen draws it apart from its words (`ValueSentence`).
 * Everything here is the state's or the app's, so it is plain bold. Our notes are ours, and the sheet draws them.
 */
import type { RollClass } from '../../../supabase/functions/_shared/licenseRoll'
import { formatWorkDateYmdFriendly, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { val } from '../valuesInPlace'
import { nameCase } from './ownLicenses'

/** A row of `license_roll` as Everyone and the sheet read it. */
export type EveryoneRow = {
  id: string
  source: 'tsbpe' | 'tdlr'
  license_class: RollClass
  license_number: string
  status: 'current' | 'expired'
  licensed_on: string | null
  expires_on: string | null
  last_name: string
  first_name: string
  middle_name: string
  suffix: string
  name_key: string
  zip: string
  county: string
  endorsements: string[]
  company: string
  insurance_ends_on: string | null
  ours: boolean
  first_seen_on: string
  gone_on: string | null
}

/** The columns the view and the sheet select, in one place so the two never drift. */
export const EVERYONE_COLUMNS =
  'id, source, license_class, license_number, status, licensed_on, expires_on, last_name, first_name, middle_name, suffix, name_key, zip, county, endorsements, company, insurance_ends_on, ours, first_seen_on, gone_on'

/** A row of `license_roll_changes`. */
export type ChangeRow = { id: string; seen_on: string; kind: string; was: Record<string, unknown>; now_is: Record<string, unknown> }

/** A row of `license_roll_notes`. */
export type NoteRow = {
  id: string
  source: string
  license_class: string
  license_number: string
  name_key: string
  body: string
  noted_by: string | null
  noted_by_name: string
  noted_at: string
}

/** A row of `license_roll_left_off`, as the way back lists it. */
export type LeftOffRow = { id: string; license_number: string | null; shown_as: string; note: string; noted_by_name: string; noted_at: string }

// ── The views ────────────────────────────────────────────────────────────────────────────────────────────────────

export type RollView = 'own' | 'everyone' | 'pulls'

/**
 * The view the address asks for, or the first this person may see. Our own is for a person who may open
 * People → Licenses; anyone else asking for it lands on Everyone.
 */
export function rollViewFor(asked: string | null, canSeeOwn: boolean): RollView {
  if (asked === 'pulls' || asked === 'everyone') return asked
  if (asked === 'own' && canSeeOwn) return 'own'
  return canSeeOwn ? 'own' : 'everyone'
}

// ── The chips ────────────────────────────────────────────────────────────────────────────────────────────────────

export type ClassChip = 'master' | 'journeyman' | 'tradesman'
export type StatusChip = 'current' | 'lapsed'

/** What the chips ask for. One status or none, any of the ranks, and two switches. */
export type EveryoneFilter = { status: StatusChip | null; classes: ClassChip[]; medicalGas: boolean; hasNotes: boolean }

/** The view opens on the current licenses, as the drawing does. */
export const EVERYONE_FIRST_FILTER: EveryoneFilter = { status: 'current', classes: [], medicalGas: false, hasNotes: false }

/** The ranks the chips offer, each with the state's classes it covers. A responsible master is a master. */
export const CLASS_CHIPS: readonly { key: ClassChip; label: string; classes: readonly RollClass[] }[] = [
  { key: 'master', label: 'Master', classes: ['master', 'responsible_master'] },
  { key: 'journeyman', label: 'Journeyman', classes: ['journeyman'] },
  { key: 'tradesman', label: 'Tradesman', classes: ['tradesman'] },
]

/** Every class Everyone shows. The apprentice rows kept are our own people's, and stay on Our own. */
export const EVERYONE_CLASSES: readonly RollClass[] = CLASS_CHIPS.flatMap((c) => c.classes)

/** A status chip pressed: it lights, or goes dark when it was lit. The two never light together. */
export function pickStatus(filter: EveryoneFilter, status: StatusChip): EveryoneFilter {
  return { ...filter, status: filter.status === status ? null : status }
}

/** A rank chip pressed: it joins the ranks asked for, or leaves them. */
export function pickClass(filter: EveryoneFilter, cls: ClassChip): EveryoneFilter {
  const has = filter.classes.includes(cls)
  return { ...filter, classes: has ? filter.classes.filter((c) => c !== cls) : CLASS_CHIPS.map((c) => c.key).filter((k) => k === cls || filter.classes.includes(k)) }
}

/** The state's classes the chips ask for: every class Everyone shows when no rank is lit. */
export function classesAskedFor(filter: EveryoneFilter): RollClass[] {
  if (filter.classes.length === 0) return [...EVERYONE_CLASSES]
  return CLASS_CHIPS.filter((c) => filter.classes.includes(c.key)).flatMap((c) => c.classes)
}

/** The state's status the chips ask for, or null for both. */
export const statusAskedFor = (filter: EveryoneFilter): 'current' | 'expired' | null =>
  filter.status === 'current' ? 'current' : filter.status === 'lapsed' ? 'expired' : null

/** True when nothing but the first filter is on, so an empty list is the roll's own emptiness. */
export const filterIsFirst = (filter: EveryoneFilter): boolean =>
  filter.status === EVERYONE_FIRST_FILTER.status && filter.classes.length === 0 && !filter.medicalGas && !filter.hasNotes

// ── The search ───────────────────────────────────────────────────────────────────────────────────────────────────

/** At most this many words are searched. Each must match a first name, a last name or a license number. */
export const SEARCH_WORDS_MAX = 4

/**
 * The words of a search, safe to put in a filter: letters, digits, an apostrophe and a hyphen. Anything else breaks
 * a word in two. *O'Brien, 4412* is two words.
 */
export function searchWords(q: string): string[] {
  return q
    .split(/[^A-Za-z0-9'-]+/)
    .map((w) => w.replace(/^[-']+|[-']+$/g, ''))
    .filter((w) => w.length > 0)
    .slice(0, SEARCH_WORDS_MAX)
}

/** One word's filter: it matches a last name, a first name or a license number anywhere in it, in any case. */
export function searchWordFilter(word: string): string {
  return ['last_name', 'first_name', 'license_number'].map((col) => `${col}.ilike.*${word}*`).join(',')
}

// ── A row ────────────────────────────────────────────────────────────────────────────────────────────────────────

const ROMAN = /^(?:i{1,3}|iv|v|vi{1,3}|ix|x)$/i

/** A suffix as a person writes it: *III* stays capitals, *JR* reads *Jr*. */
const suffixWords = (suffix: string): string => (ROMAN.test(suffix.trim()) ? suffix.trim().toUpperCase() : nameCase(suffix.trim()))

/** *Pat Q. Sample Jr*: the state's capitals in a person's case, first name first. */
export function personName(row: Pick<EveryoneRow, 'first_name' | 'middle_name' | 'last_name' | 'suffix'>): string {
  const middle = row.middle_name.trim()
  const parts = [nameCase(row.first_name.trim()), nameCase(middle.length === 1 ? `${middle}.` : middle), nameCase(row.last_name.trim()), suffixWords(row.suffix)].filter(Boolean)
  return parts.join(' ') || 'No name on the state’s row'
}

const COMPANY_CAPS = new Set(['llc', 'llp', 'lp', 'pc', 'pllc', 'dba', 'usa', 'hvac', 'ii', 'iii', 'iv'])
const COMPANY_SMALL = new Set(['and', 'of', 'the', 'a', 'an', 'in', 'at', 'for', 'on', 'by'])

/** A company in the state's capitals as a person writes it: *Example Plumbing and Mechanical of Texas LLC*. */
export function companyWords(company: string): string {
  return company
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const bare = w.toLowerCase().replace(/[^a-z]/g, '')
      if (COMPANY_CAPS.has(bare)) return w.toUpperCase()
      if (i > 0 && COMPANY_SMALL.has(bare)) return w.toLowerCase()
      return nameCase(w)
    })
    .join(' ')
}

/** The first name alone, for a press: *Leave Pat off*. */
export const firstName = (row: Pick<EveryoneRow, 'first_name' | 'middle_name' | 'last_name' | 'suffix'>): string =>
  nameCase(row.first_name.trim()) || personName(row)

const CLASS_WORDS: Record<string, string> = {
  apprentice: 'Apprentice',
  tradesman: 'Tradesman',
  journeyman: 'Journeyman',
  master: 'Master',
  responsible_master: 'Responsible master',
  registered_tech: 'Registered technician',
  certified_tech: 'Certified technician',
  contractor: 'Contractor',
}

/** The rank in a person's words: *Journeyman*, *Responsible master*. */
export const classWords = (cls: string): string => CLASS_WORDS[cls] ?? nameCase(cls.replace(/_/g, ' '))

const ENDORSEMENT_WORDS: Record<string, string> = {
  medical_gas: 'Medical gas',
  fire_sprinkler: 'Fire sprinkler',
  water_supply: 'Water supply protection',
  drain_cleaner: 'Drain cleaner',
  drain_cleaner_restricted: 'Drain cleaner, restricted',
  utilities_installer: 'Utilities installer',
}

/** An endorsement in a person's words. */
export const endorsementWords = (e: string): string => ENDORSEMENT_WORDS[e] ?? nameCase(e.replace(/_/g, ' '))

/** The Since column: the year, or the month and day when it was this year. */
export function sinceWords(licensedOn: string | null, today: string): string {
  if (!licensedOn) return 'Not given'
  return licensedOn.slice(0, 4) === today.slice(0, 4) ? formatWorkDateYmdMonthDayShort(licensedOn) : licensedOn.slice(0, 4)
}

/** The Expires column: the day, or *Not given*. */
export const expiresWords = (expiresOn: string | null): string => (expiresOn ? formatWorkDateYmdFriendly(expiresOn) : 'Not given')

/** The county in a person's case: *Guadalupe*. */
export const countyWords = (county: string): string => nameCase(county) || 'Not given'

/** The key our notes are counted by: the license's source and number. */
export const noteKey = (source: string, number: string): string => `${source}|${number.trim().toUpperCase()}`

/** A tag in the Ours column. */
export type OursTag = { label: string; tone: 'grey' | 'green' }

/**
 * What we have on a row: our notes, and whether the license is one of ours. *One of ours* is drawn only for a
 * person who may open People → Licenses, as Our own is.
 */
export function oursTags(row: Pick<EveryoneRow, 'ours'>, notes: number, canSeeOwn: boolean): OursTag[] {
  const tags: OursTag[] = []
  if (notes > 0) tags.push({ label: notes === 1 ? '1 note' : `${notes} notes`, tone: 'grey' })
  if (row.ours && canSeeOwn) tags.push({ label: 'One of ours', tone: 'green' })
  return tags
}

/** Our notes counted by license, from the note rows' keys. */
export function noteCounts(notes: readonly Pick<NoteRow, 'source' | 'license_number'>[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const n of notes) {
    const k = noteKey(n.source, n.license_number)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

/** The license numbers that carry a note, for the Has our notes chip. */
export const notedNumbers = (notes: readonly Pick<NoteRow, 'license_number'>[]): string[] => [...new Set(notes.map((n) => n.license_number))].sort()

// ── The sheet ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The state's facts, one a line, each a value. */
export function sheetFacts(row: EveryoneRow, today: string): { label: string; text: string }[] {
  const lapsed = row.status === 'expired'
  const lines = [
    { label: 'License', text: `${val('class', classWords(row.license_class))} plumber` },
    { label: 'Number', text: val('number', row.license_number) },
    { label: 'Status', text: row.gone_on ? `Missing from the state’s file since ${val('day', formatWorkDateYmdFriendly(row.gone_on))}` : val('status', lapsed ? 'Lapsed' : 'Current') },
    { label: 'Licensed', text: row.licensed_on ? val('day', formatWorkDateYmdFriendly(row.licensed_on)) : 'Not given' },
    { label: lapsed ? 'Expired' : 'Expires', text: row.expires_on ? val('day', formatWorkDateYmdFriendly(row.expires_on)) : 'Not given' },
    { label: 'Lives in', text: [row.county ? `${val('county', countyWords(row.county))} County` : '', row.zip ? val('zip', row.zip.slice(0, 5)) : ''].filter(Boolean).join(', ') || 'Not given' },
    { label: 'Endorsements', text: row.endorsements.length > 0 ? row.endorsements.map((e) => val('endorsement', endorsementWords(e))).join(', ') : 'None' },
  ]
  if (row.company.trim()) lines.push({ label: 'Company', text: val('company', companyWords(row.company)) })
  if (row.insurance_ends_on) {
    const past = row.insurance_ends_on < today
    lines.push({ label: 'Insurance', text: `On file with the board ${past ? 'ended' : 'until'} ${val('day', formatWorkDateYmdFriendly(row.insurance_ends_on))}` })
  }
  return lines
}

const dayVal = (v: unknown): string => (typeof v === 'string' && v ? val('day', formatWorkDateYmdFriendly(v)) : 'a day not given')
const placeWords = (side: Record<string, unknown>): string => {
  const county = typeof side.county === 'string' ? countyWords(side.county) : ''
  const zip = typeof side.zip === 'string' ? side.zip.slice(0, 5) : ''
  return county && county !== 'Not given' ? county : zip ? `ZIP ${zip}` : 'no place given'
}
const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const nameFrom = (side: Record<string, unknown>): string =>
  personName({ first_name: String(side.first_name ?? ''), middle_name: String(side.middle_name ?? ''), last_name: String(side.last_name ?? ''), suffix: String(side.suffix ?? '') })

/** One change a pull saw, in words. `firstPullDay` is the day of our first pull, when the roll began. */
export function changeWords(change: Pick<ChangeRow, 'kind' | 'seen_on' | 'was' | 'now_is'>, firstPullDay: string | null): string {
  const { was, now_is: now } = change
  switch (change.kind) {
    case 'first_seen':
      return change.seen_on === firstPullDay ? 'First seen on the roll, on our first pull.' : 'New on the roll.'
    case 'renewed':
      return `Renewed. Expires ${dayVal(now.expires_on)}.`
    case 'lapsed':
      return `Lapsed. It expired ${dayVal(now.expires_on ?? was.expires_on)}.`
    case 'current_again':
      return `Current again. Expires ${dayVal(now.expires_on)}.`
    case 'moved':
      return `Moved from ${val('place', placeWords(was))} to ${val('place', placeWords(now))}.`
    case 'endorsement': {
      const before = listOf(was.endorsements)
      const after = listOf(now.endorsements)
      const gained = after.filter((e) => !before.includes(e)).map((e) => val('endorsement', endorsementWords(e)))
      const lost = before.filter((e) => !after.includes(e)).map((e) => val('endorsement', endorsementWords(e)))
      const parts = [gained.length ? `Gained ${gained.join(', ')}.` : '', lost.length ? `Lost ${lost.join(', ')}.` : ''].filter(Boolean)
      return parts.join(' ') || 'The endorsements changed.'
    }
    case 'named':
      return `The state’s name changed from ${val('name', nameFrom(was))} to ${val('name', nameFrom(now))}.`
    case 'gone':
      return 'Missing from the state’s file.'
    case 'back':
      return 'Back on the state’s file.'
    default:
      return 'Changed on the state’s file.'
  }
}

/** The line of history, newest first, each with its day. */
export function historyLines(changes: readonly ChangeRow[], firstPullDay: string | null): { id: string; day: string; text: string }[] {
  return [...changes]
    .sort((a, b) => (a.seen_on < b.seen_on ? 1 : a.seen_on > b.seen_on ? -1 : a.id < b.id ? 1 : -1))
    .map((c) => ({ id: c.id, day: formatWorkDateYmdFriendly(c.seen_on), text: changeWords(c, firstPullDay) }))
}

/** A note on the sheet: on this license, or on another license with the same name and ZIP, which is a match to check. */
export type SheetNote = NoteRow & { onAnotherLicense: boolean }

/**
 * The notes the sheet shows, newest first. A note on this number is this person's. A note under the same name and ZIP
 * on another number is most likely them at another rank, so it shows, marked as written on another license.
 */
export function sheetNotes(row: Pick<EveryoneRow, 'source' | 'license_number' | 'name_key'>, notes: readonly NoteRow[]): SheetNote[] {
  const mine = noteKey(row.source, row.license_number)
  const seen = new Set<string>()
  const out: SheetNote[] = []
  for (const n of notes) {
    if (seen.has(n.id)) continue
    const onThis = noteKey(n.source, n.license_number) === mine
    const sameName = row.name_key !== '' && n.name_key === row.name_key
    if (!onThis && !sameName) continue
    seen.add(n.id)
    out.push({ ...n, onAnotherLicense: !onThis })
  }
  return out.sort((a, b) => (a.noted_at < b.noted_at ? 1 : a.noted_at > b.noted_at ? -1 : 0))
}

/** The longest note kept, as the table holds it. */
export const NOTE_MAX = 2000

/** A note's words as they will be kept, or why they cannot be. */
export function noteDraft(text: string): { ok: true; body: string } | { ok: false; why: string } {
  const body = text.trim()
  if (!body) return { ok: false, why: 'Write the note first.' }
  if (body.length > NOTE_MAX) return { ok: false, why: `A note holds ${NOTE_MAX.toLocaleString('en-US')} characters at most.` }
  return { ok: true, body }
}

/** The confirm Leave off asks, naming the act and the way back. */
export function leaveOffAsk(row: EveryoneRow): { title: string; message: string; confirmLabel: string } {
  const name = personName(row)
  return {
    title: `Leave ${name} off the roll?`,
    message: `Use this when ${name} asks not to be listed. Their rows come off now and no pull brings them back. Their line of history goes. Our notes stay. Put back on the list undoes it from the next pull.`,
    confirmLabel: `Leave ${firstName(row)} off`,
  }
}

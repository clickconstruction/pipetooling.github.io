/**
 * Research, everything public (punch list #302): the pure steps behind the two sheets a permit
 * opens. The Google search a name or an address asks for, the feed's own row as lines a person
 * can read, the other permits on one address, the other permits one name pulled, and the public
 * doors a county and the state keep. No React, no Supabase.
 */
import { builderKeyOf, contactParts } from '../../../supabase/functions/_shared/permitLookup'

/** A Google search opened in a new tab: what is asked, and the words a screen reader and a hover say. */
export type GoogleAsk = { query: string; url: string; label: string }

/** A name inside a quoted search: its own quotes dropped, its spaces evened. */
function quoted(text: string): string {
  return `"${text.replace(/"/g, '').replace(/\s+/g, ' ').trim()}"`
}

function clean(text: string | null | undefined): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t === '' ? null : t
}

export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

function ask(query: string, what: string): GoogleAsk {
  return { query, url: googleSearchUrl(query), label: `Search Google for ${what}` }
}

/** A company is searched by its name and its city, so a common name finds the local one. */
export function googleAskForCompany(company: string | null | undefined, city: string | null | undefined): GoogleAsk | null {
  const name = clean(company)
  if (!name) return null
  const place = clean(city)
  return ask([quoted(name), place ? `${place} TX` : null].filter(Boolean).join(' '), name)
}

/** A person is searched with their company when the permit names one, else with the city. */
export function googleAskForPerson(person: string | null | undefined, company: string | null | undefined, city: string | null | undefined): GoogleAsk | null {
  const name = clean(person)
  if (!name) return null
  const firm = clean(company)
  const place = clean(city)
  const tail = firm ? quoted(firm) : place ? `${place} TX` : null
  return ask([quoted(name), tail].filter(Boolean).join(' '), name)
}

/** An address is searched with its city and zip. */
export function googleAskForAddress(address: string | null | undefined, city: string | null | undefined, zip: string | null | undefined): GoogleAsk | null {
  const street = clean(address)
  if (!street) return null
  const place = clean(city)
  return ask([quoted(street), place ? `${place} TX` : null, clean(zip)].filter(Boolean).join(' '), street)
}

/** The searches a permit's contact line offers: the company first, then the person. */
export function googleAsksForContact(contact: string | null | undefined, city: string | null | undefined): { company: GoogleAsk | null; person: GoogleAsk | null } {
  const { person, company } = contactParts(contact)
  return { company: googleAskForCompany(company, city), person: googleAskForPerson(person, company, city) }
}

/** One line of the feed's own row. */
export type FeedField = { label: string; value: string }

/** The feed's columns in the order a reader wants them; any other column follows, by name. */
const FEED_ORDER = ['PERMIT TYPE', 'PERMIT #', 'PROJECT NAME', 'WORK TYPE', 'ADDRESS', 'LOCATION', 'DATE SUBMITTED', 'DATE ISSUED', 'DECLARED VALUATION', 'AREA (SF)', 'PRIMARY CONTACT']
const FEED_LABELS: Record<string, string> = {
  'PERMIT #': 'Permit number',
  'AREA (SF)': 'Area, sq ft',
  'DECLARED VALUATION': 'Declared value',
  'DATE SUBMITTED': 'Submitted',
  'DATE ISSUED': 'Issued',
  X_COORD: 'Map point, x',
  Y_COORD: 'Map point, y',
}

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function feedLabel(key: string): string {
  const known = FEED_LABELS[key]
  if (known) return known
  const words = key.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function feedValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') {
    const json = JSON.stringify(value)
    return json === '{}' || json === '[]' ? null : json
  }
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (text === '') return null
  // A feed day, with or without its midnight: "2026-11-06T00:00:00" reads "Nov 6, 2026".
  const day = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+)?$/)
  if (day) {
    const d = new Date(`${day[1]}-${day[2]}-${day[3]}T12:00:00Z`)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }
  if (/VALUATION|VALUE|COST|FEE/i.test(key)) {
    const n = Number(text.replace(/[$,]/g, ''))
    if (Number.isFinite(n)) return usd0.format(n)
  }
  if (/\(SF\)|SQ ?FT|AREA/i.test(key)) {
    const n = Number(text.replace(/,/g, ''))
    if (Number.isFinite(n)) return Math.round(n).toLocaleString('en-US')
  }
  return text
}

/**
 * Every column the city's feed sent for one permit, as lines: the known columns first in a
 * reader's order, the rest by name, an empty one left out, the feed's own row id left out.
 */
export function feedRowFields(raw: unknown): FeedField[] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return []
  const record = raw as Record<string, unknown>
  const keys = Object.keys(record).filter((k) => !k.startsWith('_'))
  const rank = (k: string): number => {
    const i = FEED_ORDER.indexOf(k)
    return i === -1 ? FEED_ORDER.length : i
  }
  keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  const out: FeedField[] = []
  for (const key of keys) {
    const value = feedValue(key, record[key])
    if (value !== null) out.push({ label: feedLabel(key), value })
  }
  return out
}

/** A permit as the two lists read it off `permits`. */
export type SitePermit = {
  id: string
  permit_number: string
  permit_type: string
  kind: string
  stage: string
  work_type: string | null
  submitted_on: string | null
  issued_on: string | null
  contact: string | null
  address: string | null
  declared_value: number | null
}

/** One line of a permit list: the day, what it is, who pulled it, and whether it is the permit the sheet opened on. */
export type PermitLine = { id: string; day: string | null; what: string; who: string | null; where: string | null; kind: string; self: boolean }

function lineOf(p: SitePermit, selfId: string | null): PermitLine {
  const what = clean(p.work_type) ?? clean(p.permit_type) ?? 'Permit'
  return {
    id: p.id,
    day: p.issued_on ?? p.submitted_on,
    what: p.stage === 'applied' ? `${what}, applied` : what,
    who: clean(p.contact),
    where: clean(p.address),
    kind: p.kind,
    self: p.id === selfId,
  }
}

function newestFirst(a: PermitLine, b: PermitLine): number {
  return (b.day ?? '').localeCompare(a.day ?? '') || a.what.localeCompare(b.what)
}

/** Every permit on one address or one number, newest first, each once. */
export function sitePermitLines(rows: readonly SitePermit[], selfId: string | null): PermitLine[] {
  const seen = new Set<string>()
  const out: PermitLine[] = []
  for (const p of rows) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(lineOf(p, selfId))
  }
  return out.sort(newestFirst)
}

/** The sentence over the site's list: how many, and whether a plumbing permit is among them. */
export function siteWords(lines: readonly PermitLine[]): string {
  const n = lines.length
  if (n === 0) return 'The feed holds this permit alone on this address.'
  const plumbing = lines.some((l) => l.kind === 'plumbing')
  const count = n === 1 ? 'This is the one permit the feed holds on this address.' : `The feed holds ${n} permits on this address.`
  return plumbing ? `${count} A plumbing permit is among them.` : `${count} A plumbing permit is not among them yet.`
}

/** The key a builder's permits are matched on: the company when the line names one, else the person. */
export function builderKey(contact: string | null | undefined): string | null {
  return builderKeyOf(contact)
}

const DULL_WORDS = new Set(['the', 'and', 'of', 'llc', 'inc', 'ltd', 'llp', 'pllc', 'corp', 'co', 'company', 'incorporated', 'group'])

/**
 * The one word asked of the table to find a name's other permits: the first word of the company
 * (or the person) that is not a suffix, letters and digits only, so it is safe inside a pattern.
 * The rows that come back are held to the whole name by `builderPermitLines`.
 */
export function builderSearchWord(contact: string | null | undefined): string | null {
  const { person, company } = contactParts(contact)
  const words = ((company ?? person ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !DULL_WORDS.has(w))
  return words.find((w) => w.length >= 3) ?? words[0] ?? null
}

/** The other building permits the same name pulled, newest first: the candidates held to the name's own key. */
export function builderPermitLines(rows: readonly SitePermit[], contact: string | null | undefined, selfId: string | null): PermitLine[] {
  const key = builderKey(contact)
  if (!key) return []
  const seen = new Set<string>()
  const out: PermitLine[] = []
  for (const p of rows) {
    if (seen.has(p.id) || p.id === selfId) continue
    if (builderKey(p.contact) !== key) continue
    seen.add(p.id)
    out.push(lineOf(p, selfId))
  }
  return out.sort(newestFirst)
}

/**
 * The sentence over a name's other permits. It says what we can see, never what a name did: the
 * records are one city's from one day on, and `reach` (`reachWords` in `permitReach.ts`) is how
 * far back they go — "since Aug 26", "in the last year", or null when that is not known.
 */
export function builderWords(lines: readonly PermitLine[], reach: string | null): string {
  const n = lines.length
  const tail = reach ? ` ${reach}` : ''
  if (n === 0) return `This is the one permit we can see under this name${tail}.`
  return `This name is on ${n} other permit${n === 1 ? '' : 's'} we can see${tail}.`
}

/** How far back a name's other permits are read. */
export const BUILDER_PERMIT_DAYS = 365

/** The public doors a county and the state keep. Each is a search page a person fills in. */
export const BEXAR_CLERK_RECORDS = 'https://bexar.tx.publicsearch.us/'
export const TEXAS_FRANCHISE_SEARCH = 'https://comptroller.texas.gov/taxes/franchise/account-status/search'

/** The county clerk's deed search for a city the county serves, or null where no door is known. */
export function deedsDoor(city: string | null | undefined): string | null {
  return clean(city)?.toLowerCase() === 'san antonio' ? BEXAR_CLERK_RECORDS : null
}

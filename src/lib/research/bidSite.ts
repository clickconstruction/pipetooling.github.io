/**
 * Bids and permits (punch list #307, PR 1): a bid's address read the way a city's permit feed
 * writes one, so the bid can be asked "what does the city hold on this site?". A bid's address is
 * one line of free text; the feed's is a street with no suite, sometimes with the street type
 * spelled out, sometimes with none, a highway by its number alone (Loop 1604 is "n 1604 w"). So
 * neither side is trusted to be tidy: both are read into the same shape (the house number, the
 * street's words in any order, the street type when there is one) and compared there. Exact on
 * that shape and nothing fuzzier — a wrong join is worse than a missed one.
 *
 * Every line this file writes says what we can see, never what a builder did: the city, the
 * first day of the records, "seen", "on this address". No React, no Supabase.
 */
import { daysBetween } from './permitSkim'
import { reachDay } from './permitReach'

/** An address in the shape both sides are compared in. */
export type SiteCanon = {
  /** The house number as written, lower-case: "4120", "100b". */
  number: string
  /** The street's words, abbreviated the feed's way and sorted, with route words and the type left out. */
  words: string[]
  /** The street type (st, rd, pkwy …) when the address carries one. The feed often carries none. */
  type: string | null
}

export type UnreadableWhy = 'empty' | 'no_number' | 'no_street' | 'crossing' | 'no_city'

export type BidSite =
  /** A street address in a city whose permits we read. `number` is what a read asks the table for. */
  | { kind: 'site'; city: string; number: string; street: string; canon: SiteCanon }
  /** A town whose permits we do not read. Null when the line names a state or a zip and no town we can pick out. */
  | { kind: 'not_read'; town: string | null }
  /** Not a street address a permit could sit on. */
  | { kind: 'unreadable'; why: UnreadableWhy; reads: string }

const STATES = new Set('al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc'.split(' '))

const DIRECTIONS: Record<string, string> = { north: 'n', south: 's', east: 'e', west: 'w', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw' }
const DIRECTION_SET = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])

/** Street types, long form to the feed's usual short one. */
const TYPES: Record<string, string> = {
  street: 'st', avenue: 'ave', av: 'ave', boulevard: 'blvd', drive: 'dr', road: 'rd', parkway: 'pkwy', pky: 'pkwy',
  lane: 'ln', court: 'ct', circle: 'cir', place: 'pl', trail: 'trl', terrace: 'ter', expressway: 'expy', freeway: 'fwy',
  square: 'sq', way: 'way', cove: 'cv', crossing: 'xing', pass: 'pass', run: 'run', path: 'path', row: 'row',
}
const TYPE_SET = new Set(Object.values(TYPES))

/** Words that name a kind of route and add nothing once the number is there: "US Hwy 281" is 281. */
const ROUTE_WORDS = new Set(['us', 'state', 'sh', 'tx', 'texas', 'hwy', 'highway', 'ih', 'i', 'interstate', 'loop'])
const SIDE_ROAD_WORDS = new Set(['frontage', 'access', 'service', 'feeder'])
const UNIT_WORDS = '(?:suite|ste|unit|apt|bldg|building|space|spc|lot|room|floor)'
const CROSSING_WORDS = new Set(['and', 'at', '&', '@'])

const isNumber = (t: string | undefined): boolean => t != null && /^\d+$/.test(t)

/** The words of a street, after the house number: lower-case, the feed's short forms, route and side-road words dropped. */
function streetTokens(rest: string): string[] {
  const raw = rest
    .toLowerCase()
    .replace(/\./g, '')
    // The feed writes a farm road as "fm 471".
    .replace(/\bfarm\s+to\s+market(\s+r(oa)?d)?\b/g, 'fm')
    .replace(/\branch\s+to\s+market(\s+r(oa)?d)?\b/g, 'rm')
    .replace(/[-/]/g, ' ')
    .split(/[^a-z0-9&@]+/)
    .filter(Boolean)
    // "ih35" and "i35" are two words.
    .flatMap((t) => {
      const m = t.match(/^(ih|i|fm|us|sh|tx)(\d+)$/)
      return m ? [m[1] as string, m[2] as string] : [t]
    })
  const out: string[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const t = raw[i] as string
    const next = raw[i + 1]
    if (ROUTE_WORDS.has(t) && (isNumber(next) || (next != null && ROUTE_WORDS.has(next)))) continue
    if (SIDE_ROAD_WORDS.has(t)) {
      if (next === 'rd' || next === 'road') i += 1
      continue
    }
    out.push(DIRECTIONS[t] ?? TYPES[t] ?? t)
  }
  return out
}

/** The street's own type: its last type word, when only a direction may follow it ("main st e"). */
function splitType(tokens: readonly string[]): { words: string[]; type: string | null } {
  for (let i = tokens.length - 1; i >= 1; i -= 1) {
    const t = tokens[i] as string
    if (TYPE_SET.has(t)) return { words: [...tokens.slice(0, i), ...tokens.slice(i + 1)], type: t }
    if (!DIRECTION_SET.has(t)) break
  }
  return { words: [...tokens], type: null }
}

/** A street line ("4120 Mill Street", a feed's "4120 mill st") in the shape both sides compare in, or null when it has no house number or no street. */
export function canonOfStreet(street: string | null | undefined): SiteCanon | null {
  const line = (street ?? '').replace(/\s+/g, ' ').trim()
  const m = line.match(/^(\d+[a-z]?)(?:\s*-\s*\d+)?\s+(.+)$/i)
  if (!m) return null
  const { words, type } = splitType(streetTokens(m[2] as string))
  if (words.length === 0) return null
  return { number: (m[1] as string).toLowerCase(), words: [...words].sort(), type }
}

/** Two addresses are one site: the same number, the same street words, and the same type when both carry one. */
export function sameSite(a: SiteCanon, b: SiteCanon): boolean {
  if (a.number !== b.number) return false
  if (a.words.length !== b.words.length || a.words.some((w, i) => w !== b.words[i])) return false
  return a.type == null || b.type == null || a.type === b.type
}

/** The town a line names, when it can be picked out: the part after the last comma, else the words after the street's type or route number. */
function townOf(head: string): string | null {
  const clean = (t: string) => {
    const town = t.replace(/^(tx|texas)\s+/i, '').replace(/\s+/g, ' ').trim()
    // A crossing's second street is not a town: "Loop 1604 at Oak Hollow".
    const crossing = town.toLowerCase().split(' ').some((w) => CROSSING_WORDS.has(w))
    return town !== '' && !/\d/.test(town) && !crossing ? town : null
  }
  if (head.includes(',')) return clean(head.slice(head.lastIndexOf(',') + 1))
  const tokens = head.split(' ')
  for (let i = tokens.length - 1; i >= 1; i -= 1) {
    const t = (tokens[i] as string).toLowerCase().replace(/\./g, '')
    const before = (tokens[i - 1] ?? '').toLowerCase().replace(/\./g, '')
    const endsStreet = TYPE_SET.has(TYPES[t] ?? t) || (isNumber(t) && (ROUTE_WORDS.has(before) || before === 'fm' || before === 'rm'))
    if (!endsStreet) continue
    let rest = tokens.slice(i + 1)
    if (rest.length > 0 && DIRECTION_SET.has(DIRECTIONS[(rest[0] as string).toLowerCase()] ?? (rest[0] as string).toLowerCase())) rest = rest.slice(1)
    return clean(rest.join(' '))
  }
  return null
}

/**
 * A bid's address line as a site we can ask a city about, a town we do not read, or the reason
 * it is not a street address. `readCities` are the cities whose permits are pulled.
 */
export function readBidAddress(address: string | null | undefined, readCities: readonly string[]): BidSite {
  const reads = (address ?? '').replace(/\s+/g, ' ').trim()
  if (reads === '') return { kind: 'unreadable', why: 'empty', reads }

  // The tail: a zip, then a state.
  let head = reads.replace(/[\s,]+$/, '')
  const zip = head.match(/[\s,]\d{5}(?:-\d{4})?$/)
  if (zip) head = head.slice(0, zip.index).replace(/[\s,]+$/, '')
  let state: string | null = null
  const st = head.match(/[\s,](texas|[a-z]{2})\.?$/i)
  if (st) {
    const code = (st[1] as string).toLowerCase() === 'texas' ? 'tx' : (st[1] as string).toLowerCase()
    // "Ct" and "Ne" are a court and a northeast before they are states: those two need their comma.
    const alsoStreetWord = TYPE_SET.has(code) || DIRECTION_SET.has(code)
    const counts = code === 'tx' || (STATES.has(code) && (st[0].startsWith(',') || (zip != null && !alsoStreetWord)))
    if (counts) {
      state = code
      head = head.slice(0, st.index).replace(/[\s,]+$/, '')
    }
  }
  if (state != null && state !== 'tx') return { kind: 'not_read', town: townOf(head) }

  // The city: the line ends on it, so "123 Austin Hwy San Antonio" is San Antonio.
  const lower = head.toLowerCase()
  const city = [...readCities].sort((a, b) => b.length - a.length).find((c) => new RegExp(`(^|[\\s,])${c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).test(lower))
  if (!city) {
    const town = townOf(head)
    if (town != null || state != null || zip != null) return { kind: 'not_read', town }
    return { kind: 'unreadable', why: /^\d/.test(head) ? 'no_city' : 'no_number', reads }
  }

  // The street: before the city, before the first comma, before a suite or a building.
  const streetPart = (head.slice(0, head.length - city.length).replace(/[\s,]+$/, '').split(',')[0] ?? '')
    .replace(new RegExp(`\\s+(?:${UNIT_WORDS}\\b|#).*$`, 'i'), '')
    .trim()
  if (streetPart === '') return { kind: 'unreadable', why: 'no_number', reads }
  const m = streetPart.match(/^(\d+[a-z]?)(?:\s*-\s*\d+)?(?:\s+(.*))?$/i)
  if (!m) return { kind: 'unreadable', why: 'no_number', reads }
  const rest = (m[2] ?? '').trim()
  if (rest === '') return { kind: 'unreadable', why: 'no_street', reads }
  if (rest.toLowerCase().split(/\s+/).some((t) => CROSSING_WORDS.has(t))) return { kind: 'unreadable', why: 'crossing', reads }
  const canon = canonOfStreet(streetPart)
  if (!canon) return { kind: 'unreadable', why: 'no_street', reads }
  return { kind: 'site', city, number: canon.number, street: streetPart, canon }
}

/** What the kernel needs of a permit: the feed's street, what it is, its days, the project name and who the city lists. */
export type BidSitePermit = {
  id: string
  address: string | null
  kind: string
  stage: string
  permit_type: string
  project_name: string | null
  submitted_on: string | null
  issued_on: string | null
  contact: string | null
}

/** The permits of one city that sit on a bid's site. A read narrows by the house number; this decides. */
export function permitsOnSite<P extends Pick<BidSitePermit, 'address'>>(site: BidSite, permits: readonly P[]): P[] {
  if (site.kind !== 'site') return []
  return permits.filter((p) => {
    const canon = canonOfStreet(p.address)
    return canon != null && sameSite(site.canon, canon)
  })
}

export type PlumbingType = 'general' | 'gas' | 'irrigation' | 'sewer' | 'other'

/** The feed files irrigation, gas and sewer under plumbing. Only a general plumbing permit says a plumber has the building's work. */
export function plumbingTypeOf(permitType: string | null | undefined): PlumbingType | null {
  const t = (permitType ?? '').toLowerCase()
  if (!/^(lsr )?plumbing\b/.test(t)) return null
  if (t.includes('irrigation')) return 'irrigation'
  if (t.includes('gas')) return 'gas'
  if (t.includes('sewer')) return 'sewer'
  if (t.includes('general')) return 'general'
  return 'other'
}

/** Words a project name carries that say nothing about which project it is. */
const DULL = new Set([
  'the', 'and', 'for', 'new', 'bldg', 'building', 'buildings', 'suite', 'unit', 'phase', 'shell', 'tenant', 'finish', 'finishout', 'remodel',
  'renovation', 'addition', 'interior', 'commercial', 'project', 'retail', 'store', 'office', 'offices', 'center', 'centre', 'plaza', 'texas',
  'llc', 'inc', 'san', 'antonio', 'austin', 'street', 'road', 'drive', 'north', 'south', 'east', 'west', 'copy', 'shadow', 'twin', 'backtest',
])

function tellingWords(name: string | null | undefined): Set<string> {
  return new Set(((name ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 4 && !DULL.has(w) && !/^\d+$/.test(w)))
}

/**
 * A hint, not a fact: the permit's project name shares a telling word with the bid's. A shared
 * address can carry another tenant's permit, so the list still shows every permit on it.
 */
export function looksLikeThisJob(bidProjectName: string | null | undefined, permitProjectName: string | null | undefined): boolean {
  const bid = tellingWords(bidProjectName)
  if (bid.size === 0) return false
  for (const w of tellingWords(permitProjectName)) if (bid.has(w)) return true
  return false
}

const dayOf = (p: Pick<BidSitePermit, 'issued_on' | 'submitted_on'>): string => p.issued_on ?? p.submitted_on ?? ''
const newestFirst = (a: BidSitePermit, b: BidSitePermit): number => dayOf(b).localeCompare(dayOf(a))

/** The permit the verdict speaks of: the newest that looks like this job, else the newest building permit, else the newest. */
export function leadPermit<P extends BidSitePermit>(bidProjectName: string | null | undefined, onSite: readonly P[]): P | null {
  const sorted = [...onSite].sort(newestFirst)
  return sorted.find((p) => p.kind === 'building' && looksLikeThisJob(bidProjectName, p.project_name)) ?? sorted.find((p) => p.kind === 'building') ?? sorted[0] ?? null
}

/** Which of the four honest states a bid's site is in. None of them reads as "no permits". */
export type BidSiteState = 'found' | 'none_seen' | 'not_read' | 'unreadable'

export function bidSiteState(site: BidSite, onSiteCount: number): BidSiteState {
  if (site.kind === 'unreadable') return 'unreadable'
  if (site.kind === 'not_read') return 'not_read'
  return onSiteCount > 0 ? 'found' : 'none_seen'
}

function agoWords(days: number | null): string {
  if (days == null) return ''
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function citiesWords(cities: readonly string[]): string {
  if (cities.length <= 1) return cities[0] ?? 'no city yet'
  return `${cities.slice(0, -1).join(', ')} and ${cities[cities.length - 1]}`
}

const UNREADABLE_WORDS: Record<UnreadableWhy, string> = {
  empty: 'This bid has no address, so permits cannot be looked up.',
  no_number: 'This bid’s address has no street number, so permits cannot be looked up.',
  no_street: 'This bid’s address has no street name, so permits cannot be looked up.',
  crossing: 'This bid’s address is a crossing, not a street number, so permits cannot be looked up.',
  no_city: 'This bid’s address names no city, so permits cannot be looked up.',
}

/**
 * The verdict line over a bid's site and the line under it. `onSite` is `permitsOnSite`'s answer;
 * `recordsStartYmd` is the day the city's records start (`loadRecordsStart`), null when not known.
 */
export function bidSiteWords(
  site: BidSite,
  bidProjectName: string | null | undefined,
  onSite: readonly BidSitePermit[],
  ctx: { todayYmd: string; recordsStartYmd: string | null; readCities: readonly string[] },
): { state: BidSiteState; main: string; detail: string | null } {
  const state = bidSiteState(site, onSite.length)
  if (site.kind === 'unreadable') return { state, main: UNREADABLE_WORDS[site.why], detail: site.reads === '' ? null : `It reads: ${site.reads}.` }
  if (site.kind === 'not_read') {
    return { state, main: site.town ? `No permit records for ${site.town}.` : 'No permit records for this town.', detail: `Permits are read for ${citiesWords(ctx.readCities)} only.` }
  }
  if (onSite.length === 0) {
    const since = ctx.recordsStartYmd ? ` since ${reachDay(ctx.recordsStartYmd, ctx.todayYmd)}` : ''
    return { state, main: `No permit seen on ${site.street}${since}.`, detail: 'The city’s records run 2 to 3 days behind. A site outside the city limits files elsewhere.' }
  }
  const lead = leadPermit(bidProjectName, onSite)
  const parts: string[] = []
  if (lead && lead.kind === 'building') {
    if (lead.stage === 'applied') {
      const ago = agoWords(daysBetween(lead.submitted_on, ctx.todayYmd))
      parts.push('The city has a permit application on this address.', ago ? `Filed ${ago}, not issued yet.` : 'Not issued yet.')
    } else {
      const ago = agoWords(daysBetween(lead.issued_on ?? lead.submitted_on, ctx.todayYmd))
      parts.push('The city has a building permit on this address.', ago ? `Issued ${ago}.` : '')
    }
  } else {
    parts.push(onSite.length === 1 ? 'The city has 1 permit on this address, and it is not a building permit.' : `The city has ${onSite.length} permits on this address, none of them a building permit.`)
  }
  const general = [...onSite].sort(newestFirst).find((p) => plumbingTypeOf(p.permit_type) === 'general')
  if (!general) parts.push('No general plumbing permit seen on it.')
  else parts.push(general.contact ? `A general plumbing permit is on this address. The city lists ${general.contact}.` : 'A general plumbing permit is on this address.')
  return { state, main: parts.filter(Boolean).join(' '), detail: null }
}

/** The line under every list of permits: whose records these are, where they start, how far behind they run. */
export function siteSourceLine(city: string, recordsStartYmd: string | null, todayYmd: string): string {
  const start = recordsStartYmd ? `Records start ${reachDay(recordsStartYmd, todayYmd)} and run 2 to 3 days behind.` : 'They run 2 to 3 days behind.'
  return `Source: City of ${city} building permits. ${start}`
}

/** A count with what it is out of: "Of the 5 sites we can see, 4 have a permit." */
export function seenOutOfWords(have: number, of: number, noun: { one: string; many: string } = { one: 'site', many: 'sites' }): string {
  if (of <= 0) return `No ${noun.many} we can see yet.`
  return `Of the ${of} ${of === 1 ? noun.one : noun.many} we can see, ${have} ${have === 1 ? 'has' : 'have'} a permit.`
}

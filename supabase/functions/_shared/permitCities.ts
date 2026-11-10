/**
 * Permits (punch list #292, revision 4): the cities the pull reads, and each city's feed as one
 * shape. A city publishes its permits through its own door (San Antonio's CKAN datastore, Austin's
 * Socrata dataset), names its kinds of work in its own words, and keeps its own search pages. A
 * `FeedReader` hides the door: the URL of one page, the records in the door's answer, and the
 * `permits` row one record makes. `permit-pull` runs the readers; the app reads the city list and
 * each city's doors. No I/O here; `src/lib/research/permitCities.test.ts` holds it.
 */
import { addressKeyOf, dayOf, feedPageSql, numberOf, permitRowFromSanAntonio, SA_APPLIED_FEED, SA_ISSUED_FEED, SAN_ANTONIO_CKAN, textOf, type PermitFeed, type PermitRow, type PermitStage, type PermitTypeClass } from './permitFeed.ts'
import { builderKeyOf, SAN_ANTONIO_PERMIT_PORTAL } from './permitLookup.ts'

/** One feed of one city, whatever door it is read through. */
export type FeedReader = {
  /** The `permits.source` value. */
  source: string
  city: string
  stage: PermitStage
  /** The URL of one page: rows filed on or after `sinceDay`, oldest first, `limit` rows from `offset`. */
  pageUrl: (sinceDay: string, limit: number, offset: number) => string
  /** The records in the door's answer. Throws with the door's own words when it refused the read. */
  recordsOf: (body: unknown) => Record<string, unknown>[]
  /** One record as a `permits` row, or null when the pull does not keep it. */
  rowOf: (record: Record<string, unknown>) => PermitRow | null
}

function assertDay(sinceDay: string, who: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceDay)) throw new Error(`${who}: sinceDay must be YYYY-MM-DD, got ${sinceDay}`)
}

// ---- San Antonio: two CKAN datastores read through the SQL door (permitFeed.ts). ----

function sanAntonioReader(feed: PermitFeed): FeedReader {
  return {
    source: feed.source,
    city: feed.city,
    stage: feed.stage,
    pageUrl: (sinceDay, limit, offset) => `${SAN_ANTONIO_CKAN}?sql=${encodeURIComponent(feedPageSql(feed, sinceDay, limit, offset))}`,
    recordsOf: (body) => {
      const b = body as { success?: boolean; result?: { records?: Record<string, unknown>[] }; error?: unknown } | null
      if (!b?.success) throw new Error(`the feed refused the read: ${JSON.stringify(b?.error ?? {}).slice(0, 300)}`)
      return b.result?.records ?? []
    },
    rowOf: (record) => permitRowFromSanAntonio(record, feed),
  }
}

// ---- Austin: one Socrata dataset of issued permits, every trade in it. ----

export const AUSTIN_SOCRATA = 'https://data.austintexas.gov/resource/3syk-w9eu.json'
export const AUSTIN_SOURCE = 'austin-issued'

/** The building work Austin names that the pull keeps, by its permit class and its work class. */
const AUSTIN_COMMERCIAL_WORK: Record<string, string> = {
  New: 'New commercial',
  Shell: 'New commercial',
  Remodel: 'Commercial remodel',
  Addition: 'Commercial addition',
  'Addition and Remodel': 'Commercial addition',
}
const AUSTIN_RESIDENTIAL_WORK: Record<string, string> = {
  New: 'New house',
  Addition: 'Home addition',
  'Addition and Remodel': 'Home addition',
}
/** Plumbing permits that say nothing about who has a building's plumbing: sprinklers in the lawn, the fire line, a demolition cap. */
const AUSTIN_PLUMBING_LEFT_OUT = ['Irrigation', 'Fireline', 'Demolition']

/**
 * An Austin record as a kind: a building permit the ledger shows, a plumbing permit that names
 * the plumber on a job, or null for the rest (the other trades, repairs, demolitions). The city's
 * class 329 is a structure that is not a building (a wall, a pool, a canopy): site work.
 */
export function classifyAustin(record: Record<string, unknown>): PermitTypeClass | null {
  const type = textOf(record['permittype'])
  const mapped = textOf(record['permit_class_mapped'])
  const work = textOf(record['work_class']) ?? ''
  if (type === 'PP') {
    if (AUSTIN_PLUMBING_LEFT_OUT.includes(work)) return null
    // "New" reads "Plumbing new"; a class that already says plumbing ("Plumbing Service Line") stands as written.
    const words = work === '' ? 'Plumbing' : /^plumbing\b/i.test(work) ? `Plumbing${work.slice(8).toLowerCase()}` : `Plumbing ${work.toLowerCase()}`
    return { kind: 'plumbing', residential: false, work: words }
  }
  if (type !== 'BP') return null
  if (mapped === 'Commercial') {
    const words = AUSTIN_COMMERCIAL_WORK[work]
    if (!words) return null
    const siteWork = /^C-\s*329\b/.test(textOf(record['permit_class']) ?? '')
    return { kind: 'building', residential: false, work: siteWork ? 'Commercial site work' : words }
  }
  if (mapped === 'Residential') {
    const words = AUSTIN_RESIDENTIAL_WORK[work]
    return words ? { kind: 'building', residential: true, work: words } : null
  }
  return null
}

/** A positive number, or null: Austin writes 0 where nothing was declared. */
function positive(value: unknown): number | null {
  const n = numberOf(value)
  return n != null && n > 0 ? n : null
}

/** The city's description as a card's title: one line, cut at a word near ninety characters. */
export function shortDescription(value: unknown, max = 90): string | null {
  const t = textOf(value)
  if (!t) return null
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const at = cut.lastIndexOf(' ')
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, '')}…`
}

/** A point inside Texas, or null: a feed's blank or zero coordinate is no point. */
export function texasPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = numberOf(lat)
  const lo = numberOf(lng)
  if (la == null || lo == null) return null
  return la > 25 && la < 37 && lo > -107 && lo < -93 ? { lat: la, lng: lo } : null
}

/** One Austin record as a `permits` row, or null when the pull does not keep its kind or it has no number. */
export function permitRowFromAustin(record: Record<string, unknown>): PermitRow | null {
  const cls = classifyAustin(record)
  if (!cls) return null
  const number = textOf(record['permit_number'])
  if (!number) return null
  const address = textOf(record['original_address1'])
  const point = texasPoint(record['latitude'], record['longitude'])
  // Who pulled it: the contractor's company on the permit, else the applicant's, else the person named.
  const contact = textOf(record['contractor_company_name']) ?? textOf(record['applicant_org']) ?? textOf(record['contractor_full_name']) ?? textOf(record['applicant_full_name'])
  const zip = (textOf(record['original_zip']) ?? '').match(/^\d{5}/)?.[0] ?? null
  return {
    city: 'Austin',
    source: AUSTIN_SOURCE,
    permit_number: number,
    permit_type: textOf(record['permit_type_desc']) ?? textOf(record['permittype']) ?? '',
    kind: cls.kind,
    stage: 'issued',
    residential: cls.residential,
    work_type: cls.work,
    project_name: shortDescription(record['description']),
    address,
    address_key: addressKeyOf(address),
    zip,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    submitted_on: dayOf(record['applieddate']),
    issued_on: dayOf(record['issue_date']),
    declared_value: positive(record['total_job_valuation']),
    area_sf: positive(record['total_new_add_sqft']),
    contact,
    builder_key: builderKeyOf(contact),
    raw: record,
  }
}

/** The Socrata `$where` for the kinds the pull keeps, issued on or after a day. */
export function austinWhere(sinceDay: string): string {
  assertDay(sinceDay, 'austinWhere')
  const list = (words: string[]) => words.map((w) => `'${w}'`).join(', ')
  const commercial = `(permit_class_mapped = 'Commercial' AND work_class in (${list(Object.keys(AUSTIN_COMMERCIAL_WORK))}))`
  const residential = `(permit_class_mapped = 'Residential' AND work_class in (${list(Object.keys(AUSTIN_RESIDENTIAL_WORK))}))`
  const plumbing = `(permittype = 'PP' AND work_class not in (${list(AUSTIN_PLUMBING_LEFT_OUT)}))`
  return `issue_date >= '${sinceDay}T00:00:00' AND ((permittype = 'BP' AND (${commercial} OR ${residential})) OR ${plumbing})`
}

export const AUSTIN_READER: FeedReader = {
  source: AUSTIN_SOURCE,
  city: 'Austin',
  stage: 'issued',
  pageUrl: (sinceDay, limit, offset) => {
    const q = new URLSearchParams({ $where: austinWhere(sinceDay), $order: 'issue_date ASC, permit_number ASC', $limit: String(Math.max(1, Math.floor(limit))), $offset: String(Math.max(0, Math.floor(offset))) })
    return `${AUSTIN_SOCRATA}?${q.toString()}`
  },
  recordsOf: (body) => {
    if (Array.isArray(body)) return body as Record<string, unknown>[]
    const b = body as { message?: unknown; error?: unknown } | null
    throw new Error(`the feed refused the read: ${String(b?.message ?? JSON.stringify(b?.error ?? b ?? {})).slice(0, 300)}`)
  },
  rowOf: permitRowFromAustin,
}

// ---- The cities. ----

/** A city the office researches: where it is, whose county keeps its land records, and its public search pages. */
export type PermitCity = {
  name: string
  county: string
  /** Roughly the middle of town, to tell a city the office drives to from one it does not. */
  center: { lat: number; lng: number }
  /** The city's own permit search, a page a person fills in. */
  permitSearch: string
  /** The county clerk's deed search, or null where no door is known. */
  deeds: string | null
  /** Whether the county's parcel record is read for the Property line. Bexar County's is; the others open at the appraisal district. */
  parcels: boolean
  feeds: readonly FeedReader[]
}

export const PERMIT_CITIES: readonly PermitCity[] = [
  {
    name: 'San Antonio',
    county: 'Bexar',
    center: { lat: 29.4241, lng: -98.4936 },
    permitSearch: SAN_ANTONIO_PERMIT_PORTAL,
    deeds: 'https://bexar.tx.publicsearch.us/',
    parcels: true,
    feeds: [sanAntonioReader(SA_ISSUED_FEED), sanAntonioReader(SA_APPLIED_FEED)],
  },
  {
    name: 'Austin',
    county: 'Travis',
    center: { lat: 30.2672, lng: -97.7431 },
    permitSearch: 'https://abc.austintexas.gov/web/permit/public-search-other',
    deeds: 'https://www.tccsearch.org/',
    parcels: false,
    feeds: [AUSTIN_READER],
  },
]

export const PERMIT_CITY_NAMES: readonly string[] = PERMIT_CITIES.map((c) => c.name)

/** A city by its name, any case; null for one the pull does not read. */
export function permitCity(name: string | null | undefined): PermitCity | null {
  const want = (name ?? '').trim().toLowerCase()
  return PERMIT_CITIES.find((c) => c.name.toLowerCase() === want) ?? null
}

/** The feeds a pull runs: one city's when it is named and known, every city's otherwise, in the list's order. */
export function feedsToPull(city: string | null | undefined): FeedReader[] {
  const one = permitCity(city)
  return one ? [...one.feeds] : PERMIT_CITIES.flatMap((c) => [...c.feeds])
}

/**
 * Permits (punch list #292): the owner of record outside Bexar County. Travis County publishes
 * the appraisal district's parcels on its own map server; Hays, Comal and Guadalupe share one
 * vendor's layer and one set of column names. None of them keeps the street address the way
 * Bexar does (one string a prefix match reads), so a permit's address is split into its number,
 * its direction and its street name, the layer is asked for the number and the name, and the
 * best row is picked here. When the county has no parcel under the street address, which is the
 * rule on new construction, the permit's own point is asked instead and the answer says so.
 * Where a permit carries the county's own id for its lot (Austin's `tcad_id`, punch list #316),
 * that id is asked first: it is the lot the permit names, with no matching.
 *
 * Pure: `permit-lookup` runs these, `src/lib/research/permitParcels.test.ts` holds them.
 */
import { BEXAR_PARCEL_FIELDS, parcelFactsFromCounty, type ParcelFacts } from './permitLookup.ts'

/** A street address in the parts a county's layer keeps apart. */
export type StreetParts = {
  /** The house number, digits only. */
  num: string
  /** N, S, E or W (or NE, NW, SE, SW) when the address leads with one. */
  prefix: string | null
  /** The street's name, upper-case, without its direction and its suffix: "CESAR CHAVEZ", "5TH". */
  name: string
}

const DIRECTIONS: Record<string, string> = { N: 'N', S: 'S', E: 'E', W: 'W', NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W', NE: 'NE', NW: 'NW', SE: 'SE', SW: 'SW' }
const SUFFIXES = new Set(['ST', 'STREET', 'AVE', 'AVENUE', 'AV', 'DR', 'DRIVE', 'RD', 'ROAD', 'BLVD', 'BOULEVARD', 'LN', 'LANE', 'CT', 'COURT', 'PKWY', 'PARKWAY', 'WAY', 'CIR', 'CIRCLE', 'PL', 'PLACE', 'TRL', 'TRAIL', 'CV', 'COVE', 'TER', 'TERRACE', 'XING', 'CROSSING', 'BND', 'BEND', 'SQ', 'SQUARE', 'PLZ', 'PLAZA', 'EXPY', 'FWY', 'RDG', 'RIDGE', 'PASS', 'PATH', 'RUN', 'ROW', 'WALK', 'HOLW', 'PT', 'POINT', 'LOOP', 'TRCE', 'TRACE', 'VW', 'HTS', 'GLN'])
/** Where the street ends and a unit begins. */
const UNIT_WORDS = new Set(['STE', 'SUITE', 'UNIT', 'APT', 'BLDG', 'BUILDING', 'FL', 'FLOOR', 'RM', 'ROOM', 'LOT', 'SPC', 'SPACE', 'TRLR'])

/** An address's house number, the direction in front of its street, the direction behind it, and the street's words between them. Null when it does not start with a house number. */
function splitStreet(address: string | null | undefined): { num: string; prefix: string | null; behind: string | null; rest: string[] } | null {
  const street = ((address ?? '').split(',')[0] ?? '').toUpperCase().replace(/[.]/g, '').replace(/#.*$/, '').replace(/[^A-Z0-9' -]/g, ' ')
  const words = street.split(/\s+/).filter(Boolean)
  const first = words[0] ?? ''
  const num = /^\d+/.exec(first)?.[0] ?? ''
  if (num === '') return null
  let rest = words.slice(1)
  const unitAt = rest.findIndex((w) => UNIT_WORDS.has(w))
  if (unitAt >= 0) rest = rest.slice(0, unitAt)
  let prefix: string | null = null
  // "100 WEST AVE" is West Avenue, not an avenue on the west side.
  const onlySuffixLeft = rest.length === 2 && SUFFIXES.has(rest[1] ?? '')
  if (rest.length >= 2 && DIRECTIONS[rest[0] ?? ''] && !onlySuffixLeft) {
    prefix = DIRECTIONS[rest[0] ?? ''] ?? null
    rest = rest.slice(1)
  }
  // "MAIN ST N": the trailing direction, never the last word standing.
  let behind: string | null = null
  if (rest.length >= 2 && DIRECTIONS[rest[rest.length - 1] ?? '']) {
    behind = DIRECTIONS[rest[rest.length - 1] ?? ''] ?? null
    rest = rest.slice(0, -1)
  }
  return { num, prefix, behind, rest }
}

/** "2700 E 5TH ST, Austin" → 2700, E, 5TH. Null when the address does not start with a house number or has no street. */
export function streetParts(address: string | null | undefined): StreetParts | null {
  const split = splitStreet(address)
  if (!split) return null
  let rest = split.rest
  // The suffix goes after the trailing direction, never the last word standing.
  if (rest.length >= 2 && SUFFIXES.has(rest[rest.length - 1] ?? '')) rest = rest.slice(0, -1)
  const name = rest.join(' ')
  if (name === '') return null
  const interstate = interstateOf(name)
  return { num: split.num, prefix: split.prefix, name: interstate === null ? name : `IH ${interstate}` }
}

/** The directions an address carries around its street: in front ("N 1604") and behind ("1604 W"). */
export type StreetDirections = { front: string | null; behind: string | null }

/** The directions around an address's street; null when the address does not start with a house number. */
export function streetDirections(address: string | null | undefined): StreetDirections | null {
  const split = splitStreet(address)
  return split ? { front: split.prefix, behind: split.behind } : null
}

const OPPOSITE: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/**
 * Whether a county's row carries the opposite of a direction the asked address carries (E for W,
 * N for S) and not that direction itself: another stretch of the same loop or street, with its
 * own house numbers. The city and the county write one stretch two ways ("N 1604 W" is
 * "W LOOP 1604", and "W 1604 N" is "N LOOP 1604 W"), so a direction that is only missing, or
 * written on the other side, is not the opposite.
 */
export function oppositeDirections(asked: StreetDirections | null, theirs: StreetDirections | null): boolean {
  const letters = (d: StreetDirections | null) => `${d?.front ?? ''}${d?.behind ?? ''}`.split('')
  const mine = letters(asked)
  const other = letters(theirs)
  return mine.some((d) => other.includes(OPPOSITE[d] ?? '') && !other.includes(d))
}

/** An interstate's number, however the address writes it: "IH 10", "I H 10", "I-35", "INTERSTATE HIGHWAY 35"; null for any other street. */
export function interstateOf(name: string): number | null {
  const m = /^(?:IH|I H|I|I-|INTERSTATE|INTERSTATE HIGHWAY)\s*-?\s*(\d+)$/.exec(name)
  return m ? Number(m[1]) : null
}

const ORDINAL_WORDS = ['', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH', 'THIRTEENTH', 'FOURTEENTH', 'FIFTEENTH', 'SIXTEENTH', 'SEVENTEENTH', 'EIGHTEENTH', 'NINETEENTH', 'TWENTIETH']

/** A numbered street's number: "5TH" → 5, "51ST" → 51; null for a named street. */
export function ordinalOf(name: string): number | null {
  const m = /^(\d+)(ST|ND|RD|TH)$/.exec(name)
  return m ? Number(m[1]) : null
}

/** Every way a county might write a street's name: "5TH" is also "5" (Travis) and "FIFTH" (Comal, Guadalupe); "IH 10" is also "I H 10" (Guadalupe). */
export function nameSpellings(name: string): string[] {
  const i = interstateOf(name)
  if (i !== null) return [`IH ${i}`, `I H ${i}`, `I-${i}`, `INTERSTATE HIGHWAY ${i}`, `INTERSTATE ${i}`]
  const n = ordinalOf(name)
  if (n === null) return [name]
  const word = ORDINAL_WORDS[n]
  return word ? [name, String(n), word] : [name, String(n)]
}

function quoted(v: string): string {
  return `'${v.replace(/'/g, "''")}'`
}

type Attributes = Record<string, unknown>

/** One county's parcel layer: where it is, what to ask it and how its row reads. */
export type ParcelSource = {
  county: string
  queryUrl: string
  outFields: string
  /** The where clause for a street address. */
  where: (parts: StreetParts) => string
  /** The street name and the direction off a row, to pick among the rows that came back. */
  streetOf: (a: Attributes) => { prefix: string | null; street: string }
  ownerOf: (a: Attributes) => string | null
  facts: (a: Attributes) => ParcelFacts
  /** Set where a permit can carry this layer's own id for its lot. Only Travis has one. */
  id?: ParcelIdColumn
}

/** A parcel layer's id a permit can carry: the layer's column, and where the permit's feed row keeps it. */
export type ParcelIdColumn = {
  /** The layer's column the id is asked of. */
  column: string
  /** The key in the permit's feed row (`permits.raw`) that holds the id. */
  permitKey: string
  /** The id as this layer keeps it, or null when it is not one of this layer's own. A neighbouring county's id is not asked here. */
  ask: (id: string) => string | null
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n !== 0 ? n : null
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}
function idOf(v: unknown): string | null {
  const s = typeof v === 'number' ? String(Math.round(v)) : str(v)
  return s === '0' ? null : s
}
function acresOf(v: unknown): number | null {
  const n = num(v)
  return n === null ? null : Math.round(n * 100) / 100
}
function sum(...parts: Array<number | null>): number | null {
  const have = parts.filter((p): p is number => p !== null)
  return have.length === 0 ? null : have.reduce((a, b) => a + b, 0)
}

/**
 * Travis County: the appraisal district's parcels as the county's road department republishes
 * them. A numbered street is kept as its bare number ("5"), a blank part is a single space, and
 * the suffix is written three ways, so the suffix stays out of the match. An Austin permit's
 * `tcad_id` is this layer's `geo_id` (ten digits, leading zeros kept), not its `PROP_ID`. An id
 * that starts with R is Williamson County's, for the zips of Austin over the county line
 * (`WILLIAMSON_PARCELS`).
 */
export const TRAVIS_PARCELS: ParcelSource = {
  county: 'Travis',
  queryUrl: 'https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD/MapServer/0/query',
  outFields: 'PROP_ID,situs_address,situs_num,situs_street_prefx,situs_street,py_owner_name,py_address,land_homesite_val,imprv_homesite_val,imprv_non_homesite_val,market_value,land_state_cd,F1year_imprv,tcad_acres,hyperlink',
  where: (p) => {
    const n = ordinalOf(p.name)
    const likes = nameSpellings(p.name)
      .filter((s) => !/^\d+$/.test(s) && !(n !== null && s === ORDINAL_WORDS[n]))
      .map((s) => `UPPER(situs_street) LIKE ${quoted(`${s}%`)}`)
    const asked = n === null ? likes : [`situs_street = ${quoted(String(n))}`, ...likes]
    return `situs_num = ${quoted(p.num)} AND ${asked.length === 1 ? asked[0] : `(${asked.join(' OR ')})`}`
  },
  streetOf: (a) => ({ prefix: str(a.situs_street_prefx)?.toUpperCase() ?? null, street: str(a.situs_street)?.toUpperCase() ?? '' }),
  ownerOf: (a) => str(a.py_owner_name),
  id: { column: 'geo_id', permitKey: 'tcad_id', ask: (id) => (/^r/i.test(id) ? null : id) },
  facts: (a) => {
    const propId = idOf(a.PROP_ID)
    return {
      prop_id: propId,
      situs: str(a.situs_address),
      owner: str(a.py_owner_name),
      owner_address: str(a.py_address),
      dba: null,
      land_value: num(a.land_homesite_val),
      improvement_value: sum(num(a.imprv_homesite_val), num(a.imprv_non_homesite_val)),
      total_value: num(a.market_value),
      use_code: str(a.land_state_cd),
      year_built: str(a.F1year_imprv) === '0' ? null : str(a.F1year_imprv),
      building_sf: null,
      acres: acresOf(a.tcad_acres),
      detail_url: str(a.hyperlink) ?? (propId ? `https://travis.prodigycad.com/property-detail/${encodeURIComponent(propId)}` : null),
    }
  },
}

const VENDOR_FIELDS = 'prop_id,file_as_name,addr_line1,addr_line2,addr_line3,addr_city,addr_state,zip,situs_num,situs_street_prefx,situs_street,situs_street_sufix,situs_city,situs_zip,land_val,imprv_val,market,legal_acreage'

/**
 * Hays, Comal and Guadalupe: one vendor's layer, one set of columns (the suffix column is spelled
 * `situs_street_sufix`). The street name is where they differ: Hays keeps the direction apart but
 * a few rows carry it in the name ("E HOPKINS"), Guadalupe keeps the suffix in the name
 * ("COURT ST"), and a numbered street is spelled out in two of them. So the name is asked every way.
 */
function vendorParcels(county: string, queryUrl: string, detailUrl: (propId: string) => string, suffixIsClean: boolean): ParcelSource {
  return {
    county,
    queryUrl,
    outFields: VENDOR_FIELDS,
    where: (p) => {
      // The bare number is Travis's spelling; as a prefix here it would also bring back every street that starts with it.
      const names = nameSpellings(p.name).filter((n) => !/^\d+$/.test(n))
      const asked = p.prefix ? [...names, ...names.map((n) => `${p.prefix} ${n}`)] : names
      return `situs_num = ${quoted(p.num)} AND (${asked.map((n) => `UPPER(situs_street) LIKE ${quoted(`${n}%`)}`).join(' OR ')})`
    },
    streetOf: (a) => ({ prefix: str(a.situs_street_prefx)?.toUpperCase() ?? null, street: str(a.situs_street)?.toUpperCase() ?? '' }),
    ownerOf: (a) => str(a.file_as_name),
    facts: (a) => {
      const propId = idOf(a.prop_id)
      const street = [str(a.situs_num), str(a.situs_street_prefx), str(a.situs_street), suffixIsClean ? str(a.situs_street_sufix) : null].filter(Boolean).join(' ')
      const situs = [street, [str(a.situs_city), str(a.situs_zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      const ownerAddress = [str(a.addr_line1), str(a.addr_line2), str(a.addr_line3), [str(a.addr_city), str(a.addr_state), str(a.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      const land = num(a.land_val)
      const improvement = num(a.imprv_val)
      return {
        prop_id: propId,
        situs: situs === '' ? null : situs,
        owner: str(a.file_as_name),
        owner_address: ownerAddress === '' ? null : ownerAddress,
        dba: null,
        land_value: land,
        improvement_value: improvement,
        // An exempt parcel's market value comes back empty; the two parts are the same number.
        total_value: num(a.market) ?? sum(land, improvement),
        use_code: null,
        year_built: null,
        building_sf: null,
        acres: acresOf(a.legal_acreage),
        detail_url: propId ? detailUrl(propId) : null,
      }
    },
  }
}

export const HAYS_PARCELS = vendorParcels('Hays', 'https://services6.arcgis.com/j94FvPaik4etwHFk/arcgis/rest/services/HaysCADWebService1/FeatureServer/0/query', (id) => `https://esearch.hayscad.com/Property-Detail/PropertyQuickRefID/R${encodeURIComponent(id)}`, true)
export const COMAL_PARCELS = vendorParcels('Comal', 'https://services7.arcgis.com/Yz6eib2o8WvEgWq8/arcgis/rest/services/ComalCADWebService/FeatureServer/0/query', (id) => `https://esearch.comalad.org/Property/View/${encodeURIComponent(id)}`, false)
export const GUADALUPE_PARCELS = vendorParcels('Guadalupe', 'https://services9.arcgis.com/1l4hbpt78hjlsIcl/arcgis/rest/services/GuadalupeCADWebService/FeatureServer/0/query', (id) => `https://esearch.guadalupead.org/Property/View/${encodeURIComponent(id)}`, false)

/**
 * Williamson County: the appraisal district's parcels on the county's own map server. No city read
 * here is filed under it. It answers for the part of Austin over the county line: those permits
 * carry the district's quick reference id (an R and six digits) where the others carry Travis's
 * `geo_id` (punch list #320). The address is kept in parts, the mailing address on two lines, and
 * there is no year built.
 */
export const WILLIAMSON_PARCELS: ParcelSource = {
  county: 'Williamson',
  queryUrl: 'https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query',
  outFields: 'QuickRefID,FullName,MailingAddress,SitusAddress,SStreetNumber,SStreetDirectional,SStreetName,DBA,TotalLandMktValue,TotalImpMktValue,TotalPropMktValue,TotalSqFtLivingArea,Acres,USECD',
  where: (p) => {
    const names = nameSpellings(p.name).filter((n) => !/^\d+$/.test(n))
    return `SStreetNumber = ${quoted(p.num)} AND (${names.map((n) => `UPPER(SStreetName) LIKE ${quoted(`${n}%`)}`).join(' OR ')})`
  },
  streetOf: (a) => ({ prefix: str(a.SStreetDirectional)?.toUpperCase() ?? null, street: str(a.SStreetName)?.toUpperCase() ?? '' }),
  ownerOf: (a) => str(a.FullName),
  id: { column: 'QuickRefID', permitKey: 'tcad_id', ask: (id) => (/^r\d+$/i.test(id) ? id.toUpperCase() : null) },
  facts: (a) => {
    const quickRef = str(a.QuickRefID)
    // The mailing address comes on two lines: the street, then the city, state and zip.
    const mailing = typeof a.MailingAddress === 'string' ? a.MailingAddress.split(/\s*\n\s*/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ') : ''
    return {
      prop_id: quickRef,
      situs: str(a.SitusAddress),
      owner: str(a.FullName),
      owner_address: mailing === '' ? null : mailing,
      dba: str(a.DBA),
      land_value: num(a.TotalLandMktValue),
      improvement_value: num(a.TotalImpMktValue),
      total_value: num(a.TotalPropMktValue),
      use_code: str(a.USECD),
      year_built: null,
      building_sf: num(a.TotalSqFtLivingArea),
      acres: acresOf(a.Acres),
      detail_url: quickRef ? `https://search.wcad.org/Property-Detail/PropertyQuickRefID/${encodeURIComponent(quickRef)}` : null,
    }
  },
}

const SOURCES: readonly ParcelSource[] = [TRAVIS_PARCELS, HAYS_PARCELS, COMAL_PARCELS, GUADALUPE_PARCELS, WILLIAMSON_PARCELS]

/** The parcel layer for a county, by its name; null for Bexar, which `permitLookup.ts` reads its own way, and for a county not read. */
export function parcelSourceFor(county: string | null | undefined): ParcelSource | null {
  const want = (county ?? '').trim().toLowerCase()
  return SOURCES.find((s) => s.county.toLowerCase() === want) ?? null
}

/**
 * The counties a city's limits reach into, by the county the city is filed under. New Braunfels
 * is filed under Comal and four of its addresses in ten are in Guadalupe; San Marcos is filed
 * under Hays and one in eight is in Guadalupe; Austin is filed under Travis and one permit in
 * thirty is in Williamson (measured 2026-11-11, punch list #320). Only the counties whose layers
 * are read here are listed.
 */
const NEIGHBOURS: Record<string, readonly string[]> = {
  Comal: ['Guadalupe'],
  Hays: ['Guadalupe', 'Comal'],
  Guadalupe: ['Comal'],
  Travis: ['Williamson', 'Hays'],
  Williamson: ['Travis'],
}

/** The neighbouring counties' layers, asked at a permit's point when its city's own county holds no parcel there. */
export function neighbourSources(source: ParcelSource): ParcelSource[] {
  return (NEIGHBOURS[source.county] ?? []).map((county) => parcelSourceFor(county)).filter((s): s is ParcelSource => s !== null)
}

/**
 * Whether a county's address for a parcel is the permit's street address: the same house number
 * and the same street name in any spelling. A county writes the suffix, the city and the zip
 * behind the name, with or without a comma or a line break ("100 SAMPLE LN AUSTIN 78701"), so
 * the names match when one starts the other on a whole word. False when either has no house
 * number, so a blank county address is never "the same".
 */
export function sameStreetAddress(permitAddress: string | null | undefined, countyAddress: string | null | undefined): boolean {
  const ours = streetParts(permitAddress)
  const firstLine = ((countyAddress ?? '').split(/[\n,]/)[0] ?? '').replace(/\s+\d{5}(-\d{4})?\s*$/, '')
  const theirs = streetParts(firstLine)
  if (!ours || !theirs || ours.num !== theirs.num) return false
  const starts = (long: string, short: string) => long === short || long.startsWith(`${short} `)
  return nameSpellings(ours.name).some((a) => nameSpellings(theirs.name).some((b) => starts(b, a) || starts(a, b)))
}

/** How many rows to ask for: a number and a name can match a few streets ("MAIN", "MAIN PLAZA"). */
export const PARCEL_ROWS_ASKED = 12

/** The query string for a street address. */
export function addressQuery(source: ParcelSource, parts: StreetParts): URLSearchParams {
  return new URLSearchParams({ where: source.where(parts), outFields: source.outFields, returnGeometry: 'false', resultRecordCount: String(PARCEL_ROWS_ASKED), f: 'json' })
}

/** The query string for the parcel under a point, for a layer by the columns it is asked for. */
export function pointQueryOf(outFields: string, point: { lat: number; lng: number }): URLSearchParams {
  return new URLSearchParams({
    geometry: `${point.lng},${point.lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'false',
    resultRecordCount: '3',
    f: 'json',
  })
}

/** The query string for the parcel under a point. */
export function pointQuery(source: ParcelSource, point: { lat: number; lng: number }): URLSearchParams {
  return pointQueryOf(source.outFields, point)
}

/** A permit's parcel id as text, or null: blank, or one this layer cannot hold. */
export function askableParcelId(source: ParcelSource, id: unknown): string | null {
  if (!source.id || (typeof id !== 'string' && typeof id !== 'number')) return null
  const text = String(id).trim()
  return text === '' ? null : source.id.ask(text)
}

/** The where clause that asks a layer for one parcel by its id, or null when the layer has no id to ask or the id is not its own. */
export function idWhere(source: ParcelSource, id: unknown): string | null {
  const text = askableParcelId(source, id)
  return text === null || !source.id ? null : `${source.id.column} = ${quoted(text)}`
}

/** The query string for the parcel a permit names by id, or null when there is nothing to ask. One id is a short address, so a GET passes the county's firewall. */
export function idQuery(source: ParcelSource, id: unknown): URLSearchParams | null {
  const where = idWhere(source, id)
  return where === null ? null : new URLSearchParams({ where, outFields: source.outFields, returnGeometry: 'false', resultRecordCount: '3', f: 'json' })
}

function featuresOf(body: unknown): Attributes[] {
  const features = (body as { features?: Array<{ attributes?: Attributes }> } | null)?.features
  return Array.isArray(features) ? features.map((f) => f.attributes ?? {}) : []
}

/** A row's street name without a direction it carries in front or behind ("I H 10 W") and a suffix it carries behind. */
function bareStreet(street: string): { lead: string | null; name: string } {
  let words = street.split(/\s+/).filter(Boolean)
  let lead: string | null = null
  if (words.length >= 2 && DIRECTIONS[words[0] ?? '']) {
    lead = DIRECTIONS[words[0] ?? ''] ?? null
    words = words.slice(1)
  }
  if (words.length >= 2 && DIRECTIONS[words[words.length - 1] ?? '']) words = words.slice(0, -1)
  if (words.length >= 2 && SUFFIXES.has(words[words.length - 1] ?? '')) words = words.slice(0, -1)
  return { lead, name: words.join(' ') }
}

/**
 * The best of the rows an address query brought back, or null when none is the street asked for.
 * The street's name must be the one asked (in any spelling), so "MAIN" never answers with
 * "MAINE"; a row on the asked side of town beats one on the other; a row with an owner beats a
 * blank one.
 */
export function pickParcel(source: ParcelSource, body: unknown, parts: StreetParts): Attributes | null {
  const spellings = new Set(nameSpellings(parts.name))
  let best: Attributes | null = null
  let bestScore = -1
  for (const a of featuresOf(body)) {
    const row = source.streetOf(a)
    const bare = bareStreet(row.street)
    if (!spellings.has(bare.name) && !spellings.has(row.street)) continue
    const side = DIRECTIONS[row.prefix ?? ''] ?? bare.lead
    let score = 0
    if (parts.prefix && side === parts.prefix) score += 4
    if (!parts.prefix && !side) score += 2
    if (parts.prefix && side && side !== parts.prefix) score -= 4
    if (source.ownerOf(a)) score += 1
    if (score > bestScore) {
      best = a
      bestScore = score
    }
  }
  return best
}

/** The facts off an address query, or null when the county has no parcel under that street address. */
export function parcelFactsByAddress(source: ParcelSource, body: unknown, parts: StreetParts): ParcelFacts | null {
  const a = pickParcel(source, body, parts)
  return a ? source.facts(a) : null
}

/** The facts off a point query: the first parcel with an owner, marked as read by the point. */
export function parcelFactsByPoint(source: ParcelSource, body: unknown): ParcelFacts | null {
  const rows = featuresOf(body)
  const a = rows.find((r) => source.ownerOf(r)) ?? null
  return a ? { ...source.facts(a), matched_by: 'point' } : null
}

/**
 * The layer a permit's parcel id belongs to: the city's own county's when it takes the id, else
 * the first neighbour's that does, else the city's own. An Austin permit that carries an R id is
 * in Williamson County, so its id, its address and its point are all asked there.
 */
export function sourceForId(home: ParcelSource, id: unknown): ParcelSource {
  return [home, ...neighbourSources(home)].find((s) => askableParcelId(s, id) !== null) ?? home
}

/** The facts as the card reads them, by the layer that answered: a layer other than the city's own county's names its county, so the card can say whose parcel it is. */
export function factsInCounty(home: ParcelSource, answered: ParcelSource, facts: ParcelFacts): ParcelFacts {
  return answered === home ? facts : { ...facts, county: answered.county }
}

/** The facts off an id query: the first parcel with an owner, marked as read by the id the permit carries. Null when the layer does not hold the id, which is about one Austin permit in five. */
export function parcelFactsById(source: ParcelSource, body: unknown): ParcelFacts | null {
  const rows = featuresOf(body)
  const a = rows.find((r) => source.ownerOf(r)) ?? null
  return a ? { ...source.facts(a), matched_by: 'id' } : null
}

/**
 * Whether a kept lookup's question was put to Bexar's layer (`situsWhere` in `permitLookup.ts`).
 * Between the client that asks about the other counties and the function that can answer, the
 * earlier function asked Bexar about an Austin address and kept "no parcel" for a month; such a
 * row is asked again.
 */
export function askedBexarLayer(query: string | null | undefined): boolean {
  return (query ?? '').startsWith('UPPER(Situs)')
}

/** The questions a kept lookup's `query` holds, in the order they were asked, joined by this. */
export const QUESTION_JOIN = ' | '

/** Whether a question in a kept `query` is the one that asks a layer by the parcel id. */
function isIdQuestion(source: ParcelSource, question: string): boolean {
  return source.id !== undefined && question.startsWith(`${source.id.column} = `)
}

/**
 * Whether a kept "no parcel" was asked with a different question than this code asks today for
 * the same address: a spelling learned since (a LOOP suffix, an interstate written "I H 10") would
 * find what the old question missed, so the row is asked again instead of waiting out its month.
 * The id question and the point ride in the same `query` and are not the address question. A row
 * whose asking stopped at the id question (the county failed there) holds no address question
 * and is not asked again for that: a dead source is not hammered.
 */
export function askedOtherQuestion(source: ParcelSource, keptQuery: string | null | undefined, address: string | null | undefined): boolean {
  const parts = streetParts(address)
  if (!parts) return false
  const questions = (keptQuery ?? '').split(QUESTION_JOIN)
  const kept = questions.find((q) => !q.startsWith('point ') && !isIdQuestion(source, q))
  if (kept === undefined) return !questions.some((q) => isIdQuestion(source, q))
  return kept !== source.where(parts)
}

/**
 * Whether a kept answer, found or not, was asked before the permit's parcel id was: its `query`
 * does not hold the id question this code would ask today. Such a row is asked again once, so an
 * owner read off a neighbouring lot does not sit for its thirty days; the new row holds the id
 * question and is then kept like any other. False when the permit carries no id this layer holds.
 */
export function askedWithoutId(source: ParcelSource, keptQuery: string | null | undefined, id: unknown): boolean {
  const where = idWhere(source, id)
  if (where === null) return false
  return !(keptQuery ?? '').split(QUESTION_JOIN).includes(where)
}

/** A numbered road's number, however it is written: "1604", "LOOP 1604", "FM 78", "HWY 90"; null for any other street. San Antonio writes "N 1604 W" where the county writes "N LOOP 1604 W". */
export function routeOf(name: string): number | null {
  const m = /^(?:(?:LOOP|FM|RM|HWY|HIGHWAY|SH|US|STATE HWY)\s+)?(\d{2,4})$/.exec(name)
  return m ? Number(m[1]) : null
}

/** Whether two street names, each without its direction and its suffix, are one street: the same name in any spelling, or the same numbered road. */
function sameStreetName(a: string, b: string): boolean {
  const routeA = routeOf(a)
  if (routeA !== null && routeA === routeOf(b) && ordinalOf(a) === null && ordinalOf(b) === null) return true
  const theirs = new Set(nameSpellings(b))
  return nameSpellings(a).some((n) => theirs.has(n))
}

/** The street line of Bexar's `Situs`, which carries the city, the state and the zip on a second line. */
function bexarStreetLine(situs: unknown): string {
  return (typeof situs === 'string' ? situs : '').split(/[\n,]/)[0] ?? ''
}

/**
 * Bexar's address question, asked the way the other counties are (punch list #320): the house
 * number and the street's name, not the whole street string. Bexar keeps the address as one
 * string, and a prefix match on it missed a suffix spelled out ("LANE" for "LN"), a direction
 * on one side only and a loop the county names ("N LOOP 1604 W" for "N 1604 W").
 */
export function bexarAddressWhere(parts: StreetParts): string {
  const route = ordinalOf(parts.name) === null ? routeOf(parts.name) : null
  const names = route !== null ? [String(route)] : nameSpellings(parts.name)
  const asked = names.map((n) => `UPPER(Situs) LIKE ${quoted(`%${n}%`)}`)
  return `UPPER(Situs) LIKE ${quoted(`${parts.num} %`)} AND ${asked.length === 1 ? asked[0] : `(${asked.join(' OR ')})`}`
}

/** The query string for Bexar's address question. */
export function bexarAddressQuery(parts: StreetParts): URLSearchParams {
  return new URLSearchParams({ where: bexarAddressWhere(parts), outFields: BEXAR_PARCEL_FIELDS, returnGeometry: 'false', resultRecordCount: String(PARCEL_ROWS_ASKED), f: 'json' })
}

/** Bexar's id for a parcel as text, however the layer sends it; null when the row carries none. */
function bexarPropId(a: Attributes): string | null {
  return typeof a.PropID === 'number' ? String(Math.round(a.PropID)) : str(a.PropID)
}

/** The rows of Bexar's answer that are at the asked number on the asked street, so "MAIN" never answers with "MAINE". */
function bexarRowsAtAddress(body: unknown, parts: StreetParts): Array<{ row: Attributes; prefix: string | null; directions: StreetDirections | null }> {
  const rows: Array<{ row: Attributes; prefix: string | null; directions: StreetDirections | null }> = []
  for (const a of featuresOf(body)) {
    const line = bexarStreetLine(a.Situs)
    const theirs = streetParts(line)
    if (theirs && theirs.num === parts.num && sameStreetName(parts.name, theirs.name)) rows.push({ row: a, prefix: theirs.prefix, directions: streetDirections(line) })
  }
  return rows
}

/**
 * How many lots Bexar holds at the asked number on the asked street. A centre on a loop or a
 * campus is several parcels under one address, and then the address alone cannot say which lot
 * the permit is on: the lookup asks the permit's point (`bexarLotIdsOf`) and takes the lot under it.
 */
export function bexarLotsAtAddress(body: unknown, parts: StreetParts): number {
  return new Set(bexarRowsAtAddress(body, parts).map(({ row }) => bexarPropId(row) ?? '')).size
}

/**
 * Whether the permit's point has to be asked before Bexar's answer to the address question can
 * be read: several lots share the address, or a row there carries the opposite of one of the
 * asked directions (`oppositeDirections`) and only the point can say it is the lot all the same.
 */
export function bexarNeedsPoint(body: unknown, parts: StreetParts, asked: StreetDirections | null): boolean {
  return bexarLotsAtAddress(body, parts) > 1 || bexarRowsAtAddress(body, parts).some(({ directions }) => oppositeDirections(asked, directions))
}

/** The ids of the lots in one of Bexar's answers: the lots under the permit's point, for `parcelFactsFromBexarAddress`. */
export function bexarLotIdsOf(body: unknown): Set<string> {
  const ids = new Set<string>()
  for (const a of featuresOf(body)) {
    const id = bexarPropId(a)
    if (id) ids.add(id)
  }
  return ids
}

/**
 * The facts off Bexar's answer to the address question: the row at the asked number on the asked
 * street. Where several lots share the address and one of them is under the permit's point
 * (`underPoint`, the ids of the lots there), that lot. Otherwise the asked side of town before the
 * other, a row with an owner before a blank one. A row that carries the opposite of one of the
 * asked directions (`asked`, off `streetDirections`) is another stretch of the street and is
 * passed by, unless it is the lot under the point. Null when no row is that street.
 */
export function parcelFactsFromBexarAddress(body: unknown, parts: StreetParts, underPoint: ReadonlySet<string> | null = null, asked: StreetDirections | null = null): ParcelFacts | null {
  let best: Attributes | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (const { row: a, prefix, directions } of bexarRowsAtAddress(body, parts)) {
    let score = 0
    const id = bexarPropId(a)
    const isUnderPoint = underPoint !== null && id !== null && underPoint.has(id)
    if (!isUnderPoint && oppositeDirections(asked, directions)) continue
    if (isUnderPoint) score += 16
    if (parts.prefix && prefix === parts.prefix) score += 4
    if (!parts.prefix && !prefix) score += 2
    if (parts.prefix && prefix && prefix !== parts.prefix) score -= 4
    if (str(a.Owner)) score += 1
    if (score > bestScore) {
      best = a
      bestScore = score
    }
  }
  return best ? parcelFactsFromCounty({ features: [{ attributes: best }] }) : null
}

/** The words a kept `query` holds for the point question: `point <lng>,<lat>`. */
export function pointQuestion(point: { lat: number; lng: number }): string {
  return `point ${point.lng},${point.lat}`
}

/** The words a kept `query` holds for the point put to a neighbouring county: `point <lng>,<lat> in <County>`. It starts like the point question, so it is never read as the address question. */
export function neighbourPointQuestion(neighbour: ParcelSource, point: { lat: number; lng: number }): string {
  return `${pointQuestion(point)} in ${neighbour.county}`
}

/**
 * Whether a kept "no parcel" was asked before the neighbouring counties could be: the permit has
 * a point, its county has neighbours read here, and the kept `query` does not hold the point
 * question for each of them. Such a row is asked again once instead of waiting out its month.
 */
export function askedWithoutNeighbours(source: ParcelSource, keptQuery: string | null | undefined, point: { lat: number; lng: number } | null): boolean {
  if (point === null) return false
  const asked = (keptQuery ?? '').split(QUESTION_JOIN)
  return neighbourSources(source).some((n) => !asked.some((q) => q.startsWith('point ') && q.endsWith(` in ${n.county}`)))
}

/**
 * Whether a kept "no parcel" was asked before the permit's point could be: its `query` holds no
 * point question and the permit has a point. Bexar's layer was asked by the street address alone
 * until punch list #320, so such a row is asked again once instead of waiting out its month.
 */
export function askedWithoutPoint(keptQuery: string | null | undefined, point: { lat: number; lng: number } | null): boolean {
  if (point === null) return false
  return !(keptQuery ?? '').split(QUESTION_JOIN).some((q) => q.startsWith('point '))
}

/** A point the layer can be asked about: both numbers, inside Texas. */
export function askablePoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = typeof lat === 'number' ? lat : Number.NaN
  const lo = typeof lng === 'number' ? lng : Number.NaN
  return la > 25 && la < 37 && lo > -107 && lo < -93 ? { lat: la, lng: lo } : null
}

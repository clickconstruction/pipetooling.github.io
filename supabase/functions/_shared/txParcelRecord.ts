/**
 * Texas parcel record kernel (customer properties train, PR 1).
 *
 * The Texas Geographic Information Office publishes a statewide parcel layer
 * fed by the county appraisal districts. Its public map service answers an
 * `identify` at a lat/lng with the parcel's owner of record, legal
 * description, owner mailing address, county, the source district and the
 * tax year — everything a mechanic's lien affidavit needs from the property
 * except the homestead exemption. This module parses that answer, folds in
 * the geocoder's county and the city→county table, and turns the result into
 * a PROPOSAL for a `customer_addresses` row: values with their sources, never
 * an overwrite of what a person typed.
 *
 * Shared between the `property-lookup` edge function (Deno) and the client
 * (re-exported from `src/lib/customers/propertyRecord.ts`, tested there), so
 * it must stay dependency-free.
 */

export const TX_PARCEL_IDENTIFY_URL =
  'https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer/identify'

/** What the statewide roll says about one parcel. Strings are trimmed; '' = not on the roll. */
export type ParcelRecord = {
  propId: string
  /** Owner of record exactly as the roll spells it (usually UPPER CASE). */
  ownerName: string
  /** "% ATTN …" care-of line, '' when none. */
  nameCare: string
  legalDescription: string
  /** The property's own address per the roll ('' when the roll has none). */
  situsAddress: string
  /** Single-line owner mailing address — where lien notices go. */
  mailingAddress: string
  /** Title-cased county name without the word "County": "Comal". */
  county: string
  /** Title-cased source district: "Comal Appraisal District". */
  source: string
  taxYear: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
}

/** "COMAL" → "Comal", "SAN PATRICIO" → "San Patricio"; already-mixed input is left alone. */
export function titleCaseUpperWords(s: string): string {
  const t = s.trim()
  if (!t) return ''
  if (t !== t.toUpperCase()) return t
  return t
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w) => (w.length > 0 && /[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join('')
}

/** "COMAL COUNTY" / "Comal County" / "COMAL" → "Comal". */
export function normalizeCountyName(raw: string): string {
  const t = raw.trim().replace(/\s+county$/i, '').replace(/\s+/g, ' ')
  return titleCaseUpperWords(t)
}

/** The roll writes "550 LANDA ST , NEW BRAUNFELS, TX 78130" — tidy the spaces around commas. */
function tidyAddressLine(s: string): string {
  return s
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim()
}

function composeMailing(a: Record<string, unknown>): string {
  const whole = tidyAddressLine(str(a.MAIL_ADDR ?? a.mail_addr))
  if (whole && /[a-z0-9]/i.test(whole)) return whole
  const l1 = str(a.MAIL_LINE1 ?? a.mail_line1)
  const l2 = str(a.MAIL_LINE2 ?? a.mail_line2)
  const city = str(a.MAIL_CITY ?? a.mail_city)
  const st = str(a.MAIL_STAT ?? a.mail_stat)
  const zip = str(a.MAIL_ZIP ?? a.mail_zip)
  const street = [l1, l2].filter(Boolean).join(' ')
  const tail = [city, [st, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return tidyAddressLine([street, tail].filter(Boolean).join(', '))
}

function composeSitus(a: Record<string, unknown>): string {
  const whole = tidyAddressLine(str(a.SITUS_ADDR ?? a.situs_addr))
  if (whole && /[a-z0-9]/i.test(whole)) return whole
  const num = str(a.SITUS_NUM ?? a.situs_num)
  const stre = str(a.SITUS_STRE ?? a.situs_stre)
  const s1 = str(a.SITUS_ST_1 ?? a.situs_st_1)
  const s2 = str(a.SITUS_ST_2 ?? a.situs_st_2)
  const city = str(a.SITUS_CITY ?? a.situs_city)
  const st = str(a.SITUS_STAT ?? a.situs_stat)
  const zip = str(a.SITUS_ZIP ?? a.situs_zip)
  const street = [num, s1, stre, s2].filter(Boolean).join(' ')
  const tail = [city, [st, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return tidyAddressLine([street, tail].filter(Boolean).join(', '))
}

function recordFromAttributes(a: Record<string, unknown>): ParcelRecord {
  return {
    propId: str(a.PROP_ID ?? a.prop_id),
    ownerName: str(a.OWNER_NAME ?? a.owner_name).replace(/\s+/g, ' '),
    nameCare: str(a.NAME_CARE ?? a.name_care).replace(/\s+/g, ' '),
    legalDescription: str(a.LEGAL_DESC ?? a.legal_desc).replace(/\s+/g, ' '),
    situsAddress: composeSitus(a),
    mailingAddress: composeMailing(a),
    county: normalizeCountyName(str(a.COUNTY ?? a.county)),
    source: titleCaseUpperWords(str(a.SOURCE ?? a.source)),
    taxYear: str(a.TAX_YEAR ?? a.tax_year),
  }
}

function hasSubstance(r: ParcelRecord): boolean {
  return Boolean(r.ownerName || r.legalDescription || r.propId)
}

/**
 * Parse the identify response. Several results can come back when the point
 * sits on a boundary; the first with an owner or a legal description wins.
 * null = nothing under the point (or an error payload).
 */
export function parseTxParcelIdentify(raw: unknown): ParcelRecord | null {
  if (raw == null || typeof raw !== 'object') return null
  const results = (raw as { results?: unknown }).results
  if (!Array.isArray(results)) return null
  for (const r of results) {
    if (r == null || typeof r !== 'object') continue
    const attrs = (r as { attributes?: unknown }).attributes
    if (attrs == null || typeof attrs !== 'object') continue
    const rec = recordFromAttributes(attrs as Record<string, unknown>)
    if (hasSubstance(rec)) return rec
  }
  return null
}

/** Google Geocoding address component (subset). */
export type GoogleAddressComponent = { long_name?: unknown; short_name?: unknown; types?: unknown }

/** The county from a Google geocode result's components ('' when absent). */
export function countyFromGoogleComponents(components: unknown): string {
  if (!Array.isArray(components)) return ''
  for (const c of components as GoogleAddressComponent[]) {
    const types = Array.isArray(c?.types) ? (c.types as unknown[]) : []
    if (types.includes('administrative_area_level_2')) return normalizeCountyName(str(c.long_name))
  }
  return ''
}

/**
 * Central-Texas cities that sit in more than one county — where the
 * city→county table is a guess, not an answer. Lower-case keys.
 */
export const TX_STRADDLING_CITIES: Readonly<Record<string, readonly string[]>> = {
  schertz: ['Bexar', 'Guadalupe', 'Comal'],
  cibolo: ['Guadalupe', 'Bexar'],
  selma: ['Bexar', 'Guadalupe', 'Comal'],
  'new braunfels': ['Comal', 'Guadalupe'],
  'san marcos': ['Hays', 'Caldwell', 'Guadalupe'],
  austin: ['Travis', 'Williamson', 'Hays'],
  'round rock': ['Williamson', 'Travis'],
  pflugerville: ['Travis', 'Williamson'],
  leander: ['Williamson', 'Travis'],
  'cedar park': ['Williamson', 'Travis'],
  'fair oaks ranch': ['Bexar', 'Comal', 'Kendall'],
  'canyon lake': ['Comal'],
}

export function cityStraddlesCounties(city: string): readonly string[] {
  const key = city.trim().toLowerCase().replace(/\s+/g, ' ')
  const list = TX_STRADDLING_CITIES[key]
  return list && list.length > 1 ? list : []
}

export type CountySource = 'parcel' | 'geocoder' | 'city' | 'manual' | ''

export type CountyProposal = {
  /** The county the ladder answered with ('' when no rung answered). */
  county: string
  source: CountySource
  /** Every distinct answer, best rung first — the pills when rungs disagree. */
  candidates: { county: string; source: CountySource }[]
  /** Two rungs named different counties. */
  disagreement: boolean
  /** The city is a known straddler, so a city-only answer is a guess. */
  straddles: boolean
}

/**
 * The county ladder: parcel → geocoder → city table. Rung 1 and 2 are facts
 * about the map pin; rung 3 is the curated table (a guess, flagged when the
 * city straddles county lines).
 */
export function proposeCounty(input: {
  parcelCounty: string
  geocoderCounty: string
  cityCounty: string
  city: string
}): CountyProposal {
  const all: { county: string; source: CountySource }[] = [
    { county: normalizeCountyName(input.parcelCounty), source: 'parcel' },
    { county: normalizeCountyName(input.geocoderCounty), source: 'geocoder' },
    { county: normalizeCountyName(input.cityCounty), source: 'city' },
  ]
  const rungs = all.filter((r) => r.county !== '')
  const candidates: { county: string; source: CountySource }[] = []
  for (const r of rungs) {
    if (!candidates.some((c) => c.county.toLowerCase() === r.county.toLowerCase())) candidates.push(r)
  }
  const best = candidates[0]
  return {
    county: best?.county ?? '',
    source: best?.source ?? '',
    candidates,
    disagreement: candidates.length > 1,
    straddles: cityStraddlesCounties(input.city).length > 0,
  }
}

const COMPANY_RE =
  /\b(LLC|L\.L\.C\.|INC|INC\.|CORP|CORPORATION|CO\b|COMPANY|LP|L\.P\.|LLP|LTD|LIMITED|TRUST|TRUSTEE|TRUSTEES|CHURCH|MINISTRIES|ISD|SCHOOL DISTRICT|CITY OF|COUNTY OF|STATE OF|HOLDINGS|PROPERTIES|PARTNERS|PARTNERSHIP|ASSOC|ASSOCIATION|ASSN|HOA|INVESTMENTS|VENTURES|ENTERPRISES|GROUP|BANK|FOUNDATION|AUTHORITY|DISTRICT|UNIVERSITY|HOSPITAL|REALTY|DEVELOPMENT|MANAGEMENT|SERVICES|HOMES|BUILDERS|CONSTRUCTION)\b/i

/** Does the owner of record read as an entity rather than a person? */
export function ownerLooksLikeCompany(ownerName: string): boolean {
  return COMPANY_RE.test(ownerName.trim())
}

/** Street-number + first street token, lower-case: "412 gruene" — enough to say two lines name the same lot. */
export function addressStreetKey(address: string): string {
  const first = address.split(',')[0] ?? ''
  const m = first.trim().toLowerCase().match(/^(\d+[a-z]?)\s+([a-z0-9]+)/)
  return m ? `${m[1]} ${m[2]}` : ''
}

export type HomesteadHint = 'likely' | 'unlikely' | 'unknown'

/**
 * The roll carries no exemptions, so homestead is inferred: an individual
 * whose mailing address is the property itself is probably living there.
 */
export function homesteadHint(parcel: ParcelRecord, propertyAddress: string): HomesteadHint {
  if (!parcel.ownerName) return 'unknown'
  if (ownerLooksLikeCompany(parcel.ownerName)) return 'unlikely'
  const prop = addressStreetKey(propertyAddress) || addressStreetKey(parcel.situsAddress)
  const mail = addressStreetKey(parcel.mailingAddress)
  if (!parcel.mailingAddress.trim() || !prop) return 'unknown'
  // A PO box or any non-street mailing line means the owner does not get mail at the property.
  if (!mail) return 'unlikely'
  return prop === mail ? 'likely' : 'unlikely'
}

export type ProposedPropertyRecord = {
  found: boolean
  county: CountyProposal
  legalDescription: string
  ownerName: string
  ownerCompany: string
  /** '' | 'homeowner' | 'building_owner' */
  ownerMode: string
  ownerMailingAddress: string
  homestead: HomesteadHint
  /** Where the legal description / owner came from; null when no parcel matched. */
  provenance: { source: string; taxYear: string; propId: string } | null
}

/**
 * Build the proposal for a property from what the lookup returned. The client
 * supplies `cityCounty` (curated table + org extras) and `city` (parsed from
 * the address); the edge function supplies the rest.
 */
export function proposePropertyRecord(input: {
  address: string
  parcel: ParcelRecord | null
  geocoderCounty: string
  cityCounty: string
  city: string
}): ProposedPropertyRecord {
  const p = input.parcel
  const county = proposeCounty({
    parcelCounty: p?.county ?? '',
    geocoderCounty: input.geocoderCounty,
    cityCounty: input.cityCounty,
    city: input.city,
  })
  if (!p) {
    return {
      found: false,
      county,
      legalDescription: '',
      ownerName: '',
      ownerCompany: '',
      ownerMode: '',
      ownerMailingAddress: '',
      homestead: 'unknown',
      provenance: null,
    }
  }
  const company = ownerLooksLikeCompany(p.ownerName)
  return {
    found: true,
    county,
    legalDescription: p.legalDescription,
    ownerName: company ? '' : p.ownerName,
    ownerCompany: company ? p.ownerName : '',
    ownerMode: p.ownerName ? (company ? 'building_owner' : 'homeowner') : '',
    ownerMailingAddress: p.mailingAddress,
    homestead: homesteadHint(p, input.address),
    provenance: { source: p.source, taxYear: p.taxYear, propId: p.propId },
  }
}

/** The editable fields of a `customer_addresses` row the proposal can fill. */
export type PropertyRecordFields = {
  county: string
  county_source: string
  legal_description: string
  property_kind: string
  homestead: boolean
  owner_mode: string
  owner_name: string
  owner_company: string
  owner_mailing_address: string
  parcel_id: string
  parcel_source: string
  parcel_tax_year: string
}

/**
 * Apply a proposal to a draft. 'fill-blanks' (the default after a lookup)
 * touches only empty fields — a person's typing is never overwritten;
 * 'replace' takes every proposed value (the explicit "Use the record" button).
 * Homestead is only ever SET, never cleared, and only when it is 'likely'
 * on a residential-looking parcel.
 */
export function applyProposalToFields<T extends PropertyRecordFields>(
  fields: T,
  proposal: ProposedPropertyRecord,
  mode: 'fill-blanks' | 'replace',
): T {
  const take = (current: string, proposed: string): string =>
    mode === 'replace' ? proposed || current : current.trim() ? current : proposed
  const next: T = { ...fields }
  if (proposal.county.county) {
    const before = next.county
    next.county = take(next.county, proposal.county.county)
    if (next.county !== before || mode === 'replace') next.county_source = proposal.county.source
  }
  if (!proposal.found) return next
  next.legal_description = take(next.legal_description, proposal.legalDescription)
  next.owner_name = take(next.owner_name, proposal.ownerName)
  next.owner_company = take(next.owner_company, proposal.ownerCompany)
  next.owner_mailing_address = take(next.owner_mailing_address, proposal.ownerMailingAddress)
  if (proposal.ownerMode && (mode === 'replace' || !next.owner_mode)) next.owner_mode = proposal.ownerMode
  if (proposal.ownerMode === 'building_owner' && (mode === 'replace' || !next.property_kind)) {
    next.property_kind = 'non_residential'
  }
  if (proposal.homestead === 'likely' && (mode === 'replace' || !next.property_kind)) {
    next.property_kind = 'residential'
    next.homestead = true
  }
  if (proposal.provenance) {
    next.parcel_id = proposal.provenance.propId
    next.parcel_source = proposal.provenance.source
    next.parcel_tax_year = proposal.provenance.taxYear
  }
  return next
}

/** "Comal Appraisal District · 2025 · Prop ID 178402" — '' when nothing was looked up. */
export function parcelProvenanceLine(fields: Pick<PropertyRecordFields, 'parcel_source' | 'parcel_tax_year' | 'parcel_id'>): string {
  const parts = [fields.parcel_source.trim(), fields.parcel_tax_year.trim(), fields.parcel_id.trim() ? `Prop ID ${fields.parcel_id.trim()}` : ''].filter(Boolean)
  return parts.join(' · ')
}

/** Human line for where the county came from. */
export function countySourceLabel(source: string): string {
  switch (source) {
    case 'parcel':
      return 'from the parcel under the map pin'
    case 'geocoder':
      return 'from the map pin'
    case 'city':
      return 'guessed from the city — confirm it'
    case 'manual':
      return 'typed'
    default:
      return ''
  }
}

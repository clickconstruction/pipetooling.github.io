/**
 * Research, Who pulled it (punch list #292, PR 4): the pure steps behind the two lookups the
 * card makes. A permit's contact line is split into the person and the company; the company
 * is asked of Google Places (Text Search, the New API the address autocomplete already uses);
 * the permit's address is asked of Bexar County's parcel layer, which carries the owner of
 * record, their mailing address and the DBA (the other counties' layers are `permitParcels.ts`).
 * `permit-lookup` runs these;
 * `src/lib/research/permitLookup.test.ts` holds them. No I/O here.
 */

/** A name as `research_name_key` keys it: lower-case letters and digits, the company suffixes dropped. The database's twin. */
export function nameKey(name: string | null | undefined): string | null {
  const lowered = (name ?? '').toLowerCase()
  const stripped = lowered.replace(/\b(llc|l\.l\.c\.|inc|inc\.|co|co\.|corp|corp\.|ltd|ltd\.|llp|pllc|company|incorporated)\b/g, '')
  const key = stripped.replace(/[^a-z0-9]+/g, '')
  return key === '' ? null : key
}

const COMPANY_WORDS = /\b(inc|llc|l\.l\.c|ltd|llp|pllc|corp|co|company|group|construction|builders?|building|contracting|contractors?|design|development|developers?|partners|properties|realty|holdings|investments?|services?|solutions|enterprises?|associates|architects?|architecture|engineering|engineers?|isd|church|ministries|plumbing|electric|mechanical|roofing|homes|custom|restaurants?|hospitality|management|industries|systems|concepts|interiors|studio|signs?|energy|solar)\b/i

/** The person and the company on a contact line: "Milton G. Ramirez, Synergy Construction, LLC" → both; "BOSSTX INC." → the company; "Richard Kenly" → the person. */
export function contactParts(contact: string | null | undefined): { person: string | null; company: string | null } {
  const raw = (contact ?? '').replace(/\s+/g, ' ').trim()
  if (raw === '') return { person: null, company: null }
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0] ?? ''
    const tail = parts.slice(1)
    const rest = tail.join(', ')
    // "Synergy Construction, LLC" and "Luis S. Faraklas, P.E., PLLC" are one name split by its own commas.
    const suffix = /^(llc|l\.l\.c\.?|inc\.?|ltd\.?|llp|pllc|corp\.?|co\.?|p\.?e\.?|r\.?a\.?|aia|cpa|jr\.?|sr\.?|iii?)$/i
    if (tail.every((t) => suffix.test(t))) return { person: null, company: raw }
    if (COMPANY_WORDS.test(first) && !COMPANY_WORDS.test(rest)) return { person: rest, company: first }
    return { person: first, company: rest }
  }
  return COMPANY_WORDS.test(raw) ? { person: null, company: raw } : { person: raw, company: null }
}

/**
 * The key a builder's permits are matched on (punch list #302): the company when the contact line
 * names one, else the person, as `research_name_key` keys a name. `permit-pull` writes it to
 * `permits.builder_key`; the app reads its permits back by it.
 */
export function builderKeyOf(contact: string | null | undefined): string | null {
  const { person, company } = contactParts(contact)
  return nameKey(company ?? person)
}

/** What to ask Google Places for: the company when there is one, else the person, with the city. */
export function placesQuery(contact: string | null | undefined, city: string): string | null {
  const { person, company } = contactParts(contact)
  const who = company ?? person
  return who ? `${who} ${city} TX` : null
}

/** The cache key for a company lookup: the name key of what was asked. */
export function companyLookupKey(contact: string | null | undefined): string | null {
  const { person, company } = contactParts(contact)
  return nameKey(company ?? person)
}

export type CompanyFacts = {
  name: string | null
  phone: string | null
  website: string | null
  address: string | null
  kind: string | null
  maps_url: string | null
  place_id: string | null
  /** exact: Google's name keys the same as what was asked; loose: Google's best guess, read with care. */
  match: 'exact' | 'loose'
}

/** The facts off a Places Text Search answer, or null when it found nothing. */
export function companyFactsFromPlaces(body: unknown, askedKey: string | null): CompanyFacts | null {
  const places = (body as { places?: Array<Record<string, unknown>> } | null)?.places
  if (!Array.isArray(places) || places.length === 0) return null
  const pick = (p: Record<string, unknown>) => {
    const dn = p.displayName as { text?: string } | undefined
    return {
      name: dn?.text ?? null,
      phone: (p.nationalPhoneNumber as string | undefined) ?? null,
      website: (p.websiteUri as string | undefined) ?? null,
      address: (p.formattedAddress as string | undefined) ?? null,
      kind: ((p.primaryTypeDisplayName as { text?: string } | undefined)?.text ?? null),
      maps_url: (p.googleMapsUri as string | undefined) ?? null,
      place_id: (p.id as string | undefined) ?? null,
    }
  }
  // The result whose name keys the same wins; else Google's first.
  const exact = places.find((p) => askedKey && nameKey((p.displayName as { text?: string } | undefined)?.text) === askedKey)
  if (exact) return { ...pick(exact), match: 'exact' }
  const first = places[0]
  return first ? { ...pick(first), match: 'loose' } : null
}

/** The parcel layer's where clause for a street address: the street part, upper-cased, quotes doubled, a prefix match on Situs. */
export function situsWhere(address: string | null | undefined): string | null {
  const street = (address ?? '').split(',')[0]?.replace(/\s+/g, ' ').trim().toUpperCase() ?? ''
  if (street.length < 4) return null
  return `UPPER(Situs) LIKE '${street.replace(/'/g, "''")}%'`
}

export const BEXAR_PARCELS_QUERY = 'https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0/query'
export const BEXAR_PARCEL_FIELDS = 'PropID,Situs,Owner,AddrLn1,AddrLn2,AddrLn3,AddrCity,AddrSt,Zip,DBA,LandVal,ImprVal,TotVal,PropUse,YrBlt,GBA,Acres'

export type ParcelFacts = {
  prop_id: string | null
  situs: string | null
  owner: string | null
  owner_address: string | null
  dba: string | null
  land_value: number | null
  improvement_value: number | null
  total_value: number | null
  use_code: string | null
  year_built: string | null
  building_sf: number | null
  acres: number | null
  detail_url: string | null
  /** How the parcel was found when not by the street address (`permitParcels.ts`): `point`, the permit's own point, asked when the address has no parcel; `id`, the county's id for the lot the permit carries, which is the exact lot. */
  matched_by?: 'point' | 'id'
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

/** The appraisal district's page for a parcel. */
export function bcadDetailUrl(propId: string | null): string | null {
  return propId ? `https://bexar.trueautomation.com/clientdb/Property.aspx?cid=110&prop_id=${encodeURIComponent(propId)}` : null
}

/** The facts off the county's first matching parcel, or null when none matched. */
export function parcelFactsFromCounty(body: unknown): ParcelFacts | null {
  const features = (body as { features?: Array<{ attributes?: Record<string, unknown> }> } | null)?.features
  const a = features?.[0]?.attributes
  if (!a) return null
  const propIdRaw = a.PropID
  const propId = typeof propIdRaw === 'number' ? String(Math.round(propIdRaw)) : str(propIdRaw)
  const ownerAddress = [str(a.AddrLn1), str(a.AddrLn2), str(a.AddrLn3), [str(a.AddrCity), str(a.AddrSt), str(a.Zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return {
    prop_id: propId,
    situs: str(a.Situs),
    owner: str(a.Owner),
    owner_address: ownerAddress === '' ? null : ownerAddress,
    dba: str(a.DBA),
    land_value: num(a.LandVal),
    improvement_value: num(a.ImprVal),
    total_value: num(a.TotVal),
    use_code: str(a.PropUse),
    year_built: str(a.YrBlt),
    building_sf: num(a.GBA),
    acres: num(a.Acres),
    detail_url: bcadDetailUrl(propId),
  }
}

/** The cache key for a parcel lookup. */
export function parcelLookupKey(city: string, address: string | null | undefined): string | null {
  const street = (address ?? '').split(',')[0]?.replace(/\s+/g, ' ').trim().toLowerCase() ?? ''
  return street ? `${city.toLowerCase()}|${street}` : null
}

/** A cached row is fresh for this long. */
export const LOOKUP_FRESH_DAYS = 30
export function lookupIsFresh(lookedUpAtIso: string, nowMs: number, freshDays = LOOKUP_FRESH_DAYS): boolean {
  const t = Date.parse(lookedUpAtIso)
  return Number.isFinite(t) && nowMs - t < freshDays * 86_400_000
}

/** The city's own permit search, where the estimator reads the applicant, the contractor and the licensed professional. */
export const SAN_ANTONIO_PERMIT_PORTAL = 'https://aca-prod.accela.com/COSA/Cap/CapHome.aspx?module=Building&TabName=Building'

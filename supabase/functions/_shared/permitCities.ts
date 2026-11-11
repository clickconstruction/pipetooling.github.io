/**
 * Permits (punch list #292, revision 4): the cities the pull reads, and each city's feed as one
 * shape. A city publishes its permits through its own door (San Antonio's CKAN datastore, Austin's
 * Socrata dataset, a map layer in New Braunfels, San Marcos and Seguin), names its kinds of work in its own words, and keeps its own search pages. A
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
  /**
   * The same page stopped before `untilDay`, for a read back as history (punch list #307). A feed
   * without it cannot be read back yet, and `permit-pull` says so.
   */
  pageUrlBefore?: (sinceDay: string, untilDay: string, limit: number, offset: number) => string
  /** The records in the door's answer. Throws with the door's own words when it refused the read. */
  recordsOf: (body: unknown) => Record<string, unknown>[]
  /** One record as a `permits` row, or null when the pull does not keep it. */
  rowOf: (record: Record<string, unknown>) => PermitRow | null
  /** The most rows the door hands over in one page, when that is fewer than the pull asks for. */
  pageSize?: number
  /**
   * Which of two rows of one permit the pull keeps, for a door that hands a permit over more than
   * once. Without it the later row wins.
   */
  prefer?: (held: PermitRow, next: PermitRow) => PermitRow
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
    pageUrlBefore: (sinceDay, untilDay, limit, offset) => `${SAN_ANTONIO_CKAN}?sql=${encodeURIComponent(feedPageSql(feed, sinceDay, limit, offset, untilDay))}`,
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

// ---- A city's map layer (ArcGIS): New Braunfels, San Marcos and Seguin each publish one. ----

/** A day from a map layer's date, which is a count of milliseconds: the day it names in UTC, as the layer wrote it. */
export function dayFromMs(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** A day from "10/17/2026 8:07:43 AM", the way Seguin writes an issue date. */
export function dayFromUsDate(value: unknown): string | null {
  const m = (textOf(value) ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  return m ? `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}` : null
}

/** A status that says the permit is not going ahead. */
const DEAD_STATUS = /void|withdrawn|cancel|denied|expired|rejected/i

type MapLayer = {
  source: string
  city: string
  /** The layer's address, without `/query`. */
  layerUrl: string
  pageSize: number
  /** The layer's SQL for the kinds the pull keeps, filed or issued on or after a day. */
  where: (sinceDay: string) => string
  orderBy: string
  rowOf: (record: Record<string, unknown>) => PermitRow | null
  prefer?: (held: PermitRow, next: PermitRow) => PermitRow
}

/** A reader over one map layer: its attributes are the record, and its point rides along as `_lat` and `_lng`. */
function mapLayerReader(layer: MapLayer): FeedReader {
  return {
    source: layer.source,
    city: layer.city,
    // The layer is read by the day a permit was applied for; a row says for itself whether it is issued.
    stage: 'applied',
    pageSize: layer.pageSize,
    pageUrl: (sinceDay, limit, offset) => {
      assertDay(sinceDay, layer.source)
      const q = new URLSearchParams({
        where: layer.where(sinceDay),
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        orderByFields: layer.orderBy,
        resultOffset: String(Math.max(0, Math.floor(offset))),
        resultRecordCount: String(Math.max(1, Math.min(Math.floor(limit), layer.pageSize))),
        f: 'json',
      })
      return `${layer.layerUrl}/query?${q.toString()}`
    },
    recordsOf: (body) => {
      const b = body as { error?: { message?: unknown }; features?: Array<{ attributes?: Record<string, unknown>; geometry?: { x?: unknown; y?: unknown } | null }> } | null
      if (!b || b.error) throw new Error(`the feed refused the read: ${String(b?.error?.message ?? JSON.stringify(b?.error ?? {})).slice(0, 300)}`)
      return (b.features ?? []).map((f) => ({ ...(f.attributes ?? {}), _lat: f.geometry?.y ?? null, _lng: f.geometry?.x ?? null }))
    },
    rowOf: layer.rowOf,
    prefer: layer.prefer,
  }
}

/** The record as the ledger keeps it: the layer's dates as days, and none of the reader's own keys. */
function rawOf(record: Record<string, unknown>, dateFields: readonly string[], drop: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    if (k.startsWith('_') || drop.includes(k)) continue
    out[k] = dateFields.includes(k) ? dayFromMs(v) : v
  }
  return out
}

function sqlList(words: readonly string[]): string {
  return words.map((w) => `'${w.replace(/'/g, "''")}'`).join(', ')
}

/** The five-digit zip an address ends on, when it carries one. */
function zipOfTail(address: string | null): string | null {
  return (address ?? '').match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? null
}

// San Marcos: the city's building-permits layer. It names no one; it carries the kind, the land use, the days and the square feet.

export const SAN_MARCOS_LAYER = 'https://smgis.sanmarcostx.gov/arcgis/rest/services/Planning/CoSM_BuildingPermits/FeatureServer/0'
const SAN_MARCOS_HOUSE_USES = ['Single Family', 'Townhouse', 'Duplex', 'Manufactured Home']
const SAN_MARCOS_KINDS = ['New Commercial', 'New', 'Shell', 'Tenant Finish Out', 'Commercial Remodel', 'Remodel', 'Addition', 'Site Prep.', 'New Residential', 'Plumbing']

/** A San Marcos record as a kind. Apartments are filed as New Residential on multi-family land: commercial work. */
export function classifySanMarcos(record: Record<string, unknown>): PermitTypeClass | null {
  const type = textOf(record['TYPE'])
  const use = textOf(record['LANDUSE']) ?? ''
  const house = SAN_MARCOS_HOUSE_USES.includes(use)
  if (type === 'Plumbing') return { kind: 'plumbing', residential: false, work: 'Plumbing' }
  if (type === 'New Commercial' || type === 'Shell') return { kind: 'building', residential: false, work: 'New commercial' }
  if (type === 'New Residential') return house || use === '' ? { kind: 'building', residential: true, work: 'New house' } : { kind: 'building', residential: false, work: 'New commercial' }
  if (type === 'New') return house ? { kind: 'building', residential: true, work: 'New house' } : use === '' ? null : { kind: 'building', residential: false, work: 'New commercial' }
  if (type === 'Tenant Finish Out' || type === 'Commercial Remodel') return { kind: 'building', residential: false, work: 'Commercial remodel' }
  if (type === 'Remodel') return house || use === '' ? null : { kind: 'building', residential: false, work: 'Commercial remodel' }
  if (type === 'Addition') return use === '' ? null : house ? { kind: 'building', residential: true, work: 'Home addition' } : { kind: 'building', residential: false, work: 'Commercial addition' }
  if (type === 'Site Prep.') return house || use === '' ? null : { kind: 'building', residential: false, work: 'Commercial site work' }
  return null
}

export function permitRowFromSanMarcos(record: Record<string, unknown>): PermitRow | null {
  const cls = classifySanMarcos(record)
  if (!cls || DEAD_STATUS.test(textOf(record['STATUS']) ?? '')) return null
  const number = textOf(record['PROJECTNUMBER']) ?? textOf(record['PERMITID'])
  if (!number) return null
  const address = textOf(record['ADDRESS'])
  const point = texasPoint(record['_lat'], record['_lng'])
  const issued = dayFromMs(record['ISSUED'])
  return {
    city: 'San Marcos',
    source: 'sm-permits',
    permit_number: number,
    permit_type: textOf(record['TYPE']) ?? '',
    kind: cls.kind,
    stage: issued ? 'issued' : 'applied',
    residential: cls.residential,
    work_type: cls.work,
    project_name: shortDescription(record['ProjectName']),
    address,
    address_key: addressKeyOf(address),
    zip: null,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    submitted_on: dayFromMs(record['APPLIED']),
    issued_on: issued,
    declared_value: null,
    area_sf: positive(record['SQUAREFEET']),
    contact: null,
    builder_key: null,
    raw: rawOf(record, ['APPLIED', 'ISSUED', 'created_date', 'last_edited_date'], ['created_user', 'last_edited_user', 'GlobalID']),
  }
}

export const SAN_MARCOS_READER = mapLayerReader({
  source: 'sm-permits',
  city: 'San Marcos',
  layerUrl: SAN_MARCOS_LAYER,
  pageSize: 1000,
  where: (since) => `(APPLIED >= DATE '${since}' OR ISSUED >= DATE '${since}') AND TYPE IN (${sqlList(SAN_MARCOS_KINDS)})`,
  orderBy: 'APPLIED ASC, OBJECTID ASC',
  rowOf: permitRowFromSanMarcos,
})

// Seguin: the city's permits layer. Its name column is the desk that issued the permit, so it names no one;
// each row links to the city's own page for the permit, which does.

export const SEGUIN_LAYER = 'https://gis.seguintexas.gov/arcgis/rest/services/Permits/Permits/FeatureServer/0'
const SEGUIN_KINDS: ReadonlyArray<{ starts: string; cls: PermitTypeClass }> = [
  { starts: 'Commercial Building New', cls: { kind: 'building', residential: false, work: 'New commercial' } },
  { starts: 'Commercial Remodel', cls: { kind: 'building', residential: false, work: 'Commercial remodel' } },
  { starts: 'Commercial Add On', cls: { kind: 'building', residential: false, work: 'Commercial addition' } },
  { starts: 'Commercial Plumbing', cls: { kind: 'plumbing', residential: false, work: 'Plumbing' } },
  { starts: 'Residential Plumbing', cls: { kind: 'plumbing', residential: false, work: 'Plumbing' } },
  { starts: 'Building Residental', cls: { kind: 'building', residential: true, work: 'New house' } },
  { starts: 'Building Duplex', cls: { kind: 'building', residential: true, work: 'New house' } },
  { starts: 'Residential Add On', cls: { kind: 'building', residential: true, work: 'Home addition' } },
]

export function classifySeguin(record: Record<string, unknown>): PermitTypeClass | null {
  const d = textOf(record['USER_DESCRIPTION']) ?? ''
  return SEGUIN_KINDS.find((k) => d.startsWith(k.starts))?.cls ?? null
}

export function permitRowFromSeguin(record: Record<string, unknown>): PermitRow | null {
  const cls = classifySeguin(record)
  if (!cls || DEAD_STATUS.test(textOf(record['USER_PERMITSTATUS']) ?? '')) return null
  const number = textOf(record['USER_PERMITNUMBER'])
  if (!number) return null
  const address = textOf(record['USER_Address'])
  const point = texasPoint(record['_lat'], record['_lng'])
  const issued = dayFromUsDate(record['USER_DATEISSUED'])
  // The city's name for the kind runs to a paragraph on the newer ones: the words before the dash or the bracket are the kind.
  const type = (textOf(record['USER_DESCRIPTION']) ?? '').split(/ - | \(/)[0]!.trim()
  return {
    city: 'Seguin',
    source: 'seguin-permits',
    permit_number: number,
    permit_type: type,
    kind: cls.kind,
    stage: issued ? 'issued' : 'applied',
    residential: cls.residential,
    work_type: cls.work,
    project_name: shortDescription(record['USER_DESCRIPTION1']),
    address,
    address_key: addressKeyOf(address),
    zip: zipOfTail(address),
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    submitted_on: dayFromMs(record['USER_APPLYDATE']),
    issued_on: issued,
    declared_value: null,
    area_sf: null,
    contact: null,
    builder_key: null,
    raw: rawOf(record, ['USER_APPLYDATE'], ['Last7Days']),
  }
}

export const SEGUIN_READER = mapLayerReader({
  source: 'seguin-permits',
  city: 'Seguin',
  layerUrl: SEGUIN_LAYER,
  pageSize: 1000,
  where: (since) => `USER_APPLYDATE >= DATE '${since}' AND (${SEGUIN_KINDS.map((k) => `USER_DESCRIPTION LIKE '${k.starts}%'`).join(' OR ')})`,
  orderBy: 'USER_APPLYDATE ASC, OBJECTID ASC',
  rowOf: permitRowFromSeguin,
})

// New Braunfels: the Permits layer of the city's open-data map service, with the applicant, the owner and the contractor.

export const NEW_BRAUNFELS_LAYER = 'https://gismaps.newbraunfels.gov/arcserverwa22/rest/services/OpenData/PlanningZoning/MapServer/10'
const NEW_BRAUNFELS_TYPES = ['Commercial  EPR', 'Commercial', 'Residential  EPR', 'Commercial Plumbing', 'Residential Plumbing']

/** A New Braunfels record as a kind, from its type and its subtype; a subtype copied in the city's system carries "(clone)". */
export function classifyNewBraunfels(record: Record<string, unknown>): PermitTypeClass | null {
  const type = (textOf(record['Permit_TYPE_DESC']) ?? '').replace(/\s+/g, ' ')
  const sub = (textOf(record['Permit_SUBTYPE_DESC']) ?? '').replace(/\s*\(clone\)\s*$/i, '').trim()
  if (type === 'Commercial Plumbing' || type === 'Residential Plumbing') return { kind: 'plumbing', residential: false, work: 'Plumbing' }
  if (type === 'Commercial EPR' || type === 'Commercial') {
    if (sub === 'New Build') return { kind: 'building', residential: false, work: 'New commercial' }
    if (sub === 'Alteration-Remodel' || sub === 'Finish Out') return { kind: 'building', residential: false, work: 'Commercial remodel' }
    if (sub === 'Addition') return { kind: 'building', residential: false, work: 'Commercial addition' }
    return null
  }
  if (type === 'Residential EPR') {
    if (sub === 'New Build') return { kind: 'building', residential: true, work: 'New house' }
    if (sub === 'Addition') return { kind: 'building', residential: true, work: 'Home addition' }
  }
  return null
}

export function permitRowFromNewBraunfels(record: Record<string, unknown>): PermitRow | null {
  const cls = classifyNewBraunfels(record)
  if (!cls || DEAD_STATUS.test(textOf(record['Permit_Status']) ?? '')) return null
  const number = textOf(record['CoNB_Permit_Number'])
  if (!number) return null
  const address = textOf(record['Permit_Address'])
  const point = texasPoint(record['_lat'], record['_lng'])
  const issued = dayFromMs(record['Permit_Issue_Date'])
  // Who pulled it: the contractor once the city has one on the permit, else the applicant.
  const contact = textOf(record['Contractor_Name']) ?? textOf(record['Applicant_Name'])
  return {
    city: 'New Braunfels',
    source: 'nb-permits',
    permit_number: number,
    permit_type: textOf(record['Permit_Type_Name']) ?? textOf(record['Permit_TYPE_DESC']) ?? '',
    kind: cls.kind,
    stage: issued ? 'issued' : 'applied',
    residential: cls.residential,
    work_type: cls.work,
    project_name: shortDescription(record['Permit_Label']),
    address,
    address_key: addressKeyOf(address),
    zip: null,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    submitted_on: dayFromMs(record['Permit_Submit_Date']),
    issued_on: issued,
    declared_value: null,
    area_sf: null,
    contact,
    builder_key: builderKeyOf(contact),
    raw: rawOf(record, ['Permit_Submit_Date', 'Permit_Issue_Date', 'Permit_Status_Date', 'LOADDTT'], ['GlobalID', 'UID', 'uniquePMT_ID', 'GISAddrKey', 'Shape']),
  }
}

/**
 * New Braunfels writes a permit once for every person on it: each applicant, the general
 * contractor, and each trade's contractor. The row worth keeping names whoever is building it: the
 * general contractor first, then a row with no contractor (the applicant), then a trade. Among
 * equals the row the city wrote first.
 */
export function newBraunfelsNameRank(row: PermitRow): number {
  const type = textOf(row.raw['Contractor_Type']) ?? ''
  if (/^general contractor/i.test(type)) return 0
  if (type === '') return 1
  return 2
}

export function preferNewBraunfels(held: PermitRow, next: PermitRow): PermitRow {
  const a = newBraunfelsNameRank(held)
  const b = newBraunfelsNameRank(next)
  if (a !== b) return a < b ? held : next
  const first = (r: PermitRow) => numberOf(r.raw['OBJECTID']) ?? Number.MAX_SAFE_INTEGER
  return first(next) < first(held) ? next : held
}

export const NEW_BRAUNFELS_READER = mapLayerReader({
  source: 'nb-permits',
  city: 'New Braunfels',
  layerUrl: NEW_BRAUNFELS_LAYER,
  pageSize: 1000,
  where: (since) => `(Permit_Submit_Date >= DATE '${since}' OR Permit_Issue_Date >= DATE '${since}') AND Permit_Group = 'Building' AND Permit_TYPE_DESC IN (${sqlList(NEW_BRAUNFELS_TYPES)})`,
  orderBy: 'Permit_Submit_Date ASC, OBJECTID ASC',
  rowOf: permitRowFromNewBraunfels,
  prefer: preferNewBraunfels,
})

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
  {
    name: 'New Braunfels',
    county: 'Comal',
    center: { lat: 29.703, lng: -98.1245 },
    permitSearch: 'https://nbpermits.nbtexas.org/publicaccess',
    // The Comal County Clerk's page links here for land records.
    deeds: 'https://comal.landrecordsonline.com/',
    parcels: false,
    feeds: [NEW_BRAUNFELS_READER],
  },
  {
    name: 'San Marcos',
    county: 'Hays',
    center: { lat: 29.8833, lng: -97.9414 },
    permitSearch: 'https://www.mygovernmentonline.org/',
    // The Hays County Clerk's self-service records search, on the county's own address.
    deeds: 'https://erss.co.hays.tx.us/web/',
    parcels: false,
    feeds: [SAN_MARCOS_READER],
  },
  {
    name: 'Seguin',
    county: 'Guadalupe',
    center: { lat: 29.5688, lng: -97.9647 },
    permitSearch: 'https://eportal.seguintexas.gov/EnerGov_Prod/SelfService',
    // The Guadalupe County Clerk's official public records page links here.
    deeds: 'https://roam.guadalupetx.gov/',
    parcels: false,
    feeds: [SEGUIN_READER],
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

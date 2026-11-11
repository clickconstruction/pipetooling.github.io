/**
 * Research (punch list #292): the shape of a city's permit feed and the pure steps that turn one
 * of its rows into a `permits` row. San Antonio first: its open-data portal (CKAN) publishes the
 * permits it issues and the applications it takes, each as a datastore the SQL door reads. The
 * function `permit-pull` runs these; `src/lib/research/permitFeed.test.ts` holds them. No I/O.
 */
import { pointFromFeedCoords } from './permitCoords.ts'
import { builderKeyOf } from './permitLookup.ts'

export type PermitKind = 'building' | 'plumbing' | 'other'
export type PermitStage = 'applied' | 'issued'

export type PermitFeed = {
  /** The `permits.source` value. */
  source: string
  city: string
  stage: PermitStage
  /** The CKAN datastore resource id. */
  resourceId: string
  /** The column the pull's since-day reads: issued permits by their issue day, applications by their submit day. */
  dateColumn: 'DATE ISSUED' | 'DATE SUBMITTED'
}

export const SAN_ANTONIO_CKAN = 'https://data.sanantonio.gov/api/3/action/datastore_search_sql'

export const SA_ISSUED_FEED: PermitFeed = { source: 'sa-issued', city: 'San Antonio', stage: 'issued', resourceId: 'c21106f9-3ef5-4f3a-8604-f992b4db7512', dateColumn: 'DATE ISSUED' }
export const SA_APPLIED_FEED: PermitFeed = { source: 'sa-applied', city: 'San Antonio', stage: 'applied', resourceId: 'fbb7202e-c6c1-475b-849e-c5c2cfb65833', dateColumn: 'DATE SUBMITTED' }
export const SAN_ANTONIO_FEEDS: readonly PermitFeed[] = [SA_ISSUED_FEED, SA_APPLIED_FEED]

/** What the pull keeps, by the feed's PERMIT TYPE; anything else is skipped. */
export type PermitTypeClass = { kind: PermitKind; residential: boolean; work: string }

const BUILDING_TYPES: Record<string, PermitTypeClass> = {
  'Comm New Building Permit': { kind: 'building', residential: false, work: 'New commercial' },
  'Comm Remodel Permit': { kind: 'building', residential: false, work: 'Commercial remodel' },
  'Comm Addition Permit': { kind: 'building', residential: false, work: 'Commercial addition' },
  'Comm Sitework Permit': { kind: 'building', residential: false, work: 'Commercial site work' },
  'Commercial Project Application': { kind: 'building', residential: false, work: 'Commercial project' },
  'Res New Building Permit': { kind: 'building', residential: true, work: 'New house' },
  'Home Addition Permit': { kind: 'building', residential: true, work: 'Home addition' },
  'Res Building Application': { kind: 'building', residential: true, work: 'Residential building' },
}

/**
 * The feed's PERMIT TYPE as a kind: a building permit the ledger shows, a plumbing permit that names
 * the plumber on a job, or null for the rest (fences, signs, garage sales, the other trades).
 */
export function classifyPermitType(permitType: string | null | undefined): PermitTypeClass | null {
  const t = (permitType ?? '').trim()
  if (t === '') return null
  const building = BUILDING_TYPES[t]
  if (building) return building
  if (/^Plumbing /i.test(t) || /^LSR Plumbing/i.test(t)) return { kind: 'plumbing', residential: false, work: t.replace(/ Permit$/i, '') }
  return null
}

/** The SQL `IN (...)` list of every type the pull keeps, quoted for the door; plumbing types come by LIKE. */
export function keptTypesSql(): string {
  return Object.keys(BUILDING_TYPES)
    .map((t) => `'${t.replace(/'/g, "''")}'`)
    .join(', ')
}

/**
 * The address with the feed's city tail stripped, one space between words, lower-cased: two rows on
 * one address pair on it. "8751 STATE HWY 151, City of San Antonio, TX 78245" → "8751 state hwy 151".
 */
export function addressKeyOf(address: string | null | undefined): string | null {
  const raw = (address ?? '').trim()
  if (raw === '') return null
  const head = raw.split(',')[0] ?? raw
  const key = head.replace(/\s+/g, ' ').trim().toLowerCase()
  return key === '' ? null : key
}

/** The five-digit zip at the end of the feed's address, when it carries one. */
export function zipOf(address: string | null | undefined): string | null {
  const m = (address ?? '').match(/\b(\d{5})(?:-\d{4})?\s*$/)
  return m?.[1] ?? null
}

/** The street part of the feed's address, for the ledger: the text before the first comma. */
export function streetOf(address: string | null | undefined): string | null {
  const raw = (address ?? '').trim()
  if (raw === '') return null
  const head = (raw.split(',')[0] ?? raw).replace(/\s+/g, ' ').trim()
  return head === '' ? null : head
}

/** A feed date ('2026-11-06' or '2026-11-06T00:00:00') as a YYYY-MM-DD day, or null. */
export function dayOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? null
}

export function numberOf(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function textOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.replace(/\s+/g, ' ').trim()
  return t === '' ? null : t
}

/** The `permits` row the pull writes. */
export type PermitRow = {
  city: string
  source: string
  permit_number: string
  permit_type: string
  kind: PermitKind
  stage: PermitStage
  residential: boolean
  work_type: string | null
  project_name: string | null
  address: string | null
  address_key: string | null
  zip: string | null
  lat: number | null
  lng: number | null
  submitted_on: string | null
  issued_on: string | null
  declared_value: number | null
  area_sf: number | null
  contact: string | null
  /** The company (else the person) on the contact line, keyed: every permit of one builder shares it. */
  builder_key: string | null
  raw: Record<string, unknown>
}

/** One San Antonio datastore record as a `permits` row, or null when the pull does not keep its type or it has no number. */
export function permitRowFromSanAntonio(record: Record<string, unknown>, feed: PermitFeed): PermitRow | null {
  const cls = classifyPermitType(textOf(record['PERMIT TYPE']))
  if (!cls) return null
  const number = textOf(record['PERMIT #'])
  if (!number) return null
  const address = textOf(record['ADDRESS'])
  const point = pointFromFeedCoords(record['X_COORD'] as string | number | null, record['Y_COORD'] as string | number | null)
  const { _full_text: _dropped, ...raw } = record as Record<string, unknown> & { _full_text?: unknown }
  // The work the feed names: its WORK TYPE (New, Existing, Other) adds nothing to the kind's own words.
  return {
    city: feed.city,
    source: feed.source,
    permit_number: number,
    permit_type: textOf(record['PERMIT TYPE']) ?? '',
    kind: cls.kind,
    stage: feed.stage,
    residential: cls.residential,
    work_type: cls.work,
    project_name: textOf(record['PROJECT NAME']),
    address: streetOf(address),
    address_key: addressKeyOf(address),
    zip: zipOf(address),
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    submitted_on: dayOf(record['DATE SUBMITTED']),
    issued_on: dayOf(record['DATE ISSUED']),
    declared_value: numberOf(record['DECLARED VALUATION']),
    area_sf: numberOf(record['AREA (SF)']),
    contact: textOf(record['PRIMARY CONTACT']),
    builder_key: builderKeyOf(textOf(record['PRIMARY CONTACT'])),
    raw,
  }
}

/**
 * The SQL one page of a feed reads: the kept building types and every plumbing type filed on or after
 * `sinceDay`, oldest first so a page boundary never skips a day, `limit` rows from `offset`.
 */
export function feedPageSql(feed: PermitFeed, sinceDay: string, limit: number, offset: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceDay)) throw new Error(`feedPageSql: sinceDay must be YYYY-MM-DD, got ${sinceDay}`)
  const col = `"${feed.dateColumn}"`
  return (
    `SELECT "PERMIT TYPE","PERMIT #","PROJECT NAME","WORK TYPE","ADDRESS","X_COORD","Y_COORD","DATE SUBMITTED","DATE ISSUED","DECLARED VALUATION","AREA (SF)","PRIMARY CONTACT" ` +
    `FROM "${feed.resourceId}" ` +
    `WHERE ${col} >= '${sinceDay}' AND ("PERMIT TYPE" IN (${keptTypesSql()}) OR "PERMIT TYPE" LIKE 'Plumbing %' OR "PERMIT TYPE" LIKE 'LSR Plumbing%') ` +
    `ORDER BY ${col} ASC, "_id" ASC LIMIT ${Math.max(1, Math.floor(limit))} OFFSET ${Math.max(0, Math.floor(offset))}`
  )
}

/** The day a pull starts from: ten days before the newest row it has, so late rows land; `firstRunDays` back when it has none. */
export function pullSinceDay(newestFiledOn: string | null, todayYmd: string, firstRunDays = 75, lookbackDays = 10): string {
  const base = newestFiledOn ?? todayYmd
  const back = newestFiledOn ? lookbackDays : firstRunDays
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

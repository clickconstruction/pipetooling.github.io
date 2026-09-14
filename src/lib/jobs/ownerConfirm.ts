/**
 * Owner of record — the Fix-ups list that looks itself up (v2.3447, PR 1 of
 * the owner-of-record train; `to-dos/owner-of-record-prompts/`).
 *
 * The § 53.056 notice goes to the owner of record at a mailing address. The
 * parcel lookup (`property-lookup`, v2.3004) answers that for nearly every
 * address in the service area, so the office never types an owner: the list
 * looks every GC job up and a person presses Use. This kernel is the pure
 * half — the RPC row shape, what the roll's answer *reads as* (a public owner
 * where a lien does not attach, a landlord, a likely homestead), the grouping
 * by property, and the counts. Persistence lives in `ownerConfirmWrite.ts`.
 */
import { addressStreetKey, homesteadHint, ownerLooksLikeCompany, type ParcelRecord } from '../customers/propertyRecord'

/** One row of `list_jobs_owner_to_confirm()` — a GC job with approved hours and no confirmed owner. */
export type OwnerToConfirmRow = {
  jobId: string
  hcpNumber: string
  clickNumber: string
  jobAddress: string
  status: string
  customerId: string | null
  customerName: string
  gcCustomerId: string | null
  gcName: string
  customerAddressId: string | null
  /** The Lien desk's reading: an owner with a mailing address is on file (record or job override). */
  hasOwner: boolean
  ownerConfirmed: boolean
  propertyKind: string
  /** 'YYYY-MM' of the earliest approved clock session. */
  firstWorkMonth: string
  /** 'YYYY-MM-DD' — the § 53.056 date for that month; null when the month could not be dated. */
  firstDeadline: string | null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function idOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

/** Fold the RPC payload into typed rows; anything that is not a row is dropped. */
export function parseOwnerToConfirmRows(raw: unknown): OwnerToConfirmRow[] {
  if (!Array.isArray(raw)) return []
  const out: OwnerToConfirmRow[] = []
  for (const r of raw) {
    if (r == null || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const jobId = str(o.job_id)
    if (!jobId) continue
    out.push({
      jobId,
      hcpNumber: str(o.hcp_number),
      clickNumber: str(o.click_number),
      jobAddress: str(o.job_address).trim(),
      status: str(o.status),
      customerId: idOrNull(o.customer_id),
      customerName: str(o.customer_name).trim(),
      gcCustomerId: idOrNull(o.gc_customer_id),
      gcName: str(o.gc_name).trim(),
      customerAddressId: idOrNull(o.customer_address_id),
      hasOwner: o.has_owner === true,
      ownerConfirmed: o.owner_confirmed === true,
      propertyKind: str(o.property_kind),
      firstWorkMonth: str(o.first_work_month),
      firstDeadline: typeof o.first_deadline === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o.first_deadline) ? o.first_deadline.slice(0, 10) : null,
    })
  }
  return out
}

/** The builder on the job: the GC, or the customer when a builder sits in the customer row with no GC. */
export function builderName(row: Pick<OwnerToConfirmRow, 'gcName' | 'customerName' | 'gcCustomerId'>): string {
  return row.gcCustomerId ? row.gcName || 'GC' : row.customerName
}

export type OwnerKind = 'public' | 'company' | 'individual'

// A city, county, school district, the State, a federal or municipal body, a
// water district or authority, a public university — property a mechanic's
// lien does not attach to (the remedy is a claim on the GC's payment bond).
const PUBLIC_RE =
  /\b(CITY OF|COUNTY|ISD|INDEPENDENT SCHOOL|SCHOOL DISTRICT|STATE OF TEXAS|TEXAS DEPARTMENT|TEXAS DEPT|UNITED STATES|MUNICIPAL|WATER DISTRICT|MUD|AUTHORITY|UNIVERSITY|HOUSING AUTHORITY)\b/i
/** The federal government as the roll abbreviates it — the whole name, so "USA Properties LLC" stays a company. */
const FEDERAL_RE = /^U\.? ?S\.? ?A\.?( OF AMERICA)?$/i

/** What kind of owner the roll names: public body · company · person. */
export function ownerKind(ownerName: string): OwnerKind {
  const name = ownerName.trim()
  if (!name) return 'individual'
  if (PUBLIC_RE.test(name) || FEDERAL_RE.test(name)) return 'public'
  if (ownerLooksLikeCompany(name)) return 'company'
  return 'individual'
}

const ENTITY_SUFFIX_RE = /\b(llc|l l c|inc|incorporated|corp|corporation|co|company|lp|l p|llp|ltd|limited|the)\b/g

/** Lower-case letters and digits only, entity suffixes dropped: "ATI Schertz, LLC" → "ati schertz". */
export function normalizeOwnerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(ENTITY_SUFFIX_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function namesMatch(a: string, b: string): boolean {
  const x = normalizeOwnerName(a)
  const y = normalizeOwnerName(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

/**
 * The owner is not the customer: the job has a customer row (not the builder)
 * whose name does not match the roll's owner — a tenant hired the work, the
 * notice goes to the landlord. Never when there is no customer row, and never
 * when the customer row IS the builder (the builder-as-customer shape).
 */
export function isLandlord(input: { ownerName: string; customerName: string | null | undefined; gcName: string | null | undefined }): boolean {
  const customer = (input.customerName ?? '').trim()
  const owner = input.ownerName.trim()
  if (!customer || !owner) return false
  const gc = (input.gcName ?? '').trim()
  if (!gc) return false
  if (namesMatch(customer, gc)) return false
  return !namesMatch(customer, owner)
}

export type ReadsAsChipKey = 'public' | 'landlord' | 'homestead' | 'mail-elsewhere'

export type ReadsAsChip = {
  key: ReadsAsChipKey
  label: string
  tone: 'red' | 'amber' | 'grey'
}

/** The chips under the roll's answer — what the office needs to know before a notice is drafted. */
export function readsAs(row: Pick<OwnerToConfirmRow, 'jobAddress' | 'customerName' | 'gcName' | 'gcCustomerId'>, parcel: ParcelRecord | null): ReadsAsChip[] {
  if (!parcel || !parcel.ownerName.trim()) return []
  const chips: ReadsAsChip[] = []
  const kind = ownerKind(parcel.ownerName)
  if (kind === 'public') {
    chips.push({ key: 'public', label: 'public owner — bond claim, not a lien', tone: 'red' })
  } else if (isLandlord({ ownerName: parcel.ownerName, customerName: row.customerName, gcName: row.gcCustomerId ? row.gcName || 'GC' : '' })) {
    chips.push({ key: 'landlord', label: `landlord · ${row.customerName} is the tenant`, tone: 'amber' })
  }
  const hs = homesteadHint(parcel, row.jobAddress)
  if (hs === 'likely') chips.push({ key: 'homestead', label: 'likely homestead', tone: 'red' })
  if (kind !== 'public' && hs !== 'likely') {
    const site = addressStreetKey(row.jobAddress) || addressStreetKey(parcel.situsAddress)
    const mail = addressStreetKey(parcel.mailingAddress)
    if (parcel.mailingAddress.trim() && site && mail !== site) chips.push({ key: 'mail-elsewhere', label: 'mail elsewhere', tone: 'grey' })
  }
  return chips
}

/** Use all found takes every row with a parcel except a public owner — that one is confirmed by its own Use, eyes open. */
export function eligibleForUseAll(chips: ReadsAsChip[]): boolean {
  return !chips.some((c) => c.key === 'public')
}

export type OwnerConfirmProperty = {
  /** `addressStreetKey` of the site (falls back to the lower-cased address). */
  key: string
  address: string
  jobs: OwnerToConfirmRow[]
  /** Earliest first deadline across the jobs (null when none is dated). */
  firstDeadline: string | null
  /** The work month behind that deadline ('YYYY-MM'). */
  firstWorkMonth: string
  /** That first month's notice window has already closed (deadline before today). */
  windowClosed: boolean
  /** "due Sep 15" · "March's window closed · later months live" · "" when undated. */
  noticeLabel: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function monthName(ym: string): string {
  const m = Number(ym.slice(5, 7))
  return MONTHS[m - 1] ?? ym
}

/** "2026-09-15" → "Sep 15" (no Date parsing — the string is already a calendar day). */
export function shortDay(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ymd
  return `${(MONTHS[Number(m[2]) - 1] ?? '').slice(0, 3)} ${Number(m[3])}`
}

export function propertyKey(address: string): string {
  return addressStreetKey(address) || address.trim().toLowerCase()
}

/**
 * One entry per property (jobs at the same street number + street share a
 * lookup and a Use), sorted by the earliest first deadline — the sitting
 * starts with the notice due soonest. A first month whose window has closed
 * is flagged; later months on that job are still live and still need an owner.
 */
export function groupByProperty(rows: OwnerToConfirmRow[], todayYmd: string): OwnerConfirmProperty[] {
  const byKey = new Map<string, OwnerConfirmProperty>()
  for (const r of rows) {
    const key = propertyKey(r.jobAddress)
    let p = byKey.get(key)
    if (!p) {
      p = { key, address: r.jobAddress, jobs: [], firstDeadline: null, firstWorkMonth: '', windowClosed: false, noticeLabel: '' }
      byKey.set(key, p)
    }
    p.jobs.push(r)
    if (r.firstDeadline && (!p.firstDeadline || r.firstDeadline < p.firstDeadline)) {
      p.firstDeadline = r.firstDeadline
      p.firstWorkMonth = r.firstWorkMonth
    }
  }
  const out = [...byKey.values()]
  for (const p of out) {
    p.jobs.sort((a, b) => (a.hcpNumber || a.clickNumber).localeCompare(b.hcpNumber || b.clickNumber, undefined, { numeric: true }))
    if (p.firstDeadline) {
      p.windowClosed = p.firstDeadline < todayYmd
      p.noticeLabel = p.windowClosed ? `${monthName(p.firstWorkMonth)}'s window closed · later months live` : `due ${shortDay(p.firstDeadline)}`
    }
  }
  out.sort((a, b) => {
    if (a.firstDeadline && b.firstDeadline && a.firstDeadline !== b.firstDeadline) return a.firstDeadline < b.firstDeadline ? -1 : 1
    if (a.firstDeadline && !b.firstDeadline) return -1
    if (!a.firstDeadline && b.firstDeadline) return 1
    return a.address.localeCompare(b.address)
  })
  return out
}

/** The Fix-ups chip's number: jobs, not properties — one per notice clock. */
export function fixupCount(rows: OwnerToConfirmRow[]): number {
  return rows.length
}

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
import { cleanStoredAddress } from '../displayAddress'

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
  /** first_work_month is the job's creation month — the job has no approved hours (v2.3747). */
  firstMonthFromCreation: boolean
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
      jobAddress: cleanStoredAddress(str(o.job_address)),
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
      firstMonthFromCreation: o.month_source === 'job_created',
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

/**
 * The chips under the roll's answer — what the office needs to know before a notice is drafted.
 * `mail-elsewhere` is residential-only (v2.3688): on a commercial job the owner is a company, a
 * REIT or an investor nearly every time, so the reading was always true and said nothing; on a
 * house it can mean the roll is stale or the owner has moved.
 */
export function readsAs(row: Pick<OwnerToConfirmRow, 'jobAddress' | 'customerName' | 'gcName' | 'gcCustomerId'> & { propertyKind?: string }, parcel: ParcelRecord | null): ReadsAsChip[] {
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
  if (kind !== 'public' && hs !== 'likely' && (row.propertyKind ?? '') === 'residential') {
    const site = addressStreetKey(row.jobAddress) || addressStreetKey(parcel.situsAddress)
    const mail = addressStreetKey(parcel.mailingAddress)
    if (parcel.mailingAddress.trim() && site && mail !== site) chips.push({ key: 'mail-elsewhere', label: 'mail elsewhere — the roll may be stale', tone: 'grey' })
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
  /** That month is the job's creation month — the job has no approved hours (v2.3747). */
  firstMonthFromCreation: boolean
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
      p = { key, address: r.jobAddress, jobs: [], firstDeadline: null, firstWorkMonth: '', firstMonthFromCreation: false, windowClosed: false, noticeLabel: '' }
      byKey.set(key, p)
    }
    p.jobs.push(r)
    if (r.firstDeadline && (!p.firstDeadline || r.firstDeadline < p.firstDeadline)) {
      p.firstDeadline = r.firstDeadline
      p.firstWorkMonth = r.firstWorkMonth
      p.firstMonthFromCreation = r.firstMonthFromCreation
    }
  }
  const out = [...byKey.values()]
  for (const p of out) {
    p.jobs.sort((a, b) => (a.hcpNumber || a.clickNumber).localeCompare(b.hcpNumber || b.clickNumber, undefined, { numeric: true }))
    if (p.firstDeadline) {
      p.windowClosed = p.firstDeadline < todayYmd
      // A job with no clock hours has one month, its creation month (v2.3747): there are no later months to promise.
      p.noticeLabel = p.firstMonthFromCreation
        ? p.windowClosed
          ? `${monthName(p.firstWorkMonth)}'s window closed · dated from the job’s creation`
          : `due ${shortDay(p.firstDeadline)} · dated from the job’s creation`
        : p.windowClosed
          ? `${monthName(p.firstWorkMonth)}'s window closed · later months live`
          : `due ${shortDay(p.firstDeadline)}`
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

// ---------------------------------------------------------------------------
// The job form (PR 2 of the train): where the silent lookup runs and when the
// builder-as-customer question is asked.
// ---------------------------------------------------------------------------

/**
 * The homestead line the Found box adds when `homesteadHint` says likely —
 * one sentence shared by the job form, the Fix-ups list, PR 3's surfaces and
 * the guide. Placeholder wording: the attorney confirms the sentence.
 */
export const HOMESTEAD_LINE =
  'Likely a homestead — the owners get mail at the property. A lien on a homestead needs a contract signed by both spouses and recorded with the county before work starts. Confirm the exemption on the CAD page and talk to the attorney before the crew goes out.'

/** A builder is a customer that sits in `gc_customer_id` on other jobs (the RPC's `builders` CTE); the caller feeds the ids it knows. */
export function isBuilderCustomer(customerId: string | null | undefined, knownGcIds: Iterable<string>): boolean {
  if (!customerId) return false
  for (const id of knownGcIds) if (id === customerId) return true
  return false
}

export type JobFormOwnerLookupInput = {
  gcCustomerId: string | null | undefined
  customerId: string | null | undefined
  /** The customer row is a builder (`isBuilderCustomer`). */
  customerIsBuilder: boolean
  jobAddress: string
  /** The job links a `customer_addresses` row. */
  hasLinkedRow: boolean
  /** That row's `owner_confirmed_at` is set. */
  linkedOwnerConfirmed: boolean
}

/**
 * Decision 2 (A): the Property record row looks the site up on GC and builder
 * jobs only — the jobs a § 53.056 notice can ever be due on — when the job
 * has an address and no confirmed owner yet. A direct job gets no lookup and
 * no box; a confirmed row reads the linked property as before.
 */
export function jobFormOwnerLookupApplies(input: JobFormOwnerLookupInput): boolean {
  if (input.jobAddress.trim().length < 5) return false
  const gcJob = Boolean(input.gcCustomerId) || (Boolean(input.customerId) && input.customerIsBuilder)
  if (!gcJob) return false
  return !(input.hasLinkedRow && input.linkedOwnerConfirmed)
}

/**
 * The builder-as-customer question ("Is <customer> building this for
 * someone?") is asked on the after-create prompt only when a builder sits in
 * the customer row and no GC is set — the shape that reads as "we contracted
 * with the owner" and gets no notice clock.
 */
export function builderQuestionApplies(input: { customerId: string | null | undefined; gcCustomerId: string | null | undefined; customerIsBuilder: boolean }): boolean {
  return Boolean(input.customerId) && !input.gcCustomerId && input.customerIsBuilder
}

// ---------- PR 3 (v2.3450): Bill Customer's line, the desk's pane, the nightly save ----------

/** The slice of a `customer_addresses` row the confirmation state is read from. */
export type OwnerConfirmStateRow = {
  owner_name?: string | null
  owner_company?: string | null
  owner_mailing_address?: string | null
  owner_confirmed_at?: string | null
  parcel_source?: string | null
}

/** An owner with a mailing address is on the record (the desk's `has_owner`, read client-side). */
export function rowHasOwner(row: OwnerConfirmStateRow | null | undefined): boolean {
  if (!row) return false
  const named = Boolean((row.owner_name ?? '').trim() || (row.owner_company ?? '').trim())
  return named && Boolean((row.owner_mailing_address ?? '').trim())
}

/**
 * *From the roll · unconfirmed*: the nightly run (or any machine) wrote the
 * owner from the appraisal roll — parcel provenance is on the row — and no
 * person has pressed Use or Confirm. A hand-typed owner carries no provenance
 * and was backfilled as confirmed, so it never reads this way.
 */
export function ownerFromRollUnconfirmed(row: OwnerConfirmStateRow | null | undefined): boolean {
  if (!row || !rowHasOwner(row)) return false
  return row.owner_confirmed_at == null && Boolean((row.parcel_source ?? '').trim())
}

export type BillCustomerOwnerLineInput = {
  /** The job names a GC. */
  hasGc: boolean
  /** The customer row is a builder (the GC on some other job) and the job names no GC. */
  customerIsBuilder: boolean
  /** A per-job owner override (`job_property_owners`) with a mailing address — a person wrote it. */
  hasJobOwnerOverride: boolean
  /** The linked property record, null when the job links none. */
  record: OwnerConfirmStateRow | null
}

/**
 * When Bill Customer's quiet owner line shows (mock-up moment 3): a GC job (or
 * a builder in the customer row) whose owner of record is not yet confirmed —
 * no owner at all, or one the nightly run saved from the roll that nobody has
 * looked at. Never on a direct job, never once a person confirmed the owner or
 * wrote a job override. The line is never a gate on sending.
 */
export function shouldShowBillCustomerOwnerLine(input: BillCustomerOwnerLineInput): boolean {
  if (!input.hasGc && !input.customerIsBuilder) return false
  if (input.hasJobOwnerOverride) return false
  if (!input.record) return true
  if (!rowHasOwner(input.record)) return true
  return input.record.owner_confirmed_at == null
}

/** "Guadalupe Appraisal District 2025" — the provenance in the line's parentheses ('' without a parcel). */
export function rollProvenanceShort(parcel: Pick<ParcelRecord, 'source' | 'taxYear'> | null): string {
  if (!parcel) return ''
  return [parcel.source.trim(), parcel.taxYear.trim()].filter(Boolean).join(' ')
}

/**
 * The roll's "name care" (c/o) beside the owner — only when it says something
 * the owner name does not. Several districts echo the owner into the c/o
 * field, which printed the same name twice on the job form and the list
 * (found in the 2026-09-15 live pass).
 */
export function careOfLine(parcel: { ownerName?: string | null; nameCare?: string | null } | null | undefined): string {
  if (!parcel) return ''
  const care = (parcel.nameCare ?? '').trim()
  if (!care) return ''
  const norm = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
  return norm(care) === norm(parcel.ownerName ?? '') ? '' : care
}

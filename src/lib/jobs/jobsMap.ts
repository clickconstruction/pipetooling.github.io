/**
 * Jobs → Pipeline "Jobs on a map" card (v2.3396). Pure: the board's filtered
 * rows in, pins / legend / popup lines out. `useAddressGeocodeCoords` resolves
 * the coordinates and `JobsMapCard` renders.
 *
 * The map is a second view of the list the board already shows — the same
 * search, GC / development / account-man / contract filters and sort — never a
 * filter on it. Pins are colored by Pipeline section in the board's own dot
 * colors (`jobsLedgerStatusDotColor`); a job in Collections keeps Billed's
 * color and wears a red ring. Paid starts off — hundreds of paid pins would
 * bury the live ones — and the Paid rows only exist once the board's Paid
 * section has loaded, so the chip says so until then.
 *
 * Distance is the straight line from the office anchor (jobs record no routed
 * miles); the 25 / 50 mile rings are the same yardstick.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import { jobOpenBillingRemainderDollars } from '../jobsStagesBoard'
import { stagesSectionKeyForJobRow } from './stagesJobNumberJump'
import { jobsLedgerStatusDotColor } from '../jobsLedgerStatusPipeline'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { normalizeAddressForGeocodeKey } from '../map/normalizeAddressForGeocode'
import { effectiveInvoiceParty } from './billToParty'
import { milesBetween } from '../bids/bidBoardMap'
import { calendarDaysSinceDateUtc, formatCurrencyNoCents } from './jobFormatting'
import { effectiveInvoiceEstBillDate } from './invoiceBilling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type JobsMapSection = 'waiting' | 'working' | 'readyToBill' | 'billed' | 'paid'

/** Legend order — the board's own section order. */
export const JOBS_MAP_SECTIONS: readonly JobsMapSection[] = ['waiting', 'working', 'readyToBill', 'billed', 'paid']

export const JOBS_MAP_SECTION_LABEL: Record<JobsMapSection, string> = {
  waiting: 'Waiting',
  working: 'Working',
  readyToBill: 'Ready to bill',
  billed: 'Billed',
  paid: 'Paid',
}

/** Pin colors — the Pipeline's own status dots, so a pin means the same thing the row's dot does. */
export const JOBS_MAP_SECTION_COLOR: Record<JobsMapSection, string> = {
  waiting: jobsLedgerStatusDotColor('waiting'),
  working: jobsLedgerStatusDotColor('working'),
  readyToBill: jobsLedgerStatusDotColor('ready_to_bill'),
  billed: jobsLedgerStatusDotColor('billed'),
  paid: jobsLedgerStatusDotColor('paid'),
}

/** The ring a job in Collections wears — the board's own collections red. */
export const JOBS_MAP_COLLECTIONS_RING_COLOR = '#dc2626'

export type JobsMapSectionVisibility = Record<JobsMapSection, boolean>

/** Paid starts off — the live jobs are what the office is looking at; Paid is one tap away. */
export const JOBS_MAP_DEFAULT_SECTIONS: JobsMapSectionVisibility = {
  waiting: true,
  working: true,
  readyToBill: true,
  billed: true,
  paid: false,
}

/** One job the card wants on the map, before coordinates are known. */
export type JobsMapJob = {
  id: string
  /** `J1019 · Vasquez pretest` — number first, like the board rows. */
  label: string
  numberLabel: string
  jobName: string
  /** Who the bills go to under the job's who-pays rule — the GC on a GC-paid job, else the customer. */
  payerName: string | null
  address: string
  addressKey: string
  section: JobsMapSection
  inCollections: boolean
  pctComplete: number | null
  /** Open bills (ready-to-bill drafts + billed remainders) minus payments applied — the Pipeline's own number. */
  owedDollars: number
  /** Whole days since the oldest open bill went out (the board's own reference: the hand-set bill date, else `billed_at`); null on other jobs. */
  billedAgeDays: number | null
  /** The board row this job came from; null for a rewound (As of) job, which the openers reach by id. */
  row: JobWithDetails | null
}

export type JobsMapPin = JobsMapJob & { lat: number; lng: number }

function sectionOf(job: JobWithDetails): { section: JobsMapSection; inCollections: boolean } | null {
  const key = stagesSectionKeyForJobRow(job)
  if (!key) return null
  if (key === 'collections') return { section: 'billed', inCollections: true }
  return { section: key, inCollections: false }
}

/** The oldest open billed invoice's age, by the Billed section's own reference rule (`stageRowBilledAgeReference`). */
export function jobBilledAgeDays(job: Pick<JobWithDetails, 'invoices'>, now: Date = new Date()): number | null {
  let oldest: number | null = null
  for (const inv of job.invoices ?? []) {
    if (inv.status !== 'billed') continue
    const est = effectiveInvoiceEstBillDate(inv)
    const billedAt = (inv.billed_at ?? '').trim()
    const ymd = est ?? (billedAt ? calendarYmdInAppTzFromIso(billedAt) : '')
    if (!ymd) continue
    const days = calendarDaysSinceDateUtc(ymd, now)
    if (days < 0) continue
    if (oldest == null || days > oldest) oldest = days
  }
  return oldest
}

function payerNameOf(job: JobWithDetails): string | null {
  const party = effectiveInvoiceParty(job, null)
  const name = party === 'gc' ? job.gcCustomer?.name : job.customer_name
  return (name ?? '').trim() || null
}

/**
 * The board's filtered rows → the card's job list, one per job, bucketed by the
 * same rule the # jump uses (`stagesSectionKeyForJobRow`). A job with no usable
 * address goes to `noAddress` — nothing to put on a map, but the footer names it.
 */
export function jobsMapJobs(rows: readonly JobWithDetails[], now: Date = new Date()): { jobs: JobsMapJob[]; noAddress: JobsMapJob[] } {
  const jobs: JobsMapJob[] = []
  const noAddress: JobsMapJob[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const bucket = sectionOf(row)
    if (!bucket) continue
    const address = (row.job_address ?? '').trim()
    const addressKey = normalizeAddressForGeocodeKey(address)
    const numberLabel = effectiveJobLedgerNumber(row.hcp_number, row.click_number) || '—'
    const jobName = (row.job_name ?? '').trim() || '—'
    const job: JobsMapJob = {
      id: row.id,
      label: `${numberLabel} · ${jobName}`,
      numberLabel,
      jobName,
      payerName: payerNameOf(row),
      address,
      addressKey,
      section: bucket.section,
      inCollections: bucket.inCollections,
      pctComplete: row.pct_complete != null && Number.isFinite(Number(row.pct_complete)) ? Number(row.pct_complete) : null,
      owedDollars: bucket.section === 'billed' || bucket.section === 'readyToBill' ? jobOpenBillingRemainderDollars(row) : 0,
      billedAgeDays: bucket.section === 'billed' ? jobBilledAgeDays(row, now) : null,
      row,
    }
    if (addressKey.length < 3) noAddress.push(job)
    else jobs.push(job)
  }
  return { jobs, noAddress }
}

/** Attach cached / freshly geocoded coordinates; a job whose key is missing stays unmapped. */
export function resolveJobsMapPins(
  jobs: readonly JobsMapJob[],
  coords: ReadonlyMap<string, { lat: number; lng: number }>,
): { pins: JobsMapPin[]; unmapped: JobsMapJob[] } {
  const pins: JobsMapPin[] = []
  const unmapped: JobsMapJob[] = []
  for (const j of jobs) {
    const c = coords.get(j.addressKey)
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) pins.push({ ...j, lat: c.lat, lng: c.lng })
    else unmapped.push(j)
  }
  return { pins, unmapped }
}

/** Legend chips: every section in board order with its pinned count (zero included — the chip is a toggle). */
export function jobsMapLegend(pins: readonly JobsMapPin[]): { section: JobsMapSection; count: number }[] {
  const counts: Record<JobsMapSection, number> = { waiting: 0, working: 0, readyToBill: 0, billed: 0, paid: 0 }
  for (const p of pins) counts[p.section] += 1
  return JOBS_MAP_SECTIONS.map((section) => ({ section, count: counts[section] }))
}

/** The pins the canvas draws — sections toggled off in the legend are dropped. */
export function jobsMapVisiblePins(pins: readonly JobsMapPin[], show: JobsMapSectionVisibility): JobsMapPin[] {
  return pins.filter((p) => show[p.section])
}

/** `Working · 60%` · `Billed · Collections` · `Waiting`. */
export function jobsMapStatusLine(job: Pick<JobsMapJob, 'section' | 'inCollections' | 'pctComplete'>): string {
  const parts: string[] = [JOBS_MAP_SECTION_LABEL[job.section]]
  if (job.inCollections) parts.push('Collections')
  if (job.pctComplete != null && (job.section === 'working' || job.section === 'waiting')) parts.push(`${Math.round(job.pctComplete)}%`)
  return parts.join(' · ')
}

/** `12 mi from the office`; null with no anchor. Straight-line — jobs carry no routed miles. */
export function jobsMapDistanceLine(pin: Pick<JobsMapPin, 'lat' | 'lng'>, anchor: { lat: number; lng: number } | null): string | null {
  if (!anchor) return null
  const miles = milesBetween(anchor, pin)
  const mi = miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles)
  return `${mi} mi from the office`
}

/** `$18,400 owed` on a billed or ready-to-bill job with an open balance; null otherwise. */
export function jobsMapOwedLine(job: Pick<JobsMapJob, 'owedDollars'>): string | null {
  return job.owedDollars > 0 ? `$${formatCurrencyNoCents(job.owedDollars)} owed` : null
}

/** The line under the map: `1 job has no map location yet` / `4 jobs have no map location yet`. */
export function jobsMapUnmappedLine(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 job has no map location yet' : `${count} jobs have no map location yet`
}

/** Google Maps directions for a job address (the same link shape the rows use). */
export function jobsMapDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
}

// ── Per-device preferences ──────────────────────────────────────────────────

const HIDDEN_KEY = 'pipetooling_jobs_map_hidden'
const CLUSTER_KEY = 'pipetooling_jobs_map_cluster'

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readJobsMapHidden(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writeJobsMapHidden(hidden: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (!storage) return
    if (hidden) storage.setItem(HIDDEN_KEY, '1')
    else storage.removeItem(HIDDEN_KEY)
  } catch {
    /* private mode / blocked storage — the map just stays visible next load */
  }
}

/** Clustering is off unless this device turned it on (the bid map's rule). */
export function readJobsMapClustered(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(CLUSTER_KEY) === '1'
  } catch {
    return false
  }
}

export function writeJobsMapClustered(on: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (!storage) return
    if (on) storage.setItem(CLUSTER_KEY, '1')
    else storage.removeItem(CLUSTER_KEY)
  } catch {
    /* private mode / quota — the toggle just doesn't persist */
  }
}

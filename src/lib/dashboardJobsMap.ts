/**
 * "Your jobs on a map" — the Dashboard card that plots the viewer's active
 * jobs (v2.3131). Pure: rows in, pins / legend / unmapped list out. The hook
 * (`useDashboardJobsMapPins`) resolves coordinates; the card renders.
 *
 * Which jobs: the Dashboard's own lists — team-assigned jobs (every role,
 * `list_assigned_jobs_for_dashboard`, already waiting/working) plus a
 * superintendent's project jobs (`list_superintendent_jobs_for_dashboard`, no
 * status column, so a row is kept unless its status says it left the field).
 * A job on both lists shows once. Nothing here widens what RLS returned.
 */
import type { DashboardTeamAssignedJobRow } from './dashboardTeamAssignedJobRow'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'
import { normalizeAddressForGeocodeKey } from './map/normalizeAddressForGeocode'

export type DashboardJobsMapStatus = 'working' | 'waiting'

/** One job the card wants on the map, before coordinates are known. */
export type DashboardJobsMapJob = {
  id: string
  /** `J1021 · Bexley Park Bldg C` — number first, the Dashboard rows' own label. */
  label: string
  address: string
  addressKey: string
  status: DashboardJobsMapStatus
  stageName: string | null
  lastReportAt: string | null
  /** The Dashboard row this job came from — the detail opener takes it back. */
  row: DashboardTeamAssignedJobRow
}

export type DashboardJobsMapPin = DashboardJobsMapJob & { lat: number; lng: number }

/** Jobs status colors, same values as the Projects-card dots (`jobsLedgerStatusPipeline`). */
export const DASHBOARD_JOBS_MAP_STATUS_COLOR: Record<DashboardJobsMapStatus, string> = {
  working: '#3b82f6',
  waiting: '#f59e0b',
}

export const DASHBOARD_JOBS_MAP_STATUS_LABEL: Record<DashboardJobsMapStatus, string> = {
  working: 'Working',
  waiting: 'Waiting',
}

/** Statuses that mean the job has left the field — never a pin. */
const OFF_THE_MAP = new Set(['ready_to_bill', 'billed', 'paid', 'cancelled', 'canceled', 'archived'])

function mapStatus(raw: string | null | undefined): DashboardJobsMapStatus | null {
  const s = (raw ?? '').trim().toLowerCase()
  if (s === 'working') return 'working'
  if (s === 'waiting' || s === '') return 'waiting'
  if (OFF_THE_MAP.has(s)) return null
  return 'waiting'
}

/**
 * Merge the Dashboard's job lists into the card's job list: assigned rows first
 * (they carry status), then superintendent rows not already present. Rows with
 * no usable address are dropped here — they are reported by `unmappedJobs`
 * only when they have an address the geocoder could not place; a job with no
 * address at all has nothing to put on a map.
 */
export function dashboardJobsMapJobs(
  assignedJobs: readonly DashboardTeamAssignedJobRow[],
  superintendentJobs: readonly DashboardTeamAssignedJobRow[],
): { jobs: DashboardJobsMapJob[]; noAddress: DashboardJobsMapJob[] } {
  const seen = new Set<string>()
  const jobs: DashboardJobsMapJob[] = []
  const noAddress: DashboardJobsMapJob[] = []
  for (const row of [...assignedJobs, ...superintendentJobs]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const status = mapStatus(row.status)
    if (!status) continue
    const address = (row.job_address ?? '').trim()
    const addressKey = normalizeAddressForGeocodeKey(address)
    const job: DashboardJobsMapJob = {
      id: row.id,
      label: `${effectiveJobLedgerNumber(row.hcp_number, row.click_number) || '—'} · ${(row.job_name ?? '').trim() || '—'}`,
      address,
      addressKey,
      status,
      stageName: row.in_progress_stage_name?.trim() || null,
      lastReportAt: row.last_report_at ?? row.my_last_report_at ?? null,
      row,
    }
    if (addressKey.length < 3) noAddress.push(job)
    else jobs.push(job)
  }
  return { jobs, noAddress }
}

/** Attach cached / freshly geocoded coordinates; a job whose key is missing stays unmapped. */
export function resolveDashboardJobsMapPins(
  jobs: readonly DashboardJobsMapJob[],
  coords: ReadonlyMap<string, { lat: number; lng: number }>,
): { pins: DashboardJobsMapPin[]; unmapped: DashboardJobsMapJob[] } {
  const pins: DashboardJobsMapPin[] = []
  const unmapped: DashboardJobsMapJob[] = []
  for (const j of jobs) {
    const c = coords.get(j.addressKey)
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) pins.push({ ...j, lat: c.lat, lng: c.lng })
    else unmapped.push(j)
  }
  return { pins, unmapped }
}

/** Header counts: `3 working · 2 waiting` (zero entries dropped). */
export function dashboardJobsMapLegend(pins: readonly DashboardJobsMapPin[]): { status: DashboardJobsMapStatus; count: number }[] {
  const counts: Record<DashboardJobsMapStatus, number> = { working: 0, waiting: 0 }
  for (const p of pins) counts[p.status] += 1
  return (['working', 'waiting'] as const).filter((s) => counts[s] > 0).map((s) => ({ status: s, count: counts[s] }))
}

/** Bounds for fit-all; `null` when there is nothing to fit. A single pin gets a small box. */
export function dashboardJobsMapBounds(
  pins: readonly DashboardJobsMapPin[],
): { south: number; west: number; north: number; east: number } | null {
  if (pins.length === 0) return null
  let south = Infinity
  let west = Infinity
  let north = -Infinity
  let east = -Infinity
  for (const p of pins) {
    south = Math.min(south, p.lat)
    north = Math.max(north, p.lat)
    west = Math.min(west, p.lng)
    east = Math.max(east, p.lng)
  }
  if (pins.length === 1 || (north - south < 1e-6 && east - west < 1e-6)) {
    const pad = 0.01
    return { south: south - pad, west: west - pad, north: north + pad, east: east + pad }
  }
  return { south, west, north, east }
}

/** The line under the map: `1 job has no map location yet` / `2 jobs have no map location yet`. */
export function dashboardJobsMapUnmappedLine(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 job has no map location yet' : `${count} jobs have no map location yet`
}

/** Google Maps directions for a job address (the same link the job rows use). */
export function dashboardJobsMapDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
}

/** `Rough-in · last report 2 days ago` — the popup's third line; null when neither is known. */
export function dashboardJobsMapDetailLine(job: Pick<DashboardJobsMapJob, 'stageName' | 'lastReportAt'>, now: Date = new Date()): string | null {
  const parts: string[] = []
  if (job.stageName) parts.push(job.stageName)
  if (job.lastReportAt) {
    const then = new Date(job.lastReportAt)
    const days = Math.floor((now.getTime() - then.getTime()) / 86400000)
    if (Number.isFinite(days)) {
      parts.push(days <= 0 ? 'last report today' : days === 1 ? 'last report yesterday' : days < 30 ? `last report ${days} days ago` : 'last report over a month ago')
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

// ── Per-device "Hide map" preference ────────────────────────────────────────

const HIDDEN_KEY = 'pipetooling_dashboard_jobs_map_hidden'

export function readDashboardJobsMapHidden(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDashboardJobsMapHidden(hidden: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (!storage) return
    if (hidden) storage.setItem(HIDDEN_KEY, '1')
    else storage.removeItem(HIDDEN_KEY)
  } catch {
    /* private mode / blocked storage — the map just stays visible next load */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

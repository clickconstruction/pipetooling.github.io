/**
 * "Where everyone is" — the clocked-in map opened from the Currently In bar
 * (v2.3756, punch list #31). Pure: the strip's open sessions in, the stops,
 * the office, the people with no job, the legend and the pins out. The modal
 * (`ClockedInMapModal`) resolves coordinates with `useAddressGeocodeCoords`
 * and renders; nothing here reads the database.
 *
 * A pin is a place, not a person: everyone clocked on one job or bid shares a
 * pin whose badge is the head count. Sessions on the office job sit on the
 * office anchor diamond (never a pin of their own); a session with no job or
 * bid is listed under the map as "Not on a job" and is never placed by guess.
 */
import {
  isSyntheticSalaryStripSession,
  shortJobOrBidLabelFromEmbeds,
  type ClockSessionRow,
  type DashboardStripSession,
} from '../types/clockSessions'
import type { LedgerPrefixMap } from './ledgerDisplayPrefixes'
import { normalizeAddressForGeocodeKey } from './map/normalizeAddressForGeocode'
import { MAP_CANVAS_ANCHOR_COLOR, type MapCanvasPin } from './map/mapCanvasTypes'
import type { AddressToGeocode } from '../hooks/useAddressGeocodeCoords'
import { dashboardJobsMapDirectionsUrl } from './dashboardJobsMap'

export type ClockedInStopKind = 'job' | 'bid' | 'office'

/** Jobs blue and bids violet — the Dashboard and Bid Board maps' colors; the office is the anchor's navy. */
export const CLOCKED_IN_MAP_COLOR: Record<ClockedInStopKind, string> = {
  job: '#3b82f6',
  bid: '#8b5cf6',
  office: MAP_CANVAS_ANCHOR_COLOR,
}

export type ClockedInPerson = {
  sessionId: string
  userId: string
  name: string
  /** ISO clock-in. */
  clockedInAt: string
  elapsedSeconds: number
  /** `3h 45m` / `18m`. */
  elapsedLabel: string
  memo: string
  /** Schedule-implied row with no `clock_sessions` row yet — nothing to assign until it is materialized. */
  synthetic: boolean
  session: DashboardStripSession
}

export type ClockedInStop = {
  /** `job:<id>` | `bid:<id>` | `office` — the pin id and the rail row key. */
  id: string
  kind: ClockedInStopKind
  /** `JP1021 · Vecchio Pinpoint` — the strip's own short label. */
  label: string
  address: string
  addressKey: string
  jobLedgerId: string | null
  bidId: string | null
  /** The embed the strip's job opener takes back. */
  jobsLedger: ClockSessionRow['jobs_ledger']
  /** Distinct people, earliest clock-in first. */
  people: ClockedInPerson[]
}

export type ClockedInMapModel = {
  /** Job and bid stops, most people first. Never the office. */
  stops: ClockedInStop[]
  /** Sessions on the office job, when any. */
  office: ClockedInStop | null
  /** Open sessions with no job or bid — listed, never placed. */
  unassigned: ClockedInPerson[]
  /** Distinct people across every open session. */
  peopleCount: number
  legend: { jobs: number; bids: number; office: number }
}

export type ClockedInMapOptions = {
  /** `overhead_office_job_ledger_id_v1` — sessions on this job are office sessions. */
  officeJobLedgerId?: string | null
  /** The office anchor's address key — a job at that address is the office too. */
  officeAddressKey?: string | null
}

export function formatClockedInElapsed(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function personOf(s: DashboardStripSession, nowMs: number): ClockedInPerson {
  const inMs = new Date(s.clocked_in_at).getTime()
  const elapsedSeconds = Number.isFinite(inMs) ? Math.max(0, Math.floor((nowMs - inMs) / 1000)) : 0
  return {
    sessionId: s.id,
    userId: s.user_id,
    name: (s.users?.name ?? '').trim() || '—',
    clockedInAt: s.clocked_in_at,
    elapsedSeconds,
    elapsedLabel: formatClockedInElapsed(elapsedSeconds),
    memo: (s.notes ?? '').trim(),
    synthetic: isSyntheticSalaryStripSession(s),
    session: s,
  }
}

function byClockIn(a: ClockedInPerson, b: ClockedInPerson): number {
  return a.clockedInAt < b.clockedInAt ? -1 : a.clockedInAt > b.clockedInAt ? 1 : a.name.localeCompare(b.name)
}

/** The strip's open sessions regrouped by place. */
export function buildClockedInMap(
  sessions: readonly DashboardStripSession[],
  nowMs: number,
  prefixMap: LedgerPrefixMap,
  opts: ClockedInMapOptions = {},
): ClockedInMapModel {
  const officeJobId = opts.officeJobLedgerId ?? null
  const officeKey = (opts.officeAddressKey ?? '').length >= 3 ? (opts.officeAddressKey as string) : null
  const stopsById = new Map<string, ClockedInStop>()
  let office: ClockedInStop | null = null
  const unassigned: ClockedInPerson[] = []
  const everyone = new Set<string>()

  for (const s of sessions) {
    everyone.add(s.user_id)
    const person = personOf(s, nowMs)
    const synthetic = isSyntheticSalaryStripSession(s)
    const row = s as ClockSessionRow
    const jobId = synthetic ? null : row.job_ledger_id
    const bidId = synthetic ? null : row.bid_id
    if (!jobId && !bidId) {
      unassigned.push(person)
      continue
    }
    const kind: ClockedInStopKind = jobId ? 'job' : 'bid'
    const address = (jobId ? row.jobs_ledger?.job_address : row.bids?.address) ?? ''
    const addressKey = normalizeAddressForGeocodeKey(address.trim())
    const isOffice = (jobId != null && officeJobId != null && jobId === officeJobId) || (officeKey != null && addressKey === officeKey)
    const id = isOffice ? 'office' : `${kind}:${jobId ?? bidId}`
    let stop: ClockedInStop | null | undefined = isOffice ? office : stopsById.get(id)
    if (!stop) {
      stop = {
        id,
        kind: isOffice ? 'office' : kind,
        label: isOffice ? 'Office' : (shortJobOrBidLabelFromEmbeds(row, prefixMap) ?? (jobId ? 'Job' : 'Bid')),
        address: address.trim(),
        addressKey,
        jobLedgerId: jobId,
        bidId,
        jobsLedger: row.jobs_ledger ?? null,
        people: [],
      }
      if (isOffice) office = stop
      else stopsById.set(id, stop)
    }
    if (!stop.people.some((p) => p.userId === person.userId)) stop.people.push(person)
  }

  const stops = [...stopsById.values()]
  for (const st of stops) st.people.sort(byClockIn)
  if (office) office.people.sort(byClockIn)
  stops.sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label))
  unassigned.sort(byClockIn)

  return {
    stops,
    office,
    unassigned,
    peopleCount: everyone.size,
    legend: {
      jobs: stops.filter((s) => s.kind === 'job').length,
      bids: stops.filter((s) => s.kind === 'bid').length,
      office: office ? office.people.length : 0,
    },
  }
}

/** The addresses the geocode hook is asked for — job and bid stops with an address, one entry per key. */
export function clockedInMapAddresses(model: Pick<ClockedInMapModel, 'stops'>): AddressToGeocode[] {
  const seen = new Set<string>()
  const out: AddressToGeocode[] = []
  for (const s of model.stops) {
    if (s.addressKey.length < 3 || seen.has(s.addressKey)) continue
    seen.add(s.addressKey)
    out.push({ key: s.addressKey, display: s.address })
  }
  return out
}

export type ClockedInMapPlaced = {
  pins: MapCanvasPin[]
  /** Coordinates by stop id, for the rail's distance line. */
  coordsByStop: Map<string, { lat: number; lng: number }>
  /** Stops with an address the cache and the geocoder could not place (yet). */
  unmapped: ClockedInStop[]
  /** Stops whose job or bid has no address at all — never sent to the geocoder. */
  noAddress: ClockedInStop[]
}

/** Attach coordinates; a pin's badge is the head count. The office is the anchor, never a pin. */
export function placeClockedInStops(
  stops: readonly ClockedInStop[],
  coords: ReadonlyMap<string, { lat: number; lng: number }>,
): ClockedInMapPlaced {
  const pins: MapCanvasPin[] = []
  const coordsByStop = new Map<string, { lat: number; lng: number }>()
  const unmapped: ClockedInStop[] = []
  const noAddress: ClockedInStop[] = []
  for (const s of stops) {
    if (s.addressKey.length < 3) {
      noAddress.push(s)
      continue
    }
    const c = coords.get(s.addressKey)
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      coordsByStop.set(s.id, c)
      pins.push({
        id: s.id,
        lat: c.lat,
        lng: c.lng,
        color: CLOCKED_IN_MAP_COLOR[s.kind],
        title: `${s.label} · ${s.people.length}`,
        label: String(s.people.length),
      })
    } else unmapped.push(s)
  }
  return { pins, coordsByStop, unmapped, noAddress }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** `1 job has no map location yet` · `2 jobs and 1 bid have no map location yet`; null when everything is placed. */
export function clockedInMapUnmappedLine(stops: readonly ClockedInStop[]): string | null {
  const jobs = stops.filter((s) => s.kind === 'job').length
  const bids = stops.filter((s) => s.kind === 'bid').length
  if (jobs + bids === 0) return null
  const parts: string[] = []
  if (jobs > 0) parts.push(plural(jobs, 'job', 'jobs'))
  if (bids > 0) parts.push(plural(bids, 'bid', 'bids'))
  const verb = jobs + bids === 1 ? 'has' : 'have'
  return `${parts.join(' and ')} ${verb} no map location yet`
}

/** `7 in · 5 stops · 1 at the office · 1 not on a job` — zero parts dropped, the head count always first. */
export function clockedInMapSummaryLine(model: ClockedInMapModel): string {
  const parts = [`${model.peopleCount} in`]
  if (model.stops.length > 0) parts.push(plural(model.stops.length, 'stop', 'stops'))
  if (model.legend.office > 0) parts.push(`${model.legend.office} at the office`)
  if (model.unassigned.length > 0) parts.push(`${model.unassigned.length} not on a job`)
  return parts.join(' · ')
}

/** `Tue, Sep 23 · 11:45 AM` for the header, beside "live". */
export function clockedInMapHeaderStamp(nowMs: number, locale?: string): string {
  const d = new Date(nowMs)
  const day = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

const EARTH_RADIUS_MILES = 3958.7613

/** Great-circle miles between two points. */
export function clockedInMapMilesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** `12 mi` from the office for a placed stop; null without an anchor or coordinates. */
export function clockedInMapDistanceLabel(
  stop: { lat: number; lng: number } | null | undefined,
  anchor: { lat: number; lng: number } | null | undefined,
): string | null {
  if (!stop || !anchor) return null
  const mi = clockedInMapMilesBetween(stop, anchor)
  if (!Number.isFinite(mi)) return null
  return mi < 1 ? '< 1 mi' : `${Math.round(mi)} mi`
}

/** Google Maps directions for a stop's address — the same link the job rows use. */
export function clockedInMapDirectionsUrl(address: string): string {
  return dashboardJobsMapDirectionsUrl(address)
}

/** The Bid Board deep link the strip's bid rows use. */
export function clockedInMapBidHref(bidId: string): string {
  return `/bids?bidId=${encodeURIComponent(bidId)}&tab=submission-followup`
}

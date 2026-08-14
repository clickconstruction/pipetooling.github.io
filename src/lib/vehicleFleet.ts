import { formatCurrency } from './format'

/**
 * Vehicles fleet kernels (v2.1644, People → Vehicles redesign): pure math for
 * the fleet board cards (current holder, odometer freshness, summary chips),
 * the unified per-vehicle ledger (readings + hand-offs + replacement values +
 * service events merged newest-first), the oil-change due math (v2.1645), and
 * the one-step hand-off write plan. The component stays thin; everything
 * testable lives here.
 */

export type FleetVehicle = {
  id: string
  year: number | null
  make: string
  model: string
  vin: string | null
}

export type FleetPossession = {
  id: string
  vehicle_id: string
  user_id: string
  start_date: string
  end_date: string | null
  created_at: string | null
}

export type FleetOdometerEntry = {
  id: string
  vehicle_id: string
  odometer_value: number
  read_date: string
  created_at: string | null
  created_by?: string | null
}

export type FleetValueEntry = {
  id: string
  vehicle_id: string
  replacement_value: number
  read_date: string
  created_at: string | null
}

export function vehicleDisplayName(v: Pick<FleetVehicle, 'year' | 'make' | 'model'>): string {
  return [v.year != null ? String(v.year) : '', v.make, v.model].map((s) => (s ?? '').trim()).filter(Boolean).join(' ') || 'Vehicle'
}

/** Last 4 VIN chars for the card corner; null when there is no VIN. */
export function vinTail(vin: string | null | undefined): string | null {
  const t = (vin ?? '').trim()
  if (!t) return null
  return t.length <= 4 ? t : `…${t.slice(-4)}`
}

/**
 * The possession that holds the vehicle today: started on/before today and not
 * ended before today. Overlaps resolve to the open-ended one first, then the
 * latest start (so a same-day hand-off puts the vehicle with the new holder).
 */
export function currentPossession(possessions: FleetPossession[], todayYmd: string): FleetPossession | null {
  const open = possessions.filter((p) => p.start_date <= todayYmd && (p.end_date == null || p.end_date >= todayYmd))
  if (open.length === 0) return null
  open.sort((a, b) => {
    const aOpenEnded = a.end_date == null ? 1 : 0
    const bOpenEnded = b.end_date == null ? 1 : 0
    if (aOpenEnded !== bOpenEnded) return bOpenEnded - aOpenEnded
    if (a.start_date !== b.start_date) return b.start_date.localeCompare(a.start_date)
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })
  return open[0] ?? null
}

/** Latest reading by read date (entry order breaks same-day ties). */
export function latestReading(entries: FleetOdometerEntry[]): FleetOdometerEntry | null {
  let best: FleetOdometerEntry | null = null
  for (const e of entries) {
    if (
      best == null ||
      e.read_date > best.read_date ||
      (e.read_date === best.read_date && (e.created_at ?? '') > (best.created_at ?? ''))
    ) {
      best = e
    }
  }
  return best
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const from = Date.UTC(
    Number(fromYmd.slice(0, 4)),
    Number(fromYmd.slice(5, 7)) - 1,
    Number(fromYmd.slice(8, 10)),
  )
  const to = Date.UTC(Number(toYmd.slice(0, 4)), Number(toYmd.slice(5, 7)) - 1, Number(toYmd.slice(8, 10)))
  return Math.round((to - from) / 86400000)
}

export type OdometerFreshness = 'fresh' | 'stale' | 'none'

/** Fresh = read within 30 days; stale = older; none = never read. */
export function odometerFreshness(latest: FleetOdometerEntry | null, todayYmd: string): OdometerFreshness {
  if (!latest) return 'none'
  return daysBetweenYmd(latest.read_date, todayYmd) <= 30 ? 'fresh' : 'stale'
}

/** "today" / "3d ago" / "May 2" style age text for the card mileage line. */
export function odometerAgeLabel(latest: FleetOdometerEntry | null, todayYmd: string): string {
  if (!latest) return 'no reading yet'
  const days = daysBetweenYmd(latest.read_date, todayYmd)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export type FleetSummary = {
  total: number
  unassigned: number
  /** Vehicles whose latest reading is >30 days old or missing entirely. */
  staleReadings: number
}

export function fleetSummary(
  vehicles: FleetVehicle[],
  holderByVehicle: ReadonlyMap<string, FleetPossession>,
  latestByVehicle: ReadonlyMap<string, FleetOdometerEntry>,
  todayYmd: string,
): FleetSummary {
  let unassigned = 0
  let staleReadings = 0
  for (const v of vehicles) {
    if (!holderByVehicle.get(v.id)) unassigned++
    if (odometerFreshness(latestByVehicle.get(v.id) ?? null, todayYmd) !== 'fresh') staleReadings++
  }
  return { total: vehicles.length, unassigned, staleReadings }
}

/** Card/search predicate: matches year/make/model/VIN and the holder's name. */
export function vehicleMatchesSearch(
  v: FleetVehicle,
  holderName: string | null,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    vehicleDisplayName(v).toLowerCase().includes(q) ||
    (v.vin ?? '').toLowerCase().includes(q) ||
    (holderName ?? '').toLowerCase().includes(q)
  )
}

/** Odometer input tolerates commas and spaces ("123,900"). Null when invalid. */
export function parseOdometerInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export type FleetServiceEvent = {
  id: string
  vehicle_id: string
  service_type: string
  service_date: string
  odometer_value: number | null
  cost: number | null
  note: string | null
  created_at: string | null
  created_by?: string | null
}

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  oil_change: 'Oil change',
  tires: 'Tires',
  repair: 'Repair',
  inspection: 'Inspection',
  registration: 'Registration',
  other: 'Service',
}

/** The newest oil_change event that recorded an odometer (due math needs the miles). */
export function lastOilChange(events: FleetServiceEvent[]): FleetServiceEvent | null {
  let best: FleetServiceEvent | null = null
  for (const e of events) {
    if (e.service_type !== 'oil_change' || e.odometer_value == null) continue
    if (best == null || e.service_date > best.service_date || (e.service_date === best.service_date && (e.created_at ?? '') > (best.created_at ?? ''))) {
      best = e
    }
  }
  return best
}

export type OilStatus =
  | { state: 'unknown' }
  | { state: 'ok'; nextDueAt: number; milesRemaining: number }
  | { state: 'due_soon'; nextDueAt: number; milesRemaining: number }
  | { state: 'overdue'; nextDueAt: number; milesOver: number }

export const OIL_DUE_SOON_MILES = 1000

/**
 * Oil due math: last oil change odometer + interval vs the latest reading.
 * Unknown until BOTH an oil change with miles and a reading exist. Due soon
 * inside the last 1,000 miles; overdue past the interval.
 */
export function oilStatus(
  lastOil: FleetServiceEvent | null,
  interval: number | null | undefined,
  latest: FleetOdometerEntry | null,
): OilStatus {
  const iv = interval ?? 5000
  if (!lastOil || lastOil.odometer_value == null || !latest || iv <= 0) return { state: 'unknown' }
  const nextDueAt = lastOil.odometer_value + iv
  const remaining = nextDueAt - latest.odometer_value
  if (remaining < 0) return { state: 'overdue', nextDueAt, milesOver: -remaining }
  if (remaining <= OIL_DUE_SOON_MILES) return { state: 'due_soon', nextDueAt, milesRemaining: remaining }
  return { state: 'ok', nextDueAt, milesRemaining: remaining }
}

/** Card chip text for an OilStatus. */
export function oilChipLabel(status: OilStatus): string {
  switch (status.state) {
    case 'unknown':
      return 'Oil unknown'
    case 'ok':
      return `Oil OK · next ${status.nextDueAt.toLocaleString()}`
    case 'due_soon':
      return `Oil due in ${status.milesRemaining.toLocaleString()} mi`
    case 'overdue':
      return `Oil overdue ${status.milesOver.toLocaleString()} mi`
  }
}

export type FleetOilCounts = { dueSoon: number; overdue: number }

export function fleetOilCounts(
  vehicles: Array<FleetVehicle & { oil_change_interval_miles?: number | null }>,
  lastOilByVehicle: ReadonlyMap<string, FleetServiceEvent>,
  latestByVehicle: ReadonlyMap<string, FleetOdometerEntry>,
): FleetOilCounts {
  let dueSoon = 0
  let overdue = 0
  for (const v of vehicles) {
    const s = oilStatus(lastOilByVehicle.get(v.id) ?? null, v.oil_change_interval_miles, latestByVehicle.get(v.id) ?? null)
    if (s.state === 'due_soon') dueSoon++
    if (s.state === 'overdue') overdue++
  }
  return { dueSoon, overdue }
}

export type FleetProblemReport = {
  id: string
  vehicle_id: string
  description: string
  severity: string
  report_date: string
  reported_by: string | null
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
  created_at: string | null
}

export const PROBLEM_SEVERITY_LABELS: Record<string, string> = {
  monitor: 'Monitor',
  needs_service: 'Needs service',
  urgent: 'Urgent',
}

export function openProblems(reports: FleetProblemReport[]): FleetProblemReport[] {
  return reports.filter((r) => r.resolved_at == null)
}

/** Open problem count per vehicle for the cards and summary chip. */
export function openProblemCounts(reports: FleetProblemReport[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of reports) {
    if (r.resolved_at != null) continue
    m.set(r.vehicle_id, (m.get(r.vehicle_id) ?? 0) + 1)
  }
  return m
}

export type VehicleLedgerRowKind = 'reading' | 'handoff' | 'return' | 'value' | 'service' | 'problem' | 'problem_resolved'

export type VehicleLedgerRow = {
  key: string
  kind: VehicleLedgerRowKind
  dateYmd: string
  /** Main line, e.g. "Reading entered by Danielle" or "Malachi → Tristen". */
  label: string
  odometer: number | null
  amount: number | null
  /** Source row id for deletes (reading/value/possession id). */
  sourceId: string
}

/**
 * The unified vehicle ledger: odometer readings, possession hand-offs (with
 * "old → new" labels when holders chain), returns, and replacement-value
 * updates, merged newest-first. Same-day ties order hand-offs above readings
 * so a hand-off's captured reading reads as part of the event.
 */
export function buildVehicleLedger(args: {
  readings: FleetOdometerEntry[]
  possessions: FleetPossession[]
  valueEntries: FleetValueEntry[]
  userNameById: ReadonlyMap<string, string>
  serviceEvents?: FleetServiceEvent[]
  problemReports?: FleetProblemReport[]
}): VehicleLedgerRow[] {
  const { readings, possessions, valueEntries, userNameById, serviceEvents = [], problemReports = [] } = args
  const name = (id: string | null | undefined): string | null => {
    if (!id) return null
    return userNameById.get(id) ?? null
  }
  const rows: VehicleLedgerRow[] = []
  for (const r of readings) {
    const by = name(r.created_by)
    rows.push({
      key: `reading-${r.id}`,
      kind: 'reading',
      dateYmd: r.read_date,
      label: by ? `Reading entered by ${by}` : 'Reading entered',
      odometer: r.odometer_value,
      amount: null,
      sourceId: r.id,
    })
  }
  const byStart = [...possessions].sort((a, b) => a.start_date.localeCompare(b.start_date))
  byStart.forEach((p, i) => {
    const holder = name(p.user_id) ?? 'Unknown'
    const prev = byStart
      .slice(0, i)
      .reverse()
      .find((q) => q.end_date != null && q.end_date <= p.start_date)
    rows.push({
      key: `handoff-${p.id}`,
      kind: 'handoff',
      dateYmd: p.start_date,
      label: prev ? `${name(prev.user_id) ?? 'Unknown'} → ${holder}` : `Assigned to ${holder}`,
      odometer: null,
      amount: null,
      sourceId: p.id,
    })
    if (p.end_date != null) {
      const successor = byStart.find((q) => q.id !== p.id && q.start_date >= p.end_date! && q.start_date <= p.end_date!)
      const hasLaterStart = byStart.some((q) => q.id !== p.id && q.start_date >= p.end_date!)
      if (!successor && !hasLaterStart) {
        rows.push({
          key: `return-${p.id}`,
          kind: 'return',
          dateYmd: p.end_date,
          label: `${holder} returned the vehicle`,
          odometer: null,
          amount: null,
          sourceId: p.id,
        })
      }
    }
  })
  for (const e of valueEntries) {
    rows.push({
      key: `value-${e.id}`,
      kind: 'value',
      dateYmd: e.read_date,
      label: 'Replacement value updated',
      odometer: null,
      amount: e.replacement_value,
      sourceId: e.id,
    })
  }
  for (const e of serviceEvents) {
    const typeLabel = SERVICE_TYPE_LABELS[e.service_type] ?? 'Service'
    const note = (e.note ?? '').trim()
    const costPart = e.cost != null && e.cost > 0 ? `$${formatCurrency(e.cost)}` : null
    rows.push({
      key: `service-${e.id}`,
      kind: 'service',
      dateYmd: e.service_date,
      label: [typeLabel, note || null, costPart].filter(Boolean).join(' · '),
      odometer: e.odometer_value,
      amount: null,
      sourceId: e.id,
    })
  }
  for (const r of problemReports) {
    const by = name(r.reported_by)
    rows.push({
      key: `problem-${r.id}`,
      kind: 'problem',
      dateYmd: r.report_date,
      label: `${r.description}${by ? ` — reported by ${by}` : ''}`,
      odometer: null,
      amount: null,
      sourceId: r.id,
    })
    if (r.resolved_at != null) {
      const note = (r.resolution_note ?? '').trim()
      rows.push({
        key: `problem-resolved-${r.id}`,
        kind: 'problem_resolved',
        dateYmd: r.resolved_at.slice(0, 10),
        label: note ? `Resolved · ${r.description} — ${note}` : `Resolved · ${r.description}`,
        odometer: null,
        amount: null,
        sourceId: r.id,
      })
    }
  }
  const kindOrder: Record<VehicleLedgerRowKind, number> = {
    return: 0,
    handoff: 1,
    problem_resolved: 2,
    problem: 3,
    service: 4,
    reading: 5,
    value: 6,
  }
  rows.sort((a, b) => {
    if (a.dateYmd !== b.dateYmd) return b.dateYmd.localeCompare(a.dateYmd)
    return kindOrder[a.kind] - kindOrder[b.kind]
  })
  return rows
}

export type HandOffWrites = {
  /** Close the departing holder's possession (end = hand-off date). Absent when unassigned. */
  endPossession: { id: string; end_date: string } | null
  newPossession: { vehicle_id: string; user_id: string; start_date: string }
  /** Optional reading captured during the hand-off. */
  odometerEntry: { vehicle_id: string; odometer_value: number; read_date: string; created_by: string | null } | null
}

/**
 * The one-step hand-off as a pure write plan: end the open possession on the
 * hand-off date, start the new one the same day (currentPossession resolves
 * the overlap day to the newer start), and record the odometer if given.
 */
export function handOffWrites(args: {
  vehicleId: string
  openPossession: FleetPossession | null
  toUserId: string
  dateYmd: string
  odometer: number | null
  byUserId: string | null
}): HandOffWrites {
  const { vehicleId, openPossession, toUserId, dateYmd, odometer, byUserId } = args
  return {
    endPossession: openPossession ? { id: openPossession.id, end_date: dateYmd } : null,
    newPossession: { vehicle_id: vehicleId, user_id: toUserId, start_date: dateYmd },
    odometerEntry:
      odometer != null
        ? { vehicle_id: vehicleId, odometer_value: odometer, read_date: dateYmd, created_by: byUserId }
        : null,
  }
}

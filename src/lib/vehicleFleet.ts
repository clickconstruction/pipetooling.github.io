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
  /** NULL = parked in the motor pool (deliberately held by no one). */
  user_id: string | null
  start_date: string
  end_date: string | null
  created_at: string | null
}

/** Display label for the person-less "holder" of a parked vehicle. */
export const MOTOR_POOL_LABEL = 'Motor pool'

/** True when this possession row parks the vehicle in the motor pool. */
export function isMotorPoolPossession(p: Pick<FleetPossession, 'user_id'>): boolean {
  return p.user_id == null
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

export type FleetInsurancePlan = {
  id: string
  name: string
  carrier: string | null
  policy_number: string | null
  renewal_date: string | null
  note: string | null
}

export type FleetInsurancePeriod = {
  id: string
  vehicle_id: string
  plan_id: string
  start_date: string
  end_date: string | null
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

type DatedPeriod = { start_date: string; end_date: string | null; created_at: string | null }

/**
 * The period active today: started on/before today and not ended before today.
 * Overlaps resolve to the open-ended one first, then the latest start (so a
 * same-day hand-off puts the vehicle with the new holder/plan).
 */
function currentDatedPeriod<T extends DatedPeriod>(periods: T[], todayYmd: string): T | null {
  const open = periods.filter((p) => p.start_date <= todayYmd && (p.end_date == null || p.end_date >= todayYmd))
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

/** The possession that holds the vehicle today (see currentDatedPeriod). */
export function currentPossession(possessions: FleetPossession[], todayYmd: string): FleetPossession | null {
  return currentDatedPeriod(possessions, todayYmd)
}

/** The insurance coverage active today — a vehicle sits on at most one plan at a time. */
export function currentInsurancePeriod(periods: FleetInsurancePeriod[], todayYmd: string): FleetInsurancePeriod | null {
  return currentDatedPeriod(periods, todayYmd)
}

/**
 * The most recently ended coverage — powers "off insurance since <date>" on
 * cards with no current plan. Null when the vehicle was never on a plan.
 */
export function lastEndedInsurancePeriod(periods: FleetInsurancePeriod[]): FleetInsurancePeriod | null {
  let best: FleetInsurancePeriod | null = null
  for (const p of periods) {
    if (p.end_date == null) continue
    if (best == null || p.end_date > (best.end_date ?? '') || (p.end_date === best.end_date && (p.created_at ?? '') > (best.created_at ?? ''))) {
      best = p
    }
  }
  return best
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
  /** No possession at all — unknown, needs an answer (amber). */
  unassigned: number
  /** Deliberately parked (possession with no person) — calm, not a warning. */
  motorPool: number
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
  let motorPool = 0
  let staleReadings = 0
  for (const v of vehicles) {
    const holder = holderByVehicle.get(v.id)
    if (!holder) unassigned++
    else if (isMotorPoolPossession(holder)) motorPool++
    if (odometerFreshness(latestByVehicle.get(v.id) ?? null, todayYmd) !== 'fresh') staleReadings++
  }
  return { total: vehicles.length, unassigned, motorPool, staleReadings }
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

export type OilThresholds = {
  /** Miles before due at which "suggested" starts (default OIL_DUE_SOON_MILES). */
  suggestWindowMiles?: number | null
  /** Miles past due before "suggested" escalates to "required" (default 0). */
  requirePastDueMiles?: number | null
}

/**
 * Oil due math: last oil change odometer + interval vs the latest reading.
 * Unknown until BOTH an oil change with miles and a reading exist.
 * due_soon ("suggested") inside the suggest window — which extends past the
 * due mark until the require threshold; overdue ("required") beyond that.
 * milesRemaining can be negative in the past-due grace zone.
 */
export function oilStatus(
  lastOil: FleetServiceEvent | null,
  interval: number | null | undefined,
  latest: FleetOdometerEntry | null,
  thresholds?: OilThresholds,
): OilStatus {
  const iv = interval ?? 5000
  if (!lastOil || lastOil.odometer_value == null || !latest || iv <= 0) return { state: 'unknown' }
  const suggestWindow = thresholds?.suggestWindowMiles ?? OIL_DUE_SOON_MILES
  const requirePastDue = Math.max(0, thresholds?.requirePastDueMiles ?? 0)
  const nextDueAt = lastOil.odometer_value + iv
  const remaining = nextDueAt - latest.odometer_value
  if (remaining < -requirePastDue) return { state: 'overdue', nextDueAt, milesOver: -remaining }
  if (remaining <= suggestWindow) return { state: 'due_soon', nextDueAt, milesRemaining: remaining }
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
      return status.milesRemaining < 0
        ? `Oil due · ${(-status.milesRemaining).toLocaleString()} mi past`
        : `Oil due in ${status.milesRemaining.toLocaleString()} mi`
    case 'overdue':
      return `Oil overdue ${status.milesOver.toLocaleString()} mi`
  }
}

/** Per-vehicle thresholds straight off a vehicles row (missing columns → defaults). */
export function oilThresholdsForVehicle(v: {
  oil_suggest_window_miles?: number | null
  oil_require_past_due_miles?: number | null
}): OilThresholds {
  return {
    suggestWindowMiles: v.oil_suggest_window_miles,
    requirePastDueMiles: v.oil_require_past_due_miles,
  }
}

export type FleetOilCounts = { dueSoon: number; overdue: number }

export function fleetOilCounts(
  vehicles: Array<
    FleetVehicle & {
      oil_change_interval_miles?: number | null
      oil_suggest_window_miles?: number | null
      oil_require_past_due_miles?: number | null
    }
  >,
  lastOilByVehicle: ReadonlyMap<string, FleetServiceEvent>,
  latestByVehicle: ReadonlyMap<string, FleetOdometerEntry>,
): FleetOilCounts {
  let dueSoon = 0
  let overdue = 0
  for (const v of vehicles) {
    const s = oilStatus(
      lastOilByVehicle.get(v.id) ?? null,
      v.oil_change_interval_miles,
      latestByVehicle.get(v.id) ?? null,
      oilThresholdsForVehicle(v),
    )
    if (s.state === 'due_soon') dueSoon++
    if (s.state === 'overdue') overdue++
  }
  return { dueSoon, overdue }
}

export type VehicleMaintenanceTask = {
  id: string
  vehicle_id: string
  title: string
  note: string | null
  source_problem_report_id: string | null
  checklist_item_id: string | null
  checklist_instance_id: string | null
  assigned_user_id: string | null
  due_date: string | null
  created_by: string | null
  created_at: string | null
  completed_at: string | null
  completed_by: string | null
}

export function openMaintenanceTasks(tasks: VehicleMaintenanceTask[]): VehicleMaintenanceTask[] {
  return tasks.filter((t) => t.completed_at == null)
}

export type MaintenanceChecklistLinkIds = {
  checklist_item_id: string | null
  checklist_instance_id: string | null
}

/**
 * Which checklist rows to touch when completing/deleting/reassigning a
 * maintenance task. Local component state can predate an assignment made in
 * the same page session (both ids null in memory while the DB row has them),
 * so a freshly fetched row wins outright — including its nulls, since after a
 * reassignment the stale local ids point at rows that no longer belong to
 * this task. Local state is only the fallback when the fetch failed.
 */
export function resolveChecklistCleanupIds(
  fresh: MaintenanceChecklistLinkIds | null,
  local: MaintenanceChecklistLinkIds,
): MaintenanceChecklistLinkIds {
  const src = fresh ?? local
  return { checklist_item_id: src.checklist_item_id, checklist_instance_id: src.checklist_instance_id }
}

export type MaintenanceTaskCounts = { open: number; unassigned: number }

/** Open/unassigned maintenance counts per vehicle for the cards and summary chips. */
export function maintenanceTaskCounts(tasks: VehicleMaintenanceTask[]): Map<string, MaintenanceTaskCounts> {
  const m = new Map<string, MaintenanceTaskCounts>()
  for (const t of tasks) {
    if (t.completed_at != null) continue
    const cur = m.get(t.vehicle_id) ?? { open: 0, unassigned: 0 }
    cur.open++
    if (t.assigned_user_id == null) cur.unassigned++
    m.set(t.vehicle_id, cur)
  }
  return m
}

/**
 * The checklist item title for an assigned maintenance task: vehicle name,
 * task, and a named link token back to the fleet board (links[0]).
 */
/** Marker the assign flow plants in the checklist title; the 🚗 chip keys off it (v2.2094). */
export const VEHICLE_TASK_TITLE_MARKER = '{{1:vehicle}}'

export function maintenanceChecklistTitle(vehicleName: string, taskTitle: string): string {
  return `${vehicleName} — ${taskTitle} ${VEHICLE_TASK_TITLE_MARKER}`
}

/** True when a checklist title came from a vehicle maintenance assignment. */
export function isVehicleTaskTitle(title: string): boolean {
  return title.includes(VEHICLE_TASK_TITLE_MARKER)
}

/** Title with the marker (and its link) removed — the chip replaces them. */
export function stripVehicleTaskMarker(title: string): string {
  return title.replace(VEHICLE_TASK_TITLE_MARKER, '').replace(/\s+$/, '')
}

export const ODOMETER_STALE_DAYS = 7

export type StaleOdometerRow = {
  vehicle: FleetVehicle
  /** The person holding it (never a motor-pool row). */
  holder: FleetPossession
  latest: FleetOdometerEntry | null
  /** Days since the last reading; null = never read. */
  daysStale: number | null
}

/**
 * The Quickfill "call for readings" list: vehicles held by a PERSON (motor
 * pool and unassigned skipped) whose latest reading is more than staleDays
 * old or missing entirely. Never-read vehicles sort first, then oldest.
 */
export function staleOdometerCallList(
  vehicles: FleetVehicle[],
  holderByVehicle: ReadonlyMap<string, FleetPossession>,
  latestByVehicle: ReadonlyMap<string, FleetOdometerEntry>,
  todayYmd: string,
  staleDays: number = ODOMETER_STALE_DAYS,
): StaleOdometerRow[] {
  const rows: StaleOdometerRow[] = []
  for (const v of vehicles) {
    const holder = holderByVehicle.get(v.id)
    if (!holder || isMotorPoolPossession(holder)) continue
    const latest = latestByVehicle.get(v.id) ?? null
    const daysStale = latest ? daysBetweenYmd(latest.read_date, todayYmd) : null
    if (daysStale != null && daysStale <= staleDays) continue
    rows.push({ vehicle: v, holder, latest, daysStale })
  }
  rows.sort((a, b) => {
    if ((a.daysStale == null) !== (b.daysStale == null)) return a.daysStale == null ? -1 : 1
    return (b.daysStale ?? 0) - (a.daysStale ?? 0)
  })
  return rows
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

export type VehicleLedgerRowKind =
  | 'reading'
  | 'handoff'
  | 'return'
  | 'value'
  | 'service'
  | 'problem'
  | 'problem_resolved'
  | 'insurance_on'
  | 'insurance_off'
  | 'task_done'

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
  insurancePeriods?: FleetInsurancePeriod[]
  planNameById?: ReadonlyMap<string, string>
  maintenanceTasks?: VehicleMaintenanceTask[]
}): VehicleLedgerRow[] {
  const { readings, possessions, valueEntries, userNameById, serviceEvents = [], problemReports = [], insurancePeriods = [], planNameById, maintenanceTasks = [] } = args
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
  const holderLabel = (p: FleetPossession): string =>
    isMotorPoolPossession(p) ? MOTOR_POOL_LABEL : (name(p.user_id) ?? 'Unknown')
  byStart.forEach((p, i) => {
    const holder = holderLabel(p)
    const prev = byStart
      .slice(0, i)
      .reverse()
      .find((q) => q.end_date != null && q.end_date <= p.start_date)
    rows.push({
      key: `handoff-${p.id}`,
      kind: 'handoff',
      dateYmd: p.start_date,
      label: prev
        ? `${holderLabel(prev)} → ${holder}`
        : isMotorPoolPossession(p)
          ? 'Parked in the motor pool'
          : `Assigned to ${holder}`,
      odometer: null,
      amount: null,
      sourceId: p.id,
    })
    if (p.end_date != null && !isMotorPoolPossession(p)) {
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
  for (const p of insurancePeriods) {
    const plan = planNameById?.get(p.plan_id) ?? 'insurance'
    rows.push({
      key: `insurance-on-${p.id}`,
      kind: 'insurance_on',
      dateYmd: p.start_date,
      label: `Added to ${plan}`,
      odometer: null,
      amount: null,
      sourceId: p.id,
    })
    if (p.end_date != null) {
      rows.push({
        key: `insurance-off-${p.id}`,
        kind: 'insurance_off',
        dateYmd: p.end_date,
        label: `Taken off ${plan}`,
        odometer: null,
        amount: null,
        sourceId: p.id,
      })
    }
  }
  for (const t of maintenanceTasks) {
    if (t.completed_at == null) continue
    const by = name(t.completed_by)
    rows.push({
      key: `task-done-${t.id}`,
      kind: 'task_done',
      dateYmd: t.completed_at.slice(0, 10),
      label: by ? `Task done · ${t.title} — by ${by}` : `Task done · ${t.title}`,
      odometer: null,
      amount: null,
      sourceId: t.id,
    })
  }
  const kindOrder: Record<VehicleLedgerRowKind, number> = {
    return: 0,
    handoff: 1,
    insurance_off: 2,
    insurance_on: 3,
    problem_resolved: 4,
    problem: 5,
    task_done: 6,
    service: 7,
    reading: 8,
    value: 9,
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
  newPossession: { vehicle_id: string; user_id: string | null; start_date: string }
  /** Optional reading captured during the hand-off. */
  odometerEntry: { vehicle_id: string; odometer_value: number; read_date: string; created_by: string | null } | null
}

/**
 * The one-step hand-off as a pure write plan: end the open possession on the
 * hand-off date, start the new one the same day (currentPossession resolves
 * the overlap day to the newer start), and record the odometer if given.
 * toUserId null = park the vehicle in the motor pool.
 */
export function handOffWrites(args: {
  vehicleId: string
  openPossession: FleetPossession | null
  toUserId: string | null
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

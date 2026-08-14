/**
 * Vehicles fleet kernels (v2.1644, People → Vehicles redesign): pure math for
 * the fleet board cards (current holder, odometer freshness, summary chips),
 * the unified per-vehicle ledger (readings + hand-offs + replacement values
 * merged newest-first), and the one-step hand-off write plan. The component
 * stays thin; everything testable lives here.
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

export type VehicleLedgerRowKind = 'reading' | 'handoff' | 'return' | 'value'

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
}): VehicleLedgerRow[] {
  const { readings, possessions, valueEntries, userNameById } = args
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
  const kindOrder: Record<VehicleLedgerRowKind, number> = { return: 0, handoff: 1, reading: 2, value: 3 }
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

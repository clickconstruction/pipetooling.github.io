import {
  daysBetweenYmd,
  isMotorPoolPossession,
  odometerFreshness,
  vehicleDisplayName,
  vinTail,
  type FleetOdometerEntry,
  type FleetPossession,
  type FleetVehicle,
} from './vehicleFleet'

/**
 * Catch-up modal rows behind the fleet summary chips (v2.2106): tap
 * "8 need a reading" and clear the whole list without leaving the modal.
 * Mirrors `fleetSummary.staleReadings` exactly — every vehicle whose latest
 * reading is missing or >30 days old, motor pool and unassigned included
 * (unlike Quickfill's `staleOdometerCallList`, which is holders-only at 7d).
 */

export type ReadingCatchUpRow = {
  vehicleId: string
  name: string
  vinTail: string | null
  holderKind: 'person' | 'pool' | 'none'
  holderUserId: string | null
  /** "no reading yet" or "56,184 mi · 41d ago". */
  lastLabel: string
}

export function readingCatchUpRows(
  vehicles: FleetVehicle[],
  holderByVehicle: ReadonlyMap<string, FleetPossession>,
  latestByVehicle: ReadonlyMap<string, FleetOdometerEntry>,
  todayYmd: string,
): ReadingCatchUpRow[] {
  const rows: Array<ReadingCatchUpRow & { daysStale: number | null }> = []
  for (const v of vehicles) {
    const latest = latestByVehicle.get(v.id) ?? null
    if (odometerFreshness(latest, todayYmd) === 'fresh') continue
    const holder = holderByVehicle.get(v.id) ?? null
    rows.push({
      vehicleId: v.id,
      name: vehicleDisplayName(v),
      vinTail: vinTail(v.vin),
      holderKind: holder == null ? 'none' : isMotorPoolPossession(holder) ? 'pool' : 'person',
      holderUserId: holder?.user_id ?? null,
      lastLabel: latest
        ? `${latest.odometer_value.toLocaleString()} mi · ${daysBetweenYmd(latest.read_date, todayYmd)}d ago`
        : 'no reading yet',
      daysStale: latest ? daysBetweenYmd(latest.read_date, todayYmd) : null,
    })
  }
  // Never-read first, then stalest first, name as the tiebreak.
  rows.sort((a, b) => {
    if ((a.daysStale == null) !== (b.daysStale == null)) return a.daysStale == null ? -1 : 1
    if ((a.daysStale ?? 0) !== (b.daysStale ?? 0)) return (b.daysStale ?? 0) - (a.daysStale ?? 0)
    return a.name.localeCompare(b.name)
  })
  return rows.map(({ daysStale: _unused, ...row }) => row)
}

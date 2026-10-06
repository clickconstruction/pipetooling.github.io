import { currentInsurancePeriod, currentPossession, isMotorPoolPossession, vehicleDisplayName, type FleetInsurancePeriod, type FleetPossession, type FleetVehicle } from './vehicleFleet'
import { effectiveWeeklyInsuranceCost } from './vehicleInsuranceCost'

/**
 * Vehicle records on the Needs You card (v2.4692; the owner, 2026-10-06): an active vehicle with
 * no insurance, registration or service on file. Active is the fleet board's rule, a person holds
 * it today (the motor pool and unassigned vehicles wait for a holder). Missing, each part:
 *   insurance    — no weekly cost counts today: off a plan, or on one at $0 (`effectiveWeeklyInsuranceCost`).
 *                  On a plan it is insured, so the words say "insurance cost" (`vehicleRecordGapWords`);
 *   registration — no weekly registration cost;
 *   service      — no service event was ever entered.
 * People → Review prices a company truck's fixed costs from these, so a missing one reads as $0
 * there. Pure; the loader is `useVehicleRecordGapsNudge`.
 */

export type VehicleRecordPart = 'insurance' | 'registration' | 'service'

export type VehicleRecordGap = {
  vehicleId: string
  /** "2007 Ram 3500" (`vehicleDisplayName`). */
  name: string
  holderUserId: string
  /** The holder's name, or null when the directory does not have it. */
  holderName: string | null
  /** In the order insurance, registration, service. */
  missing: VehicleRecordPart[]
  /** On an insurance plan today: a missing insurance part is then the plan's weekly cost, not the coverage. */
  insuranceOnPlan: boolean
}

export type VehicleRecordVehicle = Pick<FleetVehicle, 'id' | 'year' | 'make' | 'model'> & {
  weekly_insurance_cost: number | null
  weekly_registration_cost: number | null
}

const PART_ORDER: readonly VehicleRecordPart[] = ['insurance', 'registration', 'service']

/** Active vehicles with at least one part missing: most missing first, then by name. */
export function vehicleRecordGaps(input: {
  vehicles: ReadonlyArray<VehicleRecordVehicle>
  possessions: ReadonlyArray<FleetPossession>
  insurancePeriods: ReadonlyArray<FleetInsurancePeriod>
  /** Vehicles with any service event on file, ever. */
  serviceVehicleIds: ReadonlySet<string>
  holderNameByUserId: ReadonlyMap<string, string>
  /** Today on the company calendar. */
  todayYmd: string
}): VehicleRecordGap[] {
  const possessionsByVehicle = groupByVehicle(input.possessions)
  const periodsByVehicle = groupByVehicle(input.insurancePeriods)
  const out: VehicleRecordGap[] = []
  for (const v of input.vehicles) {
    const holder = currentPossession(possessionsByVehicle.get(v.id) ?? [], input.todayYmd)
    if (holder == null || isMotorPoolPossession(holder) || holder.user_id == null) continue
    const onPlan = currentInsurancePeriod(periodsByVehicle.get(v.id) ?? [], input.todayYmd) != null
    const has: Record<VehicleRecordPart, boolean> = {
      insurance: effectiveWeeklyInsuranceCost(v.weekly_insurance_cost, onPlan) > 0,
      registration: Number(v.weekly_registration_cost ?? 0) > 0,
      service: input.serviceVehicleIds.has(v.id),
    }
    const missing = PART_ORDER.filter((p) => !has[p])
    if (missing.length === 0) continue
    out.push({
      vehicleId: v.id,
      name: vehicleDisplayName(v),
      holderUserId: holder.user_id,
      holderName: input.holderNameByUserId.get(holder.user_id)?.trim() || null,
      missing,
      insuranceOnPlan: onPlan,
    })
  }
  return out.sort((a, b) => b.missing.length - a.missing.length || a.name.localeCompare(b.name) || a.vehicleId.localeCompare(b.vehicleId))
}

/** One vehicle's missing parts in words: "insurance cost" for a vehicle on a plan at $0, else the part's name. */
export function vehicleRecordGapWords(gap: Pick<VehicleRecordGap, 'missing' | 'insuranceOnPlan'>, joiner: 'and' | 'or' = 'and'): string {
  return joinWords(gap.missing.map((p) => (p === 'insurance' && gap.insuranceOnPlan ? 'insurance cost' : p)), joiner)
}

/** "a", "a and b", "a, b and c"; `or` after a "no". */
function joinWords(words: ReadonlyArray<string>, joiner: 'and' | 'or'): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} ${joiner} ${words[words.length - 1]}`
}

function groupByVehicle<T extends { vehicle_id: string }>(rows: ReadonlyArray<T>): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const list = m.get(r.vehicle_id)
    if (list) list.push(r)
    else m.set(r.vehicle_id, [r])
  }
  return m
}

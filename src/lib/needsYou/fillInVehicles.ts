import { vehicleRecordGapWords, type VehicleRecordGap, type VehicleRecordPart } from '../vehicleRecordGaps'
import { SERVICE_TYPE_LABELS, parseOdometerInput } from '../vehicleFleet'
import { INSURANCE_COST_UNITS, weeklyInsuranceCostFromInput, type InsuranceCostUnit } from '../vehicleInsuranceCost'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The vehicle kind (v2.5775, punch list #146, PR 3): the rows behind the Needs you line
 * *N vehicles are missing insurance, registration or service*, one row per vehicle, asking only
 * for the records that are missing (`vehicleRecordGaps` says which). The writes are the
 * Vehicles tab's own: the weekly costs on the vehicle, a period on an insurance plan, a service
 * event with its odometer reading. Pure; `fillInVehiclesIo.ts` reads and writes.
 */
export type VehiclePlanOption = { id: string; name: string }

export type VehicleFillInRow = FillInRowBase & {
  kind: 'vehicle'
  vehicleId: string
  name: string
  holderName: string | null
  /** In the order insurance, registration, service. */
  missing: VehicleRecordPart[]
  insuranceOnPlan: boolean
  /** The plans the insurance part can pick from. */
  plans: VehiclePlanOption[]
}

export function compareVehicleRows(a: VehicleFillInRow, b: VehicleFillInRow): number {
  return b.missing.length - a.missing.length || a.name.localeCompare(b.name) || a.vehicleId.localeCompare(b.vehicleId)
}

export function vehicleKnows(gap: Pick<VehicleRecordGap, 'holderName' | 'insuranceOnPlan' | 'missing'>): string[] {
  // The title already names who drives it; a holder with no name on file is worth a line.
  const out: string[] = []
  if (!gap.holderName) out.push('Someone holds it today, with no name on file.')
  if (gap.missing.includes('insurance')) out.push(gap.insuranceOnPlan ? 'It is on an insurance plan, with no weekly cost entered.' : 'It is not on an insurance plan.')
  if (!gap.missing.includes('registration')) out.push('Registration is on file.')
  if (!gap.missing.includes('service')) out.push('Service has been logged before.')
  return out
}

export function vehicleFillInRows(gaps: readonly VehicleRecordGap[], plans: readonly VehiclePlanOption[]): VehicleFillInRow[] {
  return gaps
    .map(
      (g): VehicleFillInRow => ({
        key: fillInRowKey('vehicle', g.vehicleId),
        kind: 'vehicle',
        severity: 'gray',
        title: `${g.name} · ${g.holderName ? `${g.holderName} drives it` : 'held today'} · no ${vehicleRecordGapWords(g, 'or')} on file`,
        knows: vehicleKnows(g),
        doorHref: '/people?tab=vehicles',
        doorLabel: 'Open Vehicles',
        vehicleId: g.vehicleId,
        name: g.name,
        holderName: g.holderName,
        missing: [...g.missing],
        insuranceOnPlan: g.insuranceOnPlan,
        plans: [...plans],
      }),
    )
    .sort(compareVehicleRows)
}

/** The fields, one block per missing part; a part the vehicle has is never asked. */
export type VehicleDecision = {
  planId: string
  planStartYmd: string
  insuranceCostRaw: string
  insuranceUnit: InsuranceCostUnit
  registrationCostRaw: string
  registrationUnit: InsuranceCostUnit
  serviceType: string
  serviceDateYmd: string
  odometerRaw: string
  serviceNote: string
}

export function emptyVehicleDecision(todayYmd: string): VehicleDecision {
  return { planId: '', planStartYmd: todayYmd, insuranceCostRaw: '', insuranceUnit: 'mo', registrationCostRaw: '', registrationUnit: 'yr', serviceType: 'oil_change', serviceDateYmd: todayYmd, odometerRaw: '', serviceNote: '' }
}

export const VEHICLE_COST_UNITS = INSURANCE_COST_UNITS
export const VEHICLE_SERVICE_TYPES: ReadonlyArray<{ key: string; label: string }> = Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => ({ key, label: key === 'other' ? 'Other' : label }))

/** Each missing part's answer is usable: a cost above zero, a plan when off one, a service type and day. */
export function vehicleDecisionReady(row: Pick<VehicleFillInRow, 'missing' | 'insuranceOnPlan'>, d: VehicleDecision): boolean {
  for (const part of row.missing) {
    if (part === 'insurance') {
      const weekly = weeklyInsuranceCostFromInput(d.insuranceCostRaw, d.insuranceUnit)
      if (weekly == null || weekly <= 0) return false
      if (!row.insuranceOnPlan && (!d.planId || !d.planStartYmd)) return false
    } else if (part === 'registration') {
      const weekly = weeklyInsuranceCostFromInput(d.registrationCostRaw, d.registrationUnit)
      if (weekly == null || weekly <= 0) return false
    } else if (part === 'service') {
      if (!d.serviceType || !d.serviceDateYmd) return false
      if (d.odometerRaw.trim() && parseOdometerInput(d.odometerRaw) == null) return false
    }
  }
  return true
}

export type VehicleWrites = {
  vehicleId: string
  /** The weekly costs the vehicle row gains; empty when neither was asked. */
  vehiclePatch: { weekly_insurance_cost?: number; weekly_registration_cost?: number }
  insurancePeriod: { vehicle_id: string; plan_id: string; start_date: string; created_by: string } | null
  serviceEvent: { vehicle_id: string; service_type: string; service_date: string; odometer_value: number | null; cost: null; note: string | null; created_by: string } | null
  /** A service with miles is also a reading, as the Vehicles tab writes it. */
  odometerEntry: { vehicle_id: string; odometer_value: number; read_date: string; created_by: string } | null
}

export function vehicleWrites(row: VehicleFillInRow, d: VehicleDecision, ctx: { userId: string }): VehicleWrites | null {
  if (!vehicleDecisionReady(row, d)) return null
  const w: VehicleWrites = { vehicleId: row.vehicleId, vehiclePatch: {}, insurancePeriod: null, serviceEvent: null, odometerEntry: null }
  for (const part of row.missing) {
    if (part === 'insurance') {
      w.vehiclePatch.weekly_insurance_cost = weeklyInsuranceCostFromInput(d.insuranceCostRaw, d.insuranceUnit)!
      if (!row.insuranceOnPlan) w.insurancePeriod = { vehicle_id: row.vehicleId, plan_id: d.planId, start_date: d.planStartYmd, created_by: ctx.userId }
    } else if (part === 'registration') {
      w.vehiclePatch.weekly_registration_cost = weeklyInsuranceCostFromInput(d.registrationCostRaw, d.registrationUnit)!
    } else if (part === 'service') {
      const odo = d.odometerRaw.trim() ? parseOdometerInput(d.odometerRaw) : null
      w.serviceEvent = { vehicle_id: row.vehicleId, service_type: d.serviceType, service_date: d.serviceDateYmd, odometer_value: odo, cost: null, note: d.serviceNote.trim() || null, created_by: ctx.userId }
      if (odo != null) w.odometerEntry = { vehicle_id: row.vehicleId, odometer_value: odo, read_date: d.serviceDateYmd, created_by: ctx.userId }
    }
  }
  return w
}

function usdWeekly(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/wk`
}

/** The saved line under the deck, after the row's title: what was entered, and where it lives now. */
export function vehicleTrailWords(row: Pick<VehicleFillInRow, 'plans'>, w: VehicleWrites): string {
  const parts: string[] = []
  if (w.vehiclePatch.weekly_insurance_cost != null) {
    const plan = w.insurancePeriod ? row.plans.find((p) => p.id === w.insurancePeriod!.plan_id)?.name : null
    parts.push(`insurance ${usdWeekly(w.vehiclePatch.weekly_insurance_cost)}${plan ? ` on ${plan}` : ''}`)
  }
  if (w.vehiclePatch.weekly_registration_cost != null) parts.push(`registration ${usdWeekly(w.vehiclePatch.weekly_registration_cost)}`)
  if (w.serviceEvent) {
    const label = (SERVICE_TYPE_LABELS[w.serviceEvent.service_type] ?? 'Service').toLowerCase()
    const ms = Date.parse(`${w.serviceEvent.service_date}T12:00:00`)
    parts.push(`${label} ${Number.isFinite(ms) ? formatDenverCalendarDayShort(ms) : w.serviceEvent.service_date}`)
  }
  parts.push('People → Vehicles has it')
  return parts.join(' · ')
}

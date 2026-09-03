// Loader for the Wheels report (v2.2733): gathers the trailing-90-day facts —
// fuel-tag card charges by attributed person, approved field hours by user,
// company trucks with their holders, insurance, registration and service —
// and hands them to the pure kernel in `wheels.ts`.

import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { ymdAddDays } from '../../utils/dateUtils'
import { buildCategoryTagLookups, categoryTagForCharge, type CategoryTagRow } from '../banking/categoryTags'
import { fetchLabelIdByTxId, loadCategoryTags } from '../banking/categoryTagsData'
import { fetchAttributionsByMercuryTxIds } from '../fetchMercuryRelationsByTxIds'
import { currentInsurancePeriod, currentPossession, isMotorPoolPossession, vehicleDisplayName, type FleetInsurancePeriod, type FleetPossession } from '../vehicleFleet'
import {
  buildWheelsRows,
  fieldHoursByUser,
  parseVehicleArrangement,
  sumFuelByUser,
  truckRunningCost,
  wheelsComparison,
  wheelsWindow,
  type WheelsPersonRow,
  type WheelsSessionRow,
  type WheelsTruck,
} from './wheels'

const PAGE = 1000

async function paged<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const rows = await withSupabaseRetry(async () => build(from, from + PAGE - 1), label)
    const batch = (rows ?? []) as T[]
    out.push(...batch)
    if (batch.length < PAGE) break
  }
  return out
}

export type WheelsSnapshot = {
  window: { start: string; end: string; days: number }
  rows: WheelsPersonRow[]
  trucks: WheelsTruck[]
  /** The tag whose charges count as fuel (default family ⛽ Fuel & gas). null when no tag is flagged. */
  fuelTag: CategoryTagRow | null
  comparison: { ownAvg: number | null; companyAvg: number | null }
  /** Fuel charges in the window nobody is attributed to — they can't reach a person's rate. */
  unattributedFuelUsd: number
}

type PayConfigLite = { person_name: string; vehicle_arrangement?: unknown; vehicle_rate_override?: number | null }

export async function loadWheelsSnapshot(input: { todayYmd: string; users: ReadonlyArray<{ id: string; name: string }> }): Promise<WheelsSnapshot> {
  const window = wheelsWindow(input.todayYmd)
  const endExclusive = ymdAddDays(window.end, 1)

  const [payRows, tagData, txRows, sessions, vehicles, possessions, insPeriods, serviceEvents] = await Promise.all([
    withSupabaseRetry(async () => await supabase.from('people_pay_config').select('*'), 'wheels pay config') as Promise<PayConfigLite[]>,
    loadCategoryTags(),
    paged<{ id: string; amount: number; mercury_category: unknown }>(
      (f, t) => supabase.from('mercury_transactions').select('id, amount, mercury_category').gte('posted_at', window.start).lt('posted_at', endExclusive).order('id').range(f, t),
      'wheels transactions',
    ),
    paged<WheelsSessionRow>(
      (f, t) =>
        supabase
          .from('clock_sessions')
          .select('user_id, job_ledger_id, bid_id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at')
          .gte('work_date', window.start)
          .lte('work_date', window.end)
          .order('id')
          .range(f, t),
      'wheels sessions',
    ),
    withSupabaseRetry(async () => await supabase.from('vehicles').select('id, year, make, model, vin, weekly_insurance_cost, weekly_registration_cost'), 'wheels vehicles'),
    withSupabaseRetry(async () => await supabase.from('vehicle_possessions').select('*').order('start_date', { ascending: false }), 'wheels possessions'),
    withSupabaseRetry(async () => await supabase.from('vehicle_insurance_periods').select('*').order('start_date', { ascending: false }), 'wheels insurance periods'),
    withSupabaseRetry(
      async () => await supabase.from('vehicle_service_events').select('vehicle_id, cost, service_date').gte('service_date', window.start).lte('service_date', window.end),
      'wheels service events',
    ),
  ])

  // Fuel = charges whose accounting label's tag, else bank category's tag, is the fuel family.
  const lookups = buildCategoryTagLookups(tagData.tags, tagData.members)
  const fuelTag = tagData.tags.find((t) => t.default_key === 'fuel_vehicle') ?? tagData.tags.find((t) => /fuel/i.test(t.name)) ?? null
  let fuelTx: Array<{ id: string; amount: number }> = []
  if (fuelTag && txRows.length > 0) {
    const labelIdByTxId = await fetchLabelIdByTxId(txRows.map((r) => r.id))
    fuelTx = txRows.filter((r) => {
      const bank = typeof r.mercury_category === 'string' ? r.mercury_category : null
      return categoryTagForCharge(lookups, labelIdByTxId.get(r.id) ?? null, bank)?.id === fuelTag.id
    })
  }
  const attributions = fuelTx.length > 0 ? await fetchAttributionsByMercuryTxIds(fuelTx.map((r) => r.id), 'wheels') : []
  const userByTx = new Map<string, string>()
  for (const a of attributions) if (a.user_id) userByTx.set(a.mercury_transaction_id, a.user_id)
  const charges = fuelTx.map((r) => ({ amount: r.amount, userId: userByTx.get(r.id) ?? null }))
  const fuelByUser = sumFuelByUser(charges)
  const unattributedFuelUsd = Math.round(charges.filter((c) => !c.userId).reduce((s, c) => s + Math.abs(c.amount), 0) * 100) / 100

  const hoursByUser = fieldHoursByUser(sessions)
  const nameById = new Map(input.users.map((u) => [u.id, u.name]))

  const possByVehicle = new Map<string, FleetPossession[]>()
  for (const p of (possessions ?? []) as FleetPossession[]) possByVehicle.set(p.vehicle_id, [...(possByVehicle.get(p.vehicle_id) ?? []), p])
  const insByVehicle = new Map<string, FleetInsurancePeriod[]>()
  for (const p of (insPeriods ?? []) as FleetInsurancePeriod[]) insByVehicle.set(p.vehicle_id, [...(insByVehicle.get(p.vehicle_id) ?? []), p])
  const serviceByVehicle = new Map<string, number>()
  for (const e of (serviceEvents ?? []) as Array<{ vehicle_id: string; cost: number | null }>) serviceByVehicle.set(e.vehicle_id, (serviceByVehicle.get(e.vehicle_id) ?? 0) + (e.cost ?? 0))

  const trucks: WheelsTruck[] = []
  for (const v of (vehicles ?? []) as Array<{ id: string; year: number | null; make: string; model: string; vin: string | null; weekly_insurance_cost: number | null; weekly_registration_cost: number | null }>) {
    const holder = currentPossession(possByVehicle.get(v.id) ?? [], input.todayYmd)
    const holderUserId = holder && !isMotorPoolPossession(holder) ? holder.user_id : null
    const holderFieldHours = holderUserId ? (hoursByUser.get(holderUserId) ?? 0) : 0
    trucks.push({
      vehicleId: v.id,
      name: vehicleDisplayName(v),
      holderUserId,
      holderName: holderUserId ? (nameById.get(holderUserId) ?? null) : null,
      holderFieldHours,
      cost: truckRunningCost({
        fuelUsd: holderUserId ? (fuelByUser.get(holderUserId) ?? 0) : 0,
        weeklyInsurance: v.weekly_insurance_cost,
        weeklyRegistration: v.weekly_registration_cost,
        onPlan: currentInsurancePeriod(insByVehicle.get(v.id) ?? [], input.todayYmd) != null,
        days: window.days,
        serviceUsd: serviceByVehicle.get(v.id) ?? 0,
        holderFieldHours,
      }),
    })
  }
  trucks.sort((a, b) => (a.holderUserId ? 0 : 1) - (b.holderUserId ? 0 : 1) || b.cost.total - a.cost.total || a.name.localeCompare(b.name))

  const userIdByName = new Map(input.users.map((u) => [u.name.trim(), u.id]))
  const people = (payRows ?? []).map((r) => ({
    name: r.person_name,
    userId: userIdByName.get(r.person_name.trim()) ?? null,
    arrangement: parseVehicleArrangement(r.vehicle_arrangement),
    override: r.vehicle_rate_override ?? null,
  }))
  const rows = buildWheelsRows(people, fuelByUser, hoursByUser, trucks)
  return { window, rows, trucks, fuelTag, comparison: wheelsComparison(rows), unattributedFuelUsd }
}

/** Manual $/field hour for a person; null clears it so the computed rate applies again. */
export async function saveVehicleRateOverride(personName: string, override: number | null): Promise<void> {
  await withSupabaseRetry(
    async () => await supabase.from('people_pay_config').update({ vehicle_rate_override: override } as never).eq('person_name', personName),
    'wheels save rate override',
  )
}

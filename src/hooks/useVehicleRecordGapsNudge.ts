import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { withSupabaseRetry } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import type { FleetInsurancePeriod, FleetPossession } from '../lib/vehicleFleet'
import { vehicleRecordGaps, type VehicleRecordGap, type VehicleRecordVehicle } from '../lib/vehicleRecordGaps'

/**
 * Needs You → Vehicles (v2.4700): the active vehicles with no insurance, registration or service
 * on file (`vehicleRecordGaps`). Reads as the viewer: dev, assistant and controller pass the
 * vehicle tables' "Pay access users" policies. Holds and insurance periods are read only where
 * they reach today; service only for the active vehicles, paged past PostgREST's 1,000-row cap.
 * Null while loading, disabled, failed or empty (no card). Refetches on window focus.
 */
export function useVehicleRecordGapsNudge(enabled: boolean): { gaps: VehicleRecordGap[] | null; reload: () => void } {
  const [gaps, setGaps] = useState<VehicleRecordGap[] | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setGaps(null)
      return
    }
    try {
      setGaps(await loadVehicleRecordGaps())
    } catch {
      setGaps(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { gaps, reload: () => void load() }
}

/** The one method the loader needs; tests hand in a fake. */
export type VehicleRecordsClient = Pick<typeof supabase, 'from'>

/** The reads and the kernel. Throws when a read fails; null when nothing is missing. */
export async function loadVehicleRecordGaps(todayYmd: string = todayYmdInAppTz(), client: VehicleRecordsClient = supabase): Promise<VehicleRecordGap[] | null> {
  const reachesToday = `end_date.is.null,end_date.gte.${todayYmd}`
  const [vehicles, possessions, insurancePeriods] = await Promise.all([
    fetchAllRows<VehicleRecordVehicle>(
      (from, to) => client.from('vehicles').select('id, year, make, model, weekly_insurance_cost, weekly_registration_cost').order('id').range(from, to),
      'needs you vehicles',
    ),
    fetchAllRows<FleetPossession>(
      (from, to) => client.from('vehicle_possessions').select('id, vehicle_id, user_id, start_date, end_date, created_at').lte('start_date', todayYmd).or(reachesToday).order('id').range(from, to),
      'needs you vehicle holders',
    ),
    fetchAllRows<FleetInsurancePeriod>(
      (from, to) => client.from('vehicle_insurance_periods').select('id, vehicle_id, plan_id, start_date, end_date, created_at').lte('start_date', todayYmd).or(reachesToday).order('id').range(from, to),
      'needs you vehicle insurance',
    ),
  ])
  // Service and names only for vehicles a person holds today: the kernel skips the rest.
  const heldIds = [...new Set(possessions.filter((p) => p.user_id != null).map((p) => p.vehicle_id))]
  if (heldIds.length === 0) return null
  const holderIds = [...new Set(possessions.map((p) => p.user_id).filter((id): id is string => id != null))]
  const [serviceRows, users] = await Promise.all([
    fetchAllRowsChunkedIn<{ vehicle_id: string }, string>(
      heldIds,
      (chunk, from, to) => client.from('vehicle_service_events').select('vehicle_id').in('vehicle_id', chunk).order('id').range(from, to),
      'needs you vehicle service',
    ),
    withSupabaseRetry(async () => await client.from('users').select('id, name').in('id', holderIds), 'needs you vehicle holder names'),
  ])
  const gaps = vehicleRecordGaps({
    vehicles,
    possessions,
    insurancePeriods,
    serviceVehicleIds: new Set(serviceRows.map((r) => r.vehicle_id)),
    holderNameByUserId: new Map(((users ?? []) as Array<{ id: string; name: string | null }>).filter((u) => (u.name ?? '').trim()).map((u) => [u.id, (u.name ?? '').trim()])),
    todayYmd,
  })
  return gaps.length > 0 ? gaps : null
}

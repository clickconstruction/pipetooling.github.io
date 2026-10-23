import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { loadVehicleRecordGaps } from '../../hooks/useVehicleRecordGapsNudge'
import type { VehicleRecordGap } from '../vehicleRecordGaps'
import type { VehiclePlanOption, VehicleWrites } from './fillInVehicles'

/**
 * The vehicle kind's reads and writes (v2.5775, punch list #145): the gaps are the Needs you
 * line's own loader, the plans the Vehicles tab's list; the writes are the tab's — the weekly
 * costs on the vehicle, a period on a plan, a service event and its reading. Undo zeroes the
 * costs it set and deletes the rows it inserted.
 */
export type VehicleFillInIo = {
  fetchGaps: () => Promise<VehicleRecordGap[]>
  fetchPlans: () => Promise<VehiclePlanOption[]>
  save: (w: VehicleWrites) => Promise<VehicleSaved>
  undo: (saved: VehicleSaved) => Promise<void>
}

export type VehicleSaved = {
  vehicleId: string
  costsSet: Array<'weekly_insurance_cost' | 'weekly_registration_cost'>
  insurancePeriodId: string | null
  serviceEventId: string | null
  odometerEntryId: string | null
}

const idOf = (rows: unknown): string | null => ((rows as Array<{ id?: string }> | null)?.[0]?.id ?? null)

export const vehicleFillInIo: VehicleFillInIo = {
  async fetchGaps() {
    return (await loadVehicleRecordGaps()) ?? []
  },
  async fetchPlans() {
    const rows = await withSupabaseRetry(async () => supabase.from('vehicle_insurance_plans').select('id, name').order('name'), 'fill in: insurance plans')
    return ((rows ?? []) as Array<{ id: string; name: string }>).map((p) => ({ id: p.id, name: p.name }))
  },
  async save(w) {
    const saved: VehicleSaved = { vehicleId: w.vehicleId, costsSet: [], insurancePeriodId: null, serviceEventId: null, odometerEntryId: null }
    if (Object.keys(w.vehiclePatch).length > 0) {
      await withSupabaseRetry(async () => supabase.from('vehicles').update({ ...w.vehiclePatch, updated_at: new Date().toISOString() }).eq('id', w.vehicleId).select('id'), 'fill in: vehicle costs')
      saved.costsSet = Object.keys(w.vehiclePatch) as VehicleSaved['costsSet']
    }
    if (w.insurancePeriod) saved.insurancePeriodId = idOf(await withSupabaseRetry(async () => supabase.from('vehicle_insurance_periods').insert(w.insurancePeriod!).select('id'), 'fill in: insurance period'))
    if (w.serviceEvent) saved.serviceEventId = idOf(await withSupabaseRetry(async () => supabase.from('vehicle_service_events').insert(w.serviceEvent!).select('id'), 'fill in: service'))
    if (w.odometerEntry) saved.odometerEntryId = idOf(await withSupabaseRetry(async () => supabase.from('vehicle_odometer_entries').insert(w.odometerEntry!).select('id'), 'fill in: odometer'))
    return saved
  },
  async undo(saved) {
    if (saved.odometerEntryId) await withSupabaseRetry(async () => supabase.from('vehicle_odometer_entries').delete().eq('id', saved.odometerEntryId!), 'fill in: undo odometer')
    if (saved.serviceEventId) await withSupabaseRetry(async () => supabase.from('vehicle_service_events').delete().eq('id', saved.serviceEventId!), 'fill in: undo service')
    if (saved.insurancePeriodId) await withSupabaseRetry(async () => supabase.from('vehicle_insurance_periods').delete().eq('id', saved.insurancePeriodId!), 'fill in: undo insurance period')
    if (saved.costsSet.length > 0) {
      const back: Record<string, number | string> = { updated_at: new Date().toISOString() }
      for (const c of saved.costsSet) back[c] = 0
      await withSupabaseRetry(async () => supabase.from('vehicles').update(back).eq('id', saved.vehicleId).select('id'), 'fill in: undo vehicle costs')
    }
  },
}

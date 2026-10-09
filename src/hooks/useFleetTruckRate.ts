import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { parseFleetTruckRate, type FleetTruckRateRead } from '../lib/bids/crewRate'
import { todayYmdInAppTz } from '../utils/dateUtils'

// Untyped until the types regenerate after 20261010008000's push.
const db = supabase as unknown as SupabaseClient

/**
 * What the company's trucks cost per field hour, for the Bids crew-rate card (Wheels PR 3, v2.5039).
 * One server read (`fleet_truck_rate_per_field_hour`) so an estimator, who cannot read the fleet's
 * own tables, sees the same number People → Vehicles shows the office. Fail-soft: any error, a
 * refusal or a server without the function yields null and the card shows no truck line.
 */
export function useFleetTruckRate(enabled: boolean): FleetTruckRateRead | null {
  const [fleet, setFleet] = useState<FleetTruckRateRead | null>(null)

  useEffect(() => {
    if (!enabled) {
      setFleet(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await db.rpc('fleet_truck_rate_per_field_hour', { p_today: todayYmdInAppTz() })
        if (!cancelled) setFleet(error ? null : parseFleetTruckRate(data))
      } catch {
        if (!cancelled) setFleet(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return fleet
}

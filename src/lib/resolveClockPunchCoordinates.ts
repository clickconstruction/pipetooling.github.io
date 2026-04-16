import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCallerIpGeoForMaps } from './ipGeolocationMaps'

export type ClockPunchLocationSource = 'gps' | 'ip'

export type ClockPunchCoordinates = { lat: number; lng: number; source: ClockPunchLocationSource }

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60000,
}

/**
 * Prefer device GPS; on failure or denial, approximate lat/lng via geo-IP (caller IP on Edge).
 */
export async function resolveClockPunchCoordinates(supabase: SupabaseClient): Promise<ClockPunchCoordinates | null> {
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS)
      })
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, source: 'gps' }
      }
    } catch {
      /* try IP */
    }
  }
  try {
    const { lat, lng } = await fetchCallerIpGeoForMaps(supabase)
    return { lat, lng, source: 'ip' }
  } catch {
    return null
  }
}

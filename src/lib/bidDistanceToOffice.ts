import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { haversineMeters, TRAVEL_ROAD_WINDING_FACTOR, type LatLng } from './jobTravelEstimate'
import { resolveOfficeAnchor } from './officeAddressSettings'
import type { GeocodeOneResponse } from './map/invokeGeocodeOneRefreshGoogleOnly'

/**
 * Auto-fill for the bid form's "Distance to Office (miles)" field.
 *
 * Preferred path: the `driving-distance` edge function (Google Routes API) —
 * real driven miles, matching what an estimator reads off Google Maps.
 * Fallback path: straight-line haversine × the road-winding factor from
 * `jobTravelEstimate.ts` — an offline approximation used whenever routing is
 * unavailable (key missing, Routes API not enabled, network error). Callers
 * surface `source` so the user can tell an exact number from an estimate.
 */

const METERS_PER_MILE = 1609.344

export function milesFromMeters(meters: number): number {
  return meters / METERS_PER_MILE
}

/** Straight-line miles × road-winding — the fallback approximation of driven miles. */
export function estimateDrivingMiles(a: LatLng, b: LatLng): number {
  return milesFromMeters(haversineMeters(a, b) * TRAVEL_ROAD_WINDING_FACTOR)
}

/** Field text for a computed mileage: one decimal, no trailing '.0'. */
export function formatMilesForInput(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return ''
  const rounded = Math.round(miles * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export type DrivingDistanceResponse =
  | { ok: true; meters: number }
  | { ok: false; error: string; detail?: string }

export type BidDistanceResult =
  | { ok: true; milesText: string; source: 'routed' | 'estimate'; anchorLabel: string }
  | { ok: false; message: string }

/**
 * Geocode the project address, then routed miles to the office with the
 * straight-line estimate as fallback. Anchor: Settings → Office address,
 * falling back to the Map default view center.
 */
export async function computeBidDistanceToOffice(projectAddress: string): Promise<BidDistanceResult> {
  const address = projectAddress.trim()
  if (address.length < 4) return { ok: false, message: 'Enter the project address first.' }

  const anchor = await resolveOfficeAnchor().catch(() => null)
  if (!anchor) {
    return { ok: false, message: 'No office address set — add one in Settings → Office address.' }
  }

  let geo: GeocodeOneResponse
  try {
    geo = await withSupabaseRetry(
      async () => supabase.functions.invoke<GeocodeOneResponse>('geocode-one', { body: { address } }),
      'geocode-one bid distance'
    )
  } catch {
    return { ok: false, message: 'Could not locate the project address.' }
  }
  if (!geo || typeof geo !== 'object' || !('ok' in geo) || !geo.ok) {
    return { ok: false, message: 'Could not locate the project address.' }
  }
  const dest: LatLng = { lat: geo.lat, lng: geo.lng }
  const origin: LatLng = { lat: anchor.lat, lng: anchor.lng }

  try {
    const routed = await withSupabaseRetry(
      async () =>
        supabase.functions.invoke<DrivingDistanceResponse>('driving-distance', {
          body: { origin, destination: dest },
        }),
      'driving-distance bid'
    )
    if (routed && typeof routed === 'object' && 'ok' in routed && routed.ok && Number.isFinite(routed.meters) && routed.meters >= 0) {
      return { ok: true, milesText: formatMilesForInput(milesFromMeters(routed.meters)), source: 'routed', anchorLabel: anchor.label }
    }
  } catch {
    // fall through to the straight-line estimate
  }

  return {
    ok: true,
    milesText: formatMilesForInput(estimateDrivingMiles(origin, dest)),
    source: 'estimate',
    anchorLabel: anchor.label,
  }
}

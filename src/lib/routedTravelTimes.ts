import { supabase } from './supabase'
import type { LatLng, TravelEstimate } from './jobTravelEstimate'

export type TravelPairRequest = {
  fromJobId: string
  toJobId: string
  from: LatLng
  to: LatLng
}

/** `${fromJobId}|${toJobId}` — the key `buildDayTravelGaps` looks routed estimates up by. */
export function travelPairKey(fromJobId: string, toJobId: string): string {
  return `${fromJobId}|${toJobId}`
}

/**
 * Option B: routed drive times from the travel-time-batch edge function
 * (Google Routes behind a job-pair cache). Best-effort by design — any
 * failure returns an empty map and the caller keeps its straight-line
 * (Option A) estimates for every missing pair.
 */
export async function fetchRoutedTravelTimes(
  pairs: readonly TravelPairRequest[],
): Promise<ReadonlyMap<string, TravelEstimate>> {
  const out = new Map<string, TravelEstimate>()
  if (pairs.length === 0) return out
  try {
    const { data, error } = await supabase.functions.invoke('travel-time-batch', {
      body: { pairs },
    })
    if (error) return out
    const results = (data as { results?: unknown })?.results
    if (!Array.isArray(results)) return out
    for (const r of results as Array<{ fromJobId?: string; toJobId?: string; seconds?: number; meters?: number }>) {
      if (typeof r.fromJobId !== 'string' || typeof r.toJobId !== 'string') continue
      const seconds = Number(r.seconds)
      if (!Number.isFinite(seconds) || seconds <= 0) continue
      out.set(travelPairKey(r.fromJobId, r.toJobId), {
        minutes: Math.ceil(seconds / 60),
        meters: Math.max(0, Math.round(Number(r.meters) || 0)),
        source: 'routed',
      })
    }
    return out
  } catch {
    return out
  }
}

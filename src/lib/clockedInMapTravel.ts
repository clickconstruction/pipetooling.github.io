/**
 * "Travel times" on the clocked-in map (v2.3764): the drive from each stop to
 * the office, on demand. One Routes call per placed stop (people at one job
 * share the stop), through the `driving-distance` edge function that the bid
 * form's Distance to Office already uses — now answering the drive time too.
 * A stop the router cannot answer (no key, Routes API off, a role the
 * function refuses, a network miss) gets the offline estimate from
 * `jobTravelEstimate.ts` (straight line × road winding at 35 mph), marked so
 * an estimate never reads as a routed number. Answers are remembered for the
 * page by address, so reopening the map or pressing the button again costs
 * nothing until a new stop appears. Pure except `fetchRoutedTravel`, which
 * takes its invoker as an argument.
 */
import { estimateTravelBetween, TRAVEL_ROAD_WINDING_FACTOR, type LatLng } from './jobTravelEstimate'
import type { DrivingDistanceResponse } from './bidDistanceToOffice'

const METERS_PER_MILE = 1609.344

export type StopTravel = {
  /** Road meters — routed, or straight line × winding for an estimate. */
  meters: number
  /** Drive seconds; null when the router answered distance only. */
  seconds: number | null
  source: 'routed' | 'estimate'
}

export type TravelInvoke = (body: { origin: LatLng; destination: LatLng }) => Promise<DrivingDistanceResponse | null>

/** Straight line × road winding, minutes at the assumed door-to-door speed. */
export function estimateStopTravel(stop: LatLng, office: LatLng): StopTravel {
  const est = estimateTravelBetween(stop, office)
  return { meters: est.meters * TRAVEL_ROAD_WINDING_FACTOR, seconds: est.minutes * 60, source: 'estimate' }
}

/** `20 mi` / `4.5 mi` / `< 1 mi`. */
export function formatTravelMiles(meters: number): string {
  const mi = meters / METERS_PER_MILE
  if (!Number.isFinite(mi) || mi < 0) return '—'
  if (mi < 0.95) return '< 1 mi'
  if (mi < 10) {
    const r = Math.round(mi * 10) / 10
    return `${Number.isInteger(r) ? r : r.toFixed(1)} mi`
  }
  return `${Math.round(mi)} mi`
}

/** `32 min` / `1 h 12 min` / `2 h`. */
export function formatTravelMinutes(seconds: number): string {
  const min = Math.max(0, Math.round(seconds / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** `20 mi · 32 min to the office`; an estimate reads `≈ 26 mi · ≈ 40 min to the office`. */
export function formatTravelLine(t: StopTravel): string {
  const approx = t.source === 'estimate' ? '≈ ' : ''
  const parts = [`${approx}${formatTravelMiles(t.meters)}`]
  if (t.seconds != null) parts.push(`${approx}${formatTravelMinutes(t.seconds)}`)
  return `${parts.join(' · ')} to the office`
}

/** One memo key per address and office, so a moved office never serves stale answers. */
export function travelMemoKey(addressKey: string, office: LatLng): string {
  return `${addressKey}|${office.lat.toFixed(5)},${office.lng.toFixed(5)}`
}

const memo = new Map<string, StopTravel>()

export function readTravelMemo(key: string): StopTravel | undefined {
  return memo.get(key)
}

export function resetTravelMemoForTests(): void {
  memo.clear()
}

/** Routed miles and minutes through the edge function; null on any refusal so the caller estimates. */
export async function fetchRoutedTravel(origin: LatLng, destination: LatLng, invoke: TravelInvoke): Promise<StopTravel | null> {
  try {
    const r = await invoke({ origin, destination })
    if (r && typeof r === 'object' && 'ok' in r && r.ok && Number.isFinite(r.meters) && r.meters >= 0) {
      const seconds = typeof r.seconds === 'number' && Number.isFinite(r.seconds) && r.seconds >= 0 ? Math.round(r.seconds) : null
      return { meters: r.meters, seconds, source: 'routed' }
    }
  } catch {
    /* the estimate below is the fallback */
  }
  return null
}

export type TravelStopInput = { id: string; addressKey: string; coords: LatLng }

/**
 * Travel for every stop: the memo first, then the router a few at a time,
 * then the estimate for whatever the router did not answer. Routed answers
 * are memoized; estimates are not, so the next press asks again.
 */
export async function computeTravelForStops(
  stops: readonly TravelStopInput[],
  office: LatLng,
  invoke: TravelInvoke,
  concurrency = 4,
): Promise<Map<string, StopTravel>> {
  const out = new Map<string, StopTravel>()
  const pending: TravelStopInput[] = []
  for (const s of stops) {
    const hit = memo.get(travelMemoKey(s.addressKey, office))
    if (hit) out.set(s.id, hit)
    else pending.push(s)
  }
  let cursor = 0
  const worker = async () => {
    while (cursor < pending.length) {
      const s = pending[cursor++]
      if (!s) break
      const routed = await fetchRoutedTravel(s.coords, office, invoke)
      if (routed) {
        memo.set(travelMemoKey(s.addressKey, office), routed)
        out.set(s.id, routed)
      } else out.set(s.id, estimateStopTravel(s.coords, office))
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, pending.length)) }, worker))
  return out
}

/** `Routed 3 · estimated 1` for the footer; null when nothing was computed. */
export function travelSummaryLine(travel: ReadonlyMap<string, StopTravel>): string | null {
  if (travel.size === 0) return null
  let routed = 0
  let estimated = 0
  for (const t of travel.values()) if (t.source === 'routed') routed += 1; else estimated += 1
  const parts: string[] = []
  if (routed > 0) parts.push(`${routed} routed`)
  if (estimated > 0) parts.push(`${estimated} estimated`)
  return `Drive times: ${parts.join(' · ')}${estimated > 0 ? ' (≈ straight line × 1.3 at 35 mph)' : ''}`
}

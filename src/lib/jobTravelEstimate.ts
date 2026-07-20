/**
 * Travel-time estimates between a person's consecutive scheduled jobs (Day view).
 *
 * Option A (this file): straight-line haversine distance × a road-winding
 * factor ÷ an assumed average speed — a true MINIMUM drive estimate, free and
 * offline. Option B (planned): real routed times from a routing API; it will
 * produce `TravelEstimate` values with `source: 'routed'` and FALL BACK to
 * these straight-line numbers whenever routing is unavailable — keep every
 * consumer reading `TravelEstimate`, never assuming the source.
 */

export type LatLng = { lat: number; lng: number }

export type TravelEstimate = {
  /** Estimated drive, minutes (rounded up). */
  minutes: number
  /** Point-to-point distance used, meters (straight-line for 'straightline'). */
  meters: number
  source: 'straightline' | 'routed'
}

/** Straight-line → road distance fudge (surface streets wander). */
export const TRAVEL_ROAD_WINDING_FACTOR = 1.3
/** Assumed average door-to-door speed, mph. */
export const TRAVEL_ASSUMED_MPH = 35
/** Same-site tolerance: closer than this is "no travel" (parking lot noise). */
export const TRAVEL_SAME_SITE_METERS = 150
/** Touching back-to-back jobs only warn when the drive is at least this long. */
export const TRAVEL_TOUCHING_WARN_MINUTES = 5

const METERS_PER_MILE = 1609.344

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Minimum drive minutes for a straight-line distance; 0 when effectively the same site. */
export function straightLineDriveMinutes(meters: number, mph: number = TRAVEL_ASSUMED_MPH): number {
  if (!Number.isFinite(meters) || meters <= TRAVEL_SAME_SITE_METERS) return 0
  const speed = Number.isFinite(mph) && mph > 0 ? mph : TRAVEL_ASSUMED_MPH
  const roadMeters = meters * TRAVEL_ROAD_WINDING_FACTOR
  const metersPerMinute = (speed * METERS_PER_MILE) / 60
  return Math.ceil(roadMeters / metersPerMinute)
}

export function estimateTravelBetween(a: LatLng, b: LatLng, mph?: number): TravelEstimate {
  const meters = haversineMeters(a, b)
  return { minutes: straightLineDriveMinutes(meters, mph), meters, source: 'straightline' }
}

export type TravelGapBlock = {
  blockId: string
  jobId: string
  startMin: number
  endMin: number
}

export type DayTravelGap = {
  fromBlockId: string
  toBlockId: string
  fromJobId: string
  toJobId: string
  /** 'gap' = open time between the blocks; 'touching' = back-to-back (gap <= 0). */
  boundaryKind: 'gap' | 'touching'
  /** Schedule slack, minutes (next.start - prev.end); 0 for touching. */
  gapMinutes: number
  estimate: TravelEstimate
  /** gapMinutes >= estimate.minutes (touching pairs with a real drive are never feasible). */
  feasible: boolean
  /** Gap span (minutes from midnight) for positioning a chip; equal when touching. */
  gapStartMin: number
  gapEndMin: number
}

export type BuildDayTravelGapsOptions = {
  /** Assumed average speed for the straight-line fallback (org setting). */
  mph?: number
  /**
   * Option B routed estimates keyed `${fromJobId}|${toJobId}`; when a pair is
   * present it wins over the straight-line estimate (falls back otherwise).
   */
  routedByPairKey?: ReadonlyMap<string, TravelEstimate>
}

/**
 * Consecutive-pair travel gaps for one person's day. Pairs are skipped when:
 * same job (no travel), either job has no coordinates, or the drive rounds
 * to 0 minutes (same site). Blocks are sorted by start.
 */
export function buildDayTravelGaps(
  blocks: readonly TravelGapBlock[],
  coordsByJobId: ReadonlyMap<string, LatLng>,
  options?: BuildDayTravelGapsOptions,
): DayTravelGap[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const out: DayTravelGap[] = []
  for (let i = 0; i + 1 < sorted.length; i++) {
    const from = sorted[i]
    const to = sorted[i + 1]
    if (!from || !to) continue
    if (from.jobId === to.jobId) continue
    const a = coordsByJobId.get(from.jobId)
    const b = coordsByJobId.get(to.jobId)
    if (!a || !b) continue
    const routed = options?.routedByPairKey?.get(`${from.jobId}|${to.jobId}`)
    const estimate =
      routed && routed.minutes > 0 ? routed : estimateTravelBetween(a, b, options?.mph)
    if (estimate.minutes <= 0) continue
    const gapMinutes = Math.max(0, to.startMin - from.endMin)
    const touching = to.startMin <= from.endMin
    out.push({
      fromBlockId: from.blockId,
      toBlockId: to.blockId,
      fromJobId: from.jobId,
      toJobId: to.jobId,
      boundaryKind: touching ? 'touching' : 'gap',
      gapMinutes: touching ? 0 : gapMinutes,
      estimate,
      feasible: !touching && gapMinutes >= estimate.minutes,
      gapStartMin: touching ? from.endMin : from.endMin,
      gapEndMin: touching ? from.endMin : to.startMin,
    })
  }
  return out
}

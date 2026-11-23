import { describe, expect, it } from 'vitest'
import { SAMPLE_PAINTED_WAY } from './paintedWaySample'

/**
 * The ground the sample was checked on, 2026-11-22: scrub beside a gravel road inside Glen Elder
 * Wildlife Area in Kansas. Its whole footprint is inside the area's mapped boundary, 250 m from the
 * nearest edge, and Google's road map and photograph both draw it dry, with no building near.
 * A sample moved out of this box is on ground nobody has looked at: look first, then move the box.
 */
const CHECKED_GROUND = { south: 39.482, north: 39.4834, west: -98.3635, east: -98.3606 }
/** Where the sample sat before v2.8311: the water of Waconda Lake. */
const THE_LAKE = { lat: 39.5, lng: -98.35 }

const everyPoint = (): Array<{ lat: number; lng: number }> => [
  ...SAMPLE_PAINTED_WAY.lines.flatMap((line) => line.points.map(([lat, lng]) => ({ lat, lng }))),
  ...SAMPLE_PAINTED_WAY.places.map((place) => ({ lat: place.lat, lng: place.lng })),
]

describe('the sample painted map', () => {
  it('has every corner and every place on the ground that was checked', () => {
    const points = everyPoint()
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) {
      expect(point.lat).toBeGreaterThanOrEqual(CHECKED_GROUND.south)
      expect(point.lat).toBeLessThanOrEqual(CHECKED_GROUND.north)
      expect(point.lng).toBeGreaterThanOrEqual(CHECKED_GROUND.west)
      expect(point.lng).toBeLessThanOrEqual(CHECKED_GROUND.east)
    }
  })

  it('is more than a kilometre from the lake it used to sit in', () => {
    for (const point of everyPoint()) {
      const northM = (point.lat - THE_LAKE.lat) * 111_195
      const eastM = (point.lng - THE_LAKE.lng) * 111_195 * Math.cos((THE_LAKE.lat * Math.PI) / 180)
      expect(Math.hypot(northM, eastM)).toBeGreaterThan(1000)
    }
  })

  it('still starts each line where the last one ended, at the truck gate', () => {
    const [walked, drawn] = SAMPLE_PAINTED_WAY.lines
    expect(walked!.points[walked!.points.length - 1]).toEqual(drawn!.points[0])
    const gate = SAMPLE_PAINTED_WAY.places.find((place) => place.kind === 'gate')!
    const start = walked!.points[0]!
    expect(Math.abs(gate.lat - start[0]) * 111_195).toBeLessThan(15)
  })
})

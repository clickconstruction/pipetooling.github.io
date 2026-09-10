import { describe, expect, it } from 'vitest'
import { clusterBounds, clusterLabel, clusterPins, clusterRadiusPx, projectToWorldPx } from './clusterPins'

const AUSTIN = { lat: 30.2672, lng: -97.7431 }
function pin(id: string, dLat: number, dLng: number, color = '#eab308', ringColor: string | null = null) {
  return { id, lat: AUSTIN.lat + dLat, lng: AUSTIN.lng + dLng, color, ringColor }
}

describe('projectToWorldPx', () => {
  it('maps the world to a 256·2^z square, equator and prime meridian at the center', () => {
    const z = 3
    const p = projectToWorldPx(0, 0, z)
    expect(p.x).toBeCloseTo(1024)
    expect(p.y).toBeCloseTo(1024)
    expect(projectToWorldPx(0, -180, 0).x).toBeCloseTo(0)
    expect(projectToWorldPx(0, 180, 0).x).toBeCloseTo(256)
    // north is up (smaller y)
    expect(projectToWorldPx(45, 0, 0).y).toBeLessThan(128)
  })
})

describe('clusterPins', () => {
  it('merges pins sharing a grid cell at a coarse zoom and leaves them apart when zoomed in', () => {
    const pins = [pin('a', 0, 0), pin('b', 0.01, 0.01), pin('c', 0.02, -0.01), pin('far', 1.5, 1.5)]
    const coarse = clusterPins(pins, 8)
    expect(coarse.map((i) => i.kind)).toEqual(['cluster', 'pin'])
    const c = coarse[0]
    if (c?.kind !== 'cluster') throw new Error()
    expect(c.cluster.count).toBe(3)
    expect(c.cluster.members.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(c.cluster.lat).toBeCloseTo(AUSTIN.lat + 0.01, 5)
    const fine = clusterPins(pins, 16)
    expect(fine.every((i) => i.kind === 'pin')).toBe(true)
  })

  it('a cluster wears the majority color and the most urgent ring by the caller’s order', () => {
    const red = '#dc2626'
    const amber = '#d97706'
    const pins = [pin('a', 0, 0, '#16a34a'), pin('b', 0.001, 0, '#eab308', amber), pin('c', 0.002, 0, '#eab308', red), pin('d', 0.003, 0, '#6b7280')]
    const [item] = clusterPins(pins, 6, { ringPriority: [red, amber] })
    if (item?.kind !== 'cluster') throw new Error()
    expect(item.cluster.color).toBe('#eab308')
    expect(item.cluster.ringColor).toBe(red)
    // without a priority the first ring seen is kept; with no rings, null
    const [noPriority] = clusterPins(pins, 6)
    expect(noPriority?.kind === 'cluster' ? noPriority.cluster.ringColor : 'wrong').toBe(amber)
    const [calm] = clusterPins([pin('a', 0, 0), pin('b', 0.001, 0)], 6)
    expect(calm?.kind === 'cluster' ? calm.cluster.ringColor : 'wrong').toBeNull()
  })

  it('keeps first-seen order for cells and gives each cluster a stable id from its members', () => {
    const pins = [pin('x', 2, 2), pin('a', 0, 0), pin('b', 0.001, 0)]
    const items = clusterPins(pins, 6)
    expect(items[0]?.kind).toBe('pin')
    const second = items[1]
    if (second?.kind !== 'cluster') throw new Error()
    expect(second.cluster.id).toMatch(/^cluster:.*:a,b$/)
  })

  it('bounds, radius and label helpers', () => {
    const [item] = clusterPins([pin('a', 0, 0), pin('b', 0.01, -0.02)], 6)
    if (item?.kind !== 'cluster') throw new Error()
    expect(clusterBounds(item.cluster)).toEqual({ south: AUSTIN.lat, north: AUSTIN.lat + 0.01, west: AUSTIN.lng - 0.02, east: AUSTIN.lng })
    expect(clusterRadiusPx(2)).toBe(14)
    expect(clusterRadiusPx(8)).toBe(18)
    expect(clusterRadiusPx(500)).toBe(22)
    expect(clusterLabel(12)).toBe('12')
    expect(clusterLabel(150)).toBe('99+')
  })
})

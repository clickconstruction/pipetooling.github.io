import { describe, expect, it } from 'vitest'
import { clusterRadiusPx, type ClusteredItem } from './clusterPins'
import { mapPulseTarget } from './pulseTarget'

type P = { id: string; lat: number; lng: number; color: string }

const pins: P[] = [
  { id: 'a', lat: 29.6, lng: -97.8, color: '#eab308' },
  { id: 'b', lat: 29.7, lng: -98.1, color: '#6b7280' },
  { id: 'c', lat: 29.71, lng: -98.11, color: '#16a34a' },
]

describe('mapPulseTarget', () => {
  it('returns null with no id or an id that is not on the map', () => {
    expect(mapPulseTarget(pins, null, null)).toBeNull()
    expect(mapPulseTarget(pins, null, undefined)).toBeNull()
    expect(mapPulseTarget(pins, null, 'zzz')).toBeNull()
  })

  it('finds a single pin when the canvas is not clustering: pin position, pin color, halo just outside an 8px pin', () => {
    expect(mapPulseTarget(pins, null, 'a')).toEqual({ lat: 29.6, lng: -97.8, color: '#eab308', radiusPx: 14, markId: 'a' })
  })

  it('finds a singleton among clustered items', () => {
    const items: ClusteredItem<P>[] = [
      { kind: 'pin', pin: pins[0]! },
      { kind: 'cluster', cluster: { id: 'cl1', lat: 29.705, lng: -98.105, count: 2, color: '#6b7280', ringColor: null, members: [pins[1]!, pins[2]!] } },
    ]
    expect(mapPulseTarget(pins, items, 'a')?.markId).toBe('a')
  })

  it('pulses the cluster disc when the pin is folded into one, sized to the disc', () => {
    const items: ClusteredItem<P>[] = [
      { kind: 'pin', pin: pins[0]! },
      { kind: 'cluster', cluster: { id: 'cl1', lat: 29.705, lng: -98.105, count: 2, color: '#6b7280', ringColor: null, members: [pins[1]!, pins[2]!] } },
    ]
    const t = mapPulseTarget(pins, items, 'c')
    expect(t).toEqual({ lat: 29.705, lng: -98.105, color: '#6b7280', radiusPx: clusterRadiusPx(2) + 6, markId: 'cl1' })
  })

  it('a pin hidden from the clustered items (filtered out) has no target even if it is in the full pin list', () => {
    const items: ClusteredItem<P>[] = [{ kind: 'pin', pin: pins[0]! }]
    expect(mapPulseTarget(pins, items, 'b')).toBeNull()
  })
})

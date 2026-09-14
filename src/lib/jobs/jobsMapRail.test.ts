import { describe, expect, it } from 'vitest'
import type { JobsMapPin } from './jobsMap'
import { DEFAULT_DISTANCE_BUCKETS, bucketAskLine, jobsMapAskLabel, jobsMapPinMiles, jobsMapPinsInBuckets, jobsMapRail } from './jobsMapRail'

const OFFICE = { lat: 29.65, lng: -97.81 }

function pin(over: Partial<JobsMapPin> & { id: string }): JobsMapPin {
  return {
    label: `J${over.id} · Test`,
    numberLabel: `J${over.id}`,
    jobName: 'Test',
    payerName: null,
    address: '1 Main',
    addressKey: '1 main',
    section: 'working',
    inCollections: false,
    pctComplete: null,
    owedDollars: 0,
    billedAgeDays: null,
    lat: OFFICE.lat,
    lng: OFFICE.lng,
    row: {} as JobsMapPin['row'],
    ...over,
  }
}

/** ~1 degree of latitude ≈ 69 miles. */
const north = (miles: number) => ({ lat: OFFICE.lat + miles / 69, lng: OFFICE.lng })

describe('miles and buckets', () => {
  it('straight-line miles from the office, nothing without an anchor', () => {
    expect(jobsMapPinMiles(pin({ id: '1' }), null)).toBeNull()
    expect(Math.round(jobsMapPinMiles(pin({ id: '1', ...north(30) }), OFFICE)!)).toBe(30)
  })

  it('bucket switches hide pins; a pin with no miles is never hidden', () => {
    const pins = [pin({ id: 'near', ...north(10) }), pin({ id: 'mid', ...north(40) }), pin({ id: 'far', ...north(90) })]
    expect(jobsMapPinsInBuckets(pins, OFFICE, { ...DEFAULT_DISTANCE_BUCKETS, mid: false }).map((p) => p.id)).toEqual(['near', 'far'])
    expect(jobsMapPinsInBuckets(pins, null, { near: false, mid: false, far: false }).map((p) => p.id)).toEqual(['near', 'mid', 'far'])
  })
})

describe('the ask label', () => {
  it('reads the age and the tone: collections red, 30+ days amber, else plain; ready to bill has no age', () => {
    expect(jobsMapAskLabel({ section: 'billed', inCollections: true, billedAgeDays: 46 })).toEqual({ text: 'Billed 46 d', tone: 'collections' })
    expect(jobsMapAskLabel({ section: 'billed', inCollections: false, billedAgeDays: 30 })).toEqual({ text: 'Billed 30 d', tone: 'late' })
    expect(jobsMapAskLabel({ section: 'billed', inCollections: false, billedAgeDays: 22 })).toEqual({ text: 'Billed 22 d', tone: 'billed' })
    expect(jobsMapAskLabel({ section: 'billed', inCollections: false, billedAgeDays: null })).toEqual({ text: 'Billed', tone: 'billed' })
    expect(jobsMapAskLabel({ section: 'readyToBill', inCollections: false, billedAgeDays: null })).toEqual({ text: 'Ready to bill', tone: 'ready' })
  })
})

describe('jobsMapRail', () => {
  const pins = [
    pin({ id: 'w', section: 'working', ...north(5) }),
    pin({ id: 'b46', section: 'billed', inCollections: true, billedAgeDays: 46, owedDollars: 18400, ...north(8) }),
    pin({ id: 'b22', section: 'billed', billedAgeDays: 22, owedDollars: 4000, ...north(2) }),
    pin({ id: 'b30', section: 'billed', billedAgeDays: 30, owedDollars: 9000, ...north(40) }),
    pin({ id: 'r1', section: 'readyToBill', owedDollars: 2500, ...north(11) }),
    pin({ id: 'r2', section: 'readyToBill', owedDollars: 1200, ...north(33) }),
    pin({ id: 'p', section: 'paid', ...north(70) }),
  ]

  it('buckets count pins, sum dollars to collect and count the jobs to ask', () => {
    const rail = jobsMapRail(pins, OFFICE)
    expect(rail.buckets.map((b) => [b.key, b.count, b.toCollectDollars, b.toAsk])).toEqual([
      ['near', 4, 24900, 3],
      ['mid', 2, 10200, 2],
      ['far', 1, 0, 0],
    ])
    expect(rail.buckets[0]!.toCollectLabel).toBe('$24.9k')
    expect(bucketAskLine(rail.buckets[0]!)).toBe('3 to ask')
    expect(bucketAskLine(rail.buckets[2]!)).toBeNull()
    expect(rail.pinnedCount).toBe(7)
    expect(rail.toCollectDollars).toBe(35100)
    expect(rail.toCollectLabel).toBe('$35.1k')
  })

  it('the ask list is longest waiting first, then nearest; ready-to-bill rows (no age) come last by distance; capped with a remainder', () => {
    const rail = jobsMapRail(pins, OFFICE, { askRows: 4 })
    expect(rail.ask.map((r) => r.pin.id)).toEqual(['b46', 'b30', 'b22', 'r1'])
    expect(rail.askMore).toBe(1)
    expect(rail.ask[0]).toMatchObject({ label: 'Billed 46 d', tone: 'collections', milesLabel: '8 mi' })
    expect(rail.ask[3]).toMatchObject({ label: 'Ready to bill', tone: 'ready', milesLabel: '11 mi' })
  })

  it('with no anchor every pin still counts on the list, with no miles', () => {
    const rail = jobsMapRail(pins, null)
    expect(rail.buckets.map((b) => b.count)).toEqual([0, 0, 0])
    expect(rail.ask[0]!.milesLabel).toBe('— mi')
    expect(rail.toCollectDollars).toBe(35100)
  })
})

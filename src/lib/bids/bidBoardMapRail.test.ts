import { describe, expect, it } from 'vitest'
import type { BidBoardMapPin } from './bidBoardMap'
import { bidBoardMapRail, bucketDueLine, distanceBucketFor, formatMoneyCompact, pinMilesFromOffice, pinsInBuckets } from './bidBoardMapRail'

const OFFICE = { lat: 29.65, lng: -97.81 }

function pin(over: Partial<BidBoardMapPin> & { id: string; value?: number | null }): BidBoardMapPin {
  const { value, ...rest } = over
  return {
    label: `b${over.id} · Test`,
    numberLabel: `b${over.id}`,
    projectName: 'Test',
    gcName: null,
    address: '1 Main',
    addressKey: '1 main',
    section: 'pending',
    dueTone: null,
    dueLabel: null,
    estimatorName: null,
    distanceMiles: null,
    valueLabel: null,
    lat: OFFICE.lat,
    lng: OFFICE.lng,
    row: { bid_value: value ?? null } as unknown as BidBoardMapPin['row'],
    ...rest,
  }
}

describe('miles and buckets', () => {
  it('prefers the bid’s recorded distance, else the straight line from the office, else nothing', () => {
    expect(pinMilesFromOffice(pin({ id: '1', distanceMiles: 41.4 }), OFFICE)).toBe(41.4)
    const straight = pinMilesFromOffice(pin({ id: '2', lat: OFFICE.lat + 0.5, lng: OFFICE.lng }), OFFICE)
    expect(straight).toBeGreaterThan(30)
    expect(straight).toBeLessThan(40)
    expect(pinMilesFromOffice(pin({ id: '3' }), null)).toBeNull()
  })

  it('buckets at 25 and 50 miles inclusive', () => {
    expect(distanceBucketFor(0)).toBe('near')
    expect(distanceBucketFor(25)).toBe('near')
    expect(distanceBucketFor(25.1)).toBe('mid')
    expect(distanceBucketFor(50)).toBe('mid')
    expect(distanceBucketFor(88)).toBe('far')
    expect(distanceBucketFor(null)).toBeNull()
  })

  it('a bucket switch filters pins; a pin with no miles is never filtered out', () => {
    const pins = [pin({ id: 'a', distanceMiles: 10 }), pin({ id: 'b', distanceMiles: 40 }), pin({ id: 'c', distanceMiles: 90 }), pin({ id: 'd' })]
    expect(pinsInBuckets(pins, null, { near: true, mid: false, far: false }).map((p) => p.id)).toEqual(['a', 'd'])
    expect(pinsInBuckets(pins, null, { near: false, mid: true, far: true }).map((p) => p.id)).toEqual(['b', 'c', 'd'])
  })
})

describe('bidBoardMapRail', () => {
  it('counts, sums and flags due-soon per bucket, and totals the pinned value', () => {
    const rail = bidBoardMapRail(
      [
        pin({ id: 'a', distanceMiles: 10, value: 5_000_000, section: 'unsent', dueTone: 'soon', dueLabel: 'Fri 9/18 (-9)' }),
        pin({ id: 'b', distanceMiles: 20, value: 4_100_000 }),
        pin({ id: 'c', distanceMiles: 40, value: 820_000, section: 'unsent', dueLabel: 'No due date (+5)' }),
        pin({ id: 'd', distanceMiles: 90, value: null, section: 'unsent', dueTone: 'overdue', dueLabel: 'Thu 9/10 (-1)' }),
      ],
      OFFICE,
    )
    expect(rail.buckets.map((b) => [b.key, b.count, b.valueLabel, b.dueSoon])).toEqual([
      ['near', 2, '$9.1M', 1],
      ['mid', 1, '$820k', 0],
      ['far', 1, '$0', 1],
    ])
    expect(rail.pinnedCount).toBe(4)
    expect(rail.pinnedValueLabel).toBe('$9.9M')
  })

  it('lists unsent pins with a due date: overdue first, then due soon, then nearest first; capped with a remainder', () => {
    const rail = bidBoardMapRail(
      [
        pin({ id: 'far-soon', distanceMiles: 88, section: 'unsent', dueTone: 'soon', dueLabel: 'x' }),
        pin({ id: 'near-none', distanceMiles: 5, section: 'unsent', dueLabel: 'No due date (+3)' }),
        pin({ id: 'over', distanceMiles: 62, section: 'unsent', dueTone: 'overdue', dueLabel: 'y' }),
        pin({ id: 'near-soon', distanceMiles: 41, section: 'unsent', dueTone: 'soon', dueLabel: 'z' }),
        pin({ id: 'pending', distanceMiles: 1, section: 'pending', dueTone: 'soon', dueLabel: 'never listed' }),
        pin({ id: 'nodue', distanceMiles: 2, section: 'unsent' }),
      ],
      OFFICE,
      { dueRows: 3 },
    )
    expect(rail.due.map((d) => d.pin.id)).toEqual(['over', 'near-soon', 'far-soon'])
    expect(rail.dueMore).toBe(1)
    expect(rail.due[0]?.milesLabel).toBe('62 mi')
  })

  it('formats money compactly', () => {
    expect(formatMoneyCompact(34_800_000)).toBe('$34.8M')
    expect(formatMoneyCompact(12_000_000)).toBe('$12M')
    expect(formatMoneyCompact(820_000)).toBe('$820k')
    expect(formatMoneyCompact(4_500)).toBe('$4.5k')
    expect(formatMoneyCompact(0)).toBe('$0')
  })

  it('names the due line only when there is something due', () => {
    expect(bucketDueLine({ dueSoon: 0 })).toBeNull()
    expect(bucketDueLine({ dueSoon: 3 })).toBe('3 due soon')
  })
})

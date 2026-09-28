import { describe, expect, it } from 'vitest'
import { revenueDollarsFromFixtures } from './revenueFromJobFixtures'

const line = (name: string, count: number, line_unit_price: number | null) => ({ name, count, line_unit_price })

describe('revenueDollarsFromFixtures (the Job Total)', () => {
  it('sums count × unit price over the named rows', () => {
    expect(revenueDollarsFromFixtures([line('Water heater', 1, 1_200), line('Hose bibb', 3, 150)])).toBe(1_650)
    expect(revenueDollarsFromFixtures([])).toBe(0)
  })

  it('skips a row with no name, however it is priced', () => {
    expect(revenueDollarsFromFixtures([line('', 2, 500), line('   ', 1, 900), line('Tub', 1, 300)])).toBe(300)
  })

  it('a named row with no price adds nothing', () => {
    expect(revenueDollarsFromFixtures([line('Walk-through', 1, null), line('Tub', 1, 300)])).toBe(300)
  })

  it('a count that is zero, negative or unreadable counts as one', () => {
    expect(revenueDollarsFromFixtures([line('Tub', 0, 300)])).toBe(300)
    expect(revenueDollarsFromFixtures([line('Tub', -2, 300)])).toBe(300)
    expect(revenueDollarsFromFixtures([line('Tub', Number.NaN, 300)])).toBe(300)
  })

  it('a fractional count multiplies through', () => {
    expect(revenueDollarsFromFixtures([line('Pipe, per foot', 2.5, 10)])).toBe(25)
  })

  it('an unreadable price counts as zero; a negative one (a discount row) subtracts', () => {
    expect(revenueDollarsFromFixtures([line('Tub', 1, Number.NaN), line('Sink', 1, 200)])).toBe(200)
    expect(revenueDollarsFromFixtures([line('Rough-in', 1, 1_000), line('Discount', 1, -125.5)])).toBe(874.5)
  })

  it('rounds the total to cents', () => {
    expect(revenueDollarsFromFixtures([line('A', 3, 0.1)])).toBe(0.3)
    expect(revenueDollarsFromFixtures([line('A', 1, 10.005), line('B', 1, 0.001)])).toBe(10.01)
  })
})

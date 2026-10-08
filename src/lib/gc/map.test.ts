/**
 * The tests of `gcMap.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-ii). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { TOWNS, driveMiles, milesBetween, townFromAddress, travelFor } from './map'
import { initialGcState } from './schedule/testState'

describe('townFromAddress (the drive read from the address)', () => {
  it('finds the town in the address, the one written last winning', () => {
    expect(townFromAddress('24165 IH-10 W, San Antonio')).toBe('San Antonio')
    expect(townFromAddress('4410 Boerne Stage Rd, San Antonio, TX 78256')).toBe('San Antonio')
    expect(townFromAddress('1436 River Rd, Boerne')).toBe('Boerne')
    expect(townFromAddress('9811 bandera rd, suite 140, helotes')).toBe('Helotes')
  })

  it('is null when no town we know is in it', () => {
    expect(townFromAddress('100 Main St, Comfort')).toBeNull()
    expect(townFromAddress('')).toBeNull()
  })
})

describe('the drive, from towns or from points (the Board\'s B2)', () => {
  it('reads the same miles from two towns or from their points', () => {
    const boerne = TOWNS.find((t) => t.name === 'Boerne')!
    const helotes = TOWNS.find((t) => t.name === 'Helotes')!
    expect(milesBetween(boerne, helotes)).toBe(driveMiles('Boerne', 'Helotes'))
    expect(driveMiles('Boerne', 'Comfort')).toBeNull()
  })

  it('a company\'s and a job\'s own points win over their towns; a town stands in without them', () => {
    const s = initialGcState()
    const project = s.projects.find((p) => p.id === 'boerne')!
    const partner = s.partners.find((p) => p.base === 'San Antonio')!
    const byTown = travelFor(s, partner, project)
    const kerrville = TOWNS.find((t) => t.name === 'Kerrville')!
    const fromPoint = travelFor(s, { ...partner, basePoint: kerrville }, { ...project, point: TOWNS.find((t) => t.name === 'Boerne')! })
    expect(byTown.miles).toBe(driveMiles('San Antonio', 'Boerne'))
    expect(fromPoint.miles).toBe(driveMiles('Kerrville', 'Boerne'))
    expect(travelFor(s, { ...partner, basePoint: kerrville }, project).miles).toBe(byTown.miles)
  })
})

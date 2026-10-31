import { describe, expect, it } from 'vitest'
import { bridgeEndsWords, coverageCasesChip, coverageCountyChip, coverageNudgeButton, coverageNudgeWords, coverageState, coverageSumWords, firmWindowCoverage } from './firmWindowCoverage'
import { coverageFromCountiesByFirm } from './firmCounties'

const byFirm = coverageFromCountiesByFirm(new Map<string, string[]>([
  ['snell', ['Williamson', 'Travis', 'Bell', 'Hays']],
  ['alamo', ['Bexar', 'Comal']],
]))

const cases = [
  { county: 'Travis', firmId: 'snell', balance: 15781.82 },
  { county: 'Travis', firmId: null, balance: 1238.65 },
  { county: 'Williamson', firmId: null, balance: 2976.34 },
  { county: 'Williamson', firmId: null, balance: 1712.5 },
  { county: 'Bell', firmId: null, balance: 4050 },
  // Released to Alamo, sitting in Williamson: Alamo's, not a row of Snell's.
  { county: 'Williamson', firmId: 'alamo', balance: 900 },
  // With Snell, in a county it no longer covers: counted for Snell, not a row.
  { county: 'Bastrop', firmId: 'snell', balance: 500 },
  // No firm, in a county nobody covers: nobody's.
  { county: 'Gonzales', firmId: null, balance: 3310 },
]

describe('firmWindowCoverage', () => {
  it('one row per county the firm covers, largest open balance first, with the cases that count for the firm', () => {
    const c = firmWindowCoverage('snell', byFirm, cases)
    expect(c.rows).toEqual([
      { county: 'Travis', cases: 2, balance: 17020.47, role: 'first', firstCall: 'snell' },
      { county: 'Williamson', cases: 2, balance: 4688.84, role: 'first', firstCall: 'snell' },
      { county: 'Bell', cases: 1, balance: 4050, role: 'first', firstCall: 'snell' },
      { county: 'Hays', cases: 0, balance: 0, role: 'first', firstCall: 'snell' },
    ])
    expect(c.counties).toBe(4)
    expect(c.also).toBe(0)
    expect(c.elsewhere).toEqual({ cases: 1, balance: 500 })
    expect(c.cases).toBe(6)
    expect(c.balance).toBe(26259.31)
  })

  it('a firm with no counties has no rows, and its released cases still count for it', () => {
    const c = firmWindowCoverage('alamo', coverageFromCountiesByFirm(new Map([['snell', ['Travis']]])), cases)
    expect(c.rows).toEqual([])
    expect(c.elsewhere).toEqual({ cases: 1, balance: 900 })
    expect(c.cases).toBe(1)
  })

  it('the chips and the sum row say the counts in words', () => {
    expect(coverageCountyChip(0)).toBe('no counties colored')
    expect(coverageCountyChip(1)).toBe('1 county')
    expect(coverageCountyChip(5)).toBe('5 counties')
    expect(coverageCasesChip(0, 0)).toBe('no cases')
    expect(coverageCasesChip(1, 2976.34)).toBe('1 case · $2,976.34')
    expect(coverageSumWords({ counties: 4, elsewhere: { cases: 0, balance: 0 } })).toBe('4 counties')
    expect(coverageSumWords({ counties: 4, elsewhere: { cases: 1, balance: 500 } })).toBe('4 counties · 1 case with the firm elsewhere')
    expect(coverageSumWords({ counties: 5, also: 1, elsewhere: { cases: 0, balance: 0 } })).toBe('5 counties · 1 shared')
  })

  it('a county the firm shares: the row reads also, names the first call, and counts only the cases already with the firm (v2.6227)', () => {
    // Comal: Alamo first call, Snell also. One case under review there (Alamo's), one released to Snell there.
    const shared = new Map([['Comal', { first: 'alamo', also: ['snell'] }], ['Travis', { first: 'snell', also: [] }]])
    const here = [
      { county: 'Comal', firmId: null, balance: 2140 },
      { county: 'Comal', firmId: 'snell', balance: 309.16 },
      { county: 'Travis', firmId: null, balance: 1000 },
    ]
    const snell = firmWindowCoverage('snell', shared, here)
    expect(snell.rows).toEqual([
      { county: 'Travis', cases: 1, balance: 1000, role: 'first', firstCall: 'snell' },
      { county: 'Comal', cases: 1, balance: 309.16, role: 'also', firstCall: 'alamo' },
    ])
    expect(snell.also).toBe(1)
    const alamo = firmWindowCoverage('alamo', shared, here)
    expect(alamo.rows).toEqual([{ county: 'Comal', cases: 1, balance: 2140, role: 'first', firstCall: 'alamo' }])
    expect(coverageState('snell', shared, 2)).toEqual({ kind: 'covers' })
  })

  it('the state: covers, nothing colored anywhere, or none here while others cover', () => {
    expect(coverageState('snell', byFirm, 2)).toEqual({ kind: 'covers' })
    expect(coverageState('snell', new Map(), 1)).toEqual({ kind: 'nothing_colored', firms: 1 })
    expect(coverageState('new', byFirm, 3)).toEqual({ kind: 'none_here' })
  })

  it('the nudge names the bridge for one firm, the standstill for several, and the empty firm beside covering ones', () => {
    expect(coverageNudgeWords('Snell', { kind: 'covers' })).toBeNull()
    expect(coverageNudgeWords('Snell', { kind: 'nothing_colored', firms: 1 })).toBe(
      'Snell takes every account today, by default. No county is colored for any firm, so the desk sends everything to the one firm. The first county colored for any firm ends that: an account outside a colored county has no firm. Color Snell’s counties now, before a second firm is added.',
    )
    expect(coverageNudgeWords('Snell', { kind: 'nothing_colored', firms: 2 })).toBe('No county is colored for any firm. With 2 firms and no counties, the desk cannot pick a firm for any account. Color each firm’s counties under Firms….')
    expect(coverageNudgeWords('Alamo', { kind: 'none_here' })).toBe('Alamo covers no county. The desk never picks it for a release until a county is colored for it.')
    expect(coverageNudgeButton('Snell')).toBe('Color Snell’s counties…')
  })

  it('over the first save, the words say the default ends and name the cases left with no firm (v2.6221)', () => {
    expect(bridgeEndsWords('Snell', [])).toBe('Saving ends the default. Every case sits in a county Snell covers.')
    expect(bridgeEndsWords('Snell', [{ name: 'Kettle Creek Farms', county: 'Gonzales' }])).toBe(
      'Saving ends the default. 1 case sits where no firm covers: Kettle Creek Farms in Gonzales County. Add its county too, or the desk cannot release it.',
    )
    expect(bridgeEndsWords('Snell', [
      { name: 'A', county: 'Bexar' },
      { name: 'B', county: null },
      { name: 'C', county: 'Comal' },
      { name: 'D', county: 'Hays' },
      { name: 'E', county: 'Hays' },
    ])).toBe('Saving ends the default. 5 cases sit where no firm covers: A in Bexar County, B, whose county is unknown, C in Comal County and 2 more. Add their counties too, or the desk cannot release them.')
  })
})

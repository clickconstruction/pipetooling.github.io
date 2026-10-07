/**
 * Main's own tests for Building's kinds on the Board's promise record (the Building lane's U2), run on
 * the test data. On Fair Oaks D, today Fri Oct 2, every hired trade but Sitework and Concrete is on
 * the daily log from Sep 21. Sitework may ask for its retainage, and Pecan Valley owes its
 * unconditional waiver on draw 1. The start cases take Cool Breeze off the job: no crew on the log and
 * nothing reported.
 */
import { describe, expect, it } from 'vitest'
import { firstOnSite, papersOwed, papersOwedWords, startsToPromise } from './buildingPromises'
import { initialGcState } from './schedule/testState'
import type { Draw, GcProject, GcState, TradePromise } from './types'

const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
/** Fair Oaks D with Cool Breeze nowhere yet: off the daily log and nothing reported. */
function hvacNotYet(p: GcProject): GcProject {
  return {
    ...p,
    dailyLogs: (p.dailyLogs ?? []).map((l) => ({ ...l, crews: l.crews.filter((c) => c.packageId !== 'fhvac') })),
    packages: p.packages.map((k) => (k.id === 'fhvac' && k.sow ? { ...k, sow: { ...k.sow, sov: k.sow.sov.map((l) => ({ ...l, pctReported: 0 })) } } : k)),
  }
}

describe('a trade’s start on site', () => {
  it('takes the first day the daily log has its crew', () => {
    const s = initialGcState()
    expect(['fsite', 'fsteel', 'fhvac'].map((id) => firstOnSite(fairOaks(s), id))).toEqual([null, '2026-09-21', '2026-09-21'])
  })

  it('asks for the day a trade gives once its first start is within 14 days or passed, and none once it shows', () => {
    const s = initialGcState()
    expect(startsToPromise(fairOaks(s), s.today)).toEqual([])
    const quiet = hvacNotYet(fairOaks(s))
    expect(startsToPromise(quiet, s.today).map((x) => [x.pkg.id, x.partnerId, x.start, x.promisedBy])).toEqual([['fhvac', 'coolbreeze', '2026-09-14', null]])
    const promise: TradePromise = { id: 'p-1', partnerId: 'coolbreeze', kind: 'start', projectId: 'fairoaksd', packageId: 'fhvac', what: 'their crew on site', by: '2026-10-05', madeOn: '2026-10-01', from: 'office' }
    expect(startsToPromise(quiet, s.today, [promise])[0]?.promisedBy).toBe('2026-10-05')
    expect(startsToPromise(quiet, s.today, [{ ...promise, keptOn: '2026-10-02' }])[0]?.promisedBy).toBeNull()
    expect(startsToPromise({ ...quiet, stage: 'buyout' }, s.today)).toEqual([])
  })
})

describe('the papers a trade owes us', () => {
  it('owes the final pay application once it can ask, and an unconditional waiver on each paid draw', () => {
    const s = initialGcState()
    const owed = (id: string) => papersOwed(fairOaks(s), fairOaks(s).packages.find((k) => k.id === id)!, s.today)
    expect([owed('fsite').finalApp, owed('fsite').waivers.length]).toEqual([true, 0])
    expect(owed('felec').waivers.map((d) => d.id)).toEqual(['felec-draw-1'])
    expect(owed('fconc')).toEqual({ waivers: [], finalApp: false })
  })

  it('says them in a sentence', () => {
    const draw = (number: number, final = false) => ({ number, final }) as Draw
    expect(papersOwedWords({ waivers: [], finalApp: false })).toBeNull()
    expect(papersOwedWords({ waivers: [], finalApp: true })).toBe('the final pay application')
    expect(papersOwedWords({ waivers: [draw(1)], finalApp: false })).toBe('the unconditional waiver on draw 1')
    expect(papersOwedWords({ waivers: [draw(1), draw(2), draw(3)], finalApp: true })).toBe('the final pay application and the unconditional waivers on draws 1, 2 and 3')
    expect(papersOwedWords({ waivers: [draw(4, true)], finalApp: false })).toBe('the unconditional final release of lien')
  })
})

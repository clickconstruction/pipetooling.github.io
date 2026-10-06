import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcAction, GcState } from './gcTypes'
import { morningList } from './gcMorningList'
import { pt } from './gcPortalI18n'
import { crewCountOn, crewCountsNow, crewWeeks, portalCrewAsks } from './gcCrewCounts'

/**
 * GC mode design spike: a trade's own crew count, from its portal (G-142). On the made-up job being
 * built, Fair Oaks D, today Fri Oct 2: the daily log last had Summit Roofing with 4 and Pecan Valley
 * Electric with 2, on Thu Oct 1. Nobody has given a count yet.
 */

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const say = (partnerId: string, packageId: string, weekOf: string, count: number): GcAction => ({ type: 'tradeSetCrewCount', projectId: ID, partnerId, packageId, weekOf, count })
const THIS_WEEK = '2026-09-28'

/** Today's log written, with each trade's count as given (the rest as Thursday's). */
function withTodaysLog(state: GcState, crews: Record<string, number>): GcState {
  return {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== ID) return p
      const thursday = (p.dailyLogs ?? []).find((l) => l.date === '2026-10-01')!
      const today = { ...thursday, date: '2026-10-02', writtenOn: '2026-10-02', crews: thursday.crews.flatMap((c) => (c.packageId in crews ? (crews[c.packageId] ? [{ ...c, workers: crews[c.packageId]! }] : []) : [c])) }
      return { ...p, dailyLogs: [...(p.dailyLogs ?? []), today] }
    }),
  }
}

const lineOf = (s: GcState, company: string) => morningList(s, job(s), new Map()).expected.find((c) => c.company === company)!

describe('the weeks a count is for, and what is refused', () => {
  it('takes this week and the next two, the look-ahead’s own', () => {
    expect(crewWeeks('2026-10-02')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
  })

  it('refuses another company’s trade, our own crew, a job not built, a week out of reach, and anything but 0 to 50', () => {
    const state = initialGcState()
    const helotes = state.projects.find((p) => p.id === 'helotes')!
    // Helotes is still buying out: Hill Country Interiors has its trade there, and no count yet.
    const hillPkg = helotes.packages.find((k) => k.invites.some((i) => i.partnerId === 'hillcountry' && i.id === k.awardedInviteId))
    expect(hillPkg).toBeDefined()
    const refused: GcAction[] = [
      say('summit', 'fhvac', THIS_WEEK, 4),
      say('summit', 'fplumb', THIS_WEEK, 4),
      say('summit', 'froof', '2026-10-19', 4),
      say('summit', 'froof', '2026-09-30', 4),
      say('summit', 'froof', THIS_WEEK, 3.5),
      say('summit', 'froof', THIS_WEEK, -1),
      say('summit', 'froof', THIS_WEEK, 51),
      say('nobody', 'froof', THIS_WEEK, 4),
      { type: 'tradeSetCrewCount', projectId: 'helotes', partnerId: 'hillcountry', packageId: hillPkg?.id ?? '', weekOf: THIS_WEEK, count: 3 },
    ]
    for (const action of refused) expect(gcReducer(state, action)).toBe(state)
  })
})

describe('a count recorded', () => {
  it('keeps the trade’s word, newest first, and logs it', () => {
    const after = gcReducer(initialGcState(), say('summit', 'froof', THIS_WEEK, 4))
    expect(job(after).crewCounts).toEqual([{ packageId: 'froof', partnerId: 'summit', weekOf: THIS_WEEK, count: 4, on: '2026-10-02' }])
    expect(after.log[0]?.text).toBe('Summit Roofing says 4 a day on Roofing at Fair Oaks Shops, Building D, the week of Sep 28.')
    // The same count again changes nothing.
    expect(gcReducer(after, say('summit', 'froof', THIS_WEEK, 4))).toBe(after)
  })

  it('keeps a lower count as history; the newest counts, and G-84 reads it in a stable shape', () => {
    let state = gcReducer(initialGcState(), say('summit', 'froof', THIS_WEEK, 4))
    state = gcReducer(state, say('pecanvalley', 'felec', '2026-10-05', 3))
    state = gcReducer(state, say('summit', 'froof', THIS_WEEK, 3))
    expect(job(state).crewCounts).toHaveLength(3)
    expect(crewCountsNow(job(state))).toEqual([
      { packageId: 'froof', partnerId: 'summit', weekOf: THIS_WEEK, count: 3, on: '2026-10-02' },
      { packageId: 'felec', partnerId: 'pecanvalley', weekOf: '2026-10-05', count: 3, on: '2026-10-02' },
    ])
    expect(crewCountOn(job(state), 'froof', '2026-10-01')).toEqual({ count: 3, on: '2026-10-02', cutFrom: { count: 4, on: '2026-10-02' } })
    expect(crewCountOn(job(state), 'froof', '2026-10-05')).toBeNull()
    expect(crewCountOn(job(state), 'felec', '2026-10-07')).toEqual({ count: 3, on: '2026-10-02', cutFrom: null })
  })
})

describe('the morning list reads the trade’s word beside the log’s', () => {
  it('says what Pecan Valley said and what the log has: 2 of the 4 is a short crew', () => {
    const said = gcReducer(initialGcState(), say('pecanvalley', 'felec', THIS_WEEK, 4))
    const c = lineOf(withTodaysLog(said, { felec: 2 }), 'Pecan Valley Electric')
    expect([c.logWords, c.crewTone, c.short, c.missing]).toEqual(["On today's log with 2 of the 4 they said.", 'amber', true, false])
  })

  it('reads before the log, as many, missing, nobody, and a cut', () => {
    const four = gcReducer(initialGcState(), say('summit', 'froof', THIS_WEEK, 4))
    expect([lineOf(four, 'Summit Roofing').logWords, lineOf(four, 'Summit Roofing').crewTone]).toEqual(['They said 4 a day this week. Last on the log Thu Oct 1 with 4.', 'grey'])
    expect([lineOf(withTodaysLog(four, { froof: 4 }), 'Summit Roofing').logWords, lineOf(withTodaysLog(four, { froof: 4 }), 'Summit Roofing').crewTone]).toEqual(["On today's log with 4. They said 4.", 'green'])
    const missing = lineOf(withTodaysLog(four, { froof: 0 }), 'Summit Roofing')
    expect([missing.logWords, missing.crewTone, missing.missing]).toEqual(["Not on today's log. They said 4 a day this week.", 'red', true])
    const nobody = gcReducer(initialGcState(), say('summit', 'froof', THIS_WEEK, 0))
    expect([lineOf(nobody, 'Summit Roofing').logWords, lineOf(nobody, 'Summit Roofing').crewTone]).toEqual(['They said nobody this week. Last on the log Thu Oct 1 with 4.', 'amber'])
    const cut = gcReducer(four, say('summit', 'froof', THIS_WEEK, 3))
    expect([lineOf(cut, 'Summit Roofing').logWords, lineOf(cut, 'Summit Roofing').crewTone]).toEqual(['They said 3 a day this week, down from 4 on Fri Oct 2. Last on the log Thu Oct 1 with 4.', 'amber'])
  })

  it('leaves every line as the log’s alone when the trade gave no count', () => {
    const state = initialGcState()
    const c = lineOf(state, 'Summit Roofing')
    expect(c.logWords).toBe('Last on the log Thu Oct 1 with 4.')
    expect('said' in c || 'short' in c || 'crewTone' in c).toBe(false)
  })
})

describe('the portal asks each coming week with work', () => {
  it('lists Summit’s three weeks, each with its trade and its count so far', () => {
    const state = gcReducer(initialGcState(), say('summit', 'froof', '2026-10-05', 5))
    expect(portalCrewAsks(state, 'summit', job(state)).map((w) => [w.weekOf, w.trades.map((t) => [t.trade, t.now?.count ?? null])])).toEqual([
      ['2026-09-28', [['Roofing', null]]],
      ['2026-10-05', [['Roofing', 5]]],
      ['2026-10-12', [['Roofing', null]]],
    ])
  })

  it('says it in Spanish', () => {
    expect(pt('es', 'crewSaid', { n: 4 })).toBe('Dijo 4 al día.')
    expect(pt('es', 'crewSend', { gc: 'Click' })).toBe('Avisar a Click')
  })
})

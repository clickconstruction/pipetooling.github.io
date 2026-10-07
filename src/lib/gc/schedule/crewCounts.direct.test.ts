/**
 * Main's own tests for a trade's own crew count (G-142; the schedule's PR 1b): which counts a company
 * may give, the count for a day's week, the morning list's line beside the log's, the log's line,
 * and the number crowding and people on site count by, run through the kernels on the test data. The
 * spike's own cases: on Fair Oaks D, today Fri Oct 2, the daily log last had Summit Roofing with 4
 * and Pecan Valley Electric with 2, on Thu Oct 1, and nobody has given a count yet.
 */
import { describe, expect, it } from 'vitest'
import { partnerById } from '../lookups'
import type { GcState } from '../types'
import { crewCountAllowed, crewCountLogWords, crewCountOn, crewLogWords } from './crewCounts'
import { morningList } from './morningList'
import { crewNumbers } from './peopleOnSite'
import { initialGcState } from './testState'
import type { CrewCount } from './types'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const THIS_WEEK = '2026-09-28'

/** A trade's count as its portal keeps it, given today. */
const count = (partnerId: string, packageId: string, weekOf: string, n: number): CrewCount => ({ packageId, partnerId, weekOf, count: n, on: '2026-10-02' })
/** The job with counts given, newest first, as the portal keeps them. */
const withCounts = (s: GcState, ...newestFirst: CrewCount[]): GcState => ({ ...s, projects: s.projects.map((p) => (p.id === ID ? { ...p, crewCounts: [...newestFirst, ...(p.crewCounts ?? [])] } : p)) })

/** Today's log written, with each trade's count as given (the rest as Thursday's). */
function withTodaysLog(state: GcState, crews: Record<string, number>): GcState {
  return {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== ID) return p
      const thursday = (p.dailyLogs ?? []).find((l) => l.date === '2026-10-01')!
      const today = { ...thursday, date: '2026-10-02', crews: thursday.crews.flatMap((c) => (c.packageId in crews ? (crews[c.packageId] ? [{ ...c, workers: crews[c.packageId]! }] : []) : [c])) }
      return { ...p, dailyLogs: [...(p.dailyLogs ?? []), today] }
    }),
  }
}
const lineOf = (s: GcState, company: string) => morningList(s, job(s), new Map()).expected.find((c) => c.company === company)!

describe('which counts a company may give', () => {
  it('takes its own trade on a job being built, this week and the next two', () => {
    const s = initialGcState()
    expect(crewCountAllowed(s, job(s), 'summit', 'froof', THIS_WEEK)).toBe(true)
    expect(crewCountAllowed(s, job(s), 'summit', 'froof', '2026-10-12')).toBe(true)
  })

  it('refuses another company’s trade, our own crew, a week out of reach, and a job not built', () => {
    const s = initialGcState()
    const refused: [string, string, string][] = [
      ['summit', 'fhvac', THIS_WEEK],
      ['summit', 'fplumb', THIS_WEEK],
      ['summit', 'froof', '2026-10-19'],
      ['summit', 'froof', '2026-09-30'],
      ['nobody', 'froof', THIS_WEEK],
    ]
    for (const [partnerId, packageId, weekOf] of refused) expect(crewCountAllowed(s, job(s), partnerId, packageId, weekOf)).toBe(false)
    // Helotes is still buying out: Hill Country Interiors has its trade there, and no count yet.
    const helotes = s.projects.find((p) => p.id === 'helotes')!
    const hillPkg = helotes.packages.find((k) => k.invites.some((i) => i.partnerId === 'hillcountry' && i.id === k.awardedInviteId))!
    expect(crewCountAllowed(s, helotes, 'hillcountry', hillPkg.id, THIS_WEEK)).toBe(false)
  })
})

describe('a count kept', () => {
  it('says the trade’s word in the log', () => {
    const s = initialGcState()
    const summit = partnerById(s, 'summit')!
    expect(crewCountLogWords(job(s), summit, count('summit', 'froof', THIS_WEEK, 4))).toBe('Summit Roofing says 4 a day on Roofing at Fair Oaks Shops, Building D, the week of Sep 28.')
    expect(crewCountLogWords(job(s), summit, count('summit', 'froof', THIS_WEEK, 0))).toBe('Summit Roofing says nobody on Roofing at Fair Oaks Shops, Building D, the week of Sep 28.')
  })

  it('keeps a lower count as history; the newest counts for the week of a day', () => {
    const s = withCounts(initialGcState(), count('summit', 'froof', THIS_WEEK, 3), count('pecanvalley', 'felec', '2026-10-05', 3), count('summit', 'froof', THIS_WEEK, 4))
    expect(crewCountOn(job(s), 'froof', '2026-10-01')).toEqual({ count: 3, on: '2026-10-02', cutFrom: { count: 4, on: '2026-10-02' } })
    expect(crewCountOn(job(s), 'froof', '2026-10-05')).toBeNull()
    expect(crewCountOn(job(s), 'felec', '2026-10-07')).toEqual({ count: 3, on: '2026-10-02', cutFrom: null })
  })
})

describe('the morning list reads the trade’s word beside the log’s', () => {
  it('says what Pecan Valley said and what the log has: 2 of the 4 is a short crew', () => {
    const c = lineOf(withTodaysLog(withCounts(initialGcState(), count('pecanvalley', 'felec', THIS_WEEK, 4)), { felec: 2 }), 'Pecan Valley Electric')
    expect([c.logWords, c.crewTone, c.short, c.missing]).toEqual(["On today's log with 2 of the 4 they said.", 'amber', true, false])
  })

  it('reads before the log, as many, missing, nobody, and a cut', () => {
    const four = withCounts(initialGcState(), count('summit', 'froof', THIS_WEEK, 4))
    expect([lineOf(four, 'Summit Roofing').logWords, lineOf(four, 'Summit Roofing').crewTone]).toEqual(['They said 4 a day this week. Last on the log Thu Oct 1 with 4.', 'grey'])
    const asMany = lineOf(withTodaysLog(four, { froof: 4 }), 'Summit Roofing')
    expect([asMany.logWords, asMany.crewTone]).toEqual(["On today's log with 4. They said 4.", 'green'])
    const missing = lineOf(withTodaysLog(four, { froof: 0 }), 'Summit Roofing')
    expect([missing.logWords, missing.crewTone, missing.missing]).toEqual(["Not on today's log. They said 4 a day this week.", 'red', true])
    const nobody = lineOf(withCounts(initialGcState(), count('summit', 'froof', THIS_WEEK, 0)), 'Summit Roofing')
    expect([nobody.logWords, nobody.crewTone]).toEqual(['They said nobody this week. Last on the log Thu Oct 1 with 4.', 'amber'])
    const cut = lineOf(withCounts(four, count('summit', 'froof', THIS_WEEK, 3)), 'Summit Roofing')
    expect([cut.logWords, cut.crewTone]).toEqual(['They said 3 a day this week, down from 4 on Fri Oct 2. Last on the log Thu Oct 1 with 4.', 'amber'])
  })

  it('says a trade never on the log before, and nobody missing from a written log', () => {
    const said = { count: 4, on: '2026-10-02', cutFrom: null }
    expect(crewLogWords(said, null, null, "today's log")).toEqual({ words: 'They said 4 a day this week. Not on the daily log before.', tone: 'grey' })
    expect(crewLogWords({ ...said, count: 0 }, 0, null, "today's log")).toEqual({ words: "Not on today's log. They said nobody this week.", tone: 'grey' })
    expect(crewLogWords(said, 5, null, "today's log")).toEqual({ words: "On today's log with 5. They said 4.", tone: 'green' })
  })
})

describe('the number crowding and people on site count by', () => {
  it('takes a trade’s own count first, then the daily log’s last, then 3', () => {
    const s = initialGcState()
    const n = crewNumbers(s, job(s))
    expect(n('froof', THIS_WEEK)).toEqual({ count: 4, from: 'log' })
    expect(n('felec', THIS_WEEK)).toEqual({ count: 2, from: 'log' })
    // Tri-County's sitework was never on the log.
    expect(n('fsite', THIS_WEEK)).toEqual({ count: 3, from: 'assumed' })
    const told = crewNumbers(s, job(s), [count('summit', 'froof', THIS_WEEK, 6)])
    expect(told('froof', THIS_WEEK)).toEqual({ count: 6, from: 'told' })
    expect(told('froof', '2026-10-05')).toEqual({ count: 4, from: 'log' })
  })

  it('reads the log only up to today', () => {
    const before = { ...initialGcState(), today: '2026-09-01' }
    expect(crewNumbers(before, job(before))('froof', THIS_WEEK)).toEqual({ count: 3, from: 'assumed' })
  })
})

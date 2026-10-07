/**
 * Main's own tests for the schedule kernels the moved tests do not call (the schedule's PR 1a). Each
 * runs a kernel directly on the test data, the prototype's made-up job, and pins the prototype's own
 * answer. On the spike these ran inside the reducer's tests, which stay there.
 */
import { describe, expect, it } from 'vitest'
import { carriedAmount, leveledTotal, takenAlternatesTotal } from '../bids'
import { addDays, crewStages, sentBackOpen } from '../building'
import { exclusionCoversTotal } from '../exclusions'
import { ownBidPriced, partnerById } from '../lookups'
import type { GcState, SubBid, TradePackage } from '../types'
import { shortDate, weekdayDate } from '../words'
import { lineStage, stageChain } from './draft'
import { inspectionItems, lookAheadReliability, markState, pushAfter, pushedAfterWords, scheduleRows, scheduleSummary, scheduleSummaryWords, withBaselineKept, workVsPlan, wouldLoop } from './schedule'
import { initialGcState } from './testState'
import type { LookAheadMark } from './types'

const job = (s: GcState, id = 'fairoaksd') => s.projects.find((p) => p.id === id)!

describe('Fair Oaks D as it stands, Fri Oct 2', () => {
  it('is 3 days behind the plan, 72% done where 76% was planned, and says so in one sentence', () => {
    const s = initialGcState()
    const work = workVsPlan(scheduleRows(s, job(s)), s.today)
    expect([Math.round(work.donePct), Math.round(work.plannedPct), work.daysBehind]).toEqual([72, 76, 3])
    const sum = scheduleSummary(job(s), s.today)!
    expect(sum.milestones).toEqual({ hit: 1, of: 2, late: [{ label: 'Dry-in', daysLate: 7 }], next: { label: 'Rough-in inspection', planned: '2026-10-13' } })
    expect(scheduleSummaryWords(sum)).toBe(
      'The schedule: 3 days behind the plan, 72% done where 76% was planned. Dry-in is 7 days late. Next: Rough-in inspection, Oct 13. 4 look-ahead marks wait on our superintendent.',
    )
  })

  it('counts the look-ahead marks as the superintendent verified them', () => {
    const s = initialGcState()
    expect(lookAheadReliability(s, job(s))).toEqual({
      done: 8,
      of: 11,
      waiting: 4,
      byCompany: [
        { company: 'Iron Horse Fabrication', done: 2, of: 3 },
        { company: 'Pecan Valley Electric', done: 0, of: 1 },
        { company: 'Our own crew', done: 3, of: 3 },
        { company: 'Cool Breeze Mechanical', done: 2, of: 2 },
        { company: 'Summit Roofing', done: 1, of: 2 },
      ],
    })
    const mark: LookAheadMark = { weekOf: '2026-09-28', lineId: 'froof-1', packageId: 'froof', done: true, markedOn: '2026-10-02', verifiedOn: null }
    expect([markState(null), markState(mark), markState({ ...mark, verifiedOn: '2026-10-05' }), markState({ ...mark, verifiedOn: '2026-10-05', verifiedDone: false })]).toEqual(['unmarked', 'waiting', 'done', 'not'])
  })

  it('lists the inspections in the order drawn, the city’s, none passed yet', () => {
    const s = initialGcState()
    expect(inspectionItems(job(s), s.today).map((i) => [i.label, i.company, i.actual])).toEqual([
      ['Rough-in inspection', 'The city', 0],
      ['Electrical service inspection', 'The city', 0],
      ['Final inspection', 'The city', 0],
    ])
    expect(inspectionItems(job(s, 'helotes'), s.today)).toEqual([])
  })

  it('keeps the plan at Start as the baseline, once, on the first change after Start', () => {
    const s = initialGcState()
    const schedule = job(s).schedule!
    expect(withBaselineKept(job(s), schedule)).toBe(schedule)
    const unlocked = { ...schedule, baseline: null }
    const kept = withBaselineKept(job(s), unlocked)
    expect(kept.baseline?.lockedOn).toBe('2026-07-01')
    expect(kept.baseline?.activities['froof-1']).toEqual({ start: '2026-09-21', finish: '2026-10-09' })
    expect(withBaselineKept({ ...job(s), startedOn: null }, unlocked)).toBe(unlocked)
  })

  it('knows a wait that would make a loop, and says what a move pushes out', () => {
    const s = initialGcState()
    const activities = job(s).schedule!.activities
    expect([wouldLoop(activities, 'fsite-2', 'fsite-4'), wouldLoop(activities, 'fsite-4', 'fsite-1'), wouldLoop(activities, 'fsite-1', 'fsite-1')]).toEqual([true, false, true])
    const later = activities.map((a) => (a.lineId === 'froof-1' ? { ...a, start: addDays(a.start, 3), finish: addDays(a.finish, 3) } : a))
    const pushed = pushAfter(job(s), later, 'froof-1')
    expect(pushedAfterWords(pushed.moved)).toBe('2 activities after it move out, the last to finish Sat Oct 24.')
    expect(pushedAfterWords(pushed.moved.slice(0, 1))).toBe('Roofing · Sheet metal and flashing moves to Tue Oct 13 to Thu Oct 22.')
    expect(pushedAfterWords([])).toBe('')
  })
})

describe('the first draft’s stages', () => {
  it('puts a line in its stage by its words, else by its trade, and chains a stage to all before it', () => {
    expect([lineStage('Plumbing', 'Rough in'), lineStage('Plumbing', 'Trim'), lineStage('Roofing', 'TPO membrane'), lineStage('Electrical', 'Lighting'), lineStage('Painting', 'Walls')]).toEqual(['roughIn', 'trim', 'dryIn', 'trim', 'finishes'])
    expect([...stageChain('finishes')]).toEqual(['finishes', 'closeIn', 'roughIn', 'framing', 'dryIn', 'structure', 'slab', 'underground', 'foundations', 'sitePrep'])
  })
})

describe('what the schedule reads from the other lanes', () => {
  it('carries each trade’s number: its statement of work, our own priced bid, or the quote it carries', () => {
    const s = initialGcState()
    expect(job(s).packages.map((k) => [k.id, carriedAmount(k)])).toEqual([
      ['fsite', 168000],
      ['fconc', 214000],
      ['fsteel', 186000],
      ['felec', 248000],
      ['froof', 132000],
      ['fplumb', 112000],
      ['fhvac', 158000],
    ])
    expect(job(s, 'boerne').packages.slice(0, 4).map((k) => [k.id, carriedAmount(k)])).toEqual([
      ['site', 184900],
      ['conc', 219800],
      ['steel', null],
      ['roof', 112300],
    ])
  })

  it('levels a quote: a plug for what it leaves out, a taken alternate, and a cover cost on what it excludes', () => {
    const bid: SubBid = {
      amount: 100000,
      basedOnRev: 0,
      submittedOn: '2026-09-28',
      includes: { 'x-1': 'yes', 'x-2': 'no' },
      plugs: { 'x-2': 4000 },
      alternates: [
        { label: 'Thicker membrane', amount: 6000 },
        { label: 'Fewer curbs', amount: -2000 },
      ],
      takenAlternates: ['Thicker membrane'],
      exclusions: [{ name: 'Permits and fees' }, { name: 'Roof drains' }],
      exclusionCovers: { 'Permits and fees': 900, 'Roof drains': 1500 },
    }
    const pkg: TradePackage = {
      id: 'x',
      trade: 'Roofing',
      budget: 90000,
      carried: 'x-quote',
      scope: [
        { id: 'x-1', label: 'TPO membrane' },
        { id: 'x-2', label: 'Roof curbs' },
      ],
      excludes: [{ label: 'Permits and fees', by: 'the owner' }],
      invites: [{ id: 'x-quote', partnerId: 'summit', status: 'bid', invitedOn: '2026-09-20', bid }],
      awardedInviteId: null,
      selfPerform: null,
      sow: null,
    }
    expect(takenAlternatesTotal(bid)).toBe(6000)
    // Permits and fees are a Known exclusion of the trade, so only the roof drains' cover counts.
    expect(exclusionCoversTotal(pkg, bid)).toBe(1500)
    expect(leveledTotal(pkg, pkg.invites[0]!)).toBe(111500)
    expect([carriedAmount(pkg), carriedAmount({ ...pkg, carried: 'plug' })]).toEqual([111500, 90000])
  })

  it('weighs our own crew’s stages, and finds the pay application sent back', () => {
    const s = initialGcState()
    const plumbing = job(s).packages.find((k) => k.id === 'fplumb')!
    expect(crewStages(plumbing).map((x) => [x.label, x.weight])).toEqual([
      ['Underground', 20],
      ['Rough in', 35],
      ['Top out', 25],
      ['Trim', 20],
    ])
    expect([ownBidPriced(plumbing), ownBidPriced({ ...plumbing, selfPerform: { ...plumbing.selfPerform!, priced: false } })]).toEqual([true, false])
    const roofing = job(s).packages.find((k) => k.id === 'froof')!
    expect(ownBidPriced(roofing)).toBe(false)
    expect(sentBackOpen(roofing.sow!)?.draw.number).toBe(1)
    expect(sentBackOpen({ ...roofing.sow!, draws: [{ number: 1, retainage: 0, net: 0, status: 'requested', waiver: 'conditional' }] })).toBeNull()
  })

  it('names a company, and writes a date the one way every lane does', () => {
    const s = initialGcState()
    const site = job(s).packages.find((k) => k.id === 'fsite')!
    const awarded = site.invites.find((i) => i.id === site.awardedInviteId)!
    expect(partnerById(s, awarded.partnerId)?.company).toBe('Tri-County Site')
    expect(partnerById(s, 'nobody')).toBeUndefined()
    expect([shortDate('2026-10-02'), weekdayDate('2026-10-02'), shortDate(null), weekdayDate(null), shortDate('2026-13-01')]).toEqual(['Oct 2', 'Fri Oct 2', '', '', '2026-13-01'])
  })
})

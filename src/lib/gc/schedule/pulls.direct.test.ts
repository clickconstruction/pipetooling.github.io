/**
 * Main's own tests for the moves a pull and a recovery save (the schedule's PR 1a). The offers
 * themselves read the holds and stay on the spike until they reach main (PR 9), so each offer here is
 * written out by hand, the way `planPull` and `recoveryOffers` shape one on Fair Oaks D.
 */
import { describe, expect, it } from 'vitest'
import type { GcState } from '../types'
import { scheduleFinish, undoMove } from './moves'
import { pullMove, pullWordsFor, type PullOffer } from './pullEarlier'
import { recoveryMove, recoveryNoneWords, type RecoveryOffer } from './recovery'
import { initialGcState } from './testState'

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!

/** Top out finished Fri Oct 2, 7 days early; the rough-in inspection can come in; sheet metal waits on a submittal. */
const PULL: PullOffer = {
  finished: [{ lineId: 'fplumb-3', name: 'Top out', trade: 'Plumbing', company: 'Our own crew', planned: { start: '2026-09-28', finish: '2026-10-09' }, to: { start: '2026-09-28', finish: '2026-10-02' }, finishedOn: '2026-10-02', early: 7 }],
  pulls: [{ lineId: 'fairoaksd-insp-roughin', name: 'Rough-in inspection', trade: 'Inspections', company: 'The city', from: { start: '2026-10-13', finish: '2026-10-13' }, to: { start: '2026-10-05', finish: '2026-10-05' }, days: 8, limit: null, said: 'Rough-in inspection can start Mon Oct 5, 8 days sooner.' }],
  stays: [{ lineId: 'froof-3', name: 'Sheet metal and flashing', trade: 'Roofing', company: 'Summit Roofing', why: 'It waits on submittal 07 62 00-01, which is with us.', said: 'Sheet metal and flashing waits on submittal 07 62 00-01, which is with us.', held: true, left: false }],
  activities: [],
  finishFrom: '2026-12-08',
  finishTo: '2026-12-08',
  finishDays: 0,
  lostDays: 0,
  words: { finished: ['Top out finished Fri Oct 2, 7 days early.'], state: '1 activity can start 8 days sooner.', detail: [], finish: 'The job still finishes Tue Dec 8.', lost: null },
  note: 'Top out finished Fri Oct 2, 7 days early.',
  show: 'pull',
}

describe('a pull when work finishes early', () => {
  it('saves the finished line as the move, every other date it changes in pushed, and names the finished lines', () => {
    const s = initialGcState()
    const schedule = job(s).schedule!
    expect(pullMove(schedule, PULL, { reason: 'early', note: ' Top out finished early. ', by: 'Robert' }, s.today)).toEqual({
      id: 'move-1',
      on: '2026-10-02',
      by: 'Robert',
      lineId: 'fplumb-3',
      from: { start: '2026-09-28', finish: '2026-10-09' },
      to: { start: '2026-09-28', finish: '2026-10-02' },
      reason: 'early',
      note: 'Top out finished early.',
      pushed: [{ lineId: 'fairoaksd-insp-roughin', from: { start: '2026-10-13', finish: '2026-10-13' }, to: { start: '2026-10-05', finish: '2026-10-05' } }],
      finishFrom: '2026-12-08',
      finishTo: '2026-12-08',
      pull: { finished: ['fplumb-3'] },
    })
    expect(pullMove(schedule, { ...PULL, pulls: [] }, { reason: 'early', note: 'x', by: 'Robert' }, s.today)).toBeNull()
  })

  it('says what the offer means for each bar it touches', () => {
    expect([pullWordsFor(PULL, 'fplumb-3'), pullWordsFor(PULL, 'fairoaksd-insp-roughin'), pullWordsFor(PULL, 'froof-3'), pullWordsFor(PULL, 'felec-3')]).toEqual([
      'It finished Fri Oct 2, 7 days early. 1 activity can start 8 days sooner.',
      'It can start Mon Oct 5, 8 days sooner. The work before it finished early.',
      'The work before it finished early. It waits on submittal 07 62 00-01, which is with us.',
      null,
    ])
  })
})

describe('days got back (G-82)', () => {
  /** Sheet metal starts 3 days before the TPO membrane finishes, side by side. */
  function sideBySide(s: GcState): RecoveryOffer {
    const activities = job(s).schedule!.activities.map((a) => (a.lineId === 'froof-3' ? { ...a, start: '2026-10-07', finish: '2026-10-16', lag: { 'froof-1': -3 } } : a))
    return {
      key: 'side:froof-3:froof-1',
      how: 'side',
      lineId: 'froof-3',
      name: 'Sheet metal and flashing',
      after: 'froof-1',
      afterName: 'TPO membrane',
      from: { start: '2026-10-12', finish: '2026-10-21' },
      to: { start: '2026-10-07', finish: '2026-10-16' },
      gapWas: 0,
      gap: -3,
      pulls: [],
      stays: [],
      activities,
      finishFrom: '2026-12-08',
      finishTo: scheduleFinish(activities),
      daysBack: 0,
      lateAfter: 0,
      saves: null,
      who: [],
      words: { title: 'Sheet metal and flashing beside TPO membrane.', detail: '', who: '', worth: '' },
      note: 'Sheet metal starts 3 days before the TPO membrane finishes.',
    }
  }

  it('saves the offer’s bar and its gap, so Undo puts the dates and the gap back', () => {
    const s = initialGcState()
    const schedule = job(s).schedule!
    const offer = sideBySide(s)
    const move = recoveryMove(schedule, offer, { reason: 'recovery', note: offer.note, by: 'Robert' }, s.today)
    expect(move).toMatchObject({ id: 'move-1', lineId: 'froof-3', from: offer.from, to: offer.to, pushed: [], recovery: { how: 'side', after: 'froof-1', gapWas: 0, gap: -3 } })
    expect([move.finishFrom, move.finishTo]).toEqual([scheduleFinish(schedule.activities), scheduleFinish(offer.activities)])
    expect(recoveryMove(schedule, { ...offer, how: 'crew', after: undefined }, { reason: 'recovery', note: 'A second crew.', by: 'Robert' }, s.today).recovery).toEqual({ how: 'crew' })

    const saved = { ...job(s), schedule: { ...schedule, activities: offer.activities, moves: [move] } }
    const back = undoMove(saved, 'move-1', 'Wendi', '2026-10-03')!
    const sheet = back.activities.find((a) => a.lineId === 'froof-3')!
    expect([sheet.start, sheet.finish, sheet.lag]).toEqual(['2026-10-12', '2026-10-21', undefined])
  })

  it('says why a late job has no offer', () => {
    const s = initialGcState()
    expect(recoveryNoneWords(s, job(s))).toBe("The work's pace sets the finish, not the plan.")
  })
})

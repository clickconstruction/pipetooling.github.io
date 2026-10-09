import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import { lagOf, scheduleMeasures } from './gcBuildingSchedule'
import { companiesToTell } from './gcTellTrades'
import { daysLostByCause } from './gcDaysLost'
import { customerChanges } from './gcCustomerSchedule'
import { moveRows } from './gcScheduleMoves'
import type { GcState, ScheduleActivity, ScheduleMoveReason, ScheduleWait } from './gcTypes'
import { CREW_RULE, recoveryOffers, sideBySideWords } from './gcRecovery'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const offersOf = (s: GcState) => recoveryOffers(s, job(s))
const why = { reason: 'recovery' as const, note: 'Cool Breeze brings a second crew for the last days.', by: 'Robert' }
const activity = (s: GcState, lineId: string) => job(s).schedule!.activities.find((a) => a.lineId === lineId)!

function moveBy(s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState {
  const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
  return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
}

/** G-98's late job: Trim waits a week on the customer, rain holds Test and balance nine days. Tue Dec 15, 4 days past Dec 11. */
function lateJob(): GcState {
  const s = moveBy(initialGcState(), 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.')
  return moveBy(s, 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
}

/**
 * Three trades in a chain on Fair Oaks D, nothing else on the schedule: Sheet metal and flashing
 * (Summit Roofing, Mon Nov 30 to Sun Dec 6), then Controls (Cool Breeze Mechanical, Dec 7 to 13),
 * then Trim (our own crew, Dec 14 to 18). The contract says Dec 11: 7 days past.
 */
function chain(more: { controls?: Partial<ScheduleActivity>; ahead?: ScheduleActivity; trim?: Partial<ScheduleActivity>; waits?: ScheduleWait[] } = {}): GcState {
  const s = initialGcState()
  const keep = new Map(job(s).schedule!.activities.map((a) => [a.lineId, a]))
  const line = (id: string, start: string, finish: string, after: string[], extra: Partial<ScheduleActivity> = {}): ScheduleActivity => {
    const { lag: _lag, ...base } = keep.get(id) as ScheduleActivity
    return { ...base, lineId: id, start, finish, after, ...extra }
  }
  const ahead = more.ahead ?? line('froof-3', '2026-11-30', '2026-12-06', [])
  const activities = [ahead, line('fhvac-3', '2026-12-07', '2026-12-13', [ahead.lineId], more.controls ?? {}), line('fplumb-4', '2026-12-14', '2026-12-18', ['fhvac-3'], more.trim ?? {})]
  return {
    ...s,
    projects: s.projects.map((p) => (p.id === ID && p.schedule ? { ...p, schedule: { ...p.schedule, activities, moves: [], walks: [], baseline: null }, waits: more.waits ?? [], submittals: [], rfis: [] } : p)),
  }
}

describe('how to get days back (G-82)', () => {
  it('the late job: one way, a second crew on Test and balance, 1 day back', () => {
    const offers = offersOf(lateJob())
    expect(offers.map((o) => [o.key, o.daysBack])).toEqual([['crew:fhvac-4', 1]])
    const [o] = offers
    expect(o?.words).toEqual({
      title: 'A second crew on Test and balance.',
      detail: `It would finish Sat Dec 12, not Sun Dec 13. ${CREW_RULE}`,
      who: 'Cool Breeze Mechanical has to agree: Andre Wallace.',
      worth: '1 day back brings the finish to Mon Dec 14, still 3 days past the contract.',
    })
    // The final inspection, right behind it, comes in a day; Trim's 2 spare days take its crew offer.
    expect(o?.pulls.map((p) => [p.name, p.to.start])).toEqual([['Final inspection', '2026-12-13']])
  })

  it('with the contract’s fee typed, the worth says what it saves', () => {
    const s = gcReducer(chain(), { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
    expect(offersOf(s)[0]?.words.worth).toBe('3 days back brings the finish to Tue Dec 15, still 4 days past the contract. At $500 a day, that saves $1,500.')
  })

  it('reads every line in plain words, the crew rule said on every crew offer', () => {
    for (const s of [lateJob(), chain()]) {
      for (const o of offersOf(s)) {
        for (const line of Object.values(o.words)) expect(plainWordsFailures(line)).toEqual([])
        if (o.how === 'crew') expect(o.words.detail).toContain(CREW_RULE)
      }
    }
    expect(sideBySideWords(3, 'TPO membrane')).toBe('3 days before TPO membrane finishes')
  })
})

describe('side by side: what the kernel reads on the wait', () => {
  const sideKeys = (s: GcState) => offersOf(s).filter((o) => o.how === 'side').map((o) => o.key)

  it('a trade’s own word that it starts later stands: its late notice takes the offer', () => {
    const s = gcReducer(chain(), { type: 'tradeSayLate', projectId: ID, partnerId: 'coolbreeze', lineId: 'fhvac-3', day: '2026-12-09', reason: 'materials', note: 'The control panels ship late.' })
    expect(sideKeys(s)).not.toContain('side:fhvac-3:froof-3')
  })
})

describe('saving one: one move, Undo and Redo, Tell the trades', () => {
  const saved = () => gcReducer(chain(), { type: 'recoverScheduleDays', projectId: ID, key: 'side:fhvac-3:froof-3', why })

  it('saves the bar, its gap on the wait and the work behind it as one move', () => {
    const s = saved()
    expect(activity(s, 'fhvac-3')).toMatchObject({ start: '2026-12-04', finish: '2026-12-10', lag: { 'froof-3': -3 } })
    expect(lagOf(activity(s, 'fhvac-3'), 'froof-3')).toBe(-3)
    expect(activity(s, 'fplumb-4')).toMatchObject({ start: '2026-12-11', finish: '2026-12-15' })
    const move = job(s).schedule!.moves![0]!
    expect([move.lineId, move.reason, move.recovery, move.pushed.map((p) => p.lineId)]).toEqual(['fhvac-3', 'recovery', { how: 'side', after: 'froof-3', gapWas: 0, gap: -3 }, ['fplumb-4']])
    // The list reads the job again: that offer is gone.
    expect(offersOf(s).map((o) => o.key)).not.toContain('side:fhvac-3:froof-3')
  })

  it('Undo puts back the exact gap and every date, and Redo puts them again', () => {
    const before = chain()
    const s = saved()
    const moveId = job(s).schedule!.moves![0]!.id
    const undone = gcReducer(s, { type: 'undoScheduleMove', projectId: ID, moveId, by: 'Robert' })
    expect(job(undone).schedule!.activities).toEqual(job(before).schedule!.activities)
    const redone = gcReducer(undone, { type: 'redoScheduleMove', projectId: ID, moveId, by: 'Robert' })
    expect(job(redone).schedule!.activities).toEqual(job(s).schedule!.activities)
  })

  it('Tell the trades tells the company whose dates moved; our own crew needs no message', () => {
    const s = saved()
    const move = job(s).schedule!.moves![0]!
    expect(companiesToTell(s, job(s), [move]).map((c) => c.partner.company)).toEqual(['Cool Breeze Mechanical'])
  })

  it('the history, days lost and the customer say it in their words', () => {
    const s = saved()
    const row = moveRows(job(s))[0]!
    expect(row.what).toBe('HVAC · Controls now starts 3 days before Sheet metal and flashing finishes, Dec 4 to Dec 10.')
    expect(row.effect).toBe('Plumbing · Trim came in behind it. The finish moved 3 days sooner, to Dec 15.')
    expect(row.reason).toBe('Getting days back')
    expect(daysLostByCause(job(s)).words).toContain('3 days back from work we sped up')
    expect(customerChanges(job(s), s.today).join(' ')).toContain('because of a faster plan for the work. The finish moves 3 days sooner.')
  })

  it('a second crew is offered once: a bar that has one gets no third crew', () => {
    const s = gcReducer(lateJob(), { type: 'recoverScheduleDays', projectId: ID, key: 'crew:fhvac-4', why })
    expect(activity(s, 'fhvac-4').finish).toBe('2026-12-12')
    expect(offersOf(s).map((o) => o.key)).not.toContain('crew:fhvac-4')
    const row = moveRows(job(s))[0]!
    expect(row.what).toBe('A second crew on HVAC · Test and balance: it finishes Sat Dec 12, not Sun Dec 13.')
    // Undone, the crew is gone, and the offer is back.
    const undone = gcReducer(s, { type: 'undoScheduleMove', projectId: ID, moveId: job(s).schedule!.moves![0]!.id, by: 'Robert' })
    expect(offersOf(undone).map((o) => o.key)).toContain('crew:fhvac-4')
  })

  it('a press for an offer no longer there, or with no reason, changes nothing', () => {
    const s = chain()
    expect(gcReducer(s, { type: 'recoverScheduleDays', projectId: ID, key: 'side:nothing:here', why })).toBe(s)
    expect(gcReducer(s, { type: 'recoverScheduleDays', projectId: ID, key: 'crew:fhvac-3', why: { ...why, note: '' } })).toBe(s)
  })
})

describe('the gap below zero (the lead’s condition)', () => {
  it('a hand edit keeps a gap below zero, and a gap of zero is no gap', () => {
    const s = chain()
    const c = activity(s, 'fhvac-3')
    const side = gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: c.lineId, start: '2026-12-05', finish: '2026-12-11', after: c.after, lag: { 'froof-3': -2 }, why: { reason: 'recovery', note: 'Controls starts beside the flashing.', by: 'Robert' } })
    expect(activity(side, 'fhvac-3').lag).toEqual({ 'froof-3': -2 })
    const none = gcReducer(side, { type: 'setScheduleActivity', projectId: ID, lineId: c.lineId, start: '2026-12-07', finish: '2026-12-13', after: c.after, lag: { 'froof-3': 0 }, why: { reason: 'recovery', note: 'Back to after the flashing.', by: 'Robert' } })
    expect(activity(none, 'fhvac-3').lag).toBeUndefined()
  })
})

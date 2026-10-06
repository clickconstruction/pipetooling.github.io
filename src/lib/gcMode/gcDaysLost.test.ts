import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import type { GcState, ScheduleMoveReason } from './gcTypes'
import { CAUSE_OF, daysLostByCause, lostDaysByLine, lostDaysMoveNote, lostDaysUnanswered, lostDaysWords, weatherLostDays } from './gcDaysLost'

/** Fair Oaks Shops, Building D: rain held the roofers on Thu Sep 24; lightning cleared the site Fri Sep 25 with only the electricians logged. */
const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!
const why = (reason: ScheduleMoveReason, note: string) => ({ reason, note, by: 'Robert' })

describe('weather days from the daily log (G-58)', () => {
  it('puts a lost day on every bar the stopped trades had running that day', () => {
    const days = weatherLostDays(job(initialGcState()))
    expect(days.map((d) => `${d.date} ${d.lineId}`)).toEqual(['2026-09-24 froof-2', '2026-09-24 froof-1', '2026-09-25 felec-2', '2026-09-25 felec-3'])
    expect(days[0]?.note).toBe('Rain all day. The membrane cannot go down wet.')
    expect(days[2]?.note).toBe('Work stopped at 12:30 for lightning.')
    // The plumbers were not logged on site on the storm day, so their top out lost nothing.
    expect(days.some((d) => d.lineId === 'fplumb-2')).toBe(false)
  })

  it('reads them by bar and says them in a sentence', () => {
    const by = lostDaysByLine(job(initialGcState()))
    expect(by.get('froof-1')?.map((d) => d.date)).toEqual(['2026-09-24'])
    expect(lostDaysWords(by.get('froof-1') ?? [])).toBe('1 day lost to the weather by the daily log: Thu Sep 24.')
    expect(lostDaysWords([])).toBeNull()
    expect(lostDaysMoveNote(by.get('froof-1') ?? [])).toBe('The daily log has 1 day lost to the weather on this work, Thu Sep 24. Rain all day. The membrane cannot go down wet.')
  })

  it('a weather move on the bar answers the lost days before it; later ones stay open', () => {
    let state = initialGcState()
    expect(lostDaysUnanswered(job(state), 'froof-1').length).toBe(1)
    const tpo = job(state).schedule!.activities.find((a) => a.lineId === 'froof-1')!
    state = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: 'froof-1', start: tpo.start, finish: addDays(tpo.finish, 1), after: tpo.after, why: why('weather', 'Rain on the 24th, by the log.') })
    expect(lostDaysUnanswered(job(state), 'froof-1')).toEqual([])
    // A move for another reason does not answer them.
    let other = initialGcState()
    other = gcReducer(other, { type: 'setScheduleActivity', projectId: ID, lineId: 'froof-1', start: tpo.start, finish: addDays(tpo.finish, 1), after: tpo.after, why: why('crew', 'Summit came short-handed all week.') })
    expect(lostDaysUnanswered(job(other), 'froof-1').length).toBe(1)
  })
})

describe('days lost by cause (G-96)', () => {
  it('lays every reason at a door', () => {
    expect(CAUSE_OF['change order']).toBe('customer')
    expect(CAUSE_OF.plans).toBe('customer')
    expect(CAUSE_OF.inspection).toBe('trade')
    expect(CAUSE_OF.us).toBe('us')
  })

  it('adds the standing moves up by cause, with what each did to the finish', () => {
    let state = initialGcState()
    expect(daysLostByCause(job(state)).words).toBe('No move has been made on the schedule. The daily log shows 2 days lost to the weather.')
    const tpo = job(state).schedule!.activities.find((a) => a.lineId === 'froof-1')!
    // The roof out a week for the weather: it pushes the sheet metal and the rooftop units; the finish holds (the final inspection has room).
    state = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: 'froof-1', start: tpo.start, finish: addDays(tpo.finish, 7), after: tpo.after, why: why('weather', 'Rain all week, by the daily log.') })
    const once = daysLostByCause(job(state))
    expect(once.moves).toBe(1)
    expect(once.rows.map((r) => [r.cause, r.workDays, r.finishDays, r.reasons])).toEqual([['weather', 7, once.finishDays, ['weather']]])
    // The final inspection out 10 days on the customer: the finish moves with it.
    const final = job(state).schedule!.activities.find((a) => a.lineId === 'fairoaksd-insp-final')!
    state = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: final.lineId, start: addDays(final.start, 10), finish: addDays(final.finish, 10), after: final.after, why: why('customer', 'Cibolo asked us to hold the final for their tenant walk.') })
    const twice = daysLostByCause(job(state))
    expect(twice.rows[0]).toMatchObject({ cause: 'customer', finishDays: 10, workDays: 10, moves: 1, reasons: ['the customer'] })
    expect(twice.finishDays).toBe(once.finishDays + 10)
    expect(twice.words).toMatch(/^The finish moved \d+ days later in 2 moves: 10 days the customer's \(the customer\)/)
    expect(twice.words).toMatch(/The daily log shows 2 days lost to the weather\.$/)
    // An undone move drops out.
    const undone = gcReducer(state, { type: 'undoScheduleMove', projectId: ID, moveId: job(state).schedule!.moves![0]!.id, by: 'Robert' })
    expect(daysLostByCause(job(undone)).moves).toBe(1)
  })
})

/**
 * The tests of `gcDaysLost.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { CAUSE_OF, lostDaysByLine, lostDaysMoveNote, lostDaysWords, weatherLostDays } from './daysLost'
import { initialGcState } from './testState'
import type { GcState } from '../types'

/** Fair Oaks Shops, Building D: rain held the roofers on Thu Sep 24; lightning cleared the site Fri Sep 25 with only the electricians logged. */
const ID = 'fairoaksd'

const job = (state: GcState) => state.projects.find((p) => p.id === ID)!

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
})

describe('days lost by cause (G-96)', () => {
  it('lays every reason at a door', () => {
    expect(CAUSE_OF['change order']).toBe('customer')
    expect(CAUSE_OF.plans).toBe('customer')
    expect(CAUSE_OF.inspection).toBe('trade')
    expect(CAUSE_OF.us).toBe('us')
  })
})

/**
 * The tests of `gcFinishOutlook.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { WEATHER_DAYS_A_MONTH, finishOutlook } from './finishOutlook'
import { initialGcState } from './testState'
import type { GcState } from '../types'

const ID = 'fairoaksd'

const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

const outlookOf = (s: GcState) => finishOutlook(s, job(s))!

describe('the projected finish with weather and crews on the fixture (Fair Oaks D, Fri Oct 2)', () => {
  it('is for a job being built with a schedule only', () => {
    const s = initialGcState()
    for (const p of s.projects.filter((x) => x.stage !== 'building')) expect(finishOutlook(s, p)).toBeNull()
  })
})

describe('the weather rule', () => {
  it('no weather in the log adds none and says so; no log at all says so for the crews too', () => {
    const s0 = initialGcState()
    const dry: GcState = { ...s0, projects: s0.projects.map((p) => (p.id !== ID ? p : { ...p, dailyLogs: (p.dailyLogs ?? []).map((l) => ({ ...l, weatherStop: false, delays: l.delays.filter((d) => d.reason !== 'weather') })) })) }
    const o = outlookOf(dry)
    expect(o.weather).toEqual({ rate: WEATHER_DAYS_A_MONTH, fromLog: false, trades: [], days: 0 })
    expect(o.words.weather).toBe('Weather adds no days: the log has no weather yet.')
    const none: GcState = { ...s0, projects: s0.projects.map((p) => (p.id !== ID ? p : { ...p, dailyLogs: [] })) }
    expect(outlookOf(none).words).toEqual({
      line: 'With weather and crews: Fri Dec 11, the same day.',
      weather: 'Weather adds no days: the log has no weather yet.',
      crews: 'Crews add no days: the log has no crews yet.',
    })
  })
})

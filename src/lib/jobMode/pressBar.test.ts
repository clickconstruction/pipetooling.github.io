import { describe, expect, it } from 'vitest'
import { ON_MY_WAY_WORDS } from './onMyWay'
import {
  buildJobModePressBar,
  clockOutOffered,
  JOB_MODE_PRESS_WORDS,
  oneLine,
  pctDoneOffered,
  pickJobModeDayPress,
  PRESS_BAR_WORDS,
  type JobModeDayPress,
} from './pressBar'

const onMyWay = (): JobModeDayPress =>
  pickJobModeDayPress({ leg: 'on-site', state: 'on-scheduled-job-not-last', hasNextBlock: true, canClockOut: true })

const ids = (buttons: Array<{ id: string }>) => buttons.map((b) => b.id)

describe('pickJobModeDayPress — the card’s six states', () => {
  it('no clock, no schedule: the manual Clock In in orange', () => {
    const p = pickJobModeDayPress({ leg: 'unmarked', state: 'no-clock-no-schedule', hasNextBlock: false, canClockOut: true })
    expect(p).toEqual({ kind: 'manual-clock-in', intent: null, label: 'Clock In', tone: 'orange', disabled: false })
  })

  it('not clocked in with a schedule: On my way, the first job of the day', () => {
    const p = pickJobModeDayPress({ leg: 'unmarked', state: 'not-clocked-in-with-schedule', hasNextBlock: true, canClockOut: true })
    expect(p.kind).toBe('next')
    expect(p.intent).toBe('start-first')
    expect(p.label).toBe(ON_MY_WAY_WORDS.button)
    expect(p.tone).toBe('green')
  })

  it('on a scheduled job with another after: On my way to the next one', () => {
    const p = onMyWay()
    expect(p.kind).toBe('next')
    expect(p.intent).toBe('next-job')
    expect(p.label).toBe(ON_MY_WAY_WORDS.button)
  })

  it('on the way: I’m here in blue, whatever the schedule says', () => {
    const p = pickJobModeDayPress({ leg: 'on-the-way', state: 'on-scheduled-job-last', hasNextBlock: false, canClockOut: true })
    expect(p).toEqual({ kind: 'im-here', intent: null, label: ON_MY_WAY_WORDS.hereButton, tone: 'blue', disabled: false })
  })

  it('last job of the day: Wrap Up Day in red for the hourly, Last job of the day dead and grey for the salaried', () => {
    const hourly = pickJobModeDayPress({ leg: 'on-site', state: 'on-scheduled-job-last', hasNextBlock: false, canClockOut: true })
    expect(hourly).toEqual({ kind: 'wrap-up', intent: null, label: 'Wrap Up\nDay', tone: 'red', disabled: false })
    const salaried = pickJobModeDayPress({ leg: 'on-site', state: 'on-scheduled-job-last', hasNextBlock: false, canClockOut: false })
    expect(salaried).toEqual({ kind: 'last-job', intent: null, label: 'Last job\nof the day', tone: 'grey', disabled: true })
  })

  it('off the schedule or on a bid with a job still to do: On my way; with nothing next: Choose Next Job', () => {
    expect(pickJobModeDayPress({ leg: 'unmarked', state: 'on-off-schedule-job', hasNextBlock: true, canClockOut: true }).intent).toBe('next-job')
    expect(pickJobModeDayPress({ leg: 'unmarked', state: 'on-bid', hasNextBlock: true, canClockOut: true }).intent).toBe('next-job')
    const none = pickJobModeDayPress({ leg: 'unmarked', state: 'on-off-schedule-job', hasNextBlock: false, canClockOut: true })
    expect(none).toEqual({ kind: 'open-update-focus', intent: null, label: 'Choose Next\nJob', tone: 'green', disabled: false })
  })

  it('the words are the card’s, imported and never retyped', () => {
    expect(JOB_MODE_PRESS_WORDS.onMyWay).toBe(ON_MY_WAY_WORDS.button)
    expect(JOB_MODE_PRESS_WORDS.imHere).toBe(ON_MY_WAY_WORDS.hereButton)
    expect(PRESS_BAR_WORDS.clockOut).toBe(JOB_MODE_PRESS_WORDS.clockOut)
    expect(oneLine('On my\nway')).toBe('On my way')
    expect(oneLine('Last job\nof the day')).toBe('Last job of the day')
  })
})

describe('the gates', () => {
  it('% done is My Schedule’s gate: subs, helpers and superintendents, nobody else', () => {
    expect(pctDoneOffered('subcontractor')).toBe(true)
    expect(pctDoneOffered('helpers')).toBe(true)
    expect(pctDoneOffered('superintendent')).toBe(true)
    for (const role of ['dev', 'master_technician', 'assistant', 'estimator', 'primary', 'controller'] as const) {
      expect(pctDoneOffered(role), role).toBe(false)
    }
    expect(pctDoneOffered(null)).toBe(false)
  })

  it('Clock out is the quiet link’s rule: an open session, hourly, and Wrap Up Day not the day’s press', () => {
    expect(clockOutOffered({ sessionOpen: true, canClockOut: true, dayPressKind: 'next' })).toBe(true)
    expect(clockOutOffered({ sessionOpen: false, canClockOut: true, dayPressKind: 'next' })).toBe(false)
    expect(clockOutOffered({ sessionOpen: true, canClockOut: false, dayPressKind: 'next' })).toBe(false)
    expect(clockOutOffered({ sessionOpen: true, canClockOut: true, dayPressKind: 'wrap-up' })).toBe(false)
  })
})

describe('buildJobModePressBar — the rows', () => {
  it('a helper clocked in mid-day: three small buttons over Leave report and On my way, nothing dead', () => {
    const rows = buildJobModePressBar({ dayPress: onMyWay(), role: 'helpers', sessionOpen: true, canClockOut: true, hasCurrentJob: true })
    expect(ids(rows.top)).toEqual(['turnaway', 'pct-done', 'clock-out'])
    expect(rows.top.map((b) => b.label)).toEqual(['Turnaway', '% done', 'Clock out'])
    expect(rows.top.every((b) => !b.disabled)).toBe(true)
    expect(rows.bottom).toEqual([
      { id: 'leave-report', label: 'Leave report', disabled: false },
      { id: 'day-press', label: 'On my way', disabled: false },
    ])
  })

  it('a master clocked in: % done is hidden, not dead, and the rest share the row', () => {
    const rows = buildJobModePressBar({ dayPress: onMyWay(), role: 'master_technician', sessionOpen: true, canClockOut: true, hasCurrentJob: true })
    expect(ids(rows.top)).toEqual(['turnaway', 'clock-out'])
  })

  it('salaried: no Clock out; on the last job the hourly’s Clock out yields to Wrap Up Day', () => {
    const salaried = buildJobModePressBar({ dayPress: onMyWay(), role: 'helpers', sessionOpen: true, canClockOut: false, hasCurrentJob: true })
    expect(ids(salaried.top)).toEqual(['turnaway', 'pct-done'])
    const last = pickJobModeDayPress({ leg: 'on-site', state: 'on-scheduled-job-last', hasNextBlock: false, canClockOut: true })
    const wrap = buildJobModePressBar({ dayPress: last, role: 'helpers', sessionOpen: true, canClockOut: true, hasCurrentJob: true })
    expect(ids(wrap.top)).toEqual(['turnaway', 'pct-done'])
    expect(wrap.bottom[1]).toEqual({ id: 'day-press', label: 'Wrap Up Day', disabled: false })
  })

  it('not clocked in: Turnaway and Leave report are dead, % done and Clock out are hidden, the day’s press stands', () => {
    const first = pickJobModeDayPress({ leg: 'unmarked', state: 'not-clocked-in-with-schedule', hasNextBlock: true, canClockOut: true })
    const rows = buildJobModePressBar({ dayPress: first, role: 'helpers', sessionOpen: false, canClockOut: true, hasCurrentJob: false })
    expect(rows.top).toEqual([{ id: 'turnaway', label: 'Turnaway', disabled: true }])
    expect(rows.bottom).toEqual([
      { id: 'leave-report', label: 'Leave report', disabled: true },
      { id: 'day-press', label: 'On my way', disabled: false },
    ])
  })

  it('clocked into a bid: no job, so Turnaway and Leave report are dead and % done hidden, but Clock out shows', () => {
    const bid = pickJobModeDayPress({ leg: 'unmarked', state: 'on-bid', hasNextBlock: false, canClockOut: true })
    const rows = buildJobModePressBar({ dayPress: bid, role: 'subcontractor', sessionOpen: true, canClockOut: true, hasCurrentJob: false })
    expect(ids(rows.top)).toEqual(['turnaway', 'clock-out'])
    expect(rows.top[0]!.disabled).toBe(true)
    expect(rows.bottom[0]!.disabled).toBe(true)
    expect(rows.bottom[1]!.label).toBe('Choose Next Job')
  })

  it('salaried on the last job: the day’s press is dead and grey, the only dead button on the bar', () => {
    const last = pickJobModeDayPress({ leg: 'on-site', state: 'on-scheduled-job-last', hasNextBlock: false, canClockOut: false })
    const rows = buildJobModePressBar({ dayPress: last, role: 'superintendent', sessionOpen: true, canClockOut: false, hasCurrentJob: true })
    expect(ids(rows.top)).toEqual(['turnaway', 'pct-done'])
    expect(rows.bottom[1]).toEqual({ id: 'day-press', label: 'Last job of the day', disabled: true })
    expect(rows.bottom[0]!.disabled).toBe(false)
  })
})

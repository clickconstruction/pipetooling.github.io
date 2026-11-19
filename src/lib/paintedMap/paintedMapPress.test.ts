/**
 * The Dashboard's Paint a map press (punch list #392, step 1): which job it lands on in each state
 * the card names, and the words under it. Every job here is made up.
 */
import { describe, expect, it } from 'vitest'
import { PAINT_PRESS_WORDS, paintPressHome, paintPressJobLabel, paintPressLanding, paintPressLine, paintPressShape, type PaintPressJob, type PaintPressStop } from './paintedMapPress'

const cedar: PaintPressJob = { id: 'j-cedar', number: 'J2417', name: 'Cedar Hollow 12', address: '1208 Wrenfield Loop' }
const marlowe: PaintPressJob = { id: 'j-marlowe', number: 'J2398', name: 'Marlowe Dental', address: '40 Made Up Road' }
const pinto: PaintPressJob = { id: 'j-pinto', number: 'J2431', name: 'Pinto Ridge 3', address: '3 Pinto Ridge' }
const billing: PaintPressJob = { id: 'j-bill', number: 'J2000', name: 'Billing only', address: null, billingOnly: true }

const stop = (job: PaintPressJob, timeStart: string, timeEnd: string): PaintPressStop => ({ job, timeStart, timeEnd })
const day: PaintPressStop[] = [stop(marlowe, '07:00:00', '09:00:00'), stop(cedar, '09:30:00', '12:00:00'), stop(pinto, '13:00:00', '15:00:00')]
const at = (h: number, m = 0) => h * 60 + m

describe('paintPressLanding', () => {
  it('clocked onto a job: that job, whatever the schedule says', () => {
    expect(paintPressLanding({ clock: { job: pinto }, todayStops: day, nowMinutes: at(8) })).toEqual({ kind: 'job', job: pinto, why: 'clocked' })
    // A job that is on no stop today is still the job the person is standing on.
    expect(paintPressLanding({ clock: { job: cedar }, todayStops: [], nowMinutes: at(8) })).toEqual({ kind: 'job', job: cedar, why: 'clocked' })
  })

  it('clocked onto the office or a bid is not a job: the schedule answers', () => {
    expect(paintPressLanding({ clock: { job: null }, todayStops: day, nowMinutes: at(10) })).toEqual({ kind: 'job', job: cedar, why: 'schedule' })
    expect(paintPressLanding({ clock: { job: null }, todayStops: [], nowMinutes: at(10) })).toEqual({ kind: 'pick' })
  })

  it('clocked onto a billing-only job is not a job either', () => {
    expect(paintPressLanding({ clock: { job: billing }, todayStops: [], nowMinutes: at(10) })).toEqual({ kind: 'pick' })
    expect(paintPressLanding({ clock: { job: billing }, todayStops: day, nowMinutes: at(6) })).toEqual({ kind: 'job', job: marlowe, why: 'schedule' })
  })

  it('not clocked in: the stop under way, else the next one', () => {
    expect(paintPressLanding({ clock: null, todayStops: day, nowMinutes: at(6) }).kind === 'job' && paintPressLanding({ clock: null, todayStops: day, nowMinutes: at(6) })).toMatchObject({ job: marlowe })
    // 10:15 is inside Cedar Hollow's stop.
    expect(paintPressLanding({ clock: null, todayStops: day, nowMinutes: at(10, 15) })).toMatchObject({ kind: 'job', job: cedar, why: 'schedule' })
    // 12:30 is between two stops: the next one.
    expect(paintPressLanding({ clock: null, todayStops: day, nowMinutes: at(12, 30) })).toMatchObject({ job: pinto })
    // A stop ends at 09:00: at 09:00 it is over.
    expect(paintPressLanding({ clock: null, todayStops: day, nowMinutes: at(9) })).toMatchObject({ job: cedar })
  })

  it('every stop over: the last one of the day', () => {
    expect(paintPressLanding({ clock: null, todayStops: day, nowMinutes: at(17) })).toMatchObject({ kind: 'job', job: pinto, why: 'schedule' })
  })

  it('reads the stops in order of start, however they arrive', () => {
    const shuffled = [day[2]!, day[0]!, day[1]!]
    expect(paintPressLanding({ clock: null, todayStops: shuffled, nowMinutes: at(6) })).toMatchObject({ job: marlowe })
  })

  it('a billing-only stop is skipped, and a day of them is a pick', () => {
    expect(paintPressLanding({ clock: null, todayStops: [stop(billing, '07:00:00', '08:00:00'), stop(cedar, '09:00:00', '10:00:00')], nowMinutes: at(6) })).toMatchObject({ job: cedar })
    expect(paintPressLanding({ clock: null, todayStops: [stop(billing, '07:00:00', '08:00:00')], nowMinutes: at(6) })).toEqual({ kind: 'pick' })
  })

  it('nothing today: the person picks', () => {
    expect(paintPressLanding({ clock: null, todayStops: [], nowMinutes: at(10) })).toEqual({ kind: 'pick' })
  })
})

describe('the words', () => {
  it('names a job as the start sheet does', () => {
    expect(paintPressJobLabel(cedar)).toBe('J2417 · Cedar Hollow 12')
    expect(paintPressJobLabel({ number: null, name: ' Cedar Hollow 12 ' })).toBe('Cedar Hollow 12')
    expect(paintPressJobLabel({ number: 'J2417', name: null })).toBe('J2417')
    expect(paintPressJobLabel({ number: null, name: null })).toBeNull()
  })

  it('says where the map will land under the press', () => {
    expect(paintPressLine({ kind: 'job', job: cedar, why: 'clocked' })).toBe('On J2417 · Cedar Hollow 12')
    expect(paintPressLine({ kind: 'job', job: { id: 'x', number: null, name: null, address: null }, why: 'clocked' })).toBe('On the job you are on')
    expect(paintPressLine({ kind: 'pick' })).toBe(PAINT_PRESS_WORDS.pick)
    expect(PAINT_PRESS_WORDS.aria('On J2417 · Cedar Hollow 12')).toBe('Paint a map. On J2417 · Cedar Hollow 12')
    expect(PAINT_PRESS_WORDS.aria(null)).toBe('Paint a map')
  })
})

describe('paintPressHome', () => {
  it('opens the start sheet on the job, with the job changeable', () => {
    expect(paintPressHome({ kind: 'job', job: cedar, why: 'schedule' })).toMatchObject({ jobId: 'j-cedar', label: 'J2417 · Cedar Hollow 12', address: '1208 Wrenfield Loop', canChangeJob: true, developmentId: null })
  })

  it('with no job, opens it as the header search does', () => {
    const home = paintPressHome({ kind: 'pick' })
    expect(home.jobId).toBeNull()
    expect(home.developmentId).toBeNull()
    expect(home.canChangeJob).toBeUndefined()
  })

  it('a job with no name or number is still a job', () => {
    expect(paintPressHome({ kind: 'job', job: { id: 'x', number: null, name: null, address: ' ' }, why: 'clocked' })).toMatchObject({ jobId: 'x', label: 'This job', address: null })
  })
})

describe('paintPressShape', () => {
  it('wide in Job Mode, a link on the office phone, a square beside the clock', () => {
    expect(paintPressShape({ hasClockSlot: false, quietSquares: false })).toBe('wide')
    expect(paintPressShape({ hasClockSlot: true, quietSquares: true })).toBe('link')
    expect(paintPressShape({ hasClockSlot: true, quietSquares: false })).toBe('square')
  })
})

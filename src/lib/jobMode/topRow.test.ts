/**
 * Job Mode's top row: which job the left pair is for, which squares draw, and their words. Every job here
 * is made up.
 */
import { describe, expect, it } from 'vitest'
import type { PaintPressJob, PaintPressStop } from '../paintedMap/paintedMapPress'
import {
  TOP_ROW_ARIA,
  TOP_ROW_NO_DAY,
  TOP_ROW_OWN,
  topRowBadge,
  topRowHoursValue,
  topRowJobState,
  topRowOnSitePath,
  topRowSquares,
  topRowTarget,
  topRowTomorrowValue,
  type TopRowDay,
} from './topRow'

const cedar: PaintPressJob = { id: 'j-cedar', number: 'J2417', name: 'Cedar Hollow 12', address: '1208 Wrenfield Loop' }
const pinto: PaintPressJob = { id: 'j-pinto', number: 'J2431', name: 'Pinto Ridge 3', address: '3 Pinto Ridge' }
const office: PaintPressJob = { id: 'j-office', number: 'OH', name: 'Office', address: '1 Shop Rd', office: true }
const bill: PaintPressJob = { id: 'j-bill', number: 'J9', name: 'Billing line', address: null, billingOnly: true }
const stop = (job: PaintPressJob, timeStart: string, timeEnd: string): PaintPressStop => ({ job, timeStart, timeEnd })
const day = (d: Partial<TopRowDay>): TopRowDay => ({ ...TOP_ROW_NO_DAY, ...d })

describe('topRowJobState', () => {
  it('nothing scheduled and not clocked in: no job', () => {
    expect(topRowJobState(TOP_ROW_NO_DAY)).toEqual({ kind: 'none' })
  })

  it('before the first job: the first stop by start, whatever order the rows came in', () => {
    const d = day({ todayStops: [stop(pinto, '11:30:00', '14:00:00'), stop(cedar, '08:00:00', '11:00:00')] })
    expect(topRowJobState(d)).toEqual({ kind: 'ahead', job: cedar })
  })

  it('a stop already visited today is passed over for the next one', () => {
    const d = day({ todayStops: [stop(cedar, '08:00:00', '11:00:00'), stop(pinto, '11:30:00', '14:00:00')], visitedJobIds: ['j-cedar'] })
    expect(topRowJobState(d)).toEqual({ kind: 'ahead', job: pinto })
  })

  it('a stop whose hour has passed is still owed until somebody clocks onto it', () => {
    // No clock reads the time of day here: an unvisited stop is ahead at any hour.
    const d = day({ todayStops: [stop(cedar, '06:00:00', '07:00:00')] })
    expect(topRowJobState(d)).toEqual({ kind: 'ahead', job: cedar })
  })

  it('every stop visited and clocked out: done for the day', () => {
    const d = day({ todayStops: [stop(cedar, '08:00:00', '11:00:00')], visitedJobIds: ['j-cedar'] })
    expect(topRowJobState(d)).toEqual({ kind: 'none' })
  })

  it('clocked onto a job, the drive begun: on the way to it', () => {
    const d = day({ clock: { job: cedar, leg: 'on-the-way' }, todayStops: [stop(cedar, '08:00:00', '11:00:00')] })
    expect(topRowJobState(d)).toEqual({ kind: 'on-the-way', job: cedar })
  })

  it('clocked onto a job and arrived, or punched in by hand with no stamps: on site', () => {
    expect(topRowJobState(day({ clock: { job: cedar, leg: 'on-site' } }))).toEqual({ kind: 'on-site', job: cedar })
    expect(topRowJobState(day({ clock: { job: cedar, leg: 'unmarked' } }))).toEqual({ kind: 'on-site', job: cedar })
  })

  it('the clocked job wins over the schedule', () => {
    const d = day({ clock: { job: pinto, leg: 'on-site' }, todayStops: [stop(cedar, '08:00:00', '11:00:00')] })
    expect(topRowJobState(d)).toEqual({ kind: 'on-site', job: pinto })
  })

  it('clocked onto the office or a bid: the next stop still owed, else no job', () => {
    expect(topRowJobState(day({ clock: { job: null, leg: 'unmarked' }, todayStops: [stop(cedar, '13:00:00', '15:00:00')] }))).toEqual({ kind: 'ahead', job: cedar })
    expect(topRowJobState(day({ clock: { job: office, leg: 'unmarked' } }))).toEqual({ kind: 'none' })
  })

  it('never the office job or a billing-only job, clocked or scheduled', () => {
    const d = day({ clock: { job: bill, leg: 'on-site' }, todayStops: [stop(office, '07:00:00', '15:00:00'), stop(bill, '08:00:00', '09:00:00')] })
    expect(topRowJobState(d)).toEqual({ kind: 'none' })
  })
})

describe('topRowSquares', () => {
  it('ends on the two that never move, in the same order, in every state', () => {
    const states = [topRowJobState(TOP_ROW_NO_DAY), { kind: 'ahead', job: cedar } as const, { kind: 'on-the-way', job: cedar } as const, { kind: 'on-site', job: cedar } as const]
    for (const s of states) expect(topRowSquares(s, 12).slice(-2)).toEqual([...TOP_ROW_OWN])
    expect([...TOP_ROW_OWN]).toEqual(['paint', 'spend'])
  })

  it('a job ahead, or on the way: Directions and Job details', () => {
    expect(topRowSquares({ kind: 'ahead', job: cedar })).toEqual(['directions', 'job-details', 'paint', 'spend'])
    expect(topRowSquares({ kind: 'on-the-way', job: cedar })).toEqual(['directions', 'job-details', 'paint', 'spend'])
  })

  it('on site: Photo takes the first place and Job details keeps the second', () => {
    expect(topRowSquares({ kind: 'on-site', job: cedar })).toEqual(['photo', 'job-details', 'paint', 'spend'])
  })

  it('On site is a fifth square only on a site that holds boxes, and only while there', () => {
    expect(topRowSquares({ kind: 'on-site', job: cedar }, 93)).toEqual(['photo', 'job-details', 'on-site', 'paint', 'spend'])
    expect(topRowSquares({ kind: 'on-site', job: cedar }, 0)).toEqual(['photo', 'job-details', 'paint', 'spend'])
    expect(topRowSquares({ kind: 'on-site', job: cedar }, null)).toEqual(['photo', 'job-details', 'paint', 'spend'])
    expect(topRowSquares({ kind: 'ahead', job: cedar }, 93)).not.toContain('on-site')
  })

  it('a job with no address draws without Directions', () => {
    expect(topRowSquares({ kind: 'ahead', job: { ...cedar, address: ' ' } })).toEqual(['job-details', 'paint', 'spend'])
  })

  it('no job left today: this week and tomorrow', () => {
    expect(topRowSquares({ kind: 'none' }, 93)).toEqual(['hours', 'tomorrow', 'paint', 'spend'])
  })
})

describe('the words', () => {
  it('the week to one decimal, a whole number without it, nothing when not read', () => {
    expect(topRowHoursValue(28.94)).toBe('28.9 h')
    expect(topRowHoursValue(40)).toBe('40 h')
    expect(topRowHoursValue(39.96)).toBe('40 h')
    expect(topRowHoursValue(0)).toBe('0 h')
    expect(topRowHoursValue(null)).toBeNull()
    expect(topRowHoursValue(Number.NaN)).toBeNull()
  })

  it('tomorrow as a count', () => {
    expect(topRowTomorrowValue(2)).toBe('2 jobs')
    expect(topRowTomorrowValue(1)).toBe('1 job')
    expect(topRowTomorrowValue(0)).toBe('No jobs')
    expect(topRowTomorrowValue(null)).toBeNull()
  })

  it('a badge only for a count above none', () => {
    expect(topRowBadge(2)).toBe('2')
    expect(topRowBadge(140)).toBe('99+')
    expect(topRowBadge(0)).toBeNull()
    expect(topRowBadge(null)).toBeNull()
  })

  it('a screen reader hears each square by its visible name first', () => {
    expect(TOP_ROW_ARIA.directions(cedar)).toBe('Directions to J2417 · Cedar Hollow 12')
    expect(TOP_ROW_ARIA.jobDetails({ id: 'x', number: null, name: null, address: null })).toBe('Job details, this job')
    expect(TOP_ROW_ARIA.photo(cedar)).toBe('Photo: add one to J2417 · Cedar Hollow 12')
    expect(TOP_ROW_ARIA.onSite(1)).toBe('On site: 1 box of materials on this site')
    expect(TOP_ROW_ARIA.onSite(93)).toBe('On site: 93 boxes of materials on this site')
    expect(TOP_ROW_ARIA.hours('28.9 h')).toBe('This week: 28.9 h so far. Open your hours')
    expect(TOP_ROW_ARIA.hours(null)).toBe('My hours: open your hours')
    expect(TOP_ROW_ARIA.tomorrow('No jobs')).toBe('Tomorrow: no jobs. Open the schedule')
    expect(TOP_ROW_ARIA.tomorrow(null)).toBe('Schedule: open the schedule')
    expect(TOP_ROW_ARIA.spend(2)).toBe('My spend: 2 charges to put on a job')
    expect(TOP_ROW_ARIA.spend(1)).toBe('My spend: 1 charge to put on a job')
    expect(TOP_ROW_ARIA.spend(null)).toBe('My spend: your card charges')
  })

  it('the press record and the On site door', () => {
    expect(topRowTarget('job-details')).toBe('#job-details')
    expect(topRowOnSitePath('j-cedar')).toBe('/tally?tab=on-site&job=j-cedar')
  })
})

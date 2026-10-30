import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { StaleStaffRow } from './teamPurchaseRows'
import type { TallyQueueCard } from './tallyTeamQueue'
import { suggestTallyDay } from './tallySortSuggestion'
import {
  buildTallyDayStrip,
  parseTallyDayStripStored,
  tallyDayStripFromCard,
  tallyDayStripStorageKey,
  tallyGapWords,
  tallyJobShortName,
  tallyStripLeadJobId,
  tallyTickPlaceWords,
  type TallyTickPlace,
} from './tallyDayStrip'

// A Tuesday in Chicago daylight time; "now" is two days on, so the day is past.
const YMD = '2026-09-30'
const at = (hm: string, day = YMD) => `${day}T${hm}:00-05:00`
const NOW = Date.parse('2026-10-02T09:00:00-05:00')
const NAMES: Record<string, string> = { 'job-a': 'JP101', 'job-b': 'JP202', 'job-c': 'JP303' }
const name = (id: string) => NAMES[id] ?? id

const session = (jobId: string, inHm: string, outHm: string | null) => ({
  jobId,
  clockedInAt: at(inHm),
  clockedOutAt: outHm ? at(outHm) : null,
})
const charge = (id: string, hm: string, amount = -10) => ({ id, madeAt: at(hm), amount })

describe('buildTallyDayStrip', () => {
  it('draws 6 AM to 8 PM, a session as a bar, a schedule block hollow, and each swipe a tick with its place', () => {
    const strip = buildTallyDayStrip({
      ymd: YMD,
      sessions: [session('job-a', '07:02', '15:40')],
      scheduled: [{ jobId: 'job-a', timeStart: '07:00:00', timeEnd: '15:30:00' }],
      charges: [charge('c-supply', '09:14', -286.4), charge('c-fuel', '18:52', -71.3)],
      nowMs: NOW,
    })
    expect(strip.startMs).toBe(Date.parse(at('06:00')))
    expect(strip.endMs).toBe(Date.parse(at('20:00')))
    expect(strip.bars.map((b) => [b.kind, b.jobId, b.colour, b.startPct, b.endPct, b.open])).toEqual([
      ['clocked', 'job-a', 0, 7.4, 69, false],
      ['scheduled', 'job-a', 0, 7.1, 67.9, false],
    ])
    expect(strip.ticks.map((t) => [t.chargeId, t.pct, t.amount, t.place])).toEqual([
      ['c-supply', 23.1, -286.4, { kind: 'inside', jobId: 'job-a' }],
      ['c-fuel', 91.9, -71.3, { kind: 'after', jobId: 'job-a', gapMs: 192 * 60_000 }],
    ])
    expect(strip.labels).toEqual([
      { pct: 23.1, row: 0, count: 1, amount: -286.4 },
      { pct: 91.9, row: 0, count: 1, amount: -71.3 },
    ])
    expect(strip.hours.map((h) => [h.hour, h.label])).toEqual([
      [6, '6 AM'],
      [7, null],
      [8, null],
      [9, '9'],
      [10, null],
      [11, null],
      [12, 'noon'],
      [13, null],
      [14, null],
      [15, '3'],
      [16, null],
      [17, null],
      [18, '6'],
      [19, null],
      [20, '8 PM'],
    ])
    expect(strip.hours[0]!.pct).toBe(0)
    expect(strip.hours[14]!.pct).toBe(100)
    expect(strip.nowPct).toBeNull()
  })

  it('widens to the hour around an early clock-in or a late swipe, never past the day', () => {
    const strip = buildTallyDayStrip({
      ymd: YMD,
      sessions: [session('job-a', '05:30', '14:00')],
      scheduled: [],
      charges: [charge('c-late', '21:20')],
      nowMs: NOW,
    })
    expect(strip.hours[0]).toEqual({ hour: 5, pct: 0, label: '5 AM' })
    expect(strip.hours[strip.hours.length - 1]).toEqual({ hour: 22, pct: 100, label: '10 PM' })
    const over = buildTallyDayStrip({
      ymd: YMD,
      sessions: [{ jobId: 'job-a', clockedInAt: at('18:00'), clockedOutAt: at('01:00', '2026-10-01') }],
      scheduled: [],
      charges: [],
      nowMs: NOW,
    })
    expect(over.hours[over.hours.length - 1]).toEqual({ hour: 24, pct: 100, label: '12 AM' })
    expect(over.bars[0]!.endPct).toBe(100)
  })

  it('places a swipe before the first clock-in, between two sessions, and in scheduled hours never clocked', () => {
    const strip = buildTallyDayStrip({
      ymd: YMD,
      sessions: [session('job-a', '07:00', '11:00'), session('job-b', '13:00', '16:00')],
      scheduled: [{ jobId: 'job-c', timeStart: '16:30:00', timeEnd: '18:00:00' }],
      charges: [charge('c-early', '06:30'), charge('c-noon', '12:00'), charge('c-sched', '17:00'), charge('c-edge', '11:00')],
      nowMs: NOW,
    })
    const places = Object.fromEntries(strip.ticks.map((t) => [t.chargeId, t.place]))
    expect(places).toEqual({
      'c-early': { kind: 'before', jobId: 'job-a', gapMs: 30 * 60_000 },
      'c-edge': { kind: 'inside', jobId: 'job-a' },
      'c-noon': { kind: 'between', afterJobId: 'job-a', beforeJobId: 'job-b', gapMs: 60 * 60_000 },
      'c-sched': { kind: 'scheduled', jobId: 'job-c' },
    })
    expect(strip.bars.map((b) => [b.jobId, b.colour])).toEqual([
      ['job-a', 0],
      ['job-b', 1],
      ['job-c', 2],
    ])
  })

  it('a session with no clock-out runs to now on today, and to the strip’s end on a past day', () => {
    const now = Date.parse(at('10:00'))
    const today = buildTallyDayStrip({ ymd: YMD, sessions: [session('job-a', '07:00', null)], scheduled: [], charges: [charge('c', '09:00')], nowMs: now })
    expect(today.bars[0]).toMatchObject({ open: true, endMs: now })
    expect(today.ticks[0]!.place).toEqual({ kind: 'inside', jobId: 'job-a' })
    expect(today.nowPct).toBe(today.bars[0]!.endPct)
    const past = buildTallyDayStrip({
      ymd: YMD,
      sessions: [session('job-a', '07:00', null)],
      scheduled: [],
      charges: [charge('c-after', '09:00'), charge('c-before', '06:30')],
      nowMs: NOW,
    })
    expect(past.bars[0]).toMatchObject({ open: true, endMs: past.endMs, endPct: 100 })
    expect(Object.fromEntries(past.ticks.map((t) => [t.chargeId, t.place]))).toEqual({
      'c-before': { kind: 'before', jobId: 'job-a', gapMs: 30 * 60_000 },
      'c-after': { kind: 'open', jobId: 'job-a' },
    })
  })

  it('a day with nothing clocked or scheduled places every swipe off the clock', () => {
    const strip = buildTallyDayStrip({ ymd: YMD, sessions: [], scheduled: [{ jobId: 'job-a', timeStart: null, timeEnd: null }], charges: [charge('c', '09:00')], nowMs: NOW })
    expect(strip.bars).toEqual([])
    expect(strip.ticks[0]!.place).toEqual({ kind: 'none' })
  })

  it('two swipes close together take two label rows, a third in the same room joins the label before it; unreadable times are left out', () => {
    const strip = buildTallyDayStrip({
      ymd: YMD,
      sessions: [],
      scheduled: [],
      charges: [charge('c-1', '09:00', -10), charge('c-2', '09:30', -20), charge('c-3', '14:00', -30), { id: 'c-bad', madeAt: 'nope', amount: -1 }],
      nowMs: NOW,
    })
    expect(strip.ticks.map((t) => t.chargeId)).toEqual(['c-1', 'c-2', 'c-3'])
    expect(strip.labels).toEqual([
      { pct: 21.4, row: 0, count: 1, amount: -10 },
      { pct: 25, row: 1, count: 1, amount: -20 },
      { pct: 57.1, row: 0, count: 1, amount: -30 },
    ])
    // Three swipes in half an hour: the first alone, the other two as one label at their middle.
    const crowd = buildTallyDayStrip({
      ymd: YMD,
      sessions: [],
      scheduled: [],
      charges: [charge('c-1', '08:17', -40.12), charge('c-2', '08:28', -136.91), charge('c-3', '08:44', -153.92), charge('c-4', '11:00', -5)],
      nowMs: NOW,
    })
    expect(crowd.labels).toEqual([
      { pct: 16.3, row: 0, count: 1, amount: -40.12 },
      { pct: 18.6, row: 1, count: 2, amount: -290.83 },
      { pct: 35.7, row: 0, count: 1, amount: -5 },
    ])
  })

  it('reads a Team queue card: its clocked spans and its charges', () => {
    const charges = [
      { id: 'c-1', holderId: 'u-ann', madeAt: at('09:14'), amount: -20, counterparty: 'Ridge Supply', category: null },
      { id: 'c-2', holderId: 'u-ann', madeAt: at('18:52'), amount: -30, counterparty: 'Corner Fuel', category: 'FuelAndGas' },
    ]
    const suggestion = suggestTallyDay({
      holderId: 'u-ann',
      ymd: YMD,
      charges,
      sessions: [{ workDate: YMD, jobId: 'job-a', clockedInAt: at('07:02'), clockedOutAt: at('15:40') }],
      scheduled: [],
      history: [],
      officeJobId: null,
      nowMs: NOW,
    })
    const card: TallyQueueCard = {
      holderId: 'u-ann',
      holderName: 'Ann',
      ymd: YMD,
      charges: charges.map((charge) => ({ row: {} as StaleStaffRow, charge })),
      total: -50,
      suggestion,
      sorted: [],
    }
    const strip = tallyDayStripFromCard(card, [{ jobId: 'job-a', timeStart: '07:00', timeEnd: '15:30' }], NOW)
    expect(strip.bars.map((b) => b.kind)).toEqual(['clocked', 'scheduled'])
    expect(strip.ticks.map((t) => t.place.kind)).toEqual(['inside', 'after'])
  })
})

describe('the words and the lead', () => {
  const PLACES: Record<TallyTickPlace['kind'], TallyTickPlace> = {
    inside: { kind: 'inside', jobId: 'job-a' },
    scheduled: { kind: 'scheduled', jobId: 'job-a' },
    before: { kind: 'before', jobId: 'job-a', gapMs: 30 * 60_000 },
    between: { kind: 'between', afterJobId: 'job-a', beforeJobId: 'job-b', gapMs: 90 * 60_000 },
    after: { kind: 'after', jobId: 'job-a', gapMs: 192 * 60_000 },
    open: { kind: 'open', jobId: 'job-a' },
    none: { kind: 'none' },
  }

  it('says each place in a few plain words', () => {
    expect(Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, tallyTickPlaceWords(p, name)]))).toEqual({
      inside: 'in JP101’s hours',
      scheduled: 'in JP101’s scheduled hours, not clocked',
      before: '30 min before clock-in',
      between: '1.5 h between JP101 and JP202',
      after: '3 h after clock-out',
      open: 'after clock-in on JP101, with no clock-out',
      none: 'off the clock all day',
    })
    for (const p of Object.values(PLACES)) expect(plainWordsFailures(tallyTickPlaceWords(p, name))).toEqual([])
  })

  it('leads the picker only from a session or a schedule block', () => {
    expect(Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, tallyStripLeadJobId(p)]))).toEqual({
      inside: 'job-a',
      scheduled: 'job-a',
      before: null,
      between: null,
      after: null,
      open: null,
      none: null,
    })
  })

  it('rounds a gap to 5 minutes under an hour and to a half hour over', () => {
    expect([2, 7, 29, 58].map((m) => tallyGapWords(m * 60_000))).toEqual(['5 min', '5 min', '30 min', '1 h'])
    expect([60, 75, 192, 600].map((m) => tallyGapWords(m * 60_000))).toEqual(['1 h', '1.5 h', '3 h', '10 h'])
  })

  it('shortens a job line to its number', () => {
    expect(['JP101 · Hill Street', 'a job', 'Office', 'JP101 — Hill', '  '].map(tallyJobShortName)).toEqual(['JP101', 'a job', 'Office', 'JP101', ''])
  })

  it('keeps the switch per person, off until turned on', () => {
    expect(tallyDayStripStorageKey('u-1')).toBe('tally_team_day_strip_u-1')
    expect(['1', '0', 'true', null, undefined].map(parseTallyDayStripStored)).toEqual([true, false, false, false, false])
  })
})

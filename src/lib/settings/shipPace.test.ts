import { describe, expect, it } from 'vitest'
import {
  clockWords,
  countWords,
  hourLabel,
  hourStartMs,
  hoursWords,
  insideWords,
  median,
  paceAsOfWords,
  paceFreshness,
  paceHeadlineWords,
  paceNowFigure,
  paceNowSmallWords,
  paceNowWords,
  paceTicks,
  paceYMax,
  parseShipPacePicture,
  percentile,
  type PacePr,
  SHIP_PACE_KEY,
  SHIP_PACE_NOW_HOURS,
  shipPacePicture,
} from '../../../supabase/functions/_shared/shipPace'

/**
 * How fast a change ships (v2.6399): the rules behind the Settings section, pinned with made-up pull requests across
 * a day boundary and the fall-back night of 2026-11-01 (2:00 AM CDT became 1:00 AM CST, so 06:00Z and 07:00Z are
 * both 1 AM on the wall). Now is Monday 2026-11-02 at 3:37 PM Central (21:37Z).
 */
const NOW = '2026-11-02T21:37:37.000Z'

let n = 1000
function pr(createdAt: string, mergedAt: string | null, over: Partial<PacePr> = {}): PacePr {
  n += 1
  return { number: n, createdAt, mergedAt, closedAt: mergedAt, draft: false, ...over }
}

function picture(prs: PacePr[], over: Partial<Parameters<typeof shipPacePicture>[0]> = {}) {
  return shipPacePicture({ now: NOW, prs, queueRuns: null, queueNow: null, ...over })
}

const hourAt = (p: ReturnType<typeof picture>, t: string) => p.hours.find((h) => h.t === t)

describe('shipPace — the series', () => {
  it('runs the last 72 hours by the hour, the hour holding now last, labelled on the app calendar', () => {
    const p = picture([])
    expect(p.hours).toHaveLength(73)
    expect(p.windowStart).toBe('2026-10-30T21:00:00.000Z')
    expect(p.hours[0]).toMatchObject({ t: '2026-10-30T21:00:00.000Z', label: 'Fri 4p' })
    expect(p.hours[72]).toMatchObject({ t: '2026-11-02T21:00:00.000Z', label: 'Mon 3p' })
    expect(p.asOf).toBe(NOW)
  })

  it('counts a pull request in the hour it merged, the median over that hour, and an hour with none is a gap', () => {
    const p = picture([
      pr('2026-11-02T13:00:00Z', '2026-11-02T14:10:00Z'), // 1.2 h
      pr('2026-11-02T12:00:00Z', '2026-11-02T14:20:00Z'), // 2.3 h
      pr('2026-11-02T04:00:00Z', '2026-11-02T14:40:00Z'), // 10.7 h
    ])
    const two = hourAt(p, '2026-11-02T14:00:00.000Z')
    expect(two).toMatchObject({ label: 'Mon 8a', merged: 3, cycleMedianH: 2.3 })
    const quiet = hourAt(p, '2026-11-02T15:00:00.000Z')
    expect(quiet).toMatchObject({ merged: 0, cycleMedianH: null })
    expect(p.hours.filter((h) => h.cycleMedianH != null)).toHaveLength(1)
  })

  it('a closed, unmerged pull request is not a merge; a draft is open', () => {
    const p = picture([
      pr('2026-11-02T10:00:00Z', null, { closedAt: '2026-11-02T11:00:00Z' }),
      pr('2026-11-02T10:30:00Z', null, { draft: true }),
      pr('2026-11-02T10:40:00Z', null),
    ])
    expect(p.hours.every((h) => h.merged === 0 && h.cycleMedianH == null)).toBe(true)
    expect(p.now).toEqual({ open: 2, drafts: 1, queue: null })
    expect(p.last24h).toMatchObject({ merged: 0, created: 3, medianH: null, p90H: null })
  })

  it('open at each hour’s end: a pull request open from before the window counts in every hour until it closes', () => {
    const p = picture([
      pr('2026-10-20T10:00:00Z', '2026-11-01T18:30:00Z'), // merged Sun 1:30 PM CDT? No: 18:30Z on Nov 1 is 12:30 PM CST
      pr('2026-10-21T10:00:00Z', null),
    ])
    expect(hourAt(p, '2026-10-30T21:00:00.000Z')?.open).toBe(2)
    expect(hourAt(p, '2026-11-01T18:00:00.000Z')?.open).toBe(1)
    expect(hourAt(p, '2026-11-01T17:00:00.000Z')?.open).toBe(2)
    expect(hourAt(p, '2026-11-02T21:00:00.000Z')?.open).toBe(1)
  })

  it('counts an opening in its hour, and a pull request listed twice once', () => {
    const twice = pr('2026-11-02T20:05:00Z', null)
    const p = picture([twice, { ...twice }, pr('2026-11-02T20:50:00Z', null)])
    expect(hourAt(p, '2026-11-02T20:00:00.000Z')?.created).toBe(2)
    expect(p.now.open).toBe(2)
  })
})

describe('shipPace — the day boundary and the fall-back night', () => {
  it('a merge at 11:30 PM Central on Sunday is Sunday’s, and one at 12:10 AM Monday is today’s', () => {
    const p = picture([
      pr('2026-11-02T03:00:00Z', '2026-11-02T05:30:00Z'), // Sun 11:30 PM CST
      pr('2026-11-02T03:00:00Z', '2026-11-02T06:10:00Z'), // Mon 12:10 AM CST
    ])
    expect(hourAt(p, '2026-11-02T05:00:00.000Z')).toMatchObject({ label: 'Sun 11p', merged: 1 })
    expect(hourAt(p, '2026-11-02T06:00:00.000Z')).toMatchObject({ label: 'Mon 12a', merged: 1 })
    expect(p.today).toEqual({ ymd: '2026-11-02', created: 0, merged: 1 })
  })

  it('on the fall-back night the two 1 AM hours stay two buckets with one label each', () => {
    const p = picture([
      pr('2026-11-01T05:00:00Z', '2026-11-01T06:30:00Z'), // 1:30 AM CDT, 1.5 h
      pr('2026-11-01T04:00:00Z', '2026-11-01T07:30:00Z'), // 1:30 AM CST, 3.5 h
    ])
    const cdt = hourAt(p, '2026-11-01T06:00:00.000Z')
    const cst = hourAt(p, '2026-11-01T07:00:00.000Z')
    expect(cdt).toMatchObject({ label: 'Sun 1a', merged: 1, cycleMedianH: 1.5 })
    expect(cst).toMatchObject({ label: 'Sun 1a', merged: 1, cycleMedianH: 3.5 })
    expect(hourAt(p, '2026-11-01T08:00:00.000Z')?.label).toBe('Sun 2a')
    expect(hourAt(p, '2026-11-01T05:00:00.000Z')?.label).toBe('Sun 12a')
  })

  it('hourStartMs and hourLabel agree with the wall clock before and after the change', () => {
    expect(hourStartMs(Date.parse('2026-10-31T19:59:59Z'))).toBe(Date.parse('2026-10-31T19:00:00Z'))
    expect(hourLabel(Date.parse('2026-10-31T19:00:00Z'))).toBe('Sat 2p') // CDT
    expect(hourLabel(Date.parse('2026-11-02T19:00:00Z'))).toBe('Mon 1p') // CST
    expect(hourLabel(Date.parse('2026-11-02T18:00:00Z'))).toBe('Mon 12p')
  })
})

describe('shipPace — the headline', () => {
  it('the median and the 90th percentile are over the merges of the last 24 hours alone', () => {
    const p = picture([
      pr('2026-11-02T10:00:00Z', '2026-11-02T14:00:00Z'), // 4 h, inside
      pr('2026-11-02T10:00:00Z', '2026-11-02T12:00:00Z'), // 2 h, inside
      pr('2026-11-02T00:00:00Z', '2026-11-02T09:00:00Z'), // 9 h, inside
      pr('2026-10-31T00:00:00Z', '2026-11-01T20:00:00Z'), // 44 h, merged 25.6 h ago: outside
      pr('2026-11-02T18:00:00Z', null),
    ])
    expect(p.last24h).toEqual({ merged: 3, created: 4, medianH: 4, p90H: 9 })
  })

  it('median and percentile: even lists average the middle pair, the 90th is the nearest rank', () => {
    expect(median([])).toBeNull()
    expect(median([3])).toBe(3)
    expect(median([1, 2, 10, 4])).toBe(3)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9)
    expect(percentile([5], 90)).toBe(5)
    expect(percentile([], 90)).toBeNull()
  })

  it('says the two sentences the owner says out loud, and says so when nothing merged', () => {
    expect(paceHeadlineWords({ merged: 87, created: 131, medianH: 4.1, p90H: 8.5 })).toBe(
      'A change asked for today has been taking about 4 hours to reach the app. Nine in ten land inside 9 hours.',
    )
    expect(paceHeadlineWords({ merged: 0, created: 3, medianH: null, p90H: null })).toBe(
      'Nothing has merged in the last 24 hours, so there is no number for today yet.',
    )
    expect(hoursWords(0.5)).toBe('about half an hour')
    expect(hoursWords(1.2)).toBe('about an hour')
    expect(hoursWords(4.6)).toBe('about 5 hours')
    expect(insideWords(0.4)).toBe('inside an hour')
    expect(insideWords(8.01)).toBe('inside 9 hours')
  })
})

describe('shipPace — the solid number, the last six hours', () => {
  it('stands on the merges of the last 6 hours alone, with the oldest of them as its since', () => {
    expect(SHIP_PACE_NOW_HOURS).toBe(6)
    const p = picture([
      pr('2026-11-02T14:00:00Z', '2026-11-02T18:00:00Z'), // 4 h, merged 3.6 h ago: inside
      pr('2026-11-02T18:00:00Z', '2026-11-02T20:00:00Z'), // 2 h, inside
      pr('2026-11-02T12:00:00Z', '2026-11-02T21:00:00Z'), // 9 h, inside
      pr('2026-11-02T10:00:00Z', '2026-11-02T15:00:00Z'), // 5 h, merged 6.6 h ago: outside, still in the headline
      pr('2026-11-02T21:00:00Z', null),
    ])
    expect(p.recent).toEqual({ hours: 6, merged: 3, medianH: 4, meanH: 5, p90H: 9, since: '2026-11-02T18:00:00.000Z' })
    expect(p.last24h.merged).toBe(4)
  })

  it('says the figure, what it stands on and the small line; under an hour it says minutes', () => {
    const r = { hours: 6, merged: 21, medianH: 4.2, meanH: 4.3, p90H: 5.3, since: '2026-11-02T17:40:00Z' }
    expect(paceNowFigure(r)).toEqual({ value: '4.2', unit: 'hours' })
    expect(paceNowWords(r)).toBe('right now, the middle of the 21 merges in the last 6 hours, since 11:40 AM')
    expect(paceNowSmallWords(r)).toBe('mean 4.3 h · nine in ten inside 5.3 h')
    expect(paceNowFigure({ ...r, medianH: 0.9 })).toEqual({ value: '54', unit: 'minutes' })
    expect(paceNowWords({ ...r, merged: 1 })).toBe('right now, the middle of the one merge in the last 6 hours, since 11:40 AM')
    const none = { hours: 6, merged: 0, medianH: null, meanH: null, p90H: null, since: null }
    expect(paceNowFigure(none)).toBeNull()
    expect(paceNowWords(none)).toBe('Nothing merged in the last 6 hours, so there is no number right now.')
    expect(paceNowSmallWords(none)).toBe('')
  })
})

describe('shipPace — the queue, the row and the words around the chart', () => {
  it('the queue’s builds count in the hour they started, failures apart; null when Actions was not read', () => {
    const runs = [
      { createdAt: '2026-11-02T20:10:00Z', conclusion: 'success' },
      { createdAt: '2026-11-02T20:20:00Z', conclusion: 'failure' },
      { createdAt: '2026-11-02T20:30:00Z', conclusion: null },
      { createdAt: '2026-11-02T20:40:00Z', conclusion: 'cancelled' },
    ]
    const p = picture([], { queueRuns: runs, queueNow: 22 })
    expect(hourAt(p, '2026-11-02T20:00:00.000Z')).toMatchObject({ queueBuilds: 4, queueFailed: 1 })
    expect(hourAt(p, '2026-11-02T19:00:00.000Z')).toMatchObject({ queueBuilds: 0, queueFailed: 0 })
    expect(p.now.queue).toBe(22)
    const none = picture([])
    expect(none.hours.every((h) => h.queueBuilds == null && h.queueFailed == null)).toBe(true)
  })

  it('the row round-trips, and a malformed or older row reads as nothing', () => {
    const p = picture([pr('2026-11-02T10:00:00Z', '2026-11-02T14:00:00Z')])
    expect(parseShipPacePicture(JSON.stringify(p))).toEqual(p)
    expect(parseShipPacePicture(null)).toBeNull()
    expect(parseShipPacePicture('')).toBeNull()
    expect(parseShipPacePicture('{"v":0}')).toBeNull()
    expect(parseShipPacePicture(JSON.stringify({ ...p, recent: undefined }))).toBeNull()
    expect(parseShipPacePicture('not json')).toBeNull()
    expect(SHIP_PACE_KEY).toBe('ship_pace_v1')
  })

  it('as of: the clock in the app calendar, and a stale row says the reader may be stuck', () => {
    const nowMs = Date.parse(NOW)
    expect(clockWords('2026-11-02T21:37:37Z')).toBe('3:37 PM')
    expect(paceAsOfWords('2026-11-02T21:30:00Z', nowMs)).toBe('As of 3:30 PM.')
    expect(paceFreshness('2026-11-02T21:30:00Z', nowMs)).toEqual({ minutes: 8, stale: false })
    expect(paceFreshness('2026-11-02T20:10:00Z', nowMs)).toEqual({ minutes: 88, stale: true })
    expect(paceAsOfWords('2026-11-02T20:10:00Z', nowMs)).toBe('The last read was at 2:10 PM, more than an hour ago. The reader may be stuck. Ask a dev.')
    expect(paceAsOfWords('2026-11-01T20:10:00Z', nowMs)).toBe(
      'The last read was at 2:10 PM on 2026-11-01, more than an hour ago. The reader may be stuck. Ask a dev.',
    )
  })

  it('ticks every sixth hour by instant, and the y-axis top is a multiple of 4, never under 8', () => {
    const p = picture([pr('2026-11-01T00:00:00Z', '2026-11-01T17:48:00Z')]) // 17.8 h
    const ticks = paceTicks(p.hours)
    expect(ticks).toHaveLength(13)
    expect(ticks[0]).toBe('2026-10-30T21:00:00.000Z')
    expect(ticks[1]).toBe('2026-10-31T03:00:00.000Z')
    expect(paceYMax(p.hours)).toBe(20)
    expect(paceYMax(picture([]).hours)).toBe(8)
    expect(countWords(77, 'opened')).toBe('77 opened')
  })
})

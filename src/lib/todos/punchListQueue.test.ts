/** The merge queue on /punch-list (`punchListQueue.ts`): a line's values, merges an hour, the day hour by hour, the folded words and a dev's read on opening. */
import { describe, expect, it } from 'vitest'
import { shipPacePicture, type PacePr, type PaceQueueEntryInput, type ShipPacePicture } from '../../../supabase/functions/_shared/shipPace'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import {
  QUEUE_FRESH_MINUTES,
  dayHourLabel,
  dayHourTitle,
  dayHours,
  dayHoursLabel,
  dayHoursMax,
  inLineCount,
  inLineWords,
  mergesAnHour,
  mergesAnHourFigure,
  queueFoldedWords,
  queueRows,
  recentStretchWords,
  rowAgeMinutes,
  rowsHaveState,
  shouldReadOnOpen,
} from './punchListQueue'

/** Monday 2:41 PM on the app calendar (20:41 UTC). */
const NOW = '2026-11-02T20:41:00.000Z'
const nowMs = Date.parse(NOW)
const minutesAgo = (m: number): string => new Date(nowMs - m * 60_000).toISOString()

let n = 100
const merged = (at: string): PacePr => {
  n += 1
  return { number: n, createdAt: new Date(Date.parse(at) - 3_600_000).toISOString(), mergedAt: at, closedAt: at, draft: false }
}

const ENTRIES: PaceQueueEntryInput[] = [
  { number: 9002, title: 'v2.9002 Bills sent: the list of ways takes a thumb', position: 2, enqueuedAt: minutesAgo(8), estimatedSeconds: 480, state: 'MERGEABLE' },
  { number: 9001, title: 'v2.9001 Jobs: the stage bar keeps its place on a phone', position: 1, enqueuedAt: minutesAgo(9), estimatedSeconds: 180, state: 'AWAITING_CHECKS' },
  { number: 9003, title: 'docs: a walk’s two findings, written on their card', position: 3, enqueuedAt: minutesAgo(65), estimatedSeconds: null, state: 'QUEUED' },
  { number: 9004, title: 'v2.9004 A card’s history opens on its newest change', position: 4, enqueuedAt: minutesAgo(0.2), estimatedSeconds: 20 },
]

/** Today: one merge at 6 AM, three at 9 AM, two at 1 PM and one in the hour in progress; two more yesterday evening. */
const PICTURE: ShipPacePicture = shipPacePicture({
  now: NOW,
  prs: [
    merged('2026-11-02T12:10:00Z'),
    merged('2026-11-02T15:05:00Z'),
    merged('2026-11-02T15:20:00Z'),
    merged('2026-11-02T15:55:00Z'),
    merged('2026-11-02T19:10:00Z'),
    merged('2026-11-02T19:40:00Z'),
    merged('2026-11-02T20:30:00Z'),
    merged('2026-11-02T03:00:00Z'),
    merged('2026-11-02T04:30:00Z'),
  ],
  queueRuns: null,
  queue: { total: 4, entries: ENTRIES, open: [] },
})

describe('queueRows', () => {
  it('draws a line as its values apart, in the order the queue gave', () => {
    expect(queueRows(PICTURE.queue!.entries, nowMs)).toEqual([
      { number: 9001, place: '1st', title: 'Jobs: the stage bar keeps its place on a phone', state: 'Checks running', tone: 'running', waited: '9 minutes', toGo: 'about 3 minutes' },
      { number: 9002, place: '2nd', title: 'Bills sent: the list of ways takes a thumb', state: 'Ready', tone: 'ready', waited: '8 minutes', toGo: 'about 8 minutes' },
      { number: 9003, place: '3rd', title: 'docs: a walk’s two findings, written on their card', state: 'Waiting its turn', tone: 'waiting', waited: '1 hour 5 minutes', toGo: null },
      // The fourth came with no state: its line draws without a chip.
      { number: 9004, place: '4th', title: 'A card’s history opens on its newest change', state: '', tone: null, waited: 'under a minute', toGo: 'under a minute' },
    ])
    expect(rowsHaveState(queueRows(PICTURE.queue!.entries, nowMs))).toBe(true)
    // A row written before the function read the state: no entry has one, so the column stays away.
    const before = PICTURE.queue!.entries.map(({ state: _state, ...rest }) => rest)
    expect(rowsHaveState(queueRows(before, nowMs))).toBe(false)
  })

  it('lists the first ten, and never a negative wait', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ number: i + 1, title: `Change ${i + 1}`, position: i + 1, enqueuedAt: new Date(nowMs + 60_000).toISOString(), estimatedMinutes: 5 }))
    const rows = queueRows(many, nowMs)
    expect(rows).toHaveLength(10)
    expect(rows[0]!.waited).toBe('under a minute')
  })
})

describe('the count in line', () => {
  it('reads the queue’s own count, and says not read when the queue was not seen', () => {
    expect(inLineCount(PICTURE)).toBe(4)
    expect(inLineWords(PICTURE)).toBe('4 in line')
    expect(inLineWords({ now: { ...PICTURE.now, queue: 0 }, queue: { ...PICTURE.queue!, entries: [] } })).toBe('0 in line')
    expect(inLineCount({ now: { ...PICTURE.now, queue: null }, queue: null })).toBeNull()
    expect(inLineWords({ now: { ...PICTURE.now, queue: null }, queue: null })).toBe('not read')
  })
})

describe('merges an hour', () => {
  it('divides the recent stretch’s merges by its hours, to one decimal', () => {
    // Six merges since 8:41 AM: three in the 9 AM hour, two in the 1 PM hour and one at 2:30 PM.
    expect(PICTURE.recent).toMatchObject({ hours: 6, merged: 6 })
    expect(mergesAnHour(PICTURE.recent)).toBe(1)
    expect(mergesAnHourFigure(PICTURE.recent)).toBe('1')
    expect(mergesAnHour({ hours: 6, merged: 37 })).toBe(6.2)
    expect(mergesAnHour({ hours: 0, merged: 3 })).toBeNull()
    expect(mergesAnHourFigure({ hours: 0, merged: 3 })).toBe('—')
    expect(recentStretchWords(6)).toBe('over the last 6 hours')
    expect(recentStretchWords(1)).toBe('over the last hour')
  })
})

describe('dayHours', () => {
  it('lays today out as twenty-four hours from midnight, the hours to come left empty', () => {
    const hours = dayHours(PICTURE)
    expect(hours).toHaveLength(24)
    expect(hours.map((h) => h.merged)).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 2, 1, null, null, null, null, null, null, null, null, null])
    expect(hours.reduce((a, h) => a + (h.merged ?? 0), 0)).toBe(PICTURE.today.merged)
    // Yesterday evening's two merges (9 PM and 10:30 PM Sunday) are not today's.
    expect(PICTURE.today.merged).toBe(7)
    expect(dayHoursMax(hours)).toBe(3)
    expect(dayHoursMax(hours.map((h) => ({ ...h, merged: h.merged === null ? null : 0 })))).toBe(1)
  })

  it('names the hours and the busiest one', () => {
    expect([0, 6, 9, 12, 18, 23].map(dayHourLabel)).toEqual(['12a', '6a', '9a', '12p', '6p', '11p'])
    const hours = dayHours(PICTURE)
    expect(dayHoursLabel(hours, 7)).toBe('7 merged today. The busiest hour was 9a, with 3.')
    expect(dayHourTitle(hours[9]!)).toBe('9a: 3 merged')
    expect(dayHourTitle(hours[20]!)).toBe('8p: not yet')
  })
})

describe('queueFoldedWords', () => {
  it('says when the next one lands and the merges an hour, each figure a value', () => {
    const words = queueFoldedWords(PICTURE)
    expect(plainSentence(words)).toBe('the next one in about 3 minutes · 1 merge an hour')
    expect(sentenceParts(words)).toEqual(['the next one in ', { kind: 'count', text: 'about 3 minutes' }, ' · ', { kind: 'count', text: '1' }, ' merge an hour'])
    expect(plainSentence(queueFoldedWords({ queue: PICTURE.queue, recent: { ...PICTURE.recent, merged: 37 } }))).toBe('the next one in about 3 minutes · 6.2 merges an hour')
  })

  it('leaves out the next one with nothing in line or no estimate', () => {
    expect(plainSentence(queueFoldedWords({ queue: { ...PICTURE.queue!, entries: [] }, recent: PICTURE.recent }))).toBe('1 merge an hour')
    expect(plainSentence(queueFoldedWords({ queue: null, recent: PICTURE.recent }))).toBe('1 merge an hour')
    const noEstimate = { ...PICTURE.queue!, entries: PICTURE.queue!.entries.map((e) => ({ ...e, estimatedMinutes: null })) }
    expect(plainSentence(queueFoldedWords({ queue: noEstimate, recent: PICTURE.recent }))).toBe('1 merge an hour')
  })
})

describe('shouldReadOnOpen', () => {
  it('asks for a dev alone, and only on a row that is missing or old', () => {
    const fresh = { asOf: minutesAgo(QUEUE_FRESH_MINUTES - 1) }
    const old = { asOf: minutesAgo(QUEUE_FRESH_MINUTES + 1) }
    expect(rowAgeMinutes(old.asOf, nowMs)).toBe(QUEUE_FRESH_MINUTES + 1)
    expect(shouldReadOnOpen({ role: 'dev', picture: old, nowMs })).toBe(true)
    expect(shouldReadOnOpen({ role: 'dev', picture: fresh, nowMs })).toBe(false)
    expect(shouldReadOnOpen({ role: 'dev', picture: null, nowMs })).toBe(true)
    expect(shouldReadOnOpen({ role: 'master_technician', picture: old, nowMs })).toBe(false)
    expect(shouldReadOnOpen({ role: null, picture: null, nowMs })).toBe(false)
    expect(shouldReadOnOpen({ role: 'dev', picture: { asOf: 'not a time' }, nowMs })).toBe(true)
  })
})

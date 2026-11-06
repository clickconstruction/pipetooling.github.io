import { describe, expect, it } from 'vitest'
import { creditedTechsByJob, dayWord, parseMyCustomerWords, stripWords, techsLine, unseenWords, wordsInWeek, type MyCustomerWord } from './ratingCredit'

const NOW = new Date('2026-11-06T20:00:00Z') // Friday Nov 6, 2 PM Chicago

const word = (p: Partial<MyCustomerWord> = {}): MyCustomerWord => ({
  id: 'r-1',
  customerName: 'Dana Whitfield',
  score: 5,
  words: 'Marcus explained everything before he started and cleaned up after.',
  answeredAt: '2026-11-05T22:12:00Z',
  googlePressedAt: null,
  jobId: 'j-1',
  jobNumber: '1184',
  jobName: 'Water heater',
  jobAddress: '1208 Mesquite Ln',
  seenAt: null,
  ...p,
})

describe('creditedTechsByJob', () => {
  const sessions = [
    { user_id: 'u-jordan', job_ledger_id: 'j-1', travel_started_at: null, clocked_in_at: '2026-11-05T13:00:00Z' },
    { user_id: 'u-marcus', job_ledger_id: 'j-1', travel_started_at: '2026-11-05T13:30:00Z', clocked_in_at: '2026-11-05T14:00:00Z' },
    { user_id: 'u-marcus', job_ledger_id: 'j-1', travel_started_at: null, clocked_in_at: '2026-11-06T14:00:00Z' },
    { user_id: 'u-gone', job_ledger_id: 'j-1', travel_started_at: null, clocked_in_at: '2026-11-05T12:00:00Z', revoked_at: '2026-11-05T12:30:00Z' },
    { user_id: 'u-no', job_ledger_id: 'j-1', travel_started_at: null, clocked_in_at: '2026-11-05T12:00:00Z', rejected_at: '2026-11-05T12:30:00Z' },
    { user_id: 'u-sam', job_ledger_id: 'j-2', travel_started_at: null, clocked_in_at: '2026-11-05T12:00:00Z' },
    { user_id: 'u-nojob', job_ledger_id: null, travel_started_at: null, clocked_in_at: '2026-11-05T12:00:00Z' },
  ]
  const names: Record<string, string> = { 'u-jordan': 'Jordan Price', 'u-marcus': 'Marcus Lee', 'u-gone': 'Gone Guy', 'u-no': 'No Guy', 'u-sam': 'Sam Hale' }

  it('credits every tech with a kept session, the On my way presser first, once each', () => {
    const m = creditedTechsByJob(sessions, (id) => names[id])
    expect(m.get('j-1')).toEqual(['Marcus Lee', 'Jordan Price'])
    expect(m.get('j-2')).toEqual(['Sam Hale'])
    expect(m.has('null')).toBe(false)
  })

  it('leaves out a revoked or rejected session and a user with no name', () => {
    const m = creditedTechsByJob(sessions, (id) => (id === 'u-jordan' ? null : names[id]))
    expect(m.get('j-1')).toEqual(['Marcus Lee'])
  })
})

describe('techsLine', () => {
  it('reads one, two and three names, and nothing for nobody', () => {
    expect(techsLine([])).toBe('')
    expect(techsLine(['Luis Ortega'])).toBe('Luis Ortega was on the job')
    expect(techsLine(['Luis Ortega', 'Jordan Price'])).toBe('Luis Ortega and Jordan Price were on the job')
    expect(techsLine(['Luis Ortega', 'Jordan Price', 'Sam Hale'])).toBe('Luis Ortega, Jordan Price and Sam Hale were on the job')
  })
})

describe('parseMyCustomerWords', () => {
  it('types the jsonb, newest first, and drops a row below four stars or with no id', () => {
    const raw = [
      { id: 'a', customer_name: 'Dana Whitfield', score: 5, words: ' Great. ', answered_at: '2026-11-04T10:00:00Z', job_id: 'j', job_number: '1184', job_name: 'Water heater', job_address: '1208 Mesquite Ln', seen_at: null },
      { id: 'b', customer_name: 'Tom Reyes', score: 4, words: '', answered_at: '2026-11-05T10:00:00Z', job_id: 'j', job_number: '', job_name: '', job_address: '', seen_at: '2026-11-05T11:00:00Z', google_pressed_at: '2026-11-05T10:05:00Z' },
      { id: 'c', customer_name: 'Low', score: 3, words: 'meh', answered_at: '2026-11-05T12:00:00Z', job_id: 'j' },
      { customer_name: 'No id', score: 5, answered_at: '2026-11-05T12:00:00Z' },
    ]
    const list = parseMyCustomerWords(raw)
    expect(list.map((w) => w.id)).toEqual(['b', 'a'])
    expect(list[1]).toMatchObject({ customerName: 'Dana Whitfield', score: 5, words: 'Great.', seenAt: null, googlePressedAt: null })
    expect(list[0]).toMatchObject({ seenAt: '2026-11-05T11:00:00Z', googlePressedAt: '2026-11-05T10:05:00Z' })
    expect(parseMyCustomerWords(null)).toEqual([])
    expect(parseMyCustomerWords({ not: 'a list' })).toEqual([])
  })
})

describe('unseenWords and wordsInWeek', () => {
  it('keeps the ones without Got it, and the ones inside the week on the company calendar', () => {
    const a = word({ id: 'a', answeredAt: '2026-11-02T06:00:00Z' }) // Nov 2 Chicago (Sunday 00:00 local, Nov 1 is Saturday)
    const b = word({ id: 'b', answeredAt: '2026-11-05T22:12:00Z', seenAt: '2026-11-05T23:00:00Z' })
    const c = word({ id: 'c', answeredAt: '2026-10-20T15:00:00Z' })
    expect(unseenWords([a, b, c]).map((w) => w.id)).toEqual(['a', 'c'])
    expect(wordsInWeek([a, b, c], { start: '2026-11-02', end: '2026-11-08' }).map((w) => w.id)).toEqual(['a', 'b'])
  })
})

describe('dayWord', () => {
  it('says today, yesterday, the weekday inside the week, then the date', () => {
    expect(dayWord('2026-11-06T15:00:00Z', NOW)).toBe('today')
    expect(dayWord('2026-11-05T22:12:00Z', NOW)).toBe('yesterday')
    expect(dayWord('2026-11-03T15:00:00Z', NOW)).toBe('Tuesday')
    expect(dayWord('2026-10-20T15:00:00Z', NOW)).toBe('Oct 20')
    expect(dayWord('nonsense', NOW)).toBe('')
  })
})

describe('stripWords', () => {
  it('names the customer by first name, the stars, their words, the job and the day', () => {
    const s = stripWords(word(), NOW)
    expect(s.title).toBe('Dana gave you five stars')
    expect(s.quote).toBe('Marcus explained everything before he started and cleaned up after.')
    expect(s.place).toBe('Water heater at 1208 Mesquite Ln · yesterday')
    expect(s.button).toBe('Got it')
  })

  it('reads four stars with no words, and a job with no name by its number', () => {
    const s = stripWords(word({ score: 4, words: '', jobName: '', jobAddress: '', answeredAt: '2026-11-06T15:00:00Z' }), NOW)
    expect(s.title).toBe('Dana gave you four stars')
    expect(s.quote).toBe('')
    expect(s.place).toBe('Job 1184 · today')
  })

  it('never shows more than the first name', () => {
    expect(stripWords(word({ customerName: '  ' }), NOW).title).toBe('A customer gave you five stars')
    expect(stripWords(word({ customerName: 'Dana Whitfield-Ortega Jr' }), NOW).title).toBe('Dana gave you five stars')
  })
})

import { describe, expect, it } from 'vitest'
import type { GcReviewGroup } from '../gcReviewRollup'
import type { RoundMarkRow } from './gcStatementRounds'
import { buildTemperatureBoard, latestTemperatureByGc, trailingWeekStarts } from './temperatureBoard'

const group = (gcId: string, subtotal: number): GcReviewGroup => ({ key: gcId, gcId, gcName: `GC ${gcId}`, isNoGc: false, rows: [], subtotal, jobCount: 1, oldestAgeDays: 10 })
const mark = (gc: string, week: string, action: RoundMarkRow['action'], over: Partial<RoundMarkRow> = {}): RoundMarkRow => ({
  gc_customer_id: gc,
  week_start: week,
  action,
  acted_by: 'u2',
  acted_by_name: 'Malachi',
  acted_at: `${week}T15:00:00Z`,
  channel: 'call',
  note: null,
  temperature: null,
  expected_pay_by: null,
  ...over,
})
const weeks = trailingWeekStarts('2026-08-31', 3) // 08-17, 08-24, 08-31

describe('trailingWeekStarts', () => {
  it('walks back N Mondays, oldest first', () => {
    expect(weeks).toEqual(['2026-08-17', '2026-08-24', '2026-08-31'])
  })
})

describe('buildTemperatureBoard', () => {
  it('sorts cold first then by amount, builds the trend, picks the newest read/word/pay date', () => {
    const rows = buildTemperatureBoard({
      groups: [group('a', 20000), group('b', 50000), group('c', 15000), group('d', 9000)],
      marks: [
        mark('a', '2026-08-24', 'contacted', { temperature: 'warm', note: 'fine' }),
        mark('a', '2026-08-31', 'contacted', { temperature: 'cold', note: 'disputing 1008', expected_pay_by: null, acted_at: '2026-09-03T10:00:00Z' }),
        mark('b', '2026-08-31', 'sent', { temperature: 'hot', note: 'paying Friday', expected_pay_by: '2026-09-05' }),
      ],
      senders: new Map([['a', 'u2']]),
      accountMen: new Map([['b', 'u9']]),
      weekStarts: weeks,
      threshold: 10000,
    })
    expect(rows.map((r) => `${r.gcId}:${r.now ?? 'none'}`)).toEqual(['a:cold', 'b:hot', 'c:none'])
    const a = rows[0]!
    expect(a.trend).toEqual([null, 'warm', 'cold'])
    expect(a.lastWord?.note).toBe('disputing 1008')
    expect(a.senderUserId).toBe('u2')
    expect(a.contactedOnlyWeeks).toBe(2)
    const b = rows[1]!
    expect(b.expectedPayBy).toBe('2026-09-05')
    expect(b.lastStatementAt).toBe('2026-08-31T15:00:00Z')
    expect(b.contactedOnlyWeeks).toBe(0)
    expect(b.senderUserId).toBe('u9')
  })

  it('a send (mark or app email) breaks the contacted-only streak', () => {
    const base = { groups: [group('a', 20000)], senders: new Map<string, string>(), accountMen: new Map<string, string>(), weekStarts: weeks, threshold: 10000 }
    const streak = [mark('a', '2026-08-24', 'contacted', { temperature: 'cool' }), mark('a', '2026-08-31', 'contacted', { temperature: 'cool' })]
    expect(buildTemperatureBoard({ ...base, marks: streak })[0]?.contactedOnlyWeeks).toBe(2)
    expect(buildTemperatureBoard({ ...base, marks: [...streak, mark('a', '2026-08-24', 'sent', { acted_at: '2026-08-25T15:00:00Z' })] })[0]?.contactedOnlyWeeks).toBe(1)
    expect(buildTemperatureBoard({ ...base, marks: streak, appLastSentByGc: { a: '2026-08-26T12:00:00Z' } })[0]?.contactedOnlyWeeks).toBe(0)
  })
})

describe('latestTemperatureByGc', () => {
  it('keeps the newest read per GC and ignores marks without one', () => {
    const m = latestTemperatureByGc([
      mark('a', '2026-08-24', 'contacted', { temperature: 'warm', acted_at: '2026-08-25T10:00:00Z' }),
      mark('a', '2026-08-31', 'sent'),
      mark('a', '2026-08-31', 'contacted', { temperature: 'cold', acted_at: '2026-09-02T10:00:00Z', note: 'upset' }),
    ])
    expect(m.get('a')).toEqual({ temperature: 'cold', at: '2026-09-02T10:00:00Z', by: 'Malachi', note: 'upset' })
  })
})

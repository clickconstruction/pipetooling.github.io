import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { wentOutDays, wentOutRows, WENT_OUT_WORDS, type WentOutLine } from './wentOut'

// 1:31 PM and 9:00 AM in Chicago on Tue Oct 20 (CDT).
const AT_131 = Date.parse('2026-10-20T18:31:00Z')
const AT_900 = Date.parse('2026-10-20T14:00:00Z')
const line = (set: Partial<WentOutLine> = {}): WentOutLine => ({ id: 'm1', contactId: 'c1', name: 'Dana Whitfield', kind: 'customer', body: 'Dana, your estimate is ready.', atMs: AT_131, who: 'Taunya', ...set })

describe('wentOutRows (v2.5686, punch list #133)', () => {
  it('newest first, the first line of the words, the time and who pressed', () => {
    const rows = wentOutRows([line({ id: 'm2', atMs: AT_900, who: '' }), line()], 'all')
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2'])
    expect(rows[0]).toEqual({ id: 'm1', contactId: 'c1', name: 'Dana Whitfield', words: 'Dana, your estimate is ready.', when: '1:31 PM · Taunya' })
    expect(rows[1]?.when).toBe('9:00 AM')
  })
  it('a pill narrows by kind, and a number nobody has named shows under All alone', () => {
    const lines = [line(), line({ id: 'm2', kind: 'sub', name: 'Pete Alvarez' }), line({ id: 'm3', kind: null, name: null })]
    expect(wentOutRows(lines, 'customer').map((r) => r.id)).toEqual(['m1'])
    expect(wentOutRows(lines, 'sub').map((r) => r.id)).toEqual(['m2'])
    expect(wentOutRows(lines, 'all').map((r) => r.name)).toEqual(['Dana Whitfield', 'Pete Alvarez', 'A number nobody has named'])
  })
  it('a customer’s own thread reads the customer’s name, since the app keeps that contact’s name null (v2.5696)', () => {
    const rows = wentOutRows([line({ name: null, customerName: 'Evan Johnson' }), line({ id: 'm2', name: null, customerName: null })], 'all')
    expect(rows.map((r) => r.name)).toEqual(['Evan Johnson', 'A number nobody has named'])
  })
  it('long words trim to one row, on the first line', () => {
    const rows = wentOutRows([line({ body: `${'w'.repeat(200)}\nsecond line` })], 'all')
    expect(rows[0]?.words.endsWith('…')).toBe(true)
    expect(rows[0]?.words.length).toBeLessThanOrEqual(111)
    expect(rows[0]?.words).not.toContain('second')
  })
  it('groups the rows under their day in the company calendar, newest day first: Today, Yesterday, then the date (v2.5699)', () => {
    // Now: Wed Oct 21, 12:03 AM Chicago (CDT), the minute the today-only lane went empty on the owner.
    const now = new Date('2026-10-21T05:03:00Z')
    const lines = [
      line({ id: 'y1', atMs: AT_131 }),
      line({ id: 'y2', atMs: AT_900, who: '' }),
      line({ id: 't1', atMs: Date.parse('2026-10-21T05:01:00Z'), name: 'Pete Alvarez', kind: 'sub' }),
      line({ id: 'o1', atMs: Date.parse('2026-10-19T16:00:00Z'), name: 'Kim Coe' }),
    ]
    const days = wentOutDays(lines, 'all', now)
    expect(days.map((d) => [d.ymd, d.label, d.rows.map((r) => r.id)])).toEqual([
      ['2026-10-21', 'Today', ['t1']],
      ['2026-10-20', 'Yesterday', ['y1', 'y2']],
      ['2026-10-19', 'Mon Oct 19', ['o1']],
    ])
    expect(wentOutDays(lines, 'sub', now).map((d) => d.label)).toEqual(['Today'])
    expect(wentOutDays([], 'all', now)).toEqual([])
  })
  it('the lane’s words are plain (the title’s count in parentheses is the queues’ own shape, not prose)', () => {
    expect(WENT_OUT_WORDS.title(3)).toBe('Went out (3)')
    for (const words of [WENT_OUT_WORDS.note, WENT_OUT_WORDS.empty, WENT_OUT_WORDS.problem]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})

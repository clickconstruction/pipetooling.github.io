import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { wentOutRows, WENT_OUT_WORDS, type WentOutLine } from './wentOut'

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
  it('long words trim to one row, on the first line', () => {
    const rows = wentOutRows([line({ body: `${'w'.repeat(200)}\nsecond line` })], 'all')
    expect(rows[0]?.words.endsWith('…')).toBe(true)
    expect(rows[0]?.words.length).toBeLessThanOrEqual(111)
    expect(rows[0]?.words).not.toContain('second')
  })
  it('the lane’s words are plain (the title’s count in parentheses is the queues’ own shape, not prose)', () => {
    expect(WENT_OUT_WORDS.title(3)).toBe('Went out today (3)')
    for (const words of [WENT_OUT_WORDS.note, WENT_OUT_WORDS.empty, WENT_OUT_WORDS.problem]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})

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
    expect(rows[0]).toEqual({ id: 'm1', contactId: 'c1', name: 'Dana Whitfield', channel: 'text', words: 'Dana, your estimate is ready.', when: '1:31 PM · Taunya', mark: null, tel: null, chip: null })
    expect(rows[1]?.when).toBe('9:00 AM')
  })
  it('a pill narrows by kind, and a number nobody has named shows under All alone', () => {
    const lines = [line(), line({ id: 'm2', kind: 'sub', name: 'Pete Alvarez' }), line({ id: 'm3', kind: null, name: null })]
    expect(wentOutRows(lines, 'customer').map((r) => r.id)).toEqual(['m1'])
    expect(wentOutRows(lines, 'sub').map((r) => r.id)).toEqual(['m2'])
    expect(wentOutRows(lines, 'all').map((r) => r.name)).toEqual(['Dana Whitfield', 'Pete Alvarez', 'A number nobody has named'])
  })
  it('a send to someone nobody has named is named by the way it went: an address on an email, a number on a text (v2.5994, Wendi 2026-10-27)', () => {
    const lines = [
      line({ id: 'e1', kind: null, name: null, channel: 'email', subject: "don't believe the hype", body: "don't believe the hype.", who: 'Wendi' }),
      line({ id: 't1', kind: null, name: null, channel: 'text', atMs: AT_900 }),
    ]
    expect(wentOutRows(lines, 'all').map((r) => [r.name, r.words])).toEqual([
      ['An address nobody has named', "don't believe the hype"],
      ['A number nobody has named', 'Dana, your estimate is ready.'],
    ])
    // A customer's own thread still reads the customer's name, whatever the channel.
    expect(wentOutRows([line({ id: 'e2', name: null, customerName: 'Evan Johnson', channel: 'email', subject: 'Thursday' })], 'all')[0]?.name).toBe('Evan Johnson')
  })
  it('a customer’s own thread reads the customer’s name, since the app keeps that contact’s name null (v2.5696)', () => {
    const rows = wentOutRows([line({ name: null, customerName: 'Evan Johnson' }), line({ id: 'm2', name: null, customerName: null })], 'all')
    expect(rows.map((r) => r.name)).toEqual(['Evan Johnson', 'A number nobody has named'])
  })
  it('carries Quo’s answer beside the time, and the dial when the text did not reach them (v2.5703)', () => {
    const rows = wentOutRows([line({ delivery: 'delivered', number: '(830) 555-0121' }), line({ id: 'm2', delivery: 'undelivered', number: '(830) 555-0121' }), line({ id: 'm3', delivery: 'failed', number: null }), line({ id: 'm4' })], 'all')
    expect(rows.map((r) => [r.mark?.words ?? null, r.tel])).toEqual([
      ['✓ delivered', null],
      ['⚠ not delivered', 'tel:+18305550121'],
      ['⚠ not sent', null],
      [null, null],
    ])
  })
  it('an email we sent sits beside the texts, its subject as the words and what the customer did as the chip; the lane’s filter picks either (v2.5707)', () => {
    const lines = [
      line(),
      line({ id: 'e1', channel: 'email', subject: 'Estimate #212 — Estimate for Dana Whitfield — $4,860 · Click Plumbing', body: 'Estimate #212 — …', atMs: AT_131 - 60_000, estimate: { number: 212, opened: true, accepted: true } }),
      line({ id: 'e2', channel: 'email', subject: 'Invoice 2041 — Calloway softener — $2,150', body: '', atMs: AT_900, who: 'the app', delivery: 'delivered', estimate: null }),
    ]
    const rows = wentOutRows(lines, 'all')
    expect(rows.map((r) => [r.id, r.channel, r.words, r.chip, r.mark?.words ?? null])).toEqual([
      ['m1', 'text', 'Dana, your estimate is ready.', null, null],
      ['e1', 'email', 'Estimate #212 — Estimate for Dana Whitfield — $4,860 · Click Plumbing', 'opened · accepted', null],
      ['e2', 'email', 'Invoice 2041 — Calloway softener — $2,150', null, null],
    ])
    expect(wentOutRows(lines, 'all', 'texts').map((r) => r.id)).toEqual(['m1'])
    expect(wentOutRows(lines, 'all', 'emails').map((r) => r.id)).toEqual(['e1', 'e2'])
    expect(wentOutRows([line({ id: 'e3', channel: 'email', subject: 'Estimate #213 — x', body: '', estimate: { number: 213, opened: true, accepted: false } })], 'all')[0]?.chip).toBe('opened')
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

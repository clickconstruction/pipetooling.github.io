import { describe, expect, it } from 'vitest'
import { buildBilledDatesLedger } from './billedDatesLedger'
import { buildBilledDatesTrack } from './billedDatesTrack'
import { buildLienPayRunway } from './lienPayRunway'
import type { PaySpeedData } from './billedExpectedPay'

const data: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: { drf: { medianDays: 11, samples: 8 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}
const row = { billedAtIso: '2026-09-29T15:00:00Z', estBillYmd: null, customerId: 'drf', payerName: 'DRF' }

function runwayFor(todayYmd: string, expectedPayYmd: string | null, extra: Partial<Parameters<typeof buildLienPayRunway>[0]> = {}) {
  return buildLienPayRunway({ todayYmd, openBalance: 1400, lastWorkYmd: '2026-09-20', propertyKind: 'residential', expectedPayYmd, filedYmd: null, releasedYmd: null, isSub: false, ...extra })
}

describe('buildBilledDatesTrack (v2.6139, punch list #217 jobs-pipeline-1)', () => {
  it('lays the bill, the guessed pay date, today and the lien flag on one axis, with the room between them as the band', () => {
    const today = '2026-09-30'
    const ledger = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: runwayFor(today, '2026-10-10'), inCollections: false })
    const t = buildBilledDatesTrack(ledger, today)!
    expect(t.startYmd).toBe('2026-09-29')
    expect(t.endYmd).toBe('2026-12-15')
    expect(t.marks.map((m) => m.key)).toEqual(['billed', 'today', 'money', 'lien'])
    const [billed, todayMark, money, lien] = t.marks
    expect(billed).toMatchObject({ label: 'Billed', sub: 'Sep 29', side: 'up', glyph: 'dot', align: 'left', action: null })
    expect(todayMark).toMatchObject({ label: 'today', sub: 'Sep 30', side: 'down', glyph: 'today', tone: 'blue' })
    expect(money).toMatchObject({ label: '~Oct 10', sub: 'guessed', side: 'up', glyph: 'ring_dashed', tone: 'green', action: 'they-said' })
    expect(lien).toMatchObject({ label: 'Lien by Dec 15', sub: '76d', side: 'down', glyph: 'flag', align: 'right', bold: false, action: 'lien-desk' })
    // Left to right, inside the padding, and the flag at the far end.
    expect(t.marks.every((m) => m.pct >= 7 && m.pct <= 93)).toBe(true)
    expect(lien!.pct).toBe(93)
    expect(billed!.pct).toBe(7)
    expect(t.band).toMatchObject({ kind: 'room', label: '66d of room', tone: 'green', action: 'lien-desk', fromPct: money!.pct, toPct: lien!.pct })
    expect(t.tag).toEqual({ kind: 'guess', words: 'guessed · ~11 d over 8 payments', title: ledger.rows[1]!.title, action: 'pay-speeds' })
    expect(t.state).toBeNull()
    expect(t.full).toBe('Billed · Sep 29 · today · Sep 30 · ~Oct 10 · guessed · Lien by Dec 15 · 76d · guessed · ~11 d over 8 payments · 66d of room')
  })

  it('a promise is a solid ring marked their word, whose tag opens New date… and keeps the history’s date', () => {
    const today = '2026-09-30'
    const promise = { promisedYmd: '2026-10-20', markedByName: 'Robert' }
    const ledger = buildBilledDatesLedger({ todayYmd: today, row, data, promise, runway: runwayFor(today, '2026-10-20'), inCollections: false })
    const t = buildBilledDatesTrack(ledger, today)!
    const money = t.marks.find((m) => m.key === 'money')!
    expect(money).toMatchObject({ label: 'Oct 20', sub: 'their word', glyph: 'ring_solid', tone: 'blue', action: 'new-date' })
    expect(t.tag).toMatchObject({ kind: 'promise', words: 'their word · Oct 20 · expected Oct 10 by their history', action: 'new-date' })
    expect(t.band).toMatchObject({ kind: 'room', label: '56d of room' })
  })

  it('no history: no ring, and the band from today to the flag reads Ask for a date', () => {
    const today = '2026-09-30'
    const ledger = buildBilledDatesLedger({ todayYmd: today, row, data: null, promise: null, runway: runwayFor(today, null), inCollections: false })
    const t = buildBilledDatesTrack(ledger, today)!
    expect(t.marks.map((m) => m.key)).toEqual(['billed', 'today', 'lien'])
    expect(t.tag).toBeNull()
    expect(t.band).toMatchObject({ kind: 'ask', label: 'Ask for a date', tone: 'plain', action: 'they-said' })
    expect(t.band!.fromPct).toBe(t.marks[1]!.pct)
    expect(t.band!.toPct).toBe(t.marks[2]!.pct)
  })

  it('a pay date past the flag draws the short band in red, from the flag to the ring', () => {
    const today = '2026-11-30'
    const late = { ...row, billedAtIso: '2026-11-28T15:00:00Z' }
    const slow: PaySpeedData = { ...data, customers: { drf: { medianDays: 40, samples: 5 } } }
    const ledger = buildBilledDatesLedger({ todayYmd: today, row: late, data: slow, promise: null, runway: runwayFor(today, '2027-01-07'), inCollections: false })
    expect(ledger.verdict?.label).toBe('File the lien first')
    const t = buildBilledDatesTrack(ledger, today)!
    const money = t.marks.find((m) => m.key === 'money')!
    const lien = t.marks.find((m) => m.key === 'lien')!
    expect(lien.pct).toBeLessThan(money.pct)
    expect(t.band).toMatchObject({ kind: 'short', label: '23d short', tone: 'red', fromPct: lien.pct, toPct: money.pct })
    expect(t.marks.map((m) => m.key)).toEqual(['billed', 'today', 'lien', 'money'])
  })

  it('when the flag is itself the to-do the band counts the days to it; a closed window is a red wash to the end', () => {
    const today = '2026-10-05'
    const sub = runwayFor(today, '2026-10-04', { openBalance: 15406, lastWorkYmd: '2026-08-14', isSub: true })
    const ledger = buildBilledDatesLedger({ todayYmd: today, row: { ...row, billedAtIso: '2026-09-23T15:00:00Z' }, data, promise: null, runway: sub, inCollections: false })
    expect(ledger.verdict).toBeNull()
    const t = buildBilledDatesTrack(ledger, today)!
    const notice = t.marks.find((m) => m.key === 'notice')!
    expect(notice).toMatchObject({ label: 'Lien notice by Oct 15', sub: '10d', bold: true, tone: 'amber', glyph: 'flag' })
    expect(t.band).toMatchObject({ kind: 'due', label: '10d to send the notice', tone: 'amber', action: 'lien-desk' })
    expect(t.state).toBeNull()
    const withState = buildBilledDatesLedger({ todayYmd: today, row: { ...row, billedAtIso: '2026-09-23T15:00:00Z' }, data, promise: null, runway: sub, inCollections: false, lienState: { words: 'Waiting on Robert · by Oct 15 · 2d', tone: 'red', title: 'August’s § 53.056 notice · Waiting on Robert' } })
    expect(buildBilledDatesTrack(withState, today)!.state).toEqual({ words: 'Waiting on Robert · by Oct 15 · 2d', tone: 'red', title: 'August’s § 53.056 notice · Waiting on Robert' })

    const gone = buildBilledDatesLedger({ todayYmd: '2027-01-20', row: { ...row, billedAtIso: '2026-09-23T15:00:00Z' }, data, promise: null, runway: runwayFor('2027-01-20', null, { lastWorkYmd: '2026-08-14' }), inCollections: true })
    expect(gone.verdict?.label).toBe('Lien gone')
    const g = buildBilledDatesTrack(gone, '2027-01-20')!
    expect(g.marks.find((m) => m.key === 'closed')).toMatchObject({ label: 'Lien window closed', glyph: 'flag', tone: 'red' })
    expect(g.band).toMatchObject({ kind: 'gone', label: 'Lien gone', tone: 'red', toPct: 100 })
  })

  it('a filed lien is a green check on its day; an empty ledger draws no track; a one-day ledger still spans two weeks', () => {
    const today = '2026-10-05'
    const filed = runwayFor(today, null, { filedYmd: '2026-10-01' })
    const ledger = buildBilledDatesLedger({ todayYmd: today, row, data: null, promise: null, runway: filed, inCollections: false })
    const t = buildBilledDatesTrack(ledger, today)!
    expect(t.marks.find((m) => m.key === 'filed')).toMatchObject({ ymd: '2026-10-01', label: 'Lien filed', sub: 'Oct 1', glyph: 'check', tone: 'green' })
    expect(t.band).toBeNull()
    expect(buildBilledDatesTrack({ rows: [], verdict: null, full: '' }, today)).toBeNull()
    const one = buildBilledDatesLedger({ todayYmd: '2026-09-29', row, data: null, promise: null, runway: null, inCollections: false })
    const s = buildBilledDatesTrack(one, '2026-09-29')!
    expect(s.startYmd).toBe('2026-09-29')
    expect(s.endYmd).toBe('2026-10-13')
    expect(s.marks.map((m) => [m.key, m.pct])).toEqual([['billed', 7], ['today', 7]])
  })
})

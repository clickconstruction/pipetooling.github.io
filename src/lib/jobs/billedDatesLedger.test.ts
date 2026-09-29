import { describe, expect, it } from 'vitest'
import { buildBilledDatesLedger } from './billedDatesLedger'
import { buildLienPayRunway, type LienRunwayInput } from './lienPayRunway'
import type { PaySpeedData } from './billedExpectedPay'

// Today is Wednesday 2026-09-30 throughout. The customer pays in ~11 days.
const today = '2026-09-30'
const data: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: { drf: { medianDays: 11, samples: 8 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}
// Billed Sep 23 → expected Oct 4 (a day behind today).
const row = { billedAtIso: '2026-09-23T15:00:00Z', estBillYmd: null, customerId: 'drf' }
// Last work in August on a residential sub job: § 53.056 notice by Oct 15, lien by Nov 16 (Nov 15 is a Sunday).
const runwayInput = (over: Partial<LienRunwayInput> = {}): LienRunwayInput => ({
  todayYmd: today,
  openBalance: 15406,
  lastWorkYmd: '2026-08-14',
  propertyKind: 'residential',
  expectedPayYmd: '2026-10-04',
  filedYmd: null,
  releasedYmd: null,
  isSub: true,
  ...over,
})
const line = (r: { label: string; joiner: string; date: string; far: string }) => [r.label, r.joiner, r.date, r.far].filter(Boolean).join(' ')

describe('buildBilledDatesLedger (v2.4168)', () => {
  it('the owner’s row: four rows, the notice row bold, four markers on a track that starts at the bill', () => {
    // Five days later than the other cases, so Oct 4 is a day behind.
    const l = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway: buildLienPayRunway(runwayInput({ todayYmd: '2026-10-05' })), inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 12 d ago', 'Expected Oct 4 1 d past', 'Send the notice by Oct 15 10 d', 'Lien by Nov 16 42 d'])
    expect(l.rows.map((r) => r.n)).toEqual([1, 2, 3, 4])
    expect(l.rows.map((r) => r.tone)).toEqual(['done', 'amber', 'amber', 'plain'])
    expect(l.rows.map((r) => r.bold)).toEqual([false, false, true, false])
    expect(l.rows[1]?.action).toBe('they-said')
    expect(l.rows[2]?.action).toBe('lien-desk')
    expect(l.roomLine).toBeNull()
    const t = l.track!
    expect(t.markers.map((m) => m.n)).toEqual([1, 2, 3, 4])
    expect(t.markers[0]?.pct).toBe(0)
    // Oct 4 sits just behind today; the notice and the lien follow in order and the lien is near the end.
    expect(t.markers[1]!.pct).toBeLessThan(t.todayPct)
    expect(t.markers[2]!.pct).toBeGreaterThan(t.todayPct)
    expect(t.markers[3]!.pct).toBeGreaterThan(t.markers[2]!.pct)
    expect(t.markers[3]!.pct).toBeGreaterThan(90)
    expect(t.markers.map((m) => m.kind)).toEqual(['dot', 'dot', 'flag', 'flag'])
    expect(l.full).toBe('Billed Sep 23 · 12 d ago · Expected Oct 4 · 1 d past · Send the notice by Oct 15 · 10 d · Lien by Nov 16 · 42 d')
  })

  it('a bill on time with no notice owed: three rows, nothing bold, the green room line', () => {
    const fresh = { ...row, billedAtIso: '2026-09-29T15:00:00Z' }
    const runway = buildLienPayRunway(runwayInput({ isSub: false, expectedPayYmd: '2026-10-10', lastWorkYmd: '2026-09-20' }))
    const l = buildBilledDatesLedger({ todayYmd: today, row: fresh, data, promise: null, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 29 yesterday', 'Expected Oct 10 in 10 d', 'Lien by Dec 15 76 d'])
    expect(l.rows.every((r) => !r.bold)).toBe(true)
    expect(l.rows[1]?.tone).toBe('green')
    expect(l.roomLine).toBe('66 d of room after they pay')
    expect(l.track?.gap).toEqual({ fromPct: l.track!.markers[1]!.pct, toPct: l.track!.markers[2]!.pct, kind: 'room' })
  })

  it('a promise replaces the Expected row, its number moves with it, and the estimate becomes the sub-line', () => {
    const promise = { promisedYmd: '2026-09-28', markedByName: 'Wendi' }
    const runway = buildLienPayRunway(runwayInput({ expectedPayYmd: '2026-09-28' }))
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 7 d ago', 'They said Sep 28 2 d past', 'Send the notice by Oct 15 15 d', 'Lien by Nov 16 47 d'])
    expect(l.rows[1]?.action).toBe('new-date')
    expect(l.rows[1]?.sub).toBe('expected Oct 4 by their history')
    expect(l.rows).toHaveLength(4)
  })

  it('the lien dies before the money: File the lien is the bold red row', () => {
    const runway = buildLienPayRunway(runwayInput({ isSub: false, lastWorkYmd: '2026-07-10', expectedPayYmd: '2026-10-20' }))
    expect(runway.state).toBe('file_first')
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: { promisedYmd: '2026-10-20', markedByName: 'Wendi' }, runway, inCollections: false })
    const lien = l.rows.find((r) => r.key === 'lien')!
    expect(lien.label).toBe('File the lien')
    expect(lien.bold).toBe(true)
    expect(lien.tone).toBe('red')
    expect(l.track?.gap?.kind).toBe('short')
  })

  it('a closed window is one red action row with no marker; a filed lien one green row; the track stays for the bill and the money', () => {
    const closed = buildLienPayRunway(runwayInput({ isSub: false, lastWorkYmd: '2026-05-10' }))
    expect(closed.state).toBe('closed')
    const lc = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: closed, inCollections: false })
    expect(lc.rows.map((r) => r.key)).toEqual(['billed', 'money', 'closed'])
    expect(lc.rows[2]).toMatchObject({ n: 0, label: 'Lien gone', bold: true, tone: 'red', sub: 'window closed Aug 17' })
    expect(lc.track?.markers).toHaveLength(2)
    const filed = buildLienPayRunway(runwayInput({ filedYmd: '2026-09-25' }))
    const lf = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: filed, inCollections: false })
    expect(lf.rows[2]).toMatchObject({ key: 'filed', n: 0, label: 'Lien filed', date: 'Sep 25', tone: 'green' })
  })

  it('Collections reads the money row red; a shell row (no bill line) has only the deadlines; no dates at all → no track', () => {
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: true })
    expect(l.rows[1]?.tone).toBe('red')
    const shell = buildBilledDatesLedger({ todayYmd: today, row: null, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false })
    expect(shell.rows.map((r) => r.key)).toEqual(['notice', 'lien'])
    expect(shell.rows.map((r) => r.n)).toEqual([1, 2])
    expect(shell.track?.todayPct).toBe(0)
    const none = buildBilledDatesLedger({ todayYmd: today, row: { ...row, billedAtIso: null }, data: null, promise: null, runway: null, inCollections: false })
    expect(none.rows).toEqual([])
    expect(none.track).toBeNull()
  })
})

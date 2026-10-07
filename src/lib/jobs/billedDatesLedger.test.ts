import { describe, expect, it } from 'vitest'
import { buildBilledDatesLedger } from './billedDatesLedger'
import { buildLienPayRunway, daysBetweenYmd, type LienRunwayInput } from './lienPayRunway'
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
// Billed Sep 23 → expected Oct 4.
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

describe('buildBilledDatesLedger (v2.4205 — rows and one bold line, one deadline at a time)', () => {
  it('the owner’s row: money past on a sub job — the notice is the one deadline and the bold row; no lien row, no verdict', () => {
    // Five days later than the other cases, so Oct 4 is a day behind.
    const l = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway: buildLienPayRunway(runwayInput({ todayYmd: '2026-10-05' })), inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 12d ago', 'Expected Oct 4 1d past', 'Lien notice by Oct 15 10d'])
    expect(l.rows.map((r) => r.tone)).toEqual(['done', 'amber', 'amber'])
    expect(l.rows.map((r) => r.bold)).toEqual([false, false, true])
    expect(l.rows.map((r) => r.dot)).toEqual(['filled', 'filled', 'filled'])
    expect(l.rows[1]?.action).toBe('they-said')
    expect(l.rows[2]?.action).toBe('lien-desk')
    expect(l.verdict).toBeNull()
    expect(l.full).toBe('Billed Sep 23 · 12d ago · Expected Oct 4 · 1d past · Lien notice by Oct 15 · 10d')
  })

  it('a sub job with the money expected before the notice: the notice is a plain ring and the verdict is the slack against it', () => {
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 7d ago', 'Expected Oct 4 in 4d', 'Lien notice by Oct 15 15d'])
    expect(l.rows[2]).toMatchObject({ key: 'notice', tone: 'green', bold: false, dot: 'ring' })
    expect(l.verdict).toMatchObject({ label: 'Can run late', value: '11d', tone: 'green', action: 'lien-desk' })
  })

  it('a direct job on time: three rows, nothing bold, the slack is against the lien', () => {
    const fresh = { ...row, billedAtIso: '2026-09-29T15:00:00Z' }
    const runway = buildLienPayRunway(runwayInput({ isSub: false, expectedPayYmd: '2026-10-10', lastWorkYmd: '2026-09-20' }))
    const l = buildBilledDatesLedger({ todayYmd: today, row: fresh, data, promise: null, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 29 yesterday', 'Expected Oct 10 in 10d', 'Lien by Dec 15 76d'])
    expect(l.rows.every((r) => !r.bold)).toBe(true)
    expect(l.rows[2]).toMatchObject({ key: 'lien', tone: 'green', dot: 'ring', sub: '' })
    expect(l.verdict).toMatchObject({ label: 'Can run late', value: '66d', tone: 'green' })
  })

  it('once the notice is recorded the row advances to the lien date, with "notice sent" under it', () => {
    const runway = buildLienPayRunway(runwayInput({ noticedMonths: ['2026-08'] }))
    expect(runway.state).toBe('room')
    expect(runway.noticeSent).toBe(true)
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 7d ago', 'Expected Oct 4 in 4d', 'Lien by Nov 16 47d'])
    expect(l.rows[2]).toMatchObject({ key: 'lien', sub: 'notice sent', dot: 'ring', tone: 'green' })
    expect(l.verdict).toMatchObject({ label: 'Can run late', value: '43d' })
  })

  it('a promise replaces the Expected row and the estimate becomes the sub-line; a past promise makes the notice the to-do', () => {
    const promise = { promisedYmd: '2026-09-28', markedByName: 'Wendi' }
    const runway = buildLienPayRunway(runwayInput({ expectedPayYmd: '2026-09-28' }))
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 7d ago', 'They said Sep 28 2d past', 'Lien notice by Oct 15 15d'])
    expect(l.rows[1]?.action).toBe('new-date')
    expect(l.rows[1]?.sub).toBe('expected Oct 4 by their history')
    expect(l.rows[2]?.bold).toBe(true)
    expect(l.verdict).toBeNull()
  })

  it('a bill the office gave up on (Uncollectible) has no Expected or They said row: nobody expects the money', () => {
    const promise = { promisedYmd: '2026-10-13', markedByName: 'Wendi' }
    const kept = buildBilledDatesLedger({ todayYmd: today, row, data, promise, runway: null, inCollections: true })
    expect(kept.rows.map((r) => r.key)).toEqual(['billed', 'money'])
    const given = buildBilledDatesLedger({ todayYmd: today, row, data, promise, runway: null, inCollections: true, uncollectible: true })
    expect(given.rows.map(line)).toEqual(['Billed Sep 23 7d ago'])
    expect(given.verdict).toBeNull()
  })

  it('the money is expected after the deadline: the row goes red and the verdict says how short — Notice first on a sub, File the lien first on a direct job', () => {
    const late = { promisedYmd: '2026-10-20', markedByName: 'Wendi' }
    const sub = buildBilledDatesLedger({ todayYmd: today, row, data, promise: late, runway: buildLienPayRunway(runwayInput({ expectedPayYmd: '2026-10-20' })), inCollections: false })
    expect(sub.rows[2]).toMatchObject({ key: 'notice', label: 'Lien notice', tone: 'red', bold: true })
    expect(sub.verdict).toMatchObject({ label: 'Notice first', value: '5d short', tone: 'red' })
    const runway = buildLienPayRunway(runwayInput({ isSub: false, lastWorkYmd: '2026-07-10', expectedPayYmd: '2026-10-20' }))
    expect(runway.state).toBe('file_first')
    const direct = buildBilledDatesLedger({ todayYmd: today, row, data, promise: late, runway, inCollections: false })
    const short = daysBetweenYmd(runway.lienByYmd, '2026-10-20')!
    expect(direct.rows[2]).toMatchObject({ key: 'lien', label: 'File the lien', tone: 'red', bold: true, dot: 'filled' })
    expect(direct.verdict).toMatchObject({ label: 'File the lien first', value: `${short}d short`, tone: 'red' })
  })

  it('past expected on a direct job with the lien far off: the lien is a plain ring and the verdict asks for a date; red in Collections', () => {
    const runway = buildLienPayRunway(runwayInput({ todayYmd: '2026-10-05', isSub: false }))
    expect(runway.state).toBe('no_pay')
    const l = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 12d ago', 'Expected Oct 4 1d past', 'Lien by Nov 16 42d'])
    // #87 J: the pay estimate counts from the bill date; the lien row counts from the last work month, so the hover names only the first.
    expect(l.rows[0]?.title).toBe('The bill went out Sep 23 — the day the pay estimate below counts from')
    expect(l.rows[2]).toMatchObject({ label: 'Lien', tone: 'plain', bold: false, dot: 'ring' })
    expect(l.verdict).toMatchObject({ label: 'Ask for a date', value: '1d past', tone: 'amber', action: 'they-said' })
    const c = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway, inCollections: true })
    expect(c.rows[1]?.tone).toBe('red')
    expect(c.verdict?.tone).toBe('red')
    // Inside three weeks the lien row itself asks, and nothing repeats it.
    const near = buildBilledDatesLedger({ todayYmd: '2026-11-01', row, data, promise: null, runway: buildLienPayRunway(runwayInput({ todayYmd: '2026-11-01', isSub: false })), inCollections: false })
    expect(near.rows[2]).toMatchObject({ label: 'File the lien', bold: true, tone: 'amber' })
    expect(near.verdict).toBeNull()
  })

  it('a closed window is a grey row with Lien gone under it; a filed lien is one green row and nothing else', () => {
    const closed = buildLienPayRunway(runwayInput({ isSub: false, lastWorkYmd: '2026-05-10' }))
    expect(closed.state).toBe('closed')
    const lc = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: closed, inCollections: false })
    expect(lc.rows.map((r) => r.key)).toEqual(['billed', 'money', 'closed'])
    expect(lc.rows[2]).toMatchObject({ label: 'Lien window closed', date: 'Aug 17', far: '44d ago', tone: 'done', dot: 'filled', action: 'lien-desk' })
    expect(lc.verdict).toMatchObject({ label: 'Lien gone', value: '', tone: 'red', action: 'lien-desk' })
    const noticeClosed = buildLienPayRunway(runwayInput({ lastWorkYmd: '2026-06-10' }))
    expect(noticeClosed.state).toBe('closed')
    const ln = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: noticeClosed, inCollections: false })
    expect(ln.rows[2]?.label).toBe('Notice window closed')
    const filed = buildLienPayRunway(runwayInput({ filedYmd: '2026-09-25' }))
    const lf = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: filed, inCollections: false })
    expect(lf.rows[2]).toMatchObject({ key: 'filed', label: 'Lien filed', date: 'Sep 25', tone: 'green' })
    expect(lf.verdict).toBeNull()
  })

  it('a shell row (no bill line) has only the deadline, bold since no money is named; no dates at all → nothing', () => {
    const shell = buildBilledDatesLedger({ todayYmd: today, row: null, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false })
    expect(shell.rows.map((r) => r.key)).toEqual(['notice'])
    expect(shell.rows[0]?.bold).toBe(true)
    expect(shell.verdict).toBeNull()
    const none = buildBilledDatesLedger({ todayYmd: today, row: { ...row, billedAtIso: null }, data: null, promise: null, runway: null, inCollections: false })
    expect(none.rows).toEqual([])
    expect(none.verdict).toBeNull()
  })
})

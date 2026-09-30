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

describe('buildBilledDatesLedger (v2.4168, redrawn v2.4193)', () => {
  it('the owner’s row: four rows, the notice the bold one, the verdict says send it, the bar runs bill → money → notice → lien', () => {
    // Five days later than the other cases, so Oct 4 is a day behind.
    const l = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway: buildLienPayRunway(runwayInput({ todayYmd: '2026-10-05' })), inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 12 d ago', 'Expected Oct 4 1 d past', 'Send the notice by Oct 15 10 d', 'Lien by Nov 16 42 d'])
    expect(l.rows.map((r) => r.tone)).toEqual(['done', 'amber', 'amber', 'plain'])
    expect(l.rows.map((r) => r.bold)).toEqual([false, false, true, false])
    expect(l.rows.map((r) => r.dot)).toEqual(['filled', 'filled', 'filled', 'ring'])
    expect(l.rows[1]?.action).toBe('they-said')
    expect(l.rows[2]?.action).toBe('lien-desk')
    expect(l.verdict).toMatchObject({ label: 'Send the notice', value: '10 d', tone: 'amber', action: 'lien-desk' })
    const b = l.bar!
    expect(b.caption).toBe('10 days left to send the notice')
    expect(b.segments.map((s) => [s.key, s.days, s.kind, s.live, s.label])).toEqual([
      ['billed-money', 11, 'wait', false, ''],
      ['money-notice', 11, 'notice', true, 'notice'],
      // The money is behind us, so the stretch to the lien is not room — just what is left.
      ['notice-lien', 32, 'wait', false, '42 d left'],
    ])
    expect(b.segments[0]!.usedFrac).toBe(1)
    expect(b.segments[1]!.usedFrac).toBeCloseTo(1 / 11, 5)
    expect(b.segments[2]!.usedFrac).toBe(0)
    expect(l.full).toBe('Billed Sep 23 · 12 d ago · Expected Oct 4 · 1 d past · Send the notice by Oct 15 · 10 d · Lien by Nov 16 · 42 d · Send the notice · 10 d')
  })

  it('a bill on time with no notice owed: three rows, nothing bold, the room is the green verdict and the green stretch of the bar', () => {
    const fresh = { ...row, billedAtIso: '2026-09-29T15:00:00Z' }
    const runway = buildLienPayRunway(runwayInput({ isSub: false, expectedPayYmd: '2026-10-10', lastWorkYmd: '2026-09-20' }))
    const l = buildBilledDatesLedger({ todayYmd: today, row: fresh, data, promise: null, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 29 yesterday', 'Expected Oct 10 in 10 d', 'Lien by Dec 15 76 d'])
    expect(l.rows.every((r) => !r.bold)).toBe(true)
    expect(l.rows[1]?.tone).toBe('green')
    expect(l.rows[2]?.dot).toBe('ring')
    expect(l.verdict).toMatchObject({ label: 'Room after they pay', value: '66 d', tone: 'green', action: 'lien-desk' })
    const b = l.bar!
    expect(b.caption).toBe('76 days left to file the lien')
    expect(b.segments.map((s) => [s.key, s.days, s.kind, s.live, s.label])).toEqual([
      ['billed-money', 11, 'wait', true, ''],
      ['money-lien', 66, 'room', false, '66 d of room'],
    ])
    expect(b.segments[0]!.usedFrac).toBeCloseTo(1 / 11, 5)
  })

  it('a promise replaces the Expected row and the estimate becomes the sub-line', () => {
    const promise = { promisedYmd: '2026-09-28', markedByName: 'Wendi' }
    const runway = buildLienPayRunway(runwayInput({ expectedPayYmd: '2026-09-28' }))
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 7 d ago', 'They said Sep 28 2 d past', 'Send the notice by Oct 15 15 d', 'Lien by Nov 16 47 d'])
    expect(l.rows[1]?.action).toBe('new-date')
    expect(l.rows[1]?.sub).toBe('expected Oct 4 by their history')
    expect(l.rows).toHaveLength(4)
  })

  it('the lien dies before the money: File the lien is the bold red row, the verdict says how short, the bar hatches the stretch past the lien', () => {
    const runway = buildLienPayRunway(runwayInput({ isSub: false, lastWorkYmd: '2026-07-10', expectedPayYmd: '2026-10-20' }))
    expect(runway.state).toBe('file_first')
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: { promisedYmd: '2026-10-20', markedByName: 'Wendi' }, runway, inCollections: false })
    const lien = l.rows.find((r) => r.key === 'lien')!
    expect(lien).toMatchObject({ label: 'File the lien', bold: true, tone: 'red', dot: 'filled' })
    const short = daysBetweenYmd(runway.lienByYmd, '2026-10-20')!
    expect(short).toBeGreaterThan(0)
    expect(l.verdict).toMatchObject({ label: 'File the lien first', value: `${short} d short`, tone: 'red' })
    const b = l.bar!
    expect(b.caption).toBe(`${runway.daysToLien} days left to file the lien`)
    expect(b.segments.map((s) => [s.key, s.kind])).toEqual([
      ['billed-lien', 'wait'],
      ['lien-money', 'short'],
    ])
    expect(b.segments[1]!.days).toBe(short)
  })

  it('the expected date has gone by with no notice owed: the flag stands alone, the verdict asks for a date and opens They said…', () => {
    const runway = buildLienPayRunway(runwayInput({ todayYmd: '2026-10-05', isSub: false }))
    expect(runway.state).toBe('no_pay')
    const l = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 12 d ago', 'Expected Oct 4 1 d past', 'Lien by Nov 16 42 d'])
    expect(l.verdict).toMatchObject({ label: 'Ask for a date', value: '1 d past', tone: 'amber', action: 'they-said' })
    expect(l.bar!.segments.map((s) => [s.key, s.kind, s.label])).toEqual([
      ['billed-money', 'wait', ''],
      ['money-lien', 'wait', '42 d left'],
    ])
    // In Collections the same row reads red.
    const c = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway, inCollections: true })
    expect(c.rows[1]?.tone).toBe('red')
    expect(c.verdict?.tone).toBe('red')
  })

  it('a closed window: a grey "Window closed" row, the verdict Lien gone, the bar all grey; a filed lien is one green row with no bar or verdict', () => {
    const closed = buildLienPayRunway(runwayInput({ isSub: false, lastWorkYmd: '2026-05-10' }))
    expect(closed.state).toBe('closed')
    const lc = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: closed, inCollections: false })
    expect(lc.rows.map((r) => r.key)).toEqual(['billed', 'money', 'closed'])
    expect(lc.rows[2]).toMatchObject({ label: 'Window closed', date: 'Aug 17', far: '44 d ago', tone: 'done', dot: 'filled', action: 'lien-desk' })
    expect(lc.verdict).toMatchObject({ label: 'Lien gone', value: '', tone: 'red', action: 'lien-desk' })
    expect(lc.bar!.caption).toBe('the lien window closed Aug 17')
    // Billed Sep 23 is after the window closed, so the only stretch is today's shell start → closed? No — the bill
    // came after the close, so the bar has nothing ahead of the bill and draws no segment past it.
    expect(lc.bar!.segments.map((s) => s.kind)).toEqual(['wait'])
    const filed = buildLienPayRunway(runwayInput({ filedYmd: '2026-09-25' }))
    const lf = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: filed, inCollections: false })
    expect(lf.rows[2]).toMatchObject({ key: 'filed', label: 'Lien filed', date: 'Sep 25', tone: 'green' })
    expect(lf.verdict).toBeNull()
    expect(lf.bar).toBeNull()
  })

  it('a shell row (no bill line) has only the deadlines and a bar from today; no dates at all → nothing', () => {
    const shell = buildBilledDatesLedger({ todayYmd: today, row: null, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false })
    expect(shell.rows.map((r) => r.key)).toEqual(['notice', 'lien'])
    expect(shell.bar!.caption).toBe('15 days left to send the notice')
    expect(shell.bar!.segments.map((s) => [s.key, s.kind, s.live])).toEqual([
      ['start-notice', 'notice', true],
      ['notice-lien', 'wait', false],
    ])
    expect(shell.verdict?.label).toBe('Send the notice')
    const none = buildBilledDatesLedger({ todayYmd: today, row: { ...row, billedAtIso: null }, data: null, promise: null, runway: null, inCollections: false })
    expect(none.rows).toEqual([])
    expect(none.bar).toBeNull()
    expect(none.verdict).toBeNull()
  })
})

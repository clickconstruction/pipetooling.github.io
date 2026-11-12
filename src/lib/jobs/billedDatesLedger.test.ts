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

  it('a bill an in-kind deal pays reads Scheduled in kind with no day, and nobody is asked for a date (punch list #301)', () => {
    // A direct job with the lien far off: without the deal this would read Expected Oct 4 and, later, Ask for a date.
    const direct = buildLienPayRunway(runwayInput({ isSub: false, expectedPayYmd: null }))
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: direct, inCollections: false, inKind: true })
    expect(l.rows.map((r) => r.key)).toEqual(['billed', 'inkind', 'lien'])
    expect(l.rows[1]).toMatchObject({ label: 'Scheduled in kind', date: '', far: '', tone: 'green', action: null })
    expect(l.verdict).toBeNull()
    // The same bill with no deal asks for a date once the day has gone by.
    const late = buildBilledDatesLedger({ todayYmd: '2026-10-20', row, data, promise: null, runway: buildLienPayRunway(runwayInput({ isSub: false, todayYmd: '2026-10-20' })), inCollections: false })
    expect(late.rows.map((r) => r.key)).toContain('money')
    // A promise on the job does not bring an Expected row back: the deal is how it is paid.
    const promised = buildBilledDatesLedger({ todayYmd: today, row, data, promise: { promisedYmd: '2026-10-10', markedByName: 'Tess' } as never, runway: direct, inCollections: false, inKind: true })
    expect(promised.rows.map((r) => r.key)).toEqual(['billed', 'inkind', 'lien'])
    // A bill the office gave up on stays as it was: no money row of any kind.
    const gaveUp = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: direct, inCollections: false, uncollectible: true, inKind: true })
    expect(gaveUp.rows.map((r) => r.key)).not.toContain('inkind')
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

  it('the notice’s state (v2.5491) is the line under the lien row, in its tone, with the sentence as its hover; without one the old “notice sent” line stands', () => {
    const state = { words: 'Waiting on Robert · by Oct 15 · 2d', tone: 'red' as const, title: 'August’s § 53.056 notice · Waiting on Robert · since Oct 7' }
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false, lienState: state })
    expect(l.rows[2]).toMatchObject({ key: 'notice', sub: 'Waiting on Robert · by Oct 15 · 2d', subTone: 'red', subTitle: 'August’s § 53.056 notice · Waiting on Robert · since Oct 7' })
    const filed = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway(runwayInput({ filedYmd: '2026-09-25' })), inCollections: false, lienState: { words: 'Lien filed Sep 25 · served Sep 29', tone: 'green' } })
    expect(filed.rows[2]).toMatchObject({ key: 'filed', sub: 'Lien filed Sep 25 · served Sep 29', subTone: 'green', subTitle: 'Lien filed Sep 25 · served Sep 29' })
    const plain = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway(runwayInput({ filedYmd: '2026-09-25' })), inCollections: false })
    expect(plain.rows[2]?.sub).toBe('')
    expect(plain.rows[2]?.subTone).toBeUndefined()
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

describe('They say paid (v2.6695 — the customer’s word that they already paid takes the money row)', () => {
  const said = { paidYmd: '2026-09-28', method: 'check_mailed' as const, amount: null, saidBy: 'Dana', customerName: 'Dana Whitfield', heardByName: 'Theo', landedSince: 0 }
  const runway = buildLienPayRunway(runwayInput({ isSub: false, lastWorkYmd: '2026-09-20', expectedPayYmd: null }))
  it('fresh: a green They say paid row in the Expected row’s place, how they paid under it, no ask', () => {
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, claim: said, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 7d ago', 'They say paid Sep 28 2d ago', 'Lien by Dec 15 76d'])
    expect(l.rows[1]).toMatchObject({ key: 'claim', tone: 'green', action: 'they-said', sub: 'a check in the mail', dot: 'filled', bold: false })
    expect(l.rows[1]?.title).toBe('Dana says they paid Sep 28, a check in the mail, heard by Theo. The office pairs it with the deposit when it lands.')
    expect(l.rows.some((r) => r.key === 'money')).toBe(false)
    expect(l.verdict).toBeNull()
  })
  it('stale: amber after a week with nothing landed, the days under it, and the verdict asks', () => {
    const l = buildBilledDatesLedger({ todayYmd: '2026-10-07', row, data, promise: null, claim: { ...said, amount: 4200 }, runway: buildLienPayRunway(runwayInput({ todayYmd: '2026-10-07', isSub: false, lastWorkYmd: '2026-09-20', expectedPayYmd: null })), inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 14d ago', 'They say paid Sep 28 9d ago', 'Lien by Dec 15 69d'])
    expect(l.rows[1]).toMatchObject({ tone: 'amber', sub: 'nothing landed in 9 days', subTone: 'amber', subTitle: 'a check in the mail · $4,200 · nothing landed in 9 days' })
    expect(l.verdict).toMatchObject({ label: 'Nothing landed', value: '9d', tone: 'amber', action: 'they-said' })
  })
  it('a claim something landed against, or a bill given up on, draws the row as before', () => {
    const met = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, claim: { ...said, landedSince: 4200 }, runway, inCollections: false })
    expect(met.rows.map((r) => r.key)).toEqual(['billed', 'money', 'lien'])
    const gone = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, claim: said, runway, inCollections: false, uncollectible: true })
    expect(gone.rows.some((r) => r.key === 'claim' || r.key === 'money')).toBe(false)
  })
  it('a claim beats a promise: the customer’s last word is that they paid', () => {
    const l = buildBilledDatesLedger({ todayYmd: today, row, data, promise: { promisedYmd: '2026-10-03', markedByName: 'Rosa' }, claim: said, runway, inCollections: false })
    expect(l.rows.map((r) => r.key)).toEqual(['billed', 'claim', 'lien'])
    expect(l.full).toBe('Billed Sep 23 · 7d ago · They say paid Sep 28 · 2d ago · Lien by Dec 15 · 76d')
  })
})

describe('buildBilledDatesLedger with a Pay calendar (punch list #323): Due on the row, Expected under it', () => {
  // Today is Thursday 2026-11-12. Larkfield Construction pays the 10th of the month after a bill is in, and its four
  // measured payments landed 0, 6, 6 and 14 days after their due days. Its median pay speed is 41 days.
  const calToday = '2026-11-12'
  const tenth = { cutoffDay: null, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '§ 5.2', words: '' }
  const lark: PaySpeedData = {
    company: { medianDays: 12, samples: 200 },
    customers: { lark: { medianDays: 41, samples: 4 } },
    segments: { residential: null, commercial: null },
    customerTypes: { lark: 'commercial' },
    receipts: {
      lark: [
        { billedYmd: '2026-10-06', paidYmd: '2026-11-10', gapDays: 35, jobId: null, jobName: null, address: null },
        { billedYmd: '2026-10-27', paidYmd: '2026-11-16', gapDays: 20, jobId: null, jobName: null, address: null },
        { billedYmd: '2026-09-03', paidYmd: '2026-10-24', gapDays: 51, jobId: null, jobName: null, address: null },
        { billedYmd: '2026-08-20', paidYmd: '2026-09-16', gapDays: 27, jobId: null, jobName: null, address: null },
      ],
    },
    quality: null,
  }
  const billed = (ymd: string, customerId = 'lark') => ({ billedAtIso: null, estBillYmd: ymd, customerId, payerName: 'Larkfield Construction' })
  const money = (l: ReturnType<typeof buildBilledDatesLedger>) => l.rows.find((r) => r.key === 'money')!

  it('a bill not yet due: Due and its day, green, with when their money usually lands under it', () => {
    const l = buildBilledDatesLedger({ todayYmd: calToday, row: billed('2026-11-03'), data: lark, promise: null, runway: null, inCollections: false, calendar: tenth })
    expect(l.rows.map(line)).toEqual(['Billed Nov 3 9d ago', 'Due Dec 10 in 28d'])
    expect(money(l)).toMatchObject({ label: 'Due', tone: 'green', sub: 'Usually lands about Dec 16', subTitle: 'Usually lands about 6d after. About Dec 16.', action: 'they-said' })
    expect(money(l).title).toContain('A bill in by the last day of the month is paid the 10th of the next month.')
    expect(l.full).toBe('Billed Nov 3 · 9d ago · Due Dec 10 · in 28d')
  })

  it('without the calendar the same bill reads Expected Dec 14, as before', () => {
    const l = buildBilledDatesLedger({ todayYmd: calToday, row: billed('2026-11-03'), data: lark, promise: null, runway: null, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Nov 3 9d ago', 'Expected Dec 14 in 32d'])
    expect(money(l).sub).toBe('')
  })

  it('a bill past its due day reads amber, though the pace guess had it 25 days out', () => {
    const now = buildBilledDatesLedger({ todayYmd: calToday, row: billed('2026-10-27'), data: lark, promise: null, runway: null, inCollections: false })
    expect(line(money(now))).toBe('Expected Dec 7 in 25d')
    const l = buildBilledDatesLedger({ todayYmd: calToday, row: billed('2026-10-27'), data: lark, promise: null, runway: null, inCollections: false, calendar: tenth })
    expect(line(money(l))).toBe('Due Nov 10 2d past')
    expect(money(l)).toMatchObject({ tone: 'amber', sub: 'Usually lands about Nov 16' })
  })

  it('reads red in Collections, and says so when the payer has no payment on record', () => {
    const l = buildBilledDatesLedger({ todayYmd: calToday, row: billed('2026-10-27', 'newco'), data: lark, promise: null, runway: null, inCollections: true, calendar: tenth })
    expect(money(l)).toMatchObject({ label: 'Due', tone: 'red', sub: 'No payment on record yet' })
  })

  it('weighs the lien against the expected day, not the due day', () => {
    // A direct job, last work Sep 20 on a residential property: lien by Dec 15. Due Nov 10 has passed, but their money
    // is expected Nov 16, 29 days before the lien's last day. So the lien is a ring and the verdict is the slack.
    const runway = buildLienPayRunway({ todayYmd: calToday, openBalance: 22750, lastWorkYmd: '2026-09-20', propertyKind: 'residential', expectedPayYmd: '2026-11-16', filedYmd: null, releasedYmd: null, isSub: false })
    const l = buildBilledDatesLedger({ todayYmd: calToday, row: billed('2026-10-27'), data: lark, promise: null, runway, inCollections: false, calendar: tenth })
    expect(l.rows.map((r) => r.label)).toEqual(['Billed', 'Due', 'Lien'])
    expect(l.rows[2]).toMatchObject({ bold: false, dot: 'ring' })
    expect(l.verdict).toMatchObject({ label: 'Can run late', value: `${daysBetweenYmd('2026-11-16', runway.lienByYmd)}d` })
  })

  it('a date the customer named still takes the row, with the due day as the line under it', () => {
    const l = buildBilledDatesLedger({ todayYmd: calToday, row: billed('2026-10-27'), data: lark, promise: { promisedYmd: '2026-11-20', markedByName: 'Rosa' } as never, runway: null, inCollections: false, calendar: tenth })
    expect(line(money(l))).toBe('They said Nov 20 in 8d')
    expect(money(l)).toMatchObject({ sub: 'due Nov 10 by their pay calendar', action: 'new-date' })
  })
})

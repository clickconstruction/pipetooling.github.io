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

  it('the money is expected after the deadline: the row goes red and the line under the rule speaks of the money alone, on a sub and on a direct job', () => {
    const late = { promisedYmd: '2026-10-20', markedByName: 'Wendi' }
    const sub = buildBilledDatesLedger({ todayYmd: today, row, data, promise: late, runway: buildLienPayRunway(runwayInput({ expectedPayYmd: '2026-10-20' })), inCollections: false })
    expect(sub.rows[2]).toMatchObject({ key: 'notice', label: 'Lien notice', tone: 'red', bold: true })
    expect(sub.verdict).toMatchObject({ label: 'Money lands too late', value: '5d short', tone: 'red' })
    const runway = buildLienPayRunway(runwayInput({ isSub: false, lastWorkYmd: '2026-07-10', expectedPayYmd: '2026-10-20' }))
    expect(runway.state).toBe('file_first')
    const direct = buildBilledDatesLedger({ todayYmd: today, row, data, promise: late, runway, inCollections: false })
    const short = daysBetweenYmd(runway.lienByYmd, '2026-10-20')!
    expect(direct.rows[2]).toMatchObject({ key: 'lien', label: 'File the affidavit', tone: 'red', bold: true, dot: 'filled' })
    expect(direct.verdict).toMatchObject({ label: 'Money lands too late', value: `${short}d short`, tone: 'red' })
  })

  it('past expected on a direct job with the lien far off: the lien is a plain ring and the verdict asks for a date; red in Collections', () => {
    const runway = buildLienPayRunway(runwayInput({ todayYmd: '2026-10-05', isSub: false }))
    expect(runway.state).toBe('no_pay')
    const l = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway, inCollections: false })
    expect(l.rows.map(line)).toEqual(['Billed Sep 23 12d ago', 'Expected Oct 4 1d past', 'Lien by Nov 16 42d'])
    // #87 J: the pay estimate counts from the bill date; the lien row counts from the last work month, so the hover names only the first.
    expect(l.rows[0]?.title).toBe('The bill went out Sep 23 — the day the pay estimate below counts from')
    expect(l.rows[2]).toMatchObject({ label: 'Lien', tone: 'plain', bold: false, dot: 'ring' })
    // v2.7042: no count beside it, since the Expected row already says 1d past.
    expect(l.verdict).toMatchObject({ label: 'Ask for a date', value: '', tone: 'amber', action: 'they-said' })
    const c = buildBilledDatesLedger({ todayYmd: '2026-10-05', row, data, promise: null, runway, inCollections: true })
    expect(c.rows[1]?.tone).toBe('red')
    expect(c.verdict?.tone).toBe('red')
    // Inside three weeks the lien row itself asks, and nothing repeats it.
    const near = buildBilledDatesLedger({ todayYmd: '2026-11-01', row, data, promise: null, runway: buildLienPayRunway(runwayInput({ todayYmd: '2026-11-01', isSub: false })), inCollections: false })
    expect(near.rows[2]).toMatchObject({ label: 'File the affidavit', bold: true, tone: 'amber' })
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

  it('the line under the lien row never says the row’s day and count again (v2.7042, punch list #325)', () => {
    // The chip names the row's own day: only its words are drawn.
    const same = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false, lienState: { words: 'Needs the owner · by Oct 15 · 2d', lead: 'Needs the owner', dueOn: '2026-10-15', paper: 'notice', action: 'find_owner', tone: 'red' } })
    expect(same.rows[2]).toMatchObject({ key: 'notice', date: 'Oct 15', sub: 'Needs the owner', subTone: 'red' })
    // The chip is about the row's own paper and names another day (a month already closed on the same notice): the clock's day stands alone.
    const twoDays = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false, lienState: { words: 'Approve the notice · by Sep 15 · 13d late', lead: 'Approve the notice', dueOn: '2026-09-15', paper: 'notice', action: 'approve', tone: 'red' } })
    expect(twoDays.rows[2]).toMatchObject({ key: 'notice', date: 'Oct 15', sub: 'Approve the notice' })
    // Another paper keeps its own day: a retainage notice under the notice row.
    const other = buildBilledDatesLedger({ todayYmd: today, row, data, promise: null, runway: buildLienPayRunway(runwayInput()), inCollections: false, lienState: { words: 'Retainage · Notice to draft · by Oct 30 · 17d', lead: 'Retainage · Notice to draft', dueOn: '2026-10-30', paper: 'retainage', action: 'draft', tone: 'amber' } })
    expect(other.rows[2]?.sub).toBe('Retainage · Notice to draft · by Oct 30 · 17d')
    // The row asks to file and the desk's move is filing: one line, not two. Nov 12, four days before the affidavit's day, the money long past.
    const late = '2026-11-12'
    const fileRunway = buildLienPayRunway(runwayInput({ todayYmd: late, noticedMonths: ['2026-08'], expectedPayYmd: '2026-10-04' }))
    const file = buildBilledDatesLedger({ todayYmd: late, row, data, promise: null, runway: fileRunway, inCollections: false, lienState: { words: 'File the affidavit · by Nov 16 · 4d', lead: 'File the affidavit', dueOn: '2026-11-16', paper: 'affidavit', action: 'file_affidavit', tone: 'red' } })
    expect(file.rows[2]).toMatchObject({ key: 'lien', label: 'File the affidavit', date: 'Nov 16', far: '4d', bold: true, sub: '' })
    expect(file.rows[2]?.subTone).toBeUndefined()
    // An earlier step on the same paper stays, without its day.
    const draft = buildBilledDatesLedger({ todayYmd: late, row, data, promise: null, runway: fileRunway, inCollections: false, lienState: { words: 'Affidavit to draft · by Nov 16 · 4d', lead: 'Affidavit to draft', dueOn: '2026-11-16', paper: 'affidavit', action: 'draft', tone: 'red' } })
    expect(draft.rows[2]).toMatchObject({ label: 'File the affidavit', sub: 'Affidavit to draft', subTone: 'red' })
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

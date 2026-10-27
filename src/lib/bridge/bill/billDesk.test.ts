import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { buildBillPile, type BillPileJob } from '../billPile'
import type { PctPoint } from '../buildPace'
import type { VectorSession } from '../vectors'
import { BILL_SAME_DAY_TOLERANCE_DAYS, BILL_SCORECARD_WEEKS, billDeskFacts, buildBillDesk, hoursByJobInWindow, pct100SinceYmd, readyDayFor, scorecardStart, shapeBillDeskBills, shapeBillDeskJobs, type BillDeskInput, type BillDeskInvoiceRow } from './billDesk'

const TODAY = '2026-10-26'
const WINDOW_START = '2026-08-31'
const md = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const plain = (s: string) => expect(plainWordsFailures(s), s).toEqual([])

const job = (id: string, status: string, revenueUsd: number | null, pctComplete: number | null, billedUsd = 0, paymentsUsd = 0): BillPileJob => ({ id, status, revenueUsd, pctComplete, billedUsd, paymentsUsd })
const jobs: BillPileJob[] = [
  job('j1024', 'working', 4_100, 100),
  job('j1051', 'working', 8_800, 100, 5_200),
  job('j1017', 'working', null, null),
  job('j1081', 'ready_to_bill', 9_600, null),
  job('j977', 'ready_to_bill', 9_500, null, 4_100),
  job('j1044', 'ready_to_bill', 9_700, null, 0, 6_100),
  job('jguess', 'working', 10_000, null),
]
const labels = new Map<string, string>([
  ['j1024', '1024 · Lawver install'],
  ['j1051', '1051 · Patel repipe'],
  ['j1017', '1017 · Terrell'],
  ['j1081', '1081 · Adams Pretest'],
  ['j977', '977 · Springtown'],
  ['j1044', '1044 · H & I Creekside'],
  ['jguess', 'G1 · A guess'],
  ['j473', '473 · Mike Holub'],
  ['j1087', '1087 · Edwards Ranch'],
  ['j1046', '1046 · Pretest'],
  ['j1048', '1048 · Tison per plans'],
  ['j1007', '1007 · SPACEX pay app 3'],
  ['j1075', '1075 · DRF Line Repair'],
  ['j804', '804 · Summit Auto Zone'],
])
const points: PctPoint[] = [
  { jobId: 'j1024', atYmd: '2026-09-10', pct: 80, source: 'hand' },
  { jobId: 'j1024', atYmd: '2026-09-19', pct: 100, source: 'hand' },
  { jobId: 'j1051', atYmd: '2026-10-05', pct: 100, source: 'report' },
]
const sessions: VectorSession[] = [
  { userId: 'u1', workDate: '2026-10-20', hours: 30, jobId: 'j1017', onBid: false, officeJob: false, approved: true, pending: false },
  { userId: 'u2', workDate: '2026-10-21', hours: 8, jobId: 'j1017', onBid: false, officeJob: false, approved: false, pending: true },
  { userId: 'u2', workDate: '2026-10-21', hours: 5, jobId: 'j1017', onBid: false, officeJob: false, approved: false, pending: false },
]
const readyDaysByJob = new Map<string, string[]>([
  ['j1081', ['2026-10-20']],
  ['j977', ['2026-09-01', '2026-10-23']],
  ['j1044', ['2026-10-24']],
  ['j1087', ['2026-10-21']],
  ['j1046', ['2026-10-17']],
  ['j1048', ['2026-10-16']],
  ['j1007', ['2026-10-10', '2026-10-25']],
  ['j1075', ['2026-10-09']],
  ['j804', ['2026-10-06']],
])
const inv = (id: string, jobId: string, usd: number, billedYmd: string, over: Partial<BillDeskInvoiceRow> = {}): BillDeskInvoiceRow => ({ id, jobId, usd, billedYmd, sentFromHere: true, sentByName: 'Taunya', status: 'billed', ...over })
const invoices: BillDeskInvoiceRow[] = [
  inv('i1051', 'j1051', 5_200, '2026-10-02'),
  inv('i473', 'j473', 1_500, '2026-10-12', { sentFromHere: false, sentByName: null }),
  inv('i1087', 'j1087', 645, '2026-10-21'),
  inv('i1046', 'j1046', 1_350, '2026-10-23'),
  inv('i1048', 'j1048', 4_800, '2026-10-16', { sentByName: 'Dana' }),
  inv('i1007', 'j1007', 11_800, '2026-10-14'),
  inv('i1075', 'j1075', 2_210, '2026-10-09', { sentByName: 'Dana', status: 'paid' }),
  inv('i804', 'j804', 3_100, '2026-10-06'),
  // Paid and hand-marked: never a leak. Old: outside the scorecard's weeks.
  inv('ipaid', 'j1075', 900, '2026-09-01', { sentFromHere: false, sentByName: null, status: 'paid' }),
  inv('iold', 'j804', 500, '2026-08-20', { sentFromHere: false, sentByName: null }),
]

const pile = buildBillPile({ jobs, points, todayYmd: TODAY })
const shapedJobs = shapeBillDeskJobs({ pile, jobs, points, sessions, labels, readyDaysByJob, invoices, windowStart: WINDOW_START, todayYmd: TODAY })
const shapedBills = shapeBillDeskBills({ invoices, labels, readyDaysByJob, todayYmd: TODAY })
const input: BillDeskInput = {
  todayYmd: TODAY,
  windowStart: WINDOW_START,
  pile: { knownUsd: pile.knownUsd, readyUsd: pile.items.filter((i) => i.source === 'ready').reduce((s, i) => s + i.usd, 0) },
  pace: { inPerWeekUsd: 52_900, outPerWeekUsd: 56_300, weeks: pile.knownUsd / 56_300, windowWeeks: 8 },
  flows: { billedUsd: 444_000, paidUsd: 268_000, arTotalUsd: 259_000 },
  companyPaceDays: 7,
  jobs: shapedJobs,
  bills: shapedBills,
  dayLabel: md,
}
const desk = buildBillDesk(input)

describe('the shapers', () => {
  it('reads the ready day on or before a day, the day the % reached 100, and the field hours by job', () => {
    expect(readyDayFor(['2026-10-10', '2026-10-25'], '2026-10-14')).toBe('2026-10-10')
    expect(readyDayFor(['2026-10-10', '2026-10-25'], TODAY)).toBe('2026-10-25')
    expect(readyDayFor(undefined, TODAY)).toBeNull()
    expect(pct100SinceYmd(points.filter((p) => p.jobId === 'j1024'), TODAY)).toBe('2026-09-19')
    expect(pct100SinceYmd([{ jobId: 'x', atYmd: '2026-09-01', pct: 100, source: 'hand' }, { jobId: 'x', atYmd: '2026-09-05', pct: 90, source: 'hand' }], TODAY)).toBeNull()
    // Approved and pending count; a closed session neither approved nor pending does not.
    expect(hoursByJobInWindow(sessions, WINDOW_START, TODAY).get('j1017')).toBe(38)
    const patel = shapedJobs.find((j) => j.id === 'j1051')!
    expect(patel).toMatchObject({ label: '1051 · Patel repipe', readyYmd: null, pct100SinceYmd: '2026-10-05', newestBillYmd: '2026-10-02', hoursInWindow: 0 })
    const spacex = shapedBills.find((b) => b.id === 'i1007')!
    expect(spacex.readyYmd).toBe('2026-10-10')
    expect(shapedBills.find((b) => b.id === 'i473')).toMatchObject({ jobLabel: '473 · Mike Holub', readyYmd: null, sentFromHere: false, paid: false })
  })
})

describe('the Bill desk (v2.5930)', () => {
  it('builds to the owner’s defaults', () => {
    expect(BILL_SAME_DAY_TOLERANCE_DAYS).toBe(0)
    expect(BILL_SCORECARD_WEEKS).toBe(8)
    expect(scorecardStart(TODAY)).toBe('2026-09-06')
  })

  it('finds the four leaks by crossing reads, biggest dollars first, each with its clock, its proof and its door', () => {
    expect(desk.leaks.map((l) => [l.kind, l.jobId, l.amountText, l.satText])).toEqual([
      ['never-billed', 'j1024', '$4.1k', '5 weeks'],
      ['remainder', 'j1051', '$3.6k', '3 weeks'],
      ['hand-marked', 'j473', '$1.5k', '2 weeks'],
      ['no-price', 'j1017', '38 h', 'no clock'],
    ])
    expect(desk.leaksUsd).toBe(9_200)
    expect(desk.leaks[0]!.detail).toBe('1024 Lawver install reads 100% since Sep 19. No bill was ever made.')
    expect(desk.leaks[0]!.door).toEqual({ label: 'Bill it', to: '/jobs?tab=billing' })
    expect(desk.leaks[1]!.detail).toBe('1051 Patel repipe billed $5.2k of $8.8k on Oct 2. The rest has no bill and no date.')
    expect(desk.leaks[1]!.proof).toContain('the bills cover $5.2k')
    expect(desk.leaks[1]!.door.label).toBe('Bill the rest')
    expect(desk.leaks[2]!.detail).toBe('473 Mike Holub was marked billed Oct 12 with no send on file.')
    expect(desk.leaks[2]!.door).toEqual({ label: 'Open the bill', to: '/jobs?tab=billing' })
    expect(desk.leaks[3]!.detail).toBe('1017 Terrell has hours and no contract price. Its finished work reads $0 forever.')
    expect(desk.leaks[3]!.door).toEqual({ label: 'Price the job', to: '/jobs?tab=stages&edit=j1017' })
    // The ready jobs and the guess stay out of the leaks; a paid bill and an old one never leak.
    expect(desk.leaks.some((l) => ['j1081', 'j977', 'j1044', 'jguess', 'j1075', 'j804'].includes(l.jobId))).toBe(false)
  })

  it('names payments when they cover more than the bills (the honesty rule)', () => {
    const paidPart = buildBillDesk({ ...input, jobs: shapedJobs.map((j) => (j.id === 'j1051' ? { ...j, billedUsd: 0, paymentsUsd: 5_200, item: { ...j.item } } : j)) })
    const row = paidPart.leaks.find((l) => l.jobId === 'j1051')!
    expect(row.detail).toBe('1051 Patel repipe has payments covering $5.2k of $8.8k. The rest has no bill and no date.')
    expect(row.proof).toContain('the payments cover $5.2k')
  })

  it('draws the fast lane with the days sat and the cover words, biggest remainder first', () => {
    expect(desk.fast.map((r) => [r.label, r.usd, r.satText, r.coverText, r.late])).toEqual([
      ['1081 · Adams Pretest', 9_600, 'sat 6 days', 'nothing billed yet', true],
      ['977 · Springtown', 5_400, 'sat 3 days', 'bills cover $4.1k of $9.5k', true],
      ['1044 · H & I Creekside', 3_600, 'sat 2 days', 'payments cover $6.1k of $9.7k', true],
    ])
    expect(desk.fastUsd).toBe(18_600)
    expect(desk.fast[0]!.door).toEqual({ label: 'Bill it', to: '/jobs?tab=billing' })
    const noDay = buildBillDesk({ ...input, jobs: shapedJobs.map((j) => (j.id === 'j1081' ? { ...j, readyYmd: null } : j)) })
    expect(noDay.fast[0]).toMatchObject({ satText: 'no ready day on record', satDays: null, late: false })
  })

  it('scores billed the day it finished over the window’s bills with a ready day, per pay week and per bill', () => {
    const s = desk.scorecard
    expect([s.sameDay, s.withReady, s.noReady]).toEqual([4, 6, 2])
    expect(s.headText).toBe('4 of 6')
    expect(s.lateCashDays).toBe(6 * 1_350 + 4 * 11_800)
    expect(s.costLabel).toBe('late sends cost $55.3k·days this window')
    expect(s.weeks.map((w) => w.label)).toEqual(['Sep 6', 'Sep 13', 'Sep 20', 'Sep 27', 'Oct 4', 'Oct 11', 'Oct 18', 'Oct 25'])
    expect(s.weeks.map((w) => `${w.same}/${w.sent}`)).toEqual(['0/0', '0/0', '0/0', '0/0', '2/2', '1/2', '1/2', '0/0'])
    expect(s.weeks.map((w) => w.tone)).toEqual(['none', 'none', 'none', 'none', 'good', 'bad', 'bad', 'none'])
    expect(s.rows.map((r) => [r.bill, r.readyText, r.billedText, r.lagText, r.sentBy, r.cashDaysText])).toEqual([
      ['1046 · Pretest · $1.4k', 'Oct 17', 'Oct 23', '6 days', 'Taunya', '$8.1k·d'],
      ['1087 · Edwards Ranch · $645', 'Oct 21', 'Oct 21', 'same day', 'Taunya', '0'],
      ['1048 · Tison per plans · $4.8k', 'Oct 16', 'Oct 16', 'same day', 'Dana', '0'],
      ['1007 · SPACEX pay app 3 · $11.8k', 'Oct 10', 'Oct 14', '4 days', 'Taunya', '$47.2k·d'],
      ['473 · Mike Holub · $1.5k', '—', 'Oct 12', '—', 'by hand', '—'],
      ['1075 · DRF Line Repair · $2.2k', 'Oct 9', 'Oct 9', 'same day', 'Dana', '0'],
      ['804 · Summit Auto Zone · $3.1k', 'Oct 6', 'Oct 6', 'same day', 'Taunya', '0'],
      ['1051 · Patel repipe · $5.2k', '—', 'Oct 2', '—', 'Taunya', '—'],
    ])
    expect(s.noReadyLine).toBe('2 bills have no ready day on record. They sit in the table with a dash.')
  })

  it('writes the headline, the verdict, the sub-line, the pipe and the meter', () => {
    expect(desk.headline).toBe('Where billing leaks: $9.2k will not bill itself.')
    expect(desk.facts.verdict).toBe('$18.6k the office already called done waits on a send.')
    expect(desk.facts.subLine).toBe('the field finishes $52.9k a week · the office bills $56.3k a week · 0.5 weeks to bill what is already finished')
    expect(desk.facts.pipe).toMatchObject({ finishedUsd: 423_200, unbilledUsd: 26_300, unbilledReadyUsd: 18_600, unbilledPctUsd: 7_700, billedUsd: 444_000, arUsd: 259_000, paidUsd: 268_000 })
    expect(desk.facts.meter.value).toBe('$184k·days')
    expect(desk.facts.meter.words).toEqual(["Billed today, $26.3k starts its payers' clocks now.", 'Customers pay in about 7 days.', 'Sitting one more week moves all of it a week right.'])
    const empty = buildBillDesk({ ...input, jobs: [], bills: [], pile: { knownUsd: 0, readyUsd: 0 }, pace: { ...input.pace, weeks: 0 }, companyPaceDays: null })
    expect(empty.headline).toBe('Where billing leaks: nothing the reads can prove today.')
    expect(empty.facts.verdict).toBe('Nothing waits on a send today.')
    expect(empty.scorecard.headText).toBe('no bill with a ready day')
    expect(empty.facts.meter.words).toHaveLength(2)
    const onlyNoPrice = buildBillDesk({ ...input, jobs: shapedJobs.filter((j) => j.id === 'j1017'), bills: [] })
    expect(onlyNoPrice.headline).toBe('Where billing leaks: 1 job has no price to bill.')
    expect(billDeskFacts({ ...input, pace: { ...input.pace, weeks: null } }).subLine).toContain('no pace to read')
  })

  it('holds every sentence to the plain-words rule', () => {
    const sentences: string[] = [desk.headline, desk.facts.verdict, desk.leaksNote, desk.fastNote, desk.facts.pipe.line, ...desk.facts.meter.words, ...desk.footnote]
    for (const l of desk.leaks) sentences.push(l.head, l.detail, l.proof)
    for (const r of desk.fast) sentences.push(r.satText, r.coverText)
    if (desk.scorecard.noReadyLine) sentences.push(desk.scorecard.noReadyLine)
    const empty = buildBillDesk({ ...input, jobs: [], bills: [], pile: { knownUsd: 0, readyUsd: 0 } })
    sentences.push(empty.headline, empty.facts.verdict, empty.leaksNote, empty.fastNote)
    for (const s of sentences) plain(s)
    expect(sentences.length).toBeGreaterThan(30)
  })
})

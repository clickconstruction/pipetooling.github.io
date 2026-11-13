import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { BillPileItem } from '../billPile'
import { BILL_SCORECARD_WEEKS, billDeskFacts, buildBillDesk, type BillDeskBill, type BillDeskInput, type BillDeskJob } from './billDesk'
import { BILL_STEP_NOTHING, billHowCounted, billStepHeadline, billStepLine, billStepWords } from './billStepWindow'

// Made-up jobs and figures throughout.
const TODAY = '2026-10-26'
const md = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const job = (id: string, label: string, status: string, revenueUsd: number | null, item: BillPileItem, over: Partial<BillDeskJob> = {}): BillDeskJob => ({ id, label, status, revenueUsd, billedUsd: 0, paymentsUsd: 0, item, readyYmd: null, pct100SinceYmd: null, newestPctYmd: null, newestBillYmd: null, hoursInWindow: 0, ...over })
const bill = (id: string, jobId: string, jobLabel: string, usd: number, billedYmd: string, readyYmd: string | null, over: Partial<BillDeskBill> = {}): BillDeskBill => ({ id, jobId, jobLabel, usd, billedYmd, sentFromHere: true, sentByName: 'Avery', readyYmd, paid: false, ...over })

const ridgeway = job('j2101', '2101 · Ridgeway tower', 'working', 30_000, { id: 'j2101', usd: 19_000, pct: 100, source: 'hand' }, { billedUsd: 11_000, newestPctYmd: '2026-09-21', newestBillYmd: '2026-09-28' })
const cedar = job('j2122', '2122 · Cedar Bend', 'working', 20_000, { id: 'j2122', usd: 13_000, pct: 100, source: 'hand' }, { billedUsd: 7_000, newestPctYmd: '2026-10-12', newestBillYmd: '2026-10-16' })
const juniper = job('j2130', '2130 · Juniper Flats', 'working', 5_000, { id: 'j2130', usd: 2_000, pct: 100, source: 'report' }, { billedUsd: 3_000, newestPctYmd: '2026-10-20', newestBillYmd: '2026-10-25' })
const marlow = job('j2140', '2140 · Marlow clinic', 'working', 4_100, { id: 'j2140', usd: 4_100, pct: 100, source: 'hand' }, { pct100SinceYmd: '2026-09-19', newestPctYmd: '2026-09-19' })
const hollis = job('j2150', '2150 · Hollis barn', 'working', null, { id: 'j2150', usd: 0, pct: null, source: 'no-price' }, { hoursInWindow: 38 })
const pine = job('j2151', '2151 · Pine Hollow', 'working', null, { id: 'j2151', usd: 0, pct: null, source: 'no-price' }, { hoursInWindow: 12 })
const quarry = job('j2160', '2160 · Quarry Road', 'ready_to_bill', 9_600, { id: 'j2160', usd: 9_600, pct: null, source: 'ready' }, { readyYmd: '2026-10-20' })
const larkspur = job('j2161', '2161 · Larkspur', 'ready_to_bill', 9_500, { id: 'j2161', usd: 5_400, pct: null, source: 'ready' }, { billedUsd: 4_100, readyYmd: '2026-10-23' })

const bills: BillDeskBill[] = [
  bill('i1', 'j2170', '2170 · Sable Creek', 1_500, '2026-10-12', null, { sentFromHere: false, sentByName: null }),
  bill('i2', 'j2171', '2171 · Tamarack', 2_500, '2026-10-14', '2026-10-10', { sentFromHere: false, sentByName: null }),
  bill('i3', 'j2172', '2172 · Wren Street', 645, '2026-10-21', '2026-10-21'),
  bill('i4', 'j2173', '2173 · Osprey Point', 1_350, '2026-10-23', '2026-10-17'),
  bill('i5', 'j2174', '2174 · Fennel Court', 4_800, '2026-10-16', '2026-10-16'),
  bill('i6', 'j2175', '2175 · Alder Row', 2_210, '2026-10-09', '2026-10-09'),
  bill('i7', 'j2176', '2176 · Briar Mill', 3_100, '2026-10-06', '2026-10-06'),
]

const input = (over: Partial<BillDeskInput> = {}): BillDeskInput => ({
  todayYmd: TODAY,
  windowStart: '2026-08-31',
  pile: { knownUsd: 53_100, readyUsd: 15_000 },
  pace: { inPerWeekUsd: 33_500, outPerWeekUsd: 39_000, weeks: 1.4, windowWeeks: 8 },
  flows: { billedUsd: 312_000, paidUsd: 204_000, arTotalUsd: 240_000 },
  companyPaceDays: 7,
  jobs: [ridgeway, cedar, juniper, marlow, hollis, pine, quarry, larkspur],
  bills,
  dayLabel: md,
  ...over,
})
const plain = (s: string) => expect(plainWordsFailures(s), s).toEqual([])

describe('billStepWindow (punch list #334, PR 1)', () => {
  it('opens on the finished work with no bill, and says the pile in weeks of the office pace', () => {
    const facts = billDeskFacts(input())
    expect(billStepHeadline(facts)).toBe('$53.1k of finished work has no bill.')
    // 312k billed over 8 weeks is 39k a week; 53.1k over 39k rounds to one.
    expect(billStepLine(facts)).toBe('The office bills $39k a week. So this is about one week of work.')
    expect(billStepLine(billDeskFacts(input({ pile: { knownUsd: 120_000, readyUsd: 0 } })))).toBe('The office bills $39k a week. So this is about 3 weeks of work.')
    expect(billStepLine(billDeskFacts(input({ pile: { knownUsd: 9_000, readyUsd: 0 } })))).toBe('The office bills $39k a week. So this is under one week of work.')
    const none = billDeskFacts(input({ pile: { knownUsd: 0, readyUsd: 0 } }))
    expect(billStepHeadline(none)).toBe('Every finished job has a bill.')
    expect(billStepLine(none)).toBe('The office bills $39k a week.')
    expect(billStepLine(billDeskFacts(input({ flows: { billedUsd: 0, paidUsd: 0, arTotalUsd: null } })))).toBe('The office sent no bill in this window.')
  })

  it('leads with the ready jobs as one row, then the two largest jobs, then the jobs with no price as one row', () => {
    const desk = buildBillDesk(input())
    const w = billStepWords(desk.facts, desk)
    expect(w.doRows.map((r) => [r.kind, r.title, r.sub, r.press, r.to])).toEqual([
      ['ready', 'Bill 2 jobs marked ready to bill', '$15k. The office already called them done.', 'Open Billing', '/jobs?tab=billing'],
      ['remainder', 'Bill the rest of 2101 Ridgeway tower', '$19k left. Part-billed 4 weeks ago.', 'Open the bill', '/jobs?tab=billing'],
      ['remainder', 'Bill the rest of 2122 Cedar Bend', '$13k left. Part-billed last week.', 'Open the bill', '/jobs?tab=billing'],
      ['no-price', 'Price 2 jobs that have hours', 'With no price their work never bills.', 'Set prices', undefined],
    ])
    expect(w.doRows[3]!.pressOpen).toBe('Hide the jobs')
    expect(w.noPrice.map((l) => [l.label, l.amountText, l.door.label, l.door.to])).toEqual([
      ['2150 · Hollis barn', '38 h', 'Price the job', '/jobs?tab=stages&edit=j2150'],
      ['2151 · Pine Hollow', '12 h', 'Price the job', '/jobs?tab=stages&edit=j2151'],
    ])
    expect(w.askRows.map((r) => [r.kind, r.title, r.sub, r.press, r.pressOpen, r.to])).toEqual([['hand-marked', '2 bills marked billed by hand', '$4k. Nothing on record went out.', 'See the 2', 'Hide the 2', undefined]])
    expect(w.ruleLine).toBe('4 of 6 bills went out the day the job finished.')
    // Every leak stays behind the fold: the four with dollars and the two with no price.
    expect(w.leakCount).toBe(6)
    expect(desk.leaks).toHaveLength(6)
  })

  it('names a finished job that was never billed when it is among the two largest, and a remainder payments cover', () => {
    const bigNever = { ...marlow, revenueUsd: 40_000, item: { ...marlow.item, usd: 40_000 } }
    const paidPart = { ...cedar, billedUsd: 0, paymentsUsd: 7_000 }
    const desk = buildBillDesk(input({ jobs: [ridgeway, paidPart, bigNever] }))
    const w = billStepWords(desk.facts, desk)
    expect(w.doRows.map((r) => [r.kind, r.title, r.sub, r.press])).toEqual([
      ['never-billed', 'Bill 2140 Marlow clinic', '$40k. Finished 5 weeks ago and never billed.', 'Bill it'],
      ['remainder', 'Bill the rest of 2101 Ridgeway tower', '$19k left. Part-billed 4 weeks ago.', 'Open the bill'],
    ])
    const third = buildBillDesk(input({ jobs: [paidPart, { ...juniper, newestBillYmd: '2026-10-25' }] }))
    expect(billStepWords(third.facts, third).doRows.map((r) => r.sub)).toEqual(['$13k left. The rest has no bill.', '$2k left. Part-billed this week.'])
  })

  it('speaks of one job, one bill and no bill in their own words', () => {
    const one = buildBillDesk(input({ jobs: [hollis, quarry], bills: [bills[0]!, bills[2]!] }))
    const w = billStepWords(one.facts, one)
    expect(w.doRows.map((r) => [r.title, r.sub])).toEqual([
      ['Bill 1 job marked ready to bill', '$9.6k. The office already called it done.'],
      ['Price 1 job that has hours', 'With no price its work never bills.'],
    ])
    expect(w.askRows.map((r) => [r.title, r.press, r.pressOpen])).toEqual([['1 bill marked billed by hand', 'See it', 'Hide it']])
    expect(w.ruleLine).toBe('The one bill sent went out the day the job finished.')
    const late = buildBillDesk(input({ jobs: [], bills: [bills[3]!] }))
    expect(billStepWords(late.facts, late).ruleLine).toBe('The one bill sent went out after the day the job finished.')
    const empty = buildBillDesk(input({ jobs: [], bills: [] }))
    const e = billStepWords(empty.facts, empty)
    expect(e.doRows).toEqual([])
    expect(e.askRows).toEqual([])
    expect(e.leakCount).toBe(0)
    expect(e.ruleLine).toBe(`No bill of the last ${BILL_SCORECARD_WEEKS} pay weeks has a ready day on record.`)
  })

  it('shows the headline and the line at once, and no row, while the reads are in flight', () => {
    const facts = billDeskFacts(input())
    expect(billStepWords(facts, null)).toEqual({ headline: '$53.1k of finished work has no bill.', line: 'The office bills $39k a week. So this is about one week of work.', doRows: [], noPrice: [], askRows: [], ruleLine: null, leakCount: null })
  })

  it('holds every sentence to the plain-words rule, and names no database column', () => {
    const sentences: string[] = [BILL_STEP_NOTHING, ...billHowCounted()]
    const desks = [buildBillDesk(input()), buildBillDesk(input({ jobs: [hollis, quarry, { ...marlow, pct100SinceYmd: null, newestPctYmd: null }, { ...cedar, billedUsd: 0, paymentsUsd: 7_000 }], bills: [bills[0]!, bills[3]!] })), buildBillDesk(input({ jobs: [], bills: [], pile: { knownUsd: 0, readyUsd: 0 }, flows: { billedUsd: 0, paidUsd: 0, arTotalUsd: null } }))]
    for (const d of desks) {
      const w = billStepWords(d.facts, d)
      sentences.push(w.headline, w.line)
      if (w.ruleLine) sentences.push(w.ruleLine)
      for (const r of [...w.doRows, ...w.askRows]) sentences.push(r.title, r.sub, r.press, r.pressOpen ?? '')
    }
    for (const s of sentences) plain(s)
    for (const s of billHowCounted()) {
      expect(s, s).not.toMatch(/_|%s|status change/)
      expect(s.endsWith('.'), s).toBe(true)
    }
  })
})

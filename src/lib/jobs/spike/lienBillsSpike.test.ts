import { describe, expect, it } from 'vitest'
import { readSpikeBillShape, spikeBillMarks, spikeJobBillsWords, spikeNoticeFor, spikeNoticeWords, spikePropertyGroups, spikePropertyMoneyWords, spikePropertySub, type SpikeBill } from './lienBillsSpike'
import type { LienPayRunway } from '../lienPayRunway'
import type { LienCalendarJob } from '../lienCalendar'
import type { LienCalendarRow } from '../lienCalendarBuckets'

function runway(months: LienPayRunway['noticeMonths']): LienPayRunway {
  return { state: 'notice_due', tone: 'amber', words: '', lines: [], title: '', chipLabel: '', lienByYmd: '', daysToLien: null, noticeByYmd: '', daysToNotice: null, kindAssumed: false, noticeSent: false, noticeMailed: false, datedFromCreation: false, datedByHand: false, basisYmd: '', closedBy: null, noticeMonths: months, endLabel: '', marks: null, sortKey: 0 }
}

function job(over: Partial<LienCalendarJob>): LienCalendarJob {
  return { jobId: 'j', number: '1', name: 'Job', customer: 'Owner', gcId: 'gc', gcName: 'GC', address: '628 Terrell Rd, San Antonio, TX 78209', openBalance: 0, isSub: true, runway: runway([]), addressId: null, ...over }
}

function bill(over: Partial<SpikeBill>): SpikeBill {
  return { invoiceId: 'i', jobId: 'j', number: '#1', what: '', sentYmd: '2026-08-20', monthKey: '2026-08', stripe: false, dueYmd: '', billed: 100, paid: 0, owed: 100, settled: false, ...over }
}

describe('spike: bills under a GC by property', () => {
  it('folds two property records and a shortened address at one property into one group, a different street apart', () => {
    const a = job({ jobId: 'a', number: '258', addressId: 'rec-1', openBalance: 9800 })
    const b = job({ jobId: 'b', number: '608', addressId: 'rec-2', openBalance: 2245 })
    const c = job({ jobId: 'c', number: '890', addressId: null, address: '628 Terrell Rd', openBalance: 285 })
    const d = job({ jobId: 'd', number: '273', addressId: 'rec-3', address: '9703 Lenox Hl San Antonio, TX', customer: 'Umar Khan', openBalance: 16685 })
    const rows: LienCalendarRow[] = [a, b, c, d].map((j) => ({ kind: 'job', key: j.jobId, job: j, closed: false }))
    const bills = new Map<string, SpikeBill[]>([
      ['a', [bill({ invoiceId: 'a1', jobId: 'a', number: '#1', sentYmd: '2026-05-13', monthKey: '2026-05', billed: 8000, paid: 8000, owed: 0, settled: true }), bill({ invoiceId: 'a2', jobId: 'a', number: '#2', billed: 9800, owed: 9800 })]],
      ['b', [bill({ invoiceId: 'b1', jobId: 'b', billed: 2245, owed: 2245 })]],
      ['d', [bill({ invoiceId: 'd1', jobId: 'd', sentYmd: '2026-03-16', monthKey: '2026-03', billed: 13420, paid: 900, owed: 12520 })]],
    ])
    const groups = spikePropertyGroups(rows, bills)
    expect(groups.map((g) => g.label)).toEqual(['628 Terrell Rd, San Antonio', '9703 Lenox Hl San Antonio'])
    const terrell = groups[0]!
    expect(terrell.rows.map((r) => r.job.number)).toEqual(['258', '608', '890'])
    expect(terrell.customer).toBe('Owner')
    // oldest billed day first
    expect(terrell.bills.map((r) => r.bill.invoiceId)).toEqual(['a1', 'a2', 'b1'])
    expect(terrell.totals).toEqual({ open: 12330, billsOpen: 12045, billsPaid: 8000, bills: 3, settled: 1, jobsWithoutBills: 1 })
    expect(spikePropertySub(terrell)).toBe('Owner · 3 jobs · 3 bills · 1 paid · 1 with no bill')
    expect(spikePropertyMoneyWords(terrell)).toBe('3 bills · $12,045 on the bills · $8,000 paid')
    expect(spikePropertyMoneyWords(groups[1]!)).toBe('1 bill · $12,520 on the bills · $900 paid')
    expect(spikeNoticeWords({ state: 'closed', monthKey: '2026-04', ymd: null }, true)).toEqual({ text: 'paid', tone: 'grey' })
  })

  it('names the notice by the bill’s month, and says so when none does', () => {
    const r = runway([
      { key: '2026-07', ymd: '2026-09-15', state: 'closed' },
      { key: '2026-08', ymd: '2026-10-15', state: 'sent' },
      { key: '2026-09', ymd: '2026-11-16', state: 'owed' },
    ])
    expect(spikeNoticeWords(spikeNoticeFor(bill({ monthKey: '2026-08' }), r))).toEqual({ text: 'Aug notice on file', tone: 'green' })
    expect(spikeNoticeWords(spikeNoticeFor(bill({ monthKey: '2026-09' }), r))).toEqual({ text: 'Sep notice owed', tone: 'amber' })
    expect(spikeNoticeWords(spikeNoticeFor(bill({ monthKey: '2026-07' }), r))).toEqual({ text: 'Jul window closed', tone: 'red' })
    expect(spikeNoticeWords(spikeNoticeFor(bill({ monthKey: '2026-03' }), r))).toEqual({ text: 'no notice names Mar', tone: 'grey' })
    expect(spikeNoticeWords(spikeNoticeFor(bill({ monthKey: '', sentYmd: '' }), r))).toEqual({ text: 'no billed day', tone: 'grey' })
  })

  it('puts a bill on the axis by its billed day and parks one before the edge at the edge', () => {
    const axis = { startYmd: '2026-10-14', pct: (ymd: string) => (ymd === '2026-10-20' ? 12.5 : 0) }
    const marks = spikeBillMarks(job({}), [bill({ sentYmd: '2026-10-20' }), bill({ invoiceId: 'old', sentYmd: '2026-03-16' }), bill({ invoiceId: 'none', sentYmd: '' })], axis)
    expect(marks.map((m) => [m.bill.invoiceId, m.pct, m.offAxis])).toEqual([
      ['i', 12.5, false],
      ['old', 0, true],
    ])
  })

  it('words a job’s bills under its money', () => {
    expect(spikeJobBillsWords(undefined)).toBe('no bill sent')
    expect(spikeJobBillsWords([bill({ number: '#922-1' })])).toBe('#922-1 · Aug 20')
    expect(spikeJobBillsWords([bill({ settled: true, owed: 0 }), bill({ owed: 9800 })])).toBe('2 bills · 1 paid · $9,800 open')
  })

  it('reads the dev toggle, off unless A or B', () => {
    expect(readSpikeBillShape({ getItem: () => 'B' })).toBe('B')
    expect(readSpikeBillShape({ getItem: () => 'x' })).toBe('off')
    expect(readSpikeBillShape(null)).toBe('off')
  })
})

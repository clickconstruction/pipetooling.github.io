import { describe, expect, it } from 'vitest'
import { billedListRows, stagesSectionHeader, stagesSectionLoadingSuffix } from './stagesSectionHeader'
import type { StageRow } from '../jobsStagesBoard'
import { billedStageRowAgingBucket, billedStageRowHasNoBillLine, stageRowBilledRemainingAmount } from './invoiceBilling'

describe('stagesSectionHeader', () => {
  it('reads the live rows when the scope is merged or a search is on', () => {
    expect(stagesSectionHeader({ useLive: true, live: { count: 7, total: 144_869.25 }, cached: { count: 99, total: 1 } })).toEqual({ count: '7', total: '144.8k' })
  })
  it('falls back to the cache’s stat, then to ellipses', () => {
    expect(stagesSectionHeader({ useLive: false, live: { count: 0, total: 0 }, cached: { count: 12, total: 1_250_000 } })).toEqual({ count: '12', total: '1.2m' })
    expect(stagesSectionHeader({ useLive: false, live: { count: 0, total: 0 }, cached: null })).toEqual({ count: '…', total: '…' })
    expect(stagesSectionHeader({ useLive: false, live: { count: 0, total: 0 }, cached: undefined })).toEqual({ count: '…', total: '…' })
  })
})

describe('stagesSectionLoadingSuffix', () => {
  it('says loading only on an open, unmerged section whose scope is busy', () => {
    expect(stagesSectionLoadingSuffix({ open: true, merged: false, busy: true })).toBe(' — loading')
    expect(stagesSectionLoadingSuffix({ open: false, merged: false, busy: true })).toBe('')
    expect(stagesSectionLoadingSuffix({ open: true, merged: true, busy: true })).toBe('')
    expect(stagesSectionLoadingSuffix({ open: true, merged: false, busy: false })).toBe('')
  })
})

describe('billedListRows', () => {
  // Real rows through the real readers: the kernel only picks, the readers decide.
  const NOW = new Date('2026-09-26T12:00:00Z')
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
  const ymd = (d: number) => daysAgo(d).slice(0, 10)
  /** A billed job-shell row (kind 'job'): it never has a bill line, its remainder is revenue less payments, and on the Billed board it never ages (only a Collections flag dates it). */
  const jobRow = (id: string, over: { revenue: number; payments_made: number; estimated_bill_date: string | null }): StageRow =>
    ({ kind: 'job', job: { id, invoices: [], payments: [], ...over } }) as unknown as StageRow
  /** A billed invoice row: dated by its billed_at. */
  const invRow = (id: string, over: { amount: number; billed_at: string | null; estimated_bill_date: string | null }): StageRow =>
    ({ kind: 'invoice', job: { id, revenue: over.amount, payments_made: 0, invoices: [], payments: [] }, inv: { id: `inv-${id}`, job_id: id, status: 'billed', ...over } }) as unknown as StageRow
  const rows: StageRow[] = [
    jobRow('a', { revenue: 1000, payments_made: 0, estimated_bill_date: ymd(45) }),
    jobRow('b', { revenue: 1000, payments_made: 0, estimated_bill_date: ymd(120) }),
    jobRow('c', { revenue: 1000, payments_made: 1000, estimated_bill_date: ymd(120) }),
    invRow('d', { amount: 500, billed_at: daysAgo(120), estimated_bill_date: null }),
    invRow('e', { amount: 500, billed_at: null, estimated_bill_date: null }),
    invRow('f', { amount: 500, billed_at: daysAgo(45), estimated_bill_date: null }),
  ]
  const ids = (out: StageRow[]) => out.map((r) => r.job.id)

  it('no chip: every row, as a new list', () => {
    const out = billedListRows(rows, null, NOW)
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(out).not.toBe(rows)
  })
  it('an aging chip keeps the rows the reader puts in that bucket: invoice rows by their billed date; a job-shell row and an undated row never age here', () => {
    expect(ids(billedListRows(rows, '30_90', NOW))).toEqual(['f'])
    expect(ids(billedListRows(rows, '90', NOW))).toEqual(['d'])
    expect(rows.map((r) => billedStageRowAgingBucket(r, NOW))).toEqual([null, null, null, '90', null, '30_90'])
  })
  it('the no-line chip keeps rows with money owed and no bill line: every job-shell row, and an invoice with no date', () => {
    expect(ids(billedListRows(rows, 'no_line', NOW))).toEqual(['a', 'b', 'e'])
    expect(rows.map((r) => stageRowBilledRemainingAmount(r) > 0 && billedStageRowHasNoBillLine(r))).toEqual([true, true, false, false, true, false])
  })
})

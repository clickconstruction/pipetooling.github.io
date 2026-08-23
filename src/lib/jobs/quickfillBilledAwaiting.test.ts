import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildJobsStagesBoardLists } from '../jobsStagesBoard'
import { buildQuickfillBilledRows } from './quickfillBilledAwaiting'

function job(p: Partial<JobWithDetails>): JobWithDetails {
  return {
    id: 'j',
    status: 'billed',
    revenue: 0,
    payments_made: 0,
    collections_at: null,
    hcp_number: '1',
    click_number: null,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...p,
  } as unknown as JobWithDetails
}
const inv = (id: string, job_id: string, amount: number) =>
  ({ id, job_id, amount, status: 'billed', sequence_order: 1, is_primary_rtb_bundle: false, billed_at: '2026-08-01T00:00:00Z', estimated_bill_date: null }) as unknown as JobWithDetails['invoices'][number]

describe('buildQuickfillBilledRows', () => {
  it('one row per bill — a billed job with one line is one merged row, not job + invoice; collections excluded; total matches the Pipeline', () => {
    const one = job({ id: 'a', hcp_number: '883', revenue: 2918.22, invoices: [inv('i1', 'a', 2918.22)] })
    const two = job({ id: 'b', hcp_number: '273', revenue: 30000, invoices: [inv('i2', 'b', 17585), inv('i3', 'b', 13420)] })
    const shell = job({ id: 'c', hcp_number: '186', revenue: 6200 })
    const coll = job({ id: 'd', hcp_number: '717', revenue: 7501.82, collections_at: '2026-07-01T00:00:00Z', invoices: [inv('i4', 'd', 7501.82)] })
    const lists = buildJobsStagesBoardLists([one, two, shell, coll], '')
    const { rows, total } = buildQuickfillBilledRows(
      lists.billedActiveRows,
      new Map([['a', 'TF Harper- Mission Hills']]),
      new Map([['b', ['Malachi', 'Abraham']]]),
    )
    // Order is the Pipeline's own; pin the SET of bills (one per line, shell once, no collections).
    const pairs = rows.map((r) => `${r.jobNumber}:${r.remaining}`).sort()
    expect(pairs).toEqual(['186:6200', '273:13420', '273:17585', '883:2918.22'])
    expect(rows.find((r) => r.jobNumber === '883')!.jobName).toBe('TF Harper- Mission Hills')
    expect(rows.find((r) => r.jobNumber === '273')!.assigned).toEqual(['Malachi', 'Abraham'])
    expect(total).toBeCloseTo(2918.22 + 17585 + 13420 + 6200, 2)
    expect(rows.filter((r) => r.jobNumber === '883')).toHaveLength(1)
  })
  it('drops rows with nothing left to pay', () => {
    const paid = job({ id: 'p', hcp_number: '9', revenue: 100, invoices: [inv('i9', 'p', 100)], payments: [{ invoice_id: 'i9', amount: 100 }] as unknown as JobWithDetails['payments'] })
    const lists = buildJobsStagesBoardLists([paid], '')
    expect(buildQuickfillBilledRows(lists.billedActiveRows, new Map(), new Map()).rows).toEqual([])
  })
})

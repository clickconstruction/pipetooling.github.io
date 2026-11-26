// @vitest-environment jsdom
/**
 * The read behind the case pane's liens (punch list #435, piece 6): once a case, again when its jobs change, never
 * for a case that is not a check that came back, and a failed read says why.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { arReturnCaseView, type ArReturnCaseRow } from '../lib/jobs/arReturnCase'
import type { PayoffReturnedInput } from '../lib/jobs/payoffReturned'
import type { readReturnedCaseLiens } from '../lib/jobs/payoffReturnedIo'
import { useReturnedCaseLiens } from './useReturnedCaseLiens'

// Every job, payer, instrument and amount here is made up.
const TODAY = '2026-10-05'
const row = (over: Partial<ArReturnCaseRow> = {}): ArReturnCaseRow => ({
  mercury_transaction_id: 'tx-1',
  counterparty_name: 'Marisol Okafor',
  amount: '7420',
  kind: 'checkDeposit',
  posted_at: '2026-09-18T22:00:58Z',
  failed_at: '2026-09-23T15:00:00Z',
  bank_reason: 'Insufficient funds',
  source: 'bank',
  opened_at: '2026-09-23T15:00:00Z',
  closed_at: null,
  closed_reason: null,
  closed_note: null,
  closed_by: null,
  replaced_by_mercury_transaction_id: null,
  notified_at: null,
  live_payments: [{ payment_id: 'p1', job_id: 'j1', job_number: '2041', job_name: 'Okafor main house', amount: 7420, invoice_id: null }],
  last_job: null,
  recorded_payment: null,
  promise: null,
  ...over,
})
const view = (over: Partial<ArReturnCaseRow> = {}) => arReturnCaseView({ row: row(over), trail: [], todayYmd: TODAY })
const liened: PayoffReturnedInput = {
  jobs: [{ jobId: 'j1', stand: 'counted' }],
  labelByJob: { j1: '#2041 Okafor main house' },
  targets: [{ affidavit: { id: 'a1', job_id: 'j1', county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-09-09' }, release: null }],
  prints: [],
  checkNumber: '1184',
}

type ReadArgs = Parameters<typeof readReturnedCaseLiens>

afterEach(cleanup)

describe('useReturnedCaseLiens', () => {
  it('reads the case’s jobs against its deposit, and hands the pane the liens', async () => {
    const read = vi.fn((..._args: ReadArgs) => Promise.resolve(liened))
    const { result } = renderHook(() => useReturnedCaseLiens(view(), true, read))
    expect(result.current).toEqual({ status: 'reading', view: null, why: null })
    await waitFor(() => expect(result.current?.status).toBe('ready'))
    expect(result.current?.view?.liens.map((l) => l.case)).toEqual(['none'])
    expect(read).toHaveBeenCalledTimes(1)
    expect(read.mock.calls[0]![1]).toBe('tx-1')
    expect(read.mock.calls[0]![0].takeOff?.jobs.map((j) => j.jobId)).toEqual(['j1'])
  })

  it('reads again when the check comes off its job, and not when the same case is drawn again', async () => {
    const read = vi.fn((..._args: ReadArgs) => Promise.resolve(liened))
    const { result, rerender } = renderHook(({ v }) => useReturnedCaseLiens(v, true, read), { initialProps: { v: view() } })
    await waitFor(() => expect(result.current?.status).toBe('ready'))
    rerender({ v: view() })
    expect(read).toHaveBeenCalledTimes(1)
    rerender({ v: view({ live_payments: [], last_job: { job_id: 'j1', job_number: '2041', job_name: 'Okafor main house', removed_at: '2026-10-05T15:00:00Z', removed_by: 'Alex Rivera' } }) })
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })

  it('reads nothing for a card dispute, a check never deposited, a seat that may not apply, or no case', () => {
    const read = vi.fn((..._args: ReadArgs) => Promise.resolve(liened))
    expect(renderHook(() => useReturnedCaseLiens(view({ source: 'stripe_dispute' }), true, read)).result.current).toBeNull()
    expect(renderHook(() => useReturnedCaseLiens(view({ source: 'unbanked' }), true, read)).result.current).toBeNull()
    expect(renderHook(() => useReturnedCaseLiens(view(), false, read)).result.current).toBeNull()
    expect(renderHook(() => useReturnedCaseLiens(null, true, read)).result.current).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it('says why when the read fails', async () => {
    const read = vi.fn((..._args: ReadArgs) => Promise.reject<PayoffReturnedInput>(new Error('permission denied for table job_lien_filings')))
    const { result } = renderHook(() => useReturnedCaseLiens(view(), true, read))
    await waitFor(() => expect(result.current?.status).toBe('failed'))
    expect(result.current?.why).toBe('permission denied for table job_lien_filings')
    expect(result.current?.view).toBeNull()
  })
})

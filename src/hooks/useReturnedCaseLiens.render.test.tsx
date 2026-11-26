// @vitest-environment jsdom
/**
 * The read behind the case pane's liens (punch list #435, piece 6): once a case, again when its jobs change, never
 * for a case that is not a check that came back, and a failed read says why.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { arReturnCaseView, type ArReturnCaseRow } from '../lib/jobs/arReturnCase'
import type { PayoffReturnedInput } from '../lib/jobs/payoffReturned'
import type { readReturnedCaseLiens } from '../lib/jobs/payoffReturnedIo'
import type { ReleaseFactsChange } from '../lib/jobs/lienReleaseFacts'
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

  describe('the mark', () => {
    const saved: PayoffReturnedInput = { ...liened, targets: [{ affidavit: liened.targets[0]!.affidavit, release: { id: 'r1', created_at: '2026-09-20T16:00:00Z', filed_at: null, fields: { releasesFilingId: 'a1' } } }] }
    const keepOk = () => vi.fn((rows: ReadonlyArray<{ releaseId: string; fields: unknown }>, _change: ReleaseFactsChange) => Promise.resolve(rows.map((r) => ({ releaseId: r.releaseId, ok: true, why: null as string | null }))))

    it('keeps the case, the day the check came back and who pressed on each saved release, then reads again', async () => {
      const read = vi.fn((..._args: ReadArgs) => Promise.resolve(saved))
      const keep = keepOk()
      const { result } = renderHook(() => useReturnedCaseLiens(view(), true, read, 'u1', keep))
      await waitFor(() => expect(result.current?.status).toBe('ready'))
      expect(result.current?.view?.mark?.button).toBe('Hold 1 release on the Lien desk')
      act(() => result.current?.mark?.())
      await waitFor(() => expect(keep).toHaveBeenCalledTimes(1))
      expect(keep.mock.calls[0]![0]).toEqual([{ releaseId: 'r1', fields: { releasesFilingId: 'a1' } }])
      expect(keep.mock.calls[0]![1].moneyBack).toMatchObject({ ymd: '2026-09-23', check: '1184', caseId: 'tx-1', by: 'u1' })
      await waitFor(() => expect(result.current?.said).toEqual({ text: 'Held 1 release. The Lien desk is told. Each release stays held until a payment holds.', tone: 'ok' }))
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    })

    it('says which release did not take the mark, with the reason, and reads nothing again', async () => {
      const read = vi.fn((..._args: ReadArgs) => Promise.resolve(saved))
      const keep = vi.fn((rows: ReadonlyArray<{ releaseId: string; fields: unknown }>, _change: ReleaseFactsChange) => Promise.resolve(rows.map((r) => ({ releaseId: r.releaseId, ok: false, why: 'permission denied for table job_lien_filings' as string | null }))))
      const { result } = renderHook(() => useReturnedCaseLiens(view(), true, read, 'u1', keep))
      await waitFor(() => expect(result.current?.status).toBe('ready'))
      act(() => result.current?.mark?.())
      await waitFor(() => expect(result.current?.said?.tone).toBe('bad'))
      expect(result.current?.said?.text).toBe('Nothing held. 1 did not take the mark. permission denied for table job_lien_filings')
      expect(read).toHaveBeenCalledTimes(1)
    })

    it('offers no press with nobody signed in, or with no saved release', async () => {
      const read = vi.fn((..._args: ReadArgs) => Promise.resolve(saved))
      const nobody = renderHook(() => useReturnedCaseLiens(view(), true, read, null, keepOk()))
      await waitFor(() => expect(nobody.result.current?.status).toBe('ready'))
      expect(nobody.result.current?.mark).toBeNull()
      const none = renderHook(() => useReturnedCaseLiens(view(), true, vi.fn((..._args: ReadArgs) => Promise.resolve(liened)), 'u1', keepOk()))
      await waitFor(() => expect(none.result.current?.status).toBe('ready'))
      expect(none.result.current?.mark).toBeNull()
    })
  })
})

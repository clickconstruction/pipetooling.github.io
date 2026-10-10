// @vitest-environment jsdom
/**
 * The Dashboard's Ready to bill and Billed lists and ZZ test jobs (punch list #61, review on #5241). The
 * RPC's job rows carry no customer name, so a ZZ customer's job is known only by the shared ids: the
 * lists hold (nothing handed out, loading, not loaded) until the ids land, hold after a failed read and
 * say so with Try again, and once the ids land drop the ZZ jobs and keep the rest. Made-up jobs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ZzTestJobIdsState } from './useZzTestJobIds'

const jobRow = (id: string, name: string) => ({ id, job_name: name, hcp_number: id, customer_id: 'c1', status: 'ready_to_bill' })
const billRow = (id: string, jobId: string, jobName: string, customerName: string) => ({
  id,
  job_id: jobId,
  amount: 500,
  status: 'ready_to_bill',
  created_at: '2026-10-01',
  jobs_ledger: { hcp_number: jobId, click_number: null, job_name: jobName, job_address: '', google_drive_link: null, job_plans_link: null, created_at: null, master_user_id: 'u-m', customer_id: 'c1', customer_name: customerName, customer_email: null, customer_phone: null, last_work_date: null, status: 'ready_to_bill' },
})
// A is real; Y is a ZZ job only by its customer, so its RPC row reads as a real job by name.
const RPC_JOBS = [jobRow('A', '101 Hill Street'), jobRow('Y', 'Hill Street remodel')]
const BILLS = [billRow('iA', 'A', '101 Hill Street', 'Ann Lee'), billRow('iY', 'Y', 'Hill Street remodel', 'ZZ Test Customer')]

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'in']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: BILLS, error: null })
      return chain
    },
    rpc: () => Promise.resolve({ data: RPC_JOBS, error: null }),
  },
}))
let zz: ZzTestJobIdsState = { ids: null, status: 'loading', retry: () => {} }
vi.mock('./useZzTestJobIds', () => ({ useZzTestJobIds: () => zz }))
vi.mock('../lib/jobs/zzTestJobSwitch', () => ({ useZzTestJobsHidden: () => true }))
const showActionToast = vi.fn()
vi.mock('../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: vi.fn(), showActionToast }) }))

const { useDashboardBillingInvoices } = await import('./useDashboardBillingInvoices')

const render = () =>
  renderHook(() =>
    useDashboardBillingInvoices({
      authUserId: 'u-ann',
      role: 'assistant',
      setAssignedJobs: vi.fn(),
      setAssignedReadyToBillJobs: vi.fn(),
      setSuperintendentJobs: vi.fn(),
      resyncDashboardAfterUpdateJobStatusFailureRef: { current: async () => {} },
    }),
  )

beforeEach(() => {
  showActionToast.mockClear()
})

describe('useDashboardBillingInvoices · ZZ test jobs', () => {
  it('holds both lists while the ids load: nothing handed out, loading, not loaded (so the Day book counts nothing)', async () => {
    zz = { ids: null, status: 'loading', retry: () => {} }
    const { result } = render()
    await waitFor(() => expect(result.current.readyToBillLoading).toBe(true))
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.readyToBillJobs).toEqual([])
    expect(result.current.readyToBillInvoices).toEqual([])
    expect(result.current.readyToBillDashboardUnits).toEqual([])
    expect(result.current.readyToBillLoaded).toBe(false)
  })

  it('once the ids land, drops the ZZ customer’s job and its bill and keeps the real one', async () => {
    zz = { ids: new Set(['Y']), status: 'ready', retry: () => {} }
    const { result } = render()
    await waitFor(() => expect(result.current.readyToBillLoaded).toBe(true))
    expect(result.current.readyToBillJobs.map((j) => j.id)).toEqual(['A'])
    expect(result.current.readyToBillInvoices.map((i) => i.id)).toEqual(['iA'])
  })

  it('after a failed read it stays held and says so, with Try again', async () => {
    const retry = vi.fn()
    zz = { ids: null, status: 'failed', retry }
    const { result } = render()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.readyToBillJobs).toEqual([])
    expect(result.current.readyToBillLoaded).toBe(false)
    expect(showActionToast).toHaveBeenCalledWith(
      'Could not check for ZZ test jobs, so Ready to bill and Billed are held.',
      expect.objectContaining({ label: 'Try again', onClick: retry }),
      expect.objectContaining({ type: 'error' }),
    )
  })
})

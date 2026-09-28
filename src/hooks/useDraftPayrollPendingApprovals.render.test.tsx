// @vitest-environment jsdom
/**
 * useDraftPayrollPendingApprovals (v2.3984): the count lands shortly after Draft Payroll opens,
 * clears when it closes, is skipped for a backwards period, and the newest request wins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useDraftPayrollPendingApprovals } from './useDraftPayrollPendingApprovals'

const reads = vi.hoisted(() => ({
  calls: [] as Array<{ start: string; end: string }>,
  next: [] as Array<() => Promise<number>>,
}))

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/pay/draftPayrollPendingApprovals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/pay/draftPayrollPendingApprovals')>()
  return {
    ...actual,
    fetchPendingApprovalCount: (_supabase: unknown, start: string, end: string) => {
      reads.calls.push({ start, end })
      const answer = reads.next.shift()
      return answer ? answer() : Promise.resolve(0)
    },
  }
})

type Props = { draftOpen: boolean; canAccessPay: boolean; periodStart: string; periodEnd: string }
const OPEN: Props = { draftOpen: true, canAccessPay: true, periodStart: '2026-09-20', periodEnd: '2026-09-26' }

beforeEach(() => {
  reads.calls.length = 0
  reads.next.length = 0
})
afterEach(cleanup)

describe('useDraftPayrollPendingApprovals', () => {
  it('counts for the period once the window is open', async () => {
    reads.next.push(() => Promise.resolve(3))
    const { result } = renderHook((p: Props) => useDraftPayrollPendingApprovals(p), { initialProps: OPEN })
    expect(result.current.draftPayrollPendingApprovalCount).toBeNull() // first paint
    await waitFor(() => expect(result.current.draftPayrollPendingApprovalCount).toBe(3))
    expect(reads.calls).toEqual([{ start: '2026-09-20', end: '2026-09-26' }])
    expect(result.current.draftPayrollPendingApprovalLoading).toBe(false)
    expect(result.current.draftPayrollPendingApprovalError).toBeNull()
  })

  it('reads nothing while the window is closed, or without pay access', async () => {
    const closed = renderHook((p: Props) => useDraftPayrollPendingApprovals(p), { initialProps: { ...OPEN, draftOpen: false } })
    const noAccess = renderHook((p: Props) => useDraftPayrollPendingApprovals(p), { initialProps: { ...OPEN, canAccessPay: false } })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120))
    })
    expect(reads.calls).toEqual([])
    expect(closed.result.current.draftPayrollPendingApprovalCount).toBeNull()
    expect(noAccess.result.current.draftPayrollPendingApprovalCount).toBeNull()
  })

  it('clears the count when the window closes', async () => {
    reads.next.push(() => Promise.resolve(5))
    const { result, rerender } = renderHook((p: Props) => useDraftPayrollPendingApprovals(p), { initialProps: OPEN })
    await waitFor(() => expect(result.current.draftPayrollPendingApprovalCount).toBe(5))
    rerender({ ...OPEN, draftOpen: false })
    await waitFor(() => expect(result.current.draftPayrollPendingApprovalCount).toBeNull())
  })

  it('skips a period whose start is after its end', async () => {
    const { result } = renderHook((p: Props) => useDraftPayrollPendingApprovals(p), { initialProps: { ...OPEN, periodStart: '2026-09-27' } })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 120))
    })
    expect(reads.calls).toEqual([])
    expect(result.current.draftPayrollPendingApprovalCount).toBeNull()
  })

  it('says why when the count fails', async () => {
    reads.next.push(() => Promise.reject(new Error('network down')))
    const { result } = renderHook((p: Props) => useDraftPayrollPendingApprovals(p), { initialProps: OPEN })
    await waitFor(() => expect(result.current.draftPayrollPendingApprovalError).toBeTruthy())
    expect(result.current.draftPayrollPendingApprovalCount).toBeNull()
    expect(result.current.draftPayrollPendingApprovalLoading).toBe(false)
  })

  it('keeps the newest request when an older one answers late', async () => {
    let answerOld: (n: number) => void = () => {}
    reads.next.push(() => new Promise<number>((resolve) => { answerOld = resolve }))
    reads.next.push(() => Promise.resolve(2))
    const { result } = renderHook((p: Props) => useDraftPayrollPendingApprovals(p), { initialProps: OPEN })
    await waitFor(() => expect(reads.calls).toHaveLength(1))
    await act(async () => {
      await result.current.loadDraftPayrollPendingApprovals('2026-09-20', '2026-09-26')
    })
    expect(result.current.draftPayrollPendingApprovalCount).toBe(2)
    await act(async () => {
      answerOld(9)
      await Promise.resolve()
    })
    expect(result.current.draftPayrollPendingApprovalCount).toBe(2)
  })
})

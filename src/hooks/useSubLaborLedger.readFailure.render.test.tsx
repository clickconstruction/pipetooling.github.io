// @vitest-environment jsdom
/**
 * The sub ledger and a read that fails (punch list #350, the audit of 2026-11-20). A sheet drawn without its
 * payments reads unpaid, and the papers stand on the same rows. So a failed read of lines or payments is not
 * drawn: the ledger keeps what it last read whole and the page is told why.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSubLaborLedger } from './useSubLaborLedger'

const db = vi.hoisted(() => ({
  fail: {} as Record<string, string>,
  rows: {} as Record<string, unknown[]>,
}))

vi.mock('../contexts/ConfirmDialogContext', () => ({ useConfirmDialog: () => async () => true }))

vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'or', 'not', 'order', 'limit', 'gte', 'lte']) builder[m] = () => builder
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(db.fail[table] ? { data: null, error: { message: db.fail[table] } } : { data: db.rows[table] ?? [], error: null }).then(onFulfilled, onRejected)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table), rpc: () => Promise.resolve({ data: null, error: null }) } }
})

const SHEET = { id: 'sheet-1', assigned_to_name: 'Maple Ridge Drywall', address: '12 Alder Way', job_number: '2041', job_ledger_id: null, labor_rate: 50, job_date: '2026-11-02', created_at: '2026-11-02T15:00:00Z' }
const LINE = { job_id: 'sheet-1', fixture: 'Hang board', count: 1, hrs_per_unit: 0, is_fixed: true, labor_rate: null, direct_labor_amount: 900 }
const PAYMENT = { id: 'pay-1', job_id: 'sheet-1', amount: 400, memo: null, created_at: '2026-11-05T15:00:00Z', payment_date: '2026-11-05' }

afterEach(() => {
  cleanup()
  db.fail = {}
  db.rows = {}
})

function ledger() {
  const setError = vi.fn()
  const hook = renderHook(() => useSubLaborLedger({ authUserId: 'user-1', setError }))
  return { hook, setError }
}

describe('useSubLaborLedger and a read that fails', () => {
  it('draws a sheet with its lines and its payments when every read came back', async () => {
    db.rows = { people_labor_jobs: [SHEET], people_labor_job_items: [LINE], people_labor_job_payments: [PAYMENT] }
    const { hook, setError } = ledger()
    await act(async () => {
      await hook.result.current.loadLaborJobs()
    })
    expect(hook.result.current.laborJobs).toHaveLength(1)
    expect(hook.result.current.laborJobs[0]!.payments).toHaveLength(1)
    expect(setError.mock.calls.every(([said]) => said === null)).toBe(true)
  })

  it('draws no sheet as unpaid when the payments read fails, and says why', async () => {
    db.rows = { people_labor_jobs: [SHEET], people_labor_job_items: [LINE] }
    db.fail = { people_labor_job_payments: 'permission denied for table people_labor_job_payments' }
    const { hook, setError } = ledger()
    await act(async () => {
      await hook.result.current.loadLaborJobs()
    })
    await waitFor(() => expect(hook.result.current.laborJobsLoadedOnce).toBe(true))
    expect(hook.result.current.laborJobs).toEqual([])
    expect(hook.result.current.laborJobsLoading).toBe(false)
    expect(setError).toHaveBeenLastCalledWith('The sub sheets were not read again: their payments did not load, and without them every sheet would read unpaid. permission denied for table people_labor_job_payments. Reload the page to try again.')
  })

  it('keeps what it last read whole when a later read of the lines fails', async () => {
    db.rows = { people_labor_jobs: [SHEET], people_labor_job_items: [LINE], people_labor_job_payments: [PAYMENT] }
    const { hook, setError } = ledger()
    await act(async () => {
      await hook.result.current.loadLaborJobs()
    })
    db.fail = { people_labor_job_items: 'statement timeout' }
    await act(async () => {
      await hook.result.current.loadLaborJobs()
    })
    expect(hook.result.current.laborJobs).toHaveLength(1)
    expect(hook.result.current.laborJobs[0]!.items).toHaveLength(1)
    expect(hook.result.current.laborJobs[0]!.payments).toHaveLength(1)
    expect(setError.mock.calls[setError.mock.calls.length - 1]![0]).toContain('their lines did not load')
  })
})

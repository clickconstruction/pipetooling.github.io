// @vitest-environment jsdom
/**
 * The trace reads the bill each event's payment sat on (v2.5008): a removal says *unlinked from
 * its bill* only when a bill held the payment, and reads as plain *removed* when none did.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const reads = vi.hoisted(() => ({ selects: [] as Array<{ table: string; cols: string }>, events: [] as unknown[] }))

vi.mock('../lib/supabase', () => {
  const from = (table: string) => {
    const data = table === 'jobs_ledger_payment_events' ? reads.events : [{ id: 'j904', hcp_number: '904', click_number: null, job_name: 'ZZ TEST held check A' }]
    const b: Record<string, unknown> = {}
    for (const m of ['or', 'order', 'limit', 'in']) b[m] = () => b
    b.select = (cols: string) => {
      reads.selects.push({ table, cols })
      return b
    }
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from } }
})

import { useJobPaymentTrace } from './useJobPaymentTrace'

describe('useJobPaymentTrace', () => {
  it('reads each event with the bill its payment sat on, and names the other job', async () => {
    reads.events = [{ id: 'm1', kind: 'moved', payment_id: 'p9', from_job_id: 'j904', to_job_id: 'j907', invoice_id: null, amount: 1, paid_on: null, reason: 'wrong job', actor_name: 'Robert', created_at: '2026-10-08T15:00:00Z' }]
    const { result } = renderHook(() => useJobPaymentTrace('j907'))
    await waitFor(() => expect(result.current.labelFor('j904')).toBe('J904 · ZZ TEST held check A'))
    expect(result.current.events).toHaveLength(1)
    const cols = reads.selects.find((s) => s.table === 'jobs_ledger_payment_events')!.cols.split(',').map((c) => c.trim())
    expect(cols).toContain('invoice_id')
    expect(cols).toContain('payment_id')
  })
})

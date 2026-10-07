// @vitest-environment jsdom
/**
 * useMercuryDepositFacts (v2.4293): the day a deposit posted is the day the bank posted it on the
 * company's calendar (v2.4463). posted_at is an instant; an evening deposit is not tomorrow's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useMercuryDepositFacts } from './useMercuryDepositFacts'

const db = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }))

vi.mock('../lib/supabase', () => {
  function makeBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in']) builder[m] = () => builder
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: db.rows, error: null }).then(onFulfilled, onRejected)
    return builder
  }
  return { supabase: { from: () => makeBuilder() } }
})

afterEach(cleanup)

describe('useMercuryDepositFacts — the posted day', () => {
  it('reads posted_at as its day in the company zone, evenings included', async () => {
    db.rows = [
      // 7:30 pm CDT on Oct 2, as PostgREST returns it; 6:30 pm CST on Dec 1; noon UTC; never posted.
      { id: 'a', posted_at: '2026-10-03T00:30:00+00:00', status: 'sent', kind: 'checkDeposit', counterparty_name: 'Loberg Contracting', failure_reason: null },
      { id: 'b', posted_at: '2026-12-02T00:30:00Z', status: 'sent', kind: 'checkDeposit', counterparty_name: null, failure_reason: null },
      { id: 'c', posted_at: '2026-10-03T12:00:00Z', status: 'sent', kind: 'checkDeposit', counterparty_name: null, failure_reason: null },
      { id: 'd', posted_at: null, status: 'pending', kind: 'checkDeposit', counterparty_name: null, failure_reason: null },
    ]
    const payments = [{ mercury_transaction_id: 'a' }, { mercury_transaction_id: 'b' }, { mercury_transaction_id: 'c' }, { mercury_transaction_id: 'd' }]
    const { result } = renderHook(() => useMercuryDepositFacts(payments))
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(4))
    expect(result.current.a?.postedYmd).toBe('2026-10-02')
    expect(result.current.a?.counterparty).toBe('Loberg Contracting')
    expect(result.current.b?.postedYmd).toBe('2026-12-01')
    expect(result.current.c?.postedYmd).toBe('2026-10-03')
    expect(result.current.d?.postedYmd).toBeNull()
  })
})

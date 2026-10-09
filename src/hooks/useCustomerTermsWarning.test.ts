// @vitest-environment jsdom
/**
 * The Deposit required? nudge reads the GC too (v2.5015, the owner's call of 2026-10-09): bills the
 * office gave up on count against the customer on the job, as before, and against the GC when the
 * job billed the GC. The shapes are prod's two GC marks of 2026-10-07: J1002 had no customer and
 * billed Heron Construction Group; 881 had a customer and billed RMC- Dudley Mason. The read is a
 * stand-in that applies the hook's own filters to these rows; the amounts are made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

type Job = { id: string; customer_id: string | null; gc_customer_id: string | null; bill_to_party: string; status: string; collections_at: string | null; uncollectible_at: string | null; revenue: number; payments_made: number }
const givenUp = { status: 'billed', collections_at: '2026-10-01T12:00:00Z', uncollectible_at: '2026-10-07T12:00:00Z' }
const JOBS: Job[] = [
  // J1002: nobody as the customer, Heron Construction Group billed.
  { id: 'j1002', customer_id: null, gc_customer_id: 'gc-heron', bill_to_party: 'gc', ...givenUp, revenue: 4000, payments_made: 1500 },
  // 881: Dudley Mason the customer, RMC- Dudley Mason billed.
  { id: 'j881', customer_id: 'cust-dudley', gc_customer_id: 'gc-rmc', bill_to_party: 'gc', ...givenUp, revenue: 3000, payments_made: 0 },
  // Heron on a job its customer paid for: Heron owed nothing there.
  { id: 'j-cust-paid', customer_id: 'cust-ann', gc_customer_id: 'gc-heron', bill_to_party: 'customer', ...givenUp, revenue: 900, payments_made: 0 },
  // A split job: each bill picks its payer, so it is not the GC's by the job alone.
  { id: 'j-split', customer_id: 'cust-bo', gc_customer_id: 'gc-heron', bill_to_party: 'split', ...givenUp, revenue: 700, payments_made: 0 },
  // Heron's own billed job, still being chased: not given up.
  { id: 'j-chasing', customer_id: null, gc_customer_id: 'gc-heron', bill_to_party: 'gc', status: 'billed', collections_at: '2026-10-01T12:00:00Z', uncollectible_at: null, revenue: 5000, payments_made: 0 },
]

/** Top-level comma split, leaving `and(...)` groups whole. */
function splitTop(expr: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of expr) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}
const cond = (row: Job, c: string) => {
  const [col, op, ...rest] = c.split('.')
  return op === 'eq' && String(row[col as keyof Job]) === rest.join('.')
}
const orMatches = (row: Job, expr: string) =>
  splitTop(expr).some((p) => (p.startsWith('and(') ? splitTop(p.slice(4, -1)).every((c) => cond(row, c)) : cond(row, p)))

vi.mock('../lib/supabase', () => {
  const from = (table: string) => {
    const filters: Array<(r: Job) => boolean> = []
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.or = (expr: string) => (filters.push((r) => orMatches(r, expr)), b)
    b.eq = (col: string, v: unknown) => (filters.push((r) => r[col as keyof Job] === v), b)
    b.not = (col: string, _op: string, _v: null) => (filters.push((r) => r[col as keyof Job] != null), b)
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve({ data: table === 'jobs_ledger' ? JOBS.filter((r) => filters.every((f) => f(r))) : [], error: null }).then(ok, bad)
    return b
  }
  return { supabase: { from, rpc: () => Promise.resolve({ data: null, error: null }) } }
})

import { useCustomerTermsWarning } from './useCustomerTermsWarning'

afterEach(cleanup)

/** Waits for the bar to read `expected`; for no bar, lets every read settle first. */
async function expectHeadline(id: string, expected: string | null) {
  const { result } = renderHook(() => useCustomerTermsWarning(id))
  if (expected == null) {
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.warning).toBeNull()
  } else {
    await waitFor(() => expect(result.current.warning?.headline).toBe(expected))
  }
}
const nudge = (dollars: string) => `The office gave up on 1 bill from this customer ($${dollars}) — set Deposit required?`

describe('useCustomerTermsWarning — the given-up bills of a GC the job billed (the owner’s call of 2026-10-09)', () => {
  it('J1002’s shape: picking Heron Construction Group nudges toward Deposit required for the bill it owed', async () => {
    await expectHeadline('gc-heron', nudge('2,500'))
  })

  it('881’s shape: the GC that was billed sees it, and the job’s customer still does, as before', async () => {
    await expectHeadline('gc-rmc', nudge('3,000'))
    await expectHeadline('cust-dudley', nudge('3,000'))
  })

  it('a GC on a job its customer paid, or a split job, owes nothing by the job alone; a customer’s own counts as before', async () => {
    await expectHeadline('cust-ann', nudge('900'))
    await expectHeadline('cust-bo', nudge('700'))
    await expectHeadline('gc-nobody', null)
  })
})

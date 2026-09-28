// @vitest-environment jsdom
/**
 * The job form's standing-discount offer as a hook. Pins the seam — no customer or a failed read
 * is no offer; a customer with a rate is an offer that Apply turns into a discount row through
 * the form's setter; waving off hides it and is written to the job when there is one; a job
 * already waved off opens with no offer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { SetStateAction } from 'react'
import { useStandingDiscountOffer } from './useStandingDiscountOffer'
import { isDiscountRow } from '../lib/jobs/discountLine'
import type { FixtureRow } from '../lib/jobs/jobFormTypes'

const db = vi.hoisted(() => ({
  customer: { data: null as unknown, error: null as unknown },
  reads: [] as string[],
  updates: [] as Array<{ table: string; patch: Record<string, unknown>; id: unknown }>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: () => {
            db.reads.push(id)
            return Promise.resolve(db.customer)
          },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: unknown) => {
          db.updates.push({ table, patch, id })
          return Promise.resolve({ error: null })
        },
      }),
    }),
  },
}))

const work: FixtureRow[] = [{ id: 'f1', name: 'Water heater', count: 1, line_unit_price: 1_000, line_description: '', invoice_id: null }]

type Params = Parameters<typeof useStandingDiscountOffer>[0]
const mount = (params: Params) => renderHook((p: Params) => useStandingDiscountOffer(p), { initialProps: params })

afterEach(() => {
  cleanup()
  db.customer = { data: null, error: null }
  db.reads.length = 0
  db.updates.length = 0
})

describe('useStandingDiscountOffer', () => {
  it('no customer reads nothing and offers nothing', async () => {
    const { result } = mount({ customerId: null, editing: null, fixtures: work, setFixtures: vi.fn() })
    await act(async () => {})
    expect(result.current.standingOffer).toBeNull()
    expect(db.reads).toHaveLength(0)
  })

  it('a customer with a rate is an offer on the job’s work; Apply adds the discount row through the setter', async () => {
    db.customer = { data: { standing_discount_pct: 10, standing_discount_reason: null }, error: null }
    let rows = work
    const setFixtures = vi.fn((action: SetStateAction<FixtureRow[]>) => {
      rows = typeof action === 'function' ? action(rows) : action
    })
    const { result } = mount({ customerId: 'cust-1', editing: null, fixtures: work, setFixtures })
    await waitFor(() => expect(result.current.standingOffer).not.toBeNull())
    expect(db.reads).toEqual(['cust-1'])
    expect(result.current.standingOffer?.pct).toBe(10)
    expect(result.current.standingOffer?.dollars).toBe(100)
    act(() => result.current.applyStandingOffer())
    expect(setFixtures).toHaveBeenCalledTimes(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toBe(work[0])
    expect(isDiscountRow(rows[1]!)).toBe(true)
    expect(rows[1]?.name).toBe(result.current.standingOffer?.name)
  })

  it('a failed read is no offer, and Apply does nothing', async () => {
    db.customer = { data: null, error: { message: 'column does not exist' } }
    const setFixtures = vi.fn()
    const { result } = mount({ customerId: 'cust-1', editing: null, fixtures: work, setFixtures })
    await waitFor(() => expect(db.reads).toHaveLength(1))
    await act(async () => {})
    expect(result.current.standingOffer).toBeNull()
    act(() => result.current.applyStandingOffer())
    expect(setFixtures).not.toHaveBeenCalled()
  })

  it('waving off hides the offer and is written to the open job', async () => {
    db.customer = { data: { standing_discount_pct: 5, standing_discount_reason: null }, error: null }
    const { result } = mount({ customerId: 'cust-1', editing: { id: 'job-1', standing_discount_waived_at: null }, fixtures: work, setFixtures: vi.fn() })
    await waitFor(() => expect(result.current.standingOffer).not.toBeNull())
    act(() => result.current.waiveStandingOffer())
    expect(result.current.standingOffer).toBeNull()
    expect(db.updates).toHaveLength(1)
    expect(db.updates[0]?.table).toBe('jobs_ledger')
    expect(db.updates[0]?.id).toBe('job-1')
    expect(typeof db.updates[0]?.patch.standing_discount_waived_at).toBe('string')
  })

  it('on a new job waving off writes nothing; a job already waved off opens with no offer', async () => {
    db.customer = { data: { standing_discount_pct: 5, standing_discount_reason: null }, error: null }
    const { result } = mount({ customerId: 'cust-1', editing: null, fixtures: work, setFixtures: vi.fn() })
    await waitFor(() => expect(result.current.standingOffer).not.toBeNull())
    act(() => result.current.waiveStandingOffer())
    expect(result.current.standingOffer).toBeNull()
    expect(db.updates).toHaveLength(0)
    cleanup()
    db.reads.length = 0
    const waived = mount({ customerId: 'cust-1', editing: { id: 'job-2', standing_discount_waived_at: '2026-09-01T00:00:00Z' }, fixtures: work, setFixtures: vi.fn() })
    await waitFor(() => expect(db.reads).toHaveLength(1))
    await act(async () => {})
    expect(waived.result.current.standingOffer).toBeNull()
  })
})

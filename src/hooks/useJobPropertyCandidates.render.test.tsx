// @vitest-environment jsdom
/**
 * The job form's property-record candidates as a hook. Pins the seam — no customer and no GC
 * means no read, an empty list and a held link cleared; with either, the list is their saved
 * addresses and a link that is not among them is cleared; a failed read keeps the link; a link
 * that changes on its own never re-reads.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useJobPropertyCandidates, type PropertyCandidateRow } from './useJobPropertyCandidates'

const db = vi.hoisted(() => ({
  result: { data: [] as unknown, error: null as unknown },
  reads: [] as Array<{ table: string; ids: unknown }>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const read = { table, ids: null as unknown }
      const builder = {
        select: () => builder,
        in: (_col: string, ids: unknown) => {
          read.ids = ids
          return builder
        },
        order: () => {
          db.reads.push(read)
          return Promise.resolve(db.result)
        },
      }
      return builder
    },
  },
}))

const row = (id: string, customerId: string) => ({ id, customer_id: customerId, address: `${id} Main St` }) as unknown as PropertyCandidateRow

type Params = Parameters<typeof useJobPropertyCandidates>[0]
const mount = (params: Params) => renderHook((p: Params) => useJobPropertyCandidates(p), { initialProps: params })

afterEach(() => {
  cleanup()
  db.result = { data: [], error: null }
  db.reads.length = 0
})

describe('useJobPropertyCandidates', () => {
  it('with no customer and no GC nothing is read; a held link is cleared, a blank one left alone', () => {
    const setCustomerAddressId = vi.fn()
    const { result } = mount({ customerId: null, gcCustomerId: null, customerAddressId: 'addr-1', setCustomerAddressId })
    expect(result.current.propertyCandidates).toEqual([])
    expect(setCustomerAddressId).toHaveBeenCalledWith(null)
    expect(db.reads).toHaveLength(0)
    cleanup()
    const untouched = vi.fn()
    mount({ customerId: null, gcCustomerId: null, customerAddressId: null, setCustomerAddressId: untouched })
    expect(untouched).not.toHaveBeenCalled()
  })

  it('reads the customer’s and the GC’s addresses; a link among them stays', async () => {
    db.result = { data: [row('addr-1', 'cust-1'), row('addr-2', 'gc-1')], error: null }
    const setCustomerAddressId = vi.fn()
    const { result } = mount({ customerId: 'cust-1', gcCustomerId: 'gc-1', customerAddressId: 'addr-2', setCustomerAddressId })
    await waitFor(() => expect(result.current.propertyCandidates).toHaveLength(2))
    expect(db.reads).toEqual([{ table: 'customer_addresses', ids: ['cust-1', 'gc-1'] }])
    expect(setCustomerAddressId).not.toHaveBeenCalled()
  })

  it('a link that is not among the loaded addresses is cleared', async () => {
    db.result = { data: [row('addr-1', 'cust-1')], error: null }
    const setCustomerAddressId = vi.fn()
    const { result } = mount({ customerId: 'cust-1', gcCustomerId: null, customerAddressId: 'addr-foreign', setCustomerAddressId })
    await waitFor(() => expect(result.current.propertyCandidates).toHaveLength(1))
    expect(db.reads[0]?.ids).toEqual(['cust-1'])
    expect(setCustomerAddressId).toHaveBeenCalledWith(null)
  })

  it('a failed read keeps the link and leaves the list empty', async () => {
    db.result = { data: null, error: { message: 'boom' } }
    const setCustomerAddressId = vi.fn()
    const { result } = mount({ customerId: 'cust-1', gcCustomerId: null, customerAddressId: 'addr-1', setCustomerAddressId })
    await waitFor(() => expect(db.reads).toHaveLength(1))
    await act(async () => {})
    expect(result.current.propertyCandidates).toEqual([])
    expect(setCustomerAddressId).not.toHaveBeenCalled()
  })

  it('the link changing alone does not re-read; the customer changing does; the form can add to the list', async () => {
    db.result = { data: [row('addr-1', 'cust-1')], error: null }
    const setCustomerAddressId = vi.fn()
    const { result, rerender } = mount({ customerId: 'cust-1', gcCustomerId: null, customerAddressId: null, setCustomerAddressId })
    await waitFor(() => expect(result.current.propertyCandidates).toHaveLength(1))
    rerender({ customerId: 'cust-1', gcCustomerId: null, customerAddressId: 'addr-1', setCustomerAddressId })
    await act(async () => {})
    expect(db.reads).toHaveLength(1)
    act(() => result.current.setPropertyCandidates((prev) => [...prev, row('addr-new', 'cust-1')]))
    expect(result.current.propertyCandidates.map((r) => r.id)).toEqual(['addr-1', 'addr-new'])
    db.result = { data: [row('addr-9', 'cust-2')], error: null }
    rerender({ customerId: 'cust-2', gcCustomerId: null, customerAddressId: 'addr-1', setCustomerAddressId })
    await waitFor(() => expect(result.current.propertyCandidates.map((r) => r.id)).toEqual(['addr-9']))
    expect(db.reads).toHaveLength(2)
    expect(setCustomerAddressId).toHaveBeenCalledWith(null)
  })
})

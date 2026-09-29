// @vitest-environment jsdom
/**
 * The four billed-money reads behind Stages' Billed Awaiting Payment money (punch list #46 row 2):
 * which RPCs each gate loads at mount, what the reloaders re-read, and the fail-soft posture —
 * a refused or thrown read leaves the value where it was and never throws into the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useBilledMoneyData, type BilledMoneyDataGates } from './useBilledMoneyData'

const db = vi.hoisted(() => ({
  payloads: {} as Record<string, unknown>,
  throwing: new Set<string>(),
  calls: [] as string[],
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (name: string) => {
      db.calls.push(name)
      if (db.throwing.has(name)) return Promise.reject(new Error(`${name} exploded`))
      if (!(name in db.payloads)) return Promise.resolve({ data: null, error: { message: `Could not find the function public.${name}`, code: 'PGRST202' } })
      return Promise.resolve({ data: db.payloads[name], error: null })
    },
  },
}))

const PAY_SPEEDS = 'get_billed_customer_pay_speeds'
const PROMISED = 'list_job_promised_pay_dates'
const RECORDS = 'list_payment_promise_records'
const CHASE = 'list_payment_chase_touches'

const OFFICE: BilledMoneyDataGates = { canSeeBilledExpectedPay: true, canMarkPromisedPay: true }
const PRIMARY: BilledMoneyDataGates = { canSeeBilledExpectedPay: true, canMarkPromisedPay: false }
const NEITHER: BilledMoneyDataGates = { canSeeBilledExpectedPay: false, canMarkPromisedPay: false }

const callsOf = (name: string) => db.calls.filter((c) => c === name).length

function seedAll() {
  db.payloads[PAY_SPEEDS] = { company: { medianDays: 31.6, samples: 40 }, customers: { 'cust-1': { medianDays: 12, samples: 5 } } }
  db.payloads[PROMISED] = { 'job-1': { promisedYmd: '2026-10-05', markedByName: ' Dana ' } }
  db.payloads[RECORDS] = [
    { id: 'p-1', jobId: 'job-1', customerId: 'cust-1', promisedYmd: '2026-08-01', createdAt: '2026-07-20T15:00:00Z', source: 'office', billedTotal: 1000, payments: [{ paidOn: '2026-08-09', amount: 1000 }] },
  ]
  db.payloads[CHASE] = [{ id: 't-1', customerId: 'cust-1', jobId: 'job-1', outcome: 'promised', note: '  ', promisedYmd: '2026-10-05', snoozeDays: null, createdAt: '2026-09-27T16:00:00Z' }]
}

async function mountSettled(gates: BilledMoneyDataGates, expectedCalls: number) {
  const hook = renderHook((g: BilledMoneyDataGates) => useBilledMoneyData(g), { initialProps: gates })
  await waitFor(() => expect(db.calls).toHaveLength(expectedCalls))
  // let the resolved reads land in state
  await act(async () => {})
  return hook
}

beforeEach(() => {
  db.payloads = {}
  db.throwing.clear()
  db.calls = []
})
afterEach(cleanup)

describe('useBilledMoneyData — what each gate loads', () => {
  it('an office role loads all four at mount, in the tab’s order, parsed', async () => {
    seedAll()
    const { result } = await mountSettled(OFFICE, 4)
    expect(db.calls).toEqual([PAY_SPEEDS, PROMISED, RECORDS, CHASE])
    expect(result.current.billedPaySpeeds?.company).toEqual({ medianDays: 32, samples: 40 })
    expect(result.current.billedPaySpeeds?.customers['cust-1']).toEqual({ medianDays: 12, samples: 5 })
    expect(result.current.promisedPayDates).toEqual({ 'job-1': { promisedYmd: '2026-10-05', markedByName: 'Dana' } })
    expect(result.current.promiseRecordsByCustomer?.has('cust-1')).toBe(true)
    expect(result.current.promiseSlipByCustomer).not.toBeNull()
    expect(result.current.chaseTouches).toEqual([
      { id: 't-1', customerId: 'cust-1', jobId: 'job-1', outcome: 'promised', note: null, promisedYmd: '2026-10-05', snoozeDays: null, createdAt: '2026-09-27T16:00:00Z', createdByName: 'office', resolvedAt: null },
    ])
  })

  it('primary sees pay speeds and promised dates only — no promise record, no chase log', async () => {
    seedAll()
    const { result } = await mountSettled(PRIMARY, 2)
    expect(db.calls).toEqual([PAY_SPEEDS, PROMISED])
    expect(result.current.billedPaySpeeds).not.toBeNull()
    expect(result.current.promisedPayDates).not.toBeNull()
    expect(result.current.promiseRecordsByCustomer).toBeNull()
    expect(result.current.promiseSlipByCustomer).toBeNull()
    expect(result.current.chaseTouches).toBeNull()
  })

  it('a role with neither gate reads nothing, and its reloaders stay quiet', async () => {
    seedAll()
    const { result } = renderHook(() => useBilledMoneyData(NEITHER))
    await act(async () => {
      await result.current.refreshBilledPaySpeeds()
      await result.current.loadPromisedPayDates()
      await result.current.loadPromiseRecords()
      await result.current.loadChaseTouches()
    })
    expect(db.calls).toEqual([])
    expect(result.current.billedPaySpeeds).toBeNull()
    expect(result.current.chaseTouches).toBeNull()
  })

  it('a gate turning on loads its own reads then, and only those', async () => {
    seedAll()
    const hook = await mountSettled(PRIMARY, 2)
    hook.rerender(OFFICE)
    await waitFor(() => expect(db.calls).toHaveLength(4))
    await act(async () => {})
    expect(db.calls.slice(2)).toEqual([RECORDS, CHASE])
    expect(hook.result.current.chaseTouches).toHaveLength(1)
  })
})

describe('useBilledMoneyData — reloaders', () => {
  it('each reloader re-reads its one RPC and replaces the value', async () => {
    seedAll()
    const { result } = await mountSettled(OFFICE, 4)
    db.payloads[PROMISED] = { 'job-2': { promisedYmd: '2026-11-01', markedByName: '' } }
    db.payloads[PAY_SPEEDS] = { company: { medianDays: 20, samples: 3 } }
    await act(async () => {
      await result.current.loadPromisedPayDates()
      await result.current.refreshBilledPaySpeeds()
    })
    expect(callsOf(PROMISED)).toBe(2)
    expect(callsOf(PAY_SPEEDS)).toBe(2)
    expect(callsOf(RECORDS)).toBe(1)
    expect(result.current.promisedPayDates).toEqual({ 'job-2': { promisedYmd: '2026-11-01', markedByName: 'office' } })
    expect(result.current.billedPaySpeeds?.company).toEqual({ medianDays: 20, samples: 3 })
    expect(result.current.billedPaySpeeds?.customers).toEqual({})
  })
})

describe('useBilledMoneyData — fail-soft', () => {
  it('a missing function (refused read) leaves every value null and does not throw', async () => {
    const { result } = await mountSettled(OFFICE, 4)
    expect(result.current.billedPaySpeeds).toBeNull()
    expect(result.current.promisedPayDates).toBeNull()
    expect(result.current.promiseRecordsByCustomer).toBeNull()
    expect(result.current.chaseTouches).toBeNull()
  })

  it('a thrown read keeps the last good value', async () => {
    seedAll()
    const { result } = await mountSettled(OFFICE, 4)
    const before = result.current.billedPaySpeeds
    db.throwing.add(PAY_SPEEDS)
    db.throwing.add(CHASE)
    await act(async () => {
      await expect(result.current.refreshBilledPaySpeeds()).resolves.toBeUndefined()
      await expect(result.current.loadChaseTouches()).resolves.toBeUndefined()
    })
    expect(result.current.billedPaySpeeds).toBe(before)
    expect(result.current.chaseTouches).toHaveLength(1)
  })

  it('preserved quirk: a refused promise-record reload keeps the old record, while a refused chase or pay-speed reload clears to null', async () => {
    seedAll()
    const { result } = await mountSettled(OFFICE, 4)
    const records = result.current.promiseRecordsByCustomer
    delete db.payloads[RECORDS]
    delete db.payloads[CHASE]
    delete db.payloads[PAY_SPEEDS]
    await act(async () => {
      await result.current.loadPromiseRecords()
      await result.current.loadChaseTouches()
      await result.current.refreshBilledPaySpeeds()
    })
    expect(result.current.promiseRecordsByCustomer).toBe(records)
    expect(result.current.chaseTouches).toBeNull()
    expect(result.current.billedPaySpeeds).toBeNull()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The three "not coming in" writes: the office marking someone off (unpaid
 * time off through the pay-staff RPC, with the salary sync's warning), the
 * office undoing it, and a person marking themselves off. Pins the overlap
 * read that runs first, each statement, and how every refusal comes back.
 */
type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
const queries: Array<{ table: string; steps: Step[] }> = []
const rpcCalls: Array<{ fn: string; params: unknown }> = []
let route: (table: string, steps: Step[]) => Result = () => ({ data: [], error: null })
let rpcRoute: (fn: string) => Result = () => ({ data: null, error: null })

const bulk = vi.hoisted(() => ({ payStaffBulkInsertUserTimeOff: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table, steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
    rpc: (fn: string, params: unknown) => {
      rpcCalls.push({ fn, params })
      return Promise.resolve(rpcRoute(fn))
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<Result>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown, fallback?: string) => (e instanceof Error ? e.message : (fallback ?? String(e))),
}))
vi.mock('./payStaffBulkTimeOff', () => bulk)

import {
  NOT_COMING_IN_NOTE,
  NO_CALL_NO_SHOW_NOTE,
  recordNotComingInForUserAsStaff,
  recordNotComingInSelf,
  removeNotComingInForUserAsStaff,
} from './notComingInTimeOff'

const WHO = { subjectUserId: 'abraham', workDateYmd: '2026-09-28' }
const inserted = (over = {}) => ({ inserted: ['abraham'], failed: [], sync_failed: [], ...over })

beforeEach(() => {
  queries.length = 0
  rpcCalls.length = 0
  route = () => ({ data: [], error: null })
  rpcRoute = () => ({ data: null, error: null })
  bulk.payStaffBulkInsertUserTimeOff.mockReset().mockResolvedValue(inserted())
})

describe('recordNotComingInForUserAsStaff', () => {
  it('looks for time off covering the day before it writes', async () => {
    await recordNotComingInForUserAsStaff(WHO)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.table).toBe('user_time_off')
    expect(queries[0]?.steps).toEqual([
      { method: 'select', args: ['id'] },
      { method: 'eq', args: ['user_id', 'abraham'] },
      { method: 'lte', args: ['start_date', '2026-09-28'] },
      { method: 'gte', args: ['end_date', '2026-09-28'] },
      { method: 'limit', args: [1] },
    ])
  })

  it('writes nothing when the day is already covered', async () => {
    route = () => ({ data: [{ id: 'off-1' }], error: null })
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({ ok: true, alreadyMarked: true })
    expect(bulk.payStaffBulkInsertUserTimeOff).not.toHaveBeenCalled()
  })

  it('records one unpaid day for one person, under the not-coming-in note', async () => {
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({ ok: true, alreadyMarked: false })
    expect(bulk.payStaffBulkInsertUserTimeOff).toHaveBeenCalledWith({
      userIds: ['abraham'],
      startDate: '2026-09-28',
      endDate: '2026-09-28',
      note: 'Not coming in',
    })
    expect(NOT_COMING_IN_NOTE).toBe('Not coming in')
  })

  it('takes the no-call-no-show note when the caller hands one over', async () => {
    await recordNotComingInForUserAsStaff({ ...WHO, note: NO_CALL_NO_SHOW_NOTE })
    expect(bulk.payStaffBulkInsertUserTimeOff.mock.calls[0]?.[0]).toMatchObject({ note: 'No call, no show' })
  })

  it('succeeds with a warning when the day saved and the salary sync did not', async () => {
    bulk.payStaffBulkInsertUserTimeOff.mockResolvedValue(
      inserted({ sync_failed: [{ user_id: 'abraham', message: 'Salary sync failed' }] }),
    )
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({
      ok: true,
      alreadyMarked: false,
      syncWarning: 'Salary sync failed',
    })
  })

  it("ignores another person's sync failure", async () => {
    bulk.payStaffBulkInsertUserTimeOff.mockResolvedValue(
      inserted({ sync_failed: [{ user_id: 'paige', message: 'Salary sync failed' }] }),
    )
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({ ok: true, alreadyMarked: false })
  })

  it('fails with the server error and hands back what the server said', async () => {
    const parsed = { error: 'Not allowed', inserted: [], failed: [], sync_failed: [] }
    bulk.payStaffBulkInsertUserTimeOff.mockResolvedValue(parsed)
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({ ok: false, message: 'Not allowed', details: parsed })
  })

  it("fails with the person's own row error", async () => {
    const parsed = { inserted: [], failed: [{ user_id: 'abraham', message: 'Overlaps approved hours' }], sync_failed: [] }
    bulk.payStaffBulkInsertUserTimeOff.mockResolvedValue(parsed)
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({
      ok: false,
      message: 'Overlaps approved hours',
      details: parsed,
    })
  })

  it('fails when the person is neither saved nor refused', async () => {
    const parsed = { inserted: [], failed: [], sync_failed: [] }
    bulk.payStaffBulkInsertUserTimeOff.mockResolvedValue(parsed)
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({
      ok: false,
      message: 'Time off was not recorded. Check permissions for this team member.',
      details: parsed,
    })
  })

  it('fails without writing when the overlap read fails', async () => {
    route = () => ({ data: null, error: { message: 'permission denied for table user_time_off' } })
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({
      ok: false,
      message: 'permission denied for table user_time_off',
    })
    expect(bulk.payStaffBulkInsertUserTimeOff).not.toHaveBeenCalled()
  })

  it('fails with the thrown message when the write throws', async () => {
    bulk.payStaffBulkInsertUserTimeOff.mockRejectedValue(new Error('network down'))
    expect(await recordNotComingInForUserAsStaff(WHO)).toEqual({ ok: false, message: 'network down' })
  })
})

describe('removeNotComingInForUserAsStaff', () => {
  it('asks the server to undo that person on that day, and reads the answer', async () => {
    rpcRoute = () => ({ data: { ok: true, deleted: 1, sync_warning: 'Salary sync failed' }, error: null })
    expect(await removeNotComingInForUserAsStaff(WHO)).toEqual({
      ok: true,
      deleted: 1,
      syncWarning: 'Salary sync failed',
    })
    expect(rpcCalls).toEqual([
      {
        fn: 'pay_staff_remove_not_coming_in_for_user_day',
        params: { p_user_id: 'abraham', p_work_date: '2026-09-28' },
      },
    ])
  })

  it('treats nothing to undo as done', async () => {
    rpcRoute = () => ({ data: { ok: true, deleted: 0 }, error: null })
    expect(await removeNotComingInForUserAsStaff(WHO)).toEqual({ ok: true, deleted: 0 })
  })

  it('fails with the server error', async () => {
    rpcRoute = () => ({ data: null, error: { message: 'Not allowed' } })
    expect(await removeNotComingInForUserAsStaff(WHO)).toEqual({ ok: false, message: 'Not allowed' })
  })
})

describe('recordNotComingInSelf', () => {
  it('inserts one unpaid day for the person themselves', async () => {
    expect(await recordNotComingInSelf({ userId: 'abraham', workDateYmd: '2026-09-28' })).toEqual({
      ok: true,
      alreadyMarked: false,
    })
    expect(queries).toHaveLength(2)
    expect(queries[1]?.table).toBe('user_time_off')
    expect(queries[1]?.steps).toEqual([
      {
        method: 'insert',
        args: [
          {
            user_id: 'abraham',
            start_date: '2026-09-28',
            end_date: '2026-09-28',
            kind: 'unpaid',
            note: 'Not coming in',
          },
        ],
      },
    ])
  })

  it('writes nothing when the day is already covered', async () => {
    route = () => ({ data: [{ id: 'off-1' }], error: null })
    expect(await recordNotComingInSelf({ userId: 'abraham', workDateYmd: '2026-09-28' })).toEqual({
      ok: true,
      alreadyMarked: true,
    })
    expect(queries).toHaveLength(1)
  })

  it('fails with the insert error', async () => {
    route = (_table, steps) =>
      steps.some((s) => s.method === 'insert')
        ? { data: null, error: { message: 'new row violates row-level security policy' } }
        : { data: [], error: null }
    expect(await recordNotComingInSelf({ userId: 'abraham', workDateYmd: '2026-09-28' })).toEqual({
      ok: false,
      message: 'new row violates row-level security policy',
    })
  })
})

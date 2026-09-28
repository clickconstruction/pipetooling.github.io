import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * No-call-no-show from the hub: the incident RPC, then the day-off marking,
 * then the blocks — in that order, and nothing after a refusal.
 */
type Result = { data: unknown; error: { message: string } | null }
const order: string[] = []
const rpcCalls: Array<{ fn: string; params: unknown }> = []
let rpcRoute: () => Result = () => ({ data: [], error: null })

const mocks = vi.hoisted(() => ({
  recordNotComingInForUserAsStaff: vi.fn(),
  removePersonDayBlocks: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    rpc: (fn: string, params: unknown) => {
      order.push('incident')
      rpcCalls.push({ fn, params })
      return Promise.resolve(rpcRoute())
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<Result>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))
vi.mock('../notComingInTimeOff', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../notComingInTimeOff')>()),
  recordNotComingInForUserAsStaff: mocks.recordNotComingInForUserAsStaff,
}))
vi.mock('./removePersonDayBlocks', () => ({ removePersonDayBlocks: mocks.removePersonDayBlocks }))

import { recordNcnsForPersonDay } from './recordNcns'

const accepted = (over = {}) => ({
  data: [{ rejected_count: 0, had_approved_sessions: false, error_message: null, ...over }],
  error: null,
})
const run = (over: Partial<Parameters<typeof recordNcnsForPersonDay>[0]> = {}) =>
  recordNcnsForPersonDay({
    subjectUserId: 'abraham',
    workDateYmd: '2026-09-28',
    details: '',
    existingBlockIds: ['blk-1', 'blk-2'],
    ...over,
  })

beforeEach(() => {
  order.length = 0
  rpcCalls.length = 0
  rpcRoute = () => accepted()
  mocks.recordNotComingInForUserAsStaff.mockReset().mockImplementation(async () => {
    order.push('day off')
    return { ok: true, alreadyMarked: false }
  })
  mocks.removePersonDayBlocks.mockReset().mockImplementation(async (ids: readonly string[]) => {
    order.push('blocks')
    return { removed: ids.length, failed: 0 }
  })
})

describe('recordNcnsForPersonDay — the order', () => {
  it('records the incident first, then marks the day off, then clears the blocks', async () => {
    await run()
    expect(order).toEqual(['incident', 'day off', 'blocks'])
  })

  it('marks the day off under the no-call-no-show note', async () => {
    await run()
    expect(mocks.recordNotComingInForUserAsStaff).toHaveBeenCalledWith({
      subjectUserId: 'abraham',
      workDateYmd: '2026-09-28',
      note: 'No call, no show',
    })
  })

  it('clears the blocks it was handed — the ones read before anything was written', async () => {
    await run({ existingBlockIds: ['blk-7'] })
    expect(mocks.removePersonDayBlocks).toHaveBeenCalledWith(['blk-7'])
  })
})

describe('recordNcnsForPersonDay — what the incident is sent', () => {
  it('names the person and the day, and leaves the details out when there are none', async () => {
    await run()
    expect(rpcCalls).toEqual([
      {
        fn: 'record_ncns_and_reject_sessions_for_day',
        params: { p_subject_user_id: 'abraham', p_work_date: '2026-09-28' },
      },
    ])
  })

  it('sends the details as they were written — not trimmed', async () => {
    await run({ details: ' Did not answer two calls. ' })
    expect(rpcCalls[0]?.params).toEqual({
      p_subject_user_id: 'abraham',
      p_work_date: '2026-09-28',
      p_details: ' Did not answer two calls. ',
    })
  })
})

describe('recordNcnsForPersonDay — a refusal stops everything', () => {
  it('hands back what the incident said and writes nothing else', async () => {
    rpcRoute = () => accepted({ error_message: 'Clock out the open session first.' })
    expect(await run()).toEqual({ ok: false, message: 'Clock out the open session first.' })
    expect(order).toEqual(['incident'])
    expect(mocks.recordNotComingInForUserAsStaff).not.toHaveBeenCalled()
    expect(mocks.removePersonDayBlocks).not.toHaveBeenCalled()
  })

  it('treats no row back as a refusal', async () => {
    rpcRoute = () => ({ data: [], error: null })
    expect(await run()).toEqual({ ok: false, message: 'Could not record NCNS.' })
    rpcRoute = () => ({ data: null, error: null })
    expect(await run()).toEqual({ ok: false, message: 'Could not record NCNS.' })
    expect(mocks.recordNotComingInForUserAsStaff).not.toHaveBeenCalled()
    expect(mocks.removePersonDayBlocks).not.toHaveBeenCalled()
  })

  it('throws when the incident call itself errors, and writes nothing else', async () => {
    rpcRoute = () => ({ data: null, error: { message: 'permission denied' } })
    await expect(run()).rejects.toThrow('permission denied')
    expect(mocks.recordNotComingInForUserAsStaff).not.toHaveBeenCalled()
    expect(mocks.removePersonDayBlocks).not.toHaveBeenCalled()
  })
})

describe('recordNcnsForPersonDay — once the incident is on record', () => {
  it('reports what the incident did and how the blocks went', async () => {
    rpcRoute = () => accepted({ rejected_count: 2, had_approved_sessions: true })
    mocks.removePersonDayBlocks.mockResolvedValue({ removed: 1, failed: 1 })
    expect(await run()).toEqual({
      ok: true,
      rejectedCount: 2,
      hadApprovedSessions: true,
      timeOff: { ok: true, alreadyMarked: false },
      removed: 1,
      failed: 1,
    })
  })

  it('still clears the blocks when the day-off marking fails, and says how it failed', async () => {
    mocks.recordNotComingInForUserAsStaff.mockImplementation(async () => {
      order.push('day off')
      return { ok: false, message: 'Not allowed' }
    })
    const result = await run()
    expect(order).toEqual(['incident', 'day off', 'blocks'])
    expect(result).toMatchObject({ ok: true, timeOff: { ok: false, message: 'Not allowed' }, removed: 2 })
  })

  it('passes on a day that already had time off, and the salary sync warning', async () => {
    mocks.recordNotComingInForUserAsStaff.mockResolvedValueOnce({ ok: true, alreadyMarked: true })
    expect(await run()).toMatchObject({ ok: true, timeOff: { ok: true, alreadyMarked: true } })
    mocks.recordNotComingInForUserAsStaff.mockResolvedValueOnce({
      ok: true,
      alreadyMarked: false,
      syncWarning: 'no pay config',
    })
    expect(await run()).toMatchObject({ timeOff: { ok: true, alreadyMarked: false, syncWarning: 'no pay config' } })
  })

  it('asks for the blocks to be cleared even when the day had none', async () => {
    const result = await run({ existingBlockIds: [] })
    expect(mocks.removePersonDayBlocks).toHaveBeenCalledWith([])
    expect(result).toMatchObject({ ok: true, removed: 0, failed: 0 })
  })
})

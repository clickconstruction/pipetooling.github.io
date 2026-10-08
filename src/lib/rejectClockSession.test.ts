/**
 * Rejecting a clock session (v2.4964): one `reject_clock_session` call when the database has it,
 * and the old two requests — the reject, then the `people_hours` resync — while its migration is
 * not pushed yet. Only a missing function falls back; any other answer is the caller's error.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isMissingRejectFunction, rejectClockSession } from './rejectClockSession'

type Result = { data: unknown; error: unknown; status?: number }

const h = vi.hoisted(() => ({
  log: [] as string[],
  updates: [] as Array<{ values: Record<string, unknown>; id: unknown }>,
  reject: { data: null, error: null } as Result,
  update: { data: null, error: null } as Result,
  recompute: { data: null, error: null } as Result,
}))

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.log.push(`rpc ${fn} ${String(args.p_session_id)}`)
      return Promise.resolve(fn === 'reject_clock_session' ? h.reject : h.recompute)
    },
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: (_col: string, id: unknown) => {
          h.log.push(`update ${table} ${String(id)}`)
          h.updates.push({ values, id })
          return Promise.resolve(h.update)
        },
      }),
    }),
  },
}))

const MISSING: Result = {
  data: null,
  error: { code: 'PGRST202', message: 'Could not find the function public.reject_clock_session(p_session_id) in the schema cache' },
  status: 404,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-08T18:00:00.000Z'))
  h.log = []
  h.updates = []
  h.reject = { data: null, error: null }
  h.update = { data: null, error: null }
  h.recompute = { data: null, error: null }
  return () => vi.useRealTimers()
})

describe('rejectClockSession', () => {
  it('sends one reject_clock_session call and nothing else', async () => {
    await expect(rejectClockSession('s-1', 'u-lead')).resolves.toBe('one transaction')
    expect(h.log).toEqual(['rpc reject_clock_session s-1'])
  })

  it('a refusal from it is the caller’s error, with no fallback', async () => {
    h.reject = { data: null, error: { code: 'P0001', message: 'reject_clock_session: no clock session s-1 that you can change' } }
    const err = await rejectClockSession('s-1', 'u-lead').catch((e: unknown) => e)
    expect(String((err as Error).message)).toContain('that you can change')
    expect(h.log).toEqual(['rpc reject_clock_session s-1'])
  })

  it('while the function is missing it falls back to the reject, then the resync', async () => {
    h.reject = MISSING
    await expect(rejectClockSession('s-1', 'u-lead')).resolves.toBe('two requests')
    expect(h.log).toEqual([
      'rpc reject_clock_session s-1',
      'update clock_sessions s-1',
      'rpc recompute_people_hours_after_session_edit s-1',
    ])
    expect(h.updates).toEqual([{ values: { rejected_at: '2026-10-08T18:00:00.000Z', rejected_by: 'u-lead' }, id: 's-1' }])
  })

  it('in the fallback a refused reject stops before the resync', async () => {
    h.reject = MISSING
    h.update = { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
    await expect(rejectClockSession('s-1', null)).rejects.toBeTruthy()
    expect(h.log).toEqual(['rpc reject_clock_session s-1', 'update clock_sessions s-1'])
  })

  it('in the fallback a failed resync comes after the reject is written — the gap the push closes', async () => {
    h.reject = MISSING
    h.recompute = { data: null, error: { code: '42501', message: 'Access denied' } }
    await expect(rejectClockSession('s-1', 'u-lead')).rejects.toBeTruthy()
    expect(h.log).toEqual([
      'rpc reject_clock_session s-1',
      'update clock_sessions s-1',
      'rpc recompute_people_hours_after_session_edit s-1',
    ])
  })
})

describe('isMissingRejectFunction', () => {
  it('knows PostgREST’s and Postgres’s answers for a missing function', () => {
    expect(isMissingRejectFunction({ code: 'PGRST202', message: 'x' })).toBe(true)
    expect(isMissingRejectFunction({ code: '42883', message: 'function public.reject_clock_session(uuid) does not exist' })).toBe(true)
    expect(isMissingRejectFunction({ serverMessage: 'Could not find the function public.reject_clock_session(p_session_id) in the schema cache' })).toBe(true)
  })

  it('anything else is not a missing function', () => {
    expect(isMissingRejectFunction({ code: 'P0001', message: 'reject_clock_session: no clock session x that you can change' })).toBe(false)
    expect(isMissingRejectFunction({ code: '42501', message: 'permission denied for function reject_clock_session' })).toBe(false)
    expect(isMissingRejectFunction(null)).toBe(false)
    expect(isMissingRejectFunction('Could not find the function')).toBe(false)
  })
})

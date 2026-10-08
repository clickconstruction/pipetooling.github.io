/**
 * Rejecting a clock session: one `reject_clock_session` call (v2.4964), the reject and the
 * `people_hours` resync in one transaction. Since v2.4973 nothing falls back to the old two
 * requests — the reject, then the resync — not even when the function is missing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rejectClockSession } from './rejectClockSession'

type Result = { data: unknown; error: unknown; status?: number }

const h = vi.hoisted(() => ({
  log: [] as string[],
  reject: { data: null, error: null } as Result,
}))

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.log.push(`rpc ${fn} ${String(args.p_session_id)}`)
      return Promise.resolve(fn === 'reject_clock_session' ? h.reject : { data: null, error: null })
    },
    from: (table: string) => ({
      update: () => ({
        eq: (_col: string, id: unknown) => {
          h.log.push(`update ${table} ${String(id)}`)
          return Promise.resolve({ data: null, error: null })
        },
      }),
    }),
  },
}))

beforeEach(() => {
  h.log = []
  h.reject = { data: null, error: null }
})

describe('rejectClockSession', () => {
  it('sends one reject_clock_session call and nothing else', async () => {
    await expect(rejectClockSession('s-1')).resolves.toBeUndefined()
    expect(h.log).toEqual(['rpc reject_clock_session s-1'])
  })

  it('a refusal from it is the caller’s error', async () => {
    h.reject = { data: null, error: { code: 'P0001', message: 'reject_clock_session: no clock session s-1 that you can change' } }
    const err = await rejectClockSession('s-1').catch((e: unknown) => e)
    expect(String((err as Error).message)).toContain('that you can change')
    expect(h.log).toEqual(['rpc reject_clock_session s-1'])
  })

  it('a missing function is the caller’s error too: no reject or resync goes out on its own', async () => {
    h.reject = {
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.reject_clock_session(p_session_id) in the schema cache' },
      status: 404,
    }
    await expect(rejectClockSession('s-1')).rejects.toBeTruthy()
    expect(h.log).toEqual(['rpc reject_clock_session s-1'])
  })
})

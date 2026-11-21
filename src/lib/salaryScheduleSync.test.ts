// @vitest-environment jsdom
/**
 * The clock button's unasked salary sync and View as. The call runs as whoever is signed in, so a
 * dev looking as a teammate would write that teammate's clock rows. It is held while View as is on
 * and the flag is read at each call. The sync a person presses for is not held.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpcs: [] as { fn: string; args: Record<string, unknown> }[] }))

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.rpcs.push({ fn, args })
      return Promise.resolve({ data: null, error: null })
    },
  },
}))

import { IMPERSONATION_ORIGINAL_STORAGE_KEY } from './impersonationSession'
import { syncSalaryClockSessionsForUserDay, syncSalaryClockSessionsUnasked } from './salaryScheduleSync'

const viewAs = (on: boolean) => {
  if (on) localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }))
  else localStorage.removeItem(IMPERSONATION_ORIGINAL_STORAGE_KEY)
}

describe('syncSalaryClockSessionsUnasked', () => {
  beforeEach(() => {
    h.rpcs.length = 0
    localStorage.clear()
  })
  afterEach(() => localStorage.clear())

  it('as yourself runs the sync for today', async () => {
    expect(await syncSalaryClockSessionsUnasked('user-1')).toEqual({ error: null, held: false })
    expect(h.rpcs).toHaveLength(1)
    expect(h.rpcs[0]!.fn).toBe('sync_salary_clock_sessions_for_user_day')
    expect(h.rpcs[0]!.args.p_user_id).toBe('user-1')
  })

  it('while View as is on makes no call and says it was held', async () => {
    viewAs(true)
    expect(await syncSalaryClockSessionsUnasked('user-1')).toEqual({ error: null, held: true })
    expect(h.rpcs).toEqual([])
  })

  it('reads the flag at each call: held from the moment an imitation begins, running again after it', async () => {
    await syncSalaryClockSessionsUnasked('user-1')
    viewAs(true)
    await syncSalaryClockSessionsUnasked('user-1')
    await syncSalaryClockSessionsUnasked('user-1')
    expect(h.rpcs).toHaveLength(1)
    viewAs(false)
    await syncSalaryClockSessionsUnasked('user-1')
    expect(h.rpcs).toHaveLength(2)
  })

  it('hands back the reason when the sync fails', async () => {
    const sync = vi.fn(async () => ({ error: 'not authorized' }))
    expect(await syncSalaryClockSessionsUnasked('user-1', { viewingAs: () => false, sync })).toEqual({ error: 'not authorized', held: false })
    expect(sync).toHaveBeenCalledWith('user-1')
  })

  it('leaves the sync a person presses for alone', async () => {
    viewAs(true)
    expect(await syncSalaryClockSessionsForUserDay('user-1', '2026-11-21')).toEqual({ error: null })
    expect(h.rpcs).toEqual([{ fn: 'sync_salary_clock_sessions_for_user_day', args: { p_user_id: 'user-1', p_work_date: '2026-11-21' } }])
  })
})

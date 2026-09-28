// @vitest-environment jsdom
/**
 * The one read behind every Write up a change door: nothing is read for a role that cannot
 * write one up or without a signed-in user; the opt-in row's `visible` is the answer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useQuickEstimateDoor } from './useQuickEstimateDoor'

type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let visible: boolean | null = null
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: visible == null ? null : { visible }, error: null })
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
afterEach(() => {
  cleanup()
  queries.length = 0
  visible = null
})

describe('useQuickEstimateDoor', () => {
  it('is on when the opt-in row says visible, read for this user and key', async () => {
    visible = true
    const { result } = renderHook(() => useQuickEstimateDoor('user-1', 'master_technician'))
    await waitFor(() => expect(result.current).toBe(true))
    expect(queries[0]?.table).toBe('user_dashboard_buttons')
    const eqs = queries[0]!.steps.filter((s) => s.method === 'eq').map((s) => s.args)
    expect(eqs).toEqual([
      ['user_id', 'user-1'],
      ['button_key', 'quick_estimate'],
    ])
  })

  it('stays off without a row (the default) and when the row says not visible', async () => {
    const off = renderHook(() => useQuickEstimateDoor('user-1', 'estimator'))
    await waitFor(() => expect(queries.length).toBe(1))
    expect(off.result.current).toBe(false)
    visible = false
    const { result } = renderHook(() => useQuickEstimateDoor('user-2', 'estimator'))
    await waitFor(() => expect(queries.length).toBe(2))
    expect(result.current).toBe(false)
  })

  it('reads nothing for an office role or without a user', () => {
    const a = renderHook(() => useQuickEstimateDoor('user-1', 'assistant'))
    const b = renderHook(() => useQuickEstimateDoor(null, 'master_technician'))
    expect(a.result.current).toBe(false)
    expect(b.result.current).toBe(false)
    expect(queries.length).toBe(0)
  })
})

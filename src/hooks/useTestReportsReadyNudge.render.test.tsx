// @vitest-environment jsdom
/**
 * Test reports ready and ZZ test jobs (punch list #61, v2.5122): the shared ids leave in the query itself, so
 * test drafts cannot fill the 200-row read and push real ones out (review on #5246); the embedded job name
 * catches any the ids missed. Without the option the read is as before.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const calls: Array<[string, unknown[]]> = []
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'not', 'order', 'limit']) {
        chain[m] = (...a: unknown[]) => {
          calls.push([m, a])
          return chain
        }
      }
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
      return chain
    },
  },
}))
vi.mock('../lib/jobs/zzTestJobRows', () => ({ loadZzTestJobIds: async () => new Set(['Z', 'Y']) }))

const { useTestReportsReadyNudge } = await import('./useTestReportsReadyNudge')

beforeEach(() => {
  calls.length = 0
})

describe('useTestReportsReadyNudge · ZZ test jobs', () => {
  it('leaves the ZZ ids out in the query, before the 200-row limit', async () => {
    const { result } = renderHook(() => useTestReportsReadyNudge(true, true, 'u-ann'))
    await waitFor(() => expect(result.current.drafts).not.toBeNull())
    expect(calls.find(([m]) => m === 'not')).toEqual(['not', ['job_id', 'in', '(Z,Y)']])
    expect(calls.map(([m]) => m)).toEqual(['select', 'eq', 'not', 'order', 'limit'])
  })

  it('without the option, sends the read as before', async () => {
    const { result } = renderHook(() => useTestReportsReadyNudge(true, false))
    await waitFor(() => expect(result.current.drafts).not.toBeNull())
    expect(calls.some(([m]) => m === 'not')).toBe(false)
  })
})

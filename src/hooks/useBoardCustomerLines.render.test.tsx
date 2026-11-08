// @vitest-environment jsdom
/**
 * Punch list #125, PR 1: the board's customer lines read for the office on `refresh`, again on `reload`, nothing for
 * anyone else, and the last lines stand when a read fails.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { JobActivityMessage } from '../lib/jobs/jobActivityMessages'
import { useBoardCustomerLines } from './useBoardCustomerLines'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const line: JobActivityMessage = {
  id: 'm-ask',
  contactId: 'c-dana',
  contact: { name: 'Dana Whitfield', goesBy: null, kind: 'customer' },
  channel: 'text',
  direction: 'in',
  at: '2026-10-12T14:05:00Z',
  who: 'Dana Whitfield',
  body: 'Can you do Thursday?',
  tied: true,
}
const LINES = new Map([['job-1312', [line]]])

describe('useBoardCustomerLines', () => {
  it('reads for the office on refresh and again on reload', async () => {
    const load = vi.fn(() => Promise.resolve(LINES))
    const { result } = renderHook(() => useBoardCustomerLines({ enabled: true, load }))
    await result.current.refresh(['job-1312'])
    await waitFor(() => expect(result.current.linesByJobId.get('job-1312')?.[0]?.body).toBe('Can you do Thursday?'))
    expect(load).toHaveBeenCalledWith(['job-1312'])
    await result.current.reload()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reads nothing for anyone but the office', async () => {
    const load = vi.fn(() => Promise.resolve(LINES))
    const { result } = renderHook(() => useBoardCustomerLines({ enabled: false, load }))
    await result.current.refresh(['job-1312'])
    expect(load).not.toHaveBeenCalled()
    expect(result.current.linesByJobId.size).toBe(0)
  })

  it('keeps the last lines when a read fails', async () => {
    let fail = false
    const load = vi.fn(() => (fail ? Promise.reject(new Error('down')) : Promise.resolve(LINES)))
    const { result } = renderHook(() => useBoardCustomerLines({ enabled: true, load }))
    await result.current.refresh(['job-1312'])
    await waitFor(() => expect(result.current.linesByJobId.size).toBe(1))
    fail = true
    await result.current.reload()
    expect(result.current.linesByJobId.size).toBe(1)
  })
})

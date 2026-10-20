// @vitest-environment jsdom
/**
 * The Pipeline's waiting dots (v2.5632): the hook reads once for the office, maps the jobs whose customer waits, reads
 * again on a new key or a reload, reads nothing for anyone else, and keeps its last dots when a read fails.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BoardDotRows } from '../lib/messages/boardDotsIo'
import { useBoardDots } from './useBoardDots'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const ROWS: BoardDotRows = {
  contacts: [{ id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', goesBy: null, company: null, state: 'waiting', snoozedUntil: null, has: null, hasUserId: null, hasSince: null, hasHow: null, phone: null }],
  lines: [
    {
      id: 'm-ask',
      contactId: 'c-dana',
      jobId: 'job-1312',
      channel: 'text',
      direction: 'in',
      at: '2026-10-12T14:05:00Z',
      subject: null,
      body: 'Can you do Thursday?',
      who: 'Dana Whitfield',
      backOn: null,
      backBy: null,
      mailbox: null,
      tiedByHand: false,
    },
  ],
}

describe('useBoardDots', () => {
  it('maps the waiting job for the office and reads again on a new key and on reload', async () => {
    const load = vi.fn(() => Promise.resolve(ROWS))
    const { result, rerender } = renderHook(({ key }) => useBoardDots({ enabled: true, refreshKey: key, load, todayYmd: '2026-10-12', nowIso: '2026-10-12T20:00:00Z' }), {
      initialProps: { key: 1 },
    })
    await waitFor(() => expect(result.current.dotByJobId.get('job-1312')?.who).toBe('Dana'))
    expect(load).toHaveBeenCalledTimes(1)
    rerender({ key: 2 })
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await result.current.reload()
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('reads nothing for anyone but the office', async () => {
    const load = vi.fn(() => Promise.resolve(ROWS))
    const { result } = renderHook(() => useBoardDots({ enabled: false, load }))
    await new Promise((r) => setTimeout(r, 0))
    expect(load).not.toHaveBeenCalled()
    expect(result.current.dotByJobId.size).toBe(0)
  })

  it('keeps the last dots when a read fails', async () => {
    let fail = false
    const load = vi.fn(() => (fail ? Promise.reject(new Error('down')) : Promise.resolve(ROWS)))
    const { result } = renderHook(() => useBoardDots({ enabled: true, load, todayYmd: '2026-10-12', nowIso: '2026-10-12T20:00:00Z' }))
    await waitFor(() => expect(result.current.dotByJobId.size).toBe(1))
    fail = true
    await result.current.reload()
    expect(result.current.dotByJobId.size).toBe(1)
  })
})

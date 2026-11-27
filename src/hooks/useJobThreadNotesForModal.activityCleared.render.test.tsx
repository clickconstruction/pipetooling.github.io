// @vitest-environment jsdom
/**
 * Finding 283 of the fixing thread's ledger (punch list #443, row 1; the walk of 2026-11-27): after the Lien window's
 * **Clear…** took three lines off a test job's Activity, the job window open behind it still drew them until the job
 * was opened again. The list hears a new line from the database and nothing told it of a delete. The press that
 * deletes now says so (`jobActivityChanged.ts`), and the job window's list reads again. Made-up rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const io = vi.hoisted(() => ({
  /** The job's Activity lines, as each read answers them. */
  rows: [] as Array<{ id: string; event_type: string; occurred_at: string; actor_user_id: null; actor_name: null; summary: string; detail: null; financial: false }>,
  read: [] as string[],
}))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../lib/fetchJobActivityEventsForJobLedger', () => ({
  fetchJobActivityEventsForJobLedger: async (jobId: string) => {
    io.read.push(jobId)
    return { data: io.rows, error: null }
  },
}))

import { announceJobActivityChanged } from '../lib/jobs/jobActivityChanged'
import { useJobThreadNotesForModal } from './useJobThreadNotesForModal'

const line = (id: string) => ({ id, event_type: 'lien_notice_sent', occurred_at: '2026-11-20T15:00:00Z', actor_user_id: null, actor_name: null, summary: 'Lien notice sent by hand', detail: null, financial: false as const })
/** Stable, as the toast context's is: the hook reads the thread again whenever it changes. */
const showToast = () => {}
const noticeLines = (activity: ReadonlyArray<{ kind: string }>) => activity.filter((i) => i.kind === 'event').length

beforeEach(() => {
  io.rows = [line('a'), line('b'), line('c')]
  io.read = []
})
afterEach(() => vi.restoreAllMocks())

describe('the job window’s Activity after a press took lines off it', () => {
  it('reads again when its own job is named, and draws what is left', async () => {
    const { result } = renderHook(() => useJobThreadNotesForModal('job-1', true, { authUserId: 'user-1', showToast }))
    await waitFor(() => expect(noticeLines(result.current.activity)).toBe(3))
    expect(io.read).toEqual(['job-1'])
    // The Lien window's Clear… took all three.
    io.rows = []
    act(() => announceJobActivityChanged('job-1'))
    await waitFor(() => expect(noticeLines(result.current.activity)).toBe(0))
    expect(io.read).toEqual(['job-1', 'job-1'])
  })

  it('reads nothing again when another job is named', async () => {
    const { result } = renderHook(() => useJobThreadNotesForModal('job-1', true, { authUserId: 'user-1', showToast }))
    await waitFor(() => expect(noticeLines(result.current.activity)).toBe(3))
    io.rows = []
    act(() => announceJobActivityChanged('job-2'))
    await Promise.resolve()
    expect(io.read).toEqual(['job-1'])
    expect(noticeLines(result.current.activity)).toBe(3)
  })

  it('a window that is shut hears nothing', async () => {
    renderHook(() => useJobThreadNotesForModal('job-1', false, { authUserId: 'user-1', showToast }))
    act(() => announceJobActivityChanged('job-1'))
    await Promise.resolve()
    expect(io.read).toEqual([])
  })

  it('stops hearing once the window is gone', async () => {
    const { result, unmount } = renderHook(() => useJobThreadNotesForModal('job-1', true, { authUserId: 'user-1', showToast }))
    await waitFor(() => expect(noticeLines(result.current.activity)).toBe(3))
    unmount()
    announceJobActivityChanged('job-1')
    await Promise.resolve()
    expect(io.read).toEqual(['job-1'])
  })
})

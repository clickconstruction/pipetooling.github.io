// @vitest-environment jsdom
/**
 * The "seen" marks a page makes with no press, while View as is on. A dev looking as a teammate is
 * signed in as them, so each of these would clear something the teammate has not read. They are held:
 * the answers to a tagged note, the read mark on a bid's notes, and the answers to a plan question.
 * (The bid request strip, the First look stamp, the firm's intake and the day editor's sync have
 * their case in their own smokes.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  rpcs: [] as string[],
  upserts: [] as string[],
  updates: [] as Array<{ table: string; ids: unknown }>,
  reads: 0,
  planRows: [] as unknown[],
}))

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (fn: string) => {
      h.rpcs.push(fn)
      return Promise.resolve({ data: 2, error: null })
    },
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      let update = false
      for (const m of ['select', 'eq', 'neq', 'is', 'order', 'limit']) b[m] = () => b
      b.upsert = () => {
        h.upserts.push(table)
        return Promise.resolve({ data: null, error: null })
      }
      b.update = () => {
        update = true
        return b
      }
      b.in = (_column: string, ids: unknown) => {
        if (update) h.updates.push({ table, ids })
        return b
      }
      b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
        if (!update) h.reads += 1
        return Promise.resolve({ data: update ? null : h.planRows, error: null }).then(res, rej)
      }
      return b
    },
  },
}))

import { IMPERSONATION_ORIGINAL_STORAGE_KEY } from './impersonationSession'
import { markAnswersSeen } from './jobs/noteTagsIo'
import { upsertBidNotesReadWatermark } from './userBidNotesReadState'
import { usePlanQuestions } from '../hooks/usePlanQuestions'

const viewAs = () => localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }))

beforeEach(() => {
  h.rpcs.length = 0
  h.upserts.length = 0
  h.updates.length = 0
  h.reads = 0
  h.planRows = []
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('a tagged note’s answers (markAnswersSeen)', () => {
  it('as yourself marks each kind seen', async () => {
    expect(await markAnswersSeen('job')).toBe(2)
    expect(await markAnswersSeen('task')).toBe(2)
    expect(h.rpcs).toEqual(['job_note_tags_seen', 'task_note_tags_seen'])
  })

  it('while View as is on marks nothing, and says none were', async () => {
    viewAs()
    expect(await markAnswersSeen('job')).toBe(0)
    expect(await markAnswersSeen('task')).toBe(0)
    expect(h.rpcs).toEqual([])
  })

  it('reads the flag at each call', async () => {
    viewAs()
    await markAnswersSeen('job')
    localStorage.removeItem(IMPERSONATION_ORIGINAL_STORAGE_KEY)
    await markAnswersSeen('job')
    expect(h.rpcs).toEqual(['job_note_tags_seen'])
  })
})

describe('the read mark on a bid’s notes (upsertBidNotesReadWatermark)', () => {
  it('as yourself writes the mark', async () => {
    await upsertBidNotesReadWatermark('user-1', 'bid-1')
    expect(h.upserts).toEqual(['user_bid_notes_read_state'])
  })

  it('while View as is on writes nothing', async () => {
    viewAs()
    await upsertBidNotesReadWatermark('user-1', 'bid-1')
    expect(h.upserts).toEqual([])
  })
})

describe('the answers to a plan question (usePlanQuestions)', () => {
  const ROWS = [
    { id: 'q1', bid_id: 'bid-1', status: 'answered', seen_at: null, asked_by: 'user-1' },
    { id: 'q2', bid_id: 'bid-1', status: 'answered', seen_at: null, asked_by: 'someone-else' },
    { id: 'q3', bid_id: 'bid-1', status: 'open', seen_at: null, asked_by: 'user-1' },
  ]
  const input = { bidId: 'bid-1', enabled: true, userId: 'user-1' }

  it('as yourself reading the thread marks your own fresh answers seen', async () => {
    h.planRows = ROWS
    const { result } = renderHook(() => usePlanQuestions(input))
    await waitFor(() => expect(result.current.rows).toHaveLength(3))
    await waitFor(() => expect(h.updates).toEqual([{ table: 'bid_plan_questions', ids: ['q1'] }]))
  })

  it('while View as is on the thread is read and nothing is marked', async () => {
    viewAs()
    h.planRows = ROWS
    const { result } = renderHook(() => usePlanQuestions(input))
    await waitFor(() => expect(result.current.rows).toHaveLength(3))
    // The read answered and the rows are drawn, so the mark's turn has come and gone.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(h.reads).toBeGreaterThan(0)
    expect(h.updates).toEqual([])
  })
})

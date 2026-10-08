/**
 * The six clock-session split RPC wrappers the My Time day editor's assign flow and the segment
 * persist call (`splitOwnClockSessionSegments.ts`, `leaderClockSessionSplit.ts`; the map's risk flag
 * "the own/leader RPC wrappers"). Each calls its RPC on the public schema with the right parameter
 * names and the segments as given, answers the inserted ids, and turns no row, the row's own
 * `error_message` and a database refusal into an error without retrying.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  leaderReplaceClockSessionClusterMixed,
  leaderSplitClockSessionCluster,
  leaderSplitClockSessionSegments,
} from './leaderClockSessionSplit'
import {
  replaceOwnClockSessionClusterMixed,
  splitOwnClockSessionCluster,
  splitOwnClockSessionSegments,
  type SplitClockSegmentPayload,
} from './splitOwnClockSessionSegments'
import { DatabaseError } from '../utils/errorHandling'

const h = vi.hoisted(() => ({
  calls: [] as Array<{ schema: string; fn: string; args: Record<string, unknown> }>,
  answer: { data: [] as unknown, error: null as unknown },
}))

vi.mock('./supabase', () => ({
  supabase: {
    schema: (schema: string) => ({
      rpc: (fn: string, args: Record<string, unknown>) => {
        h.calls.push({ schema, fn, args })
        return Promise.resolve(h.answer)
      },
    }),
  },
}))

const SEGMENTS: SplitClockSegmentPayload[] = [
  { clocked_in_at: '2026-10-06T14:00:00Z', clocked_out_at: '2026-10-06T15:00:00Z', notes: 'Rough-in', job_ledger_id: 'job-1', bid_id: null },
  { clocked_in_at: '2026-10-06T15:00:00Z', clocked_out_at: '2026-10-06T16:00:00Z', notes: 'Trim out' },
]
const ONE = 'session-1'
const ROWS = ['session-1', 'session-2']

const WRAPPERS = [
  { name: 'splitOwnClockSessionSegments', fn: 'split_own_clock_session_segments', call: () => splitOwnClockSessionSegments(ONE, SEGMENTS), target: { p_session_id: ONE } },
  { name: 'splitOwnClockSessionCluster', fn: 'split_own_clock_session_cluster', call: () => splitOwnClockSessionCluster(ROWS, SEGMENTS), target: { p_session_ids: ROWS } },
  { name: 'replaceOwnClockSessionClusterMixed', fn: 'replace_own_clock_session_cluster_mixed', call: () => replaceOwnClockSessionClusterMixed(ROWS, SEGMENTS), target: { p_session_ids: ROWS } },
  { name: 'leaderSplitClockSessionSegments', fn: 'leader_split_clock_session_segments', call: () => leaderSplitClockSessionSegments(ONE, SEGMENTS), target: { p_session_id: ONE } },
  { name: 'leaderSplitClockSessionCluster', fn: 'leader_split_clock_session_cluster', call: () => leaderSplitClockSessionCluster(ROWS, SEGMENTS), target: { p_session_ids: ROWS } },
  { name: 'leaderReplaceClockSessionClusterMixed', fn: 'leader_replace_clock_session_cluster_mixed', call: () => leaderReplaceClockSessionClusterMixed(ROWS, SEGMENTS), target: { p_session_ids: ROWS } },
]

beforeEach(() => {
  h.calls = []
  h.answer = { data: [], error: null }
})

describe.each(WRAPPERS)('$name', ({ fn, call, target }) => {
  it(`calls public.${fn} with its rows and the segments as given, and answers the inserted ids`, async () => {
    h.answer = { data: [{ inserted_ids: ['new-1', 'new-2'], error_message: null }], error: null }
    await expect(call()).resolves.toEqual(['new-1', 'new-2'])
    expect(h.calls).toEqual([{ schema: 'public', fn, args: { ...target, p_segments: SEGMENTS } }])
  })

  it('answers no ids when the row carries none', async () => {
    h.answer = { data: [{ inserted_ids: null, error_message: null }], error: null }
    await expect(call()).resolves.toEqual([])
  })

  it('no row back is an error that names the RPC', async () => {
    for (const data of [[], null]) {
      h.answer = { data, error: null }
      const err = await call().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(DatabaseError)
      expect((err as Error).message).toBe(`No response from ${fn}`)
    }
  })

  it('the row’s own error_message is the error, and no ids are answered', async () => {
    h.answer = { data: [{ inserted_ids: ['new-1'], error_message: 'Segments must cover the session exactly.' }], error: null }
    const err = await call().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DatabaseError)
    expect((err as Error).message).toBe('Segments must cover the session exactly.')
  })

  it('a database refusal rejects once, without a retry', async () => {
    h.answer = { data: null, error: { message: `permission denied for function ${fn}`, code: '42501' } }
    await expect(call()).rejects.toBeTruthy()
    expect(h.calls).toHaveLength(1)
  })
})

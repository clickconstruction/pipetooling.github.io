import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Persisting an edited My Time cluster before assigning its segments: which
 * RPC (or which per-row update) each cluster shape takes, what each is handed,
 * and the segment-index → clock_sessions.id map that comes back. The
 * predicates it branches on have their own suites; this pins the routing.
 */
type Step = { method: string; args: unknown[] }
const updates: Array<{ table: string; steps: Step[] }> = []
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      updates.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: null, error: null })
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

import { DatabaseError } from '../utils/errorHandling'
import { persistMyTimeClusterAndGetSegmentIds } from './persistMyTimeClusterForSegmentAssign'
import type { DayEditorSession } from './myTimeDayTimeline'

const T = (h: number, m = 0) => `2026-09-07T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`
const ms = (h: number, m = 0) => Date.parse(T(h, m))
const now = ms(20)
const row = (id: string, inH: number, outH: number | null, over: Partial<DayEditorSession> = {}): DayEditorSession => ({
  id,
  clocked_in_at: T(inH),
  clocked_out_at: outH == null ? null : T(outH),
  work_date: '2026-09-07',
  notes: '',
  job_ledger_id: 'j1',
  bid_id: null,
  approved_at: null,
  origin: 'user_punch',
  salary_segment_index: null,
  ...over,
})
const payload = (inH: number, outH: number | null, notes = '', extra: Record<string, unknown> = {}) => ({
  clocked_in_at: T(inH),
  clocked_out_at: outH == null ? null : T(outH),
  notes,
  job_ledger_id: 'stripped-if-sent-to-a-segment-rpc',
  ...extra,
})
const rpcs = () => ({
  runSplitSeg: vi.fn(async (_id: string, segs: unknown[]) => segs.map((_s, i) => `seg-${i}`)),
  runSplitCluster: vi.fn(async (_ids: string[], segs: unknown[]) => segs.map((_s, i) => `cl-${i}`)),
  runReplaceMixed: vi.fn(async (_ids: string[], segs: unknown[]) => segs.map((_s, i) => `mx-${i}`)),
})
const updateArgs = () => updates.map((u) => ({ table: u.table, set: u.steps.find((s) => s.method === 'update')?.args[0], id: u.steps.find((s) => s.method === 'eq')?.args[1] }))

beforeEach(() => {
  updates.length = 0
})

describe('persistMyTimeClusterAndGetSegmentIds', () => {
  it('refuses fewer than two segments', async () => {
    await expect(persistMyTimeClusterAndGetSegmentIds([row('a', 8, 12)], { boundaries: [ms(8), ms(12)], notes: [''] }, [payload(8, 12)], now, rpcs())).rejects.toBeInstanceOf(DatabaseError)
  })

  it('one row: splits it with the segment RPC, job/bid stripped from the payloads, and checks one id per segment', async () => {
    const r = rpcs()
    const ids = await persistMyTimeClusterAndGetSegmentIds([row('a', 8, 12)], { boundaries: [ms(8), ms(10), ms(12)], notes: ['x', 'y'] }, [payload(8, 10, 'x'), payload(10, 12, 'y')], now, r)
    expect(ids).toEqual(['seg-0', 'seg-1'])
    expect(r.runSplitSeg).toHaveBeenCalledWith('a', [
      { clocked_in_at: T(8), clocked_out_at: T(10), notes: 'x' },
      { clocked_in_at: T(10), clocked_out_at: T(12), notes: 'y' },
    ])
    expect(r.runSplitCluster).not.toHaveBeenCalled()
    r.runSplitSeg.mockResolvedValueOnce(['only-one'])
    await expect(persistMyTimeClusterAndGetSegmentIds([row('a', 8, 12)], { boundaries: [ms(8), ms(10), ms(12)], notes: ['', ''] }, [payload(8, 10), payload(10, 12)], now, r)).rejects.toThrow('Split did not return one id per segment')
  })

  it('a homogeneous cluster (same job, same origin) is re-split as one with the cluster RPC', async () => {
    const r = rpcs()
    const c = [row('a', 8, 10), row('b', 10, 12)]
    const ids = await persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(9), ms(12)], notes: ['', ''] }, [payload(8, 9), payload(9, 12)], now, r)
    expect(ids).toEqual(['cl-0', 'cl-1'])
    expect(r.runSplitCluster).toHaveBeenCalledWith(['a', 'b'], [
      { clocked_in_at: T(8), clocked_out_at: T(9), notes: '' },
      { clocked_in_at: T(9), clocked_out_at: T(12), notes: '' },
    ])
    expect(updates).toHaveLength(0)
    r.runSplitCluster.mockResolvedValueOnce(['x'])
    await expect(persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(9), ms(12)], notes: ['', ''] }, [payload(8, 9), payload(9, 12)], now, r)).rejects.toThrow('Cluster split did not return one id per segment')
  })

  it('a mixed cluster with one segment per row, in order, updates each row in place — notes only when the times still match, times too when they moved', async () => {
    const r = rpcs()
    const c = [row('a', 8, 10), row('b', 10, 12, { job_ledger_id: 'j2' })]
    const ids = await persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(11), ms(12)], notes: ['moved', 'kept'] }, [payload(8, 11, 'moved'), payload(11, 12, 'kept')], now, r)
    expect(ids).toEqual(['a', 'b'])
    expect(updateArgs()).toEqual([
      { table: 'clock_sessions', set: { clocked_in_at: T(8), clocked_out_at: T(11), notes: 'moved' }, id: 'a' },
      { table: 'clock_sessions', set: { clocked_in_at: T(11), clocked_out_at: T(12), notes: 'kept' }, id: 'b' },
    ])
    expect(r.runSplitSeg).not.toHaveBeenCalled()
    expect(r.runReplaceMixed).not.toHaveBeenCalled()

    updates.length = 0
    await persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(10), ms(12)], notes: ['n1', 'n2'] }, [payload(8, 10, 'n1'), payload(10, 12, 'n2')], now, r)
    expect(updateArgs()).toEqual([
      { table: 'clock_sessions', set: { notes: 'n1' }, id: 'a' },
      { table: 'clock_sessions', set: { notes: 'n2' }, id: 'b' },
    ])
  })

  it('a mixed cluster whose segments each sit inside one row: a row with several segments is split, a row with one is updated', async () => {
    const r = rpcs()
    const c = [row('a', 8, 10), row('b', 10, 12, { job_ledger_id: 'j2' })]
    const ids = await persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(9), ms(10), ms(12)], notes: ['p', 'q', 'r'] }, [payload(8, 9, 'p'), payload(9, 10, 'q'), payload(10, 12, 'r')], now, r)
    expect(ids).toEqual(['seg-0', 'seg-1', 'b'])
    expect(r.runSplitSeg).toHaveBeenCalledWith('a', [
      { clocked_in_at: T(8), clocked_out_at: T(9), notes: 'p' },
      { clocked_in_at: T(9), clocked_out_at: T(10), notes: 'q' },
    ])
    expect(updateArgs()).toEqual([{ table: 'clock_sessions', set: { notes: 'r' }, id: 'b' }])
    r.runSplitSeg.mockResolvedValueOnce(['only-one'])
    await expect(persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(9), ms(10), ms(12)], notes: ['', '', ''] }, [payload(8, 9), payload(9, 10), payload(10, 12)], now, r)).rejects.toThrow('Row split did not return one id per sub-segment')
  })

  it('a mixed cluster whose segments straddle rows is replaced as a whole with per-segment job allocations', async () => {
    const r = rpcs()
    const c = [row('a', 8, 10), row('b', 10, 12, { job_ledger_id: 'j2' })]
    const ids = await persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(9), ms(11), ms(12)], notes: ['', '', ''] }, [payload(8, 9), payload(9, 11), payload(11, 12)], now, r)
    expect(ids).toEqual(['mx-0', 'mx-1', 'mx-2'])
    expect(r.runReplaceMixed).toHaveBeenCalledTimes(1)
    const [sentIds, sent] = r.runReplaceMixed.mock.calls[0]! as [string[], Array<{ clocked_in_at: string; job_ledger_id: string | null; bid_id: string | null }>]
    expect(sentIds).toEqual(['a', 'b'])
    expect(sent.map((s) => s.clocked_in_at)).toEqual([T(8), T(9), T(11)])
    expect(sent[0]!.job_ledger_id).toBe('j1')
    expect(sent[2]!.job_ledger_id).toBe('j2')
    expect(['j1', 'j2']).toContain(sent[1]!.job_ledger_id) // the straddling segment is allocated to one of its rows
    expect(updates).toHaveLength(0)
    r.runReplaceMixed.mockResolvedValueOnce(['x'])
    await expect(persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(9), ms(11), ms(12)], notes: ['', '', ''] }, [payload(8, 9), payload(9, 11), payload(11, 12)], now, r)).rejects.toThrow('Replace mixed did not return one id per segment')
  })

  it('a straddling edit across rows that differ in origin cannot be merged: it fails before any RPC with the user-facing message', async () => {
    const r = rpcs()
    const c = [row('a', 8, 10), row('b', 10, 12, { job_ledger_id: 'j2', origin: 'salary_schedule', salary_segment_index: 0 })]
    await expect(persistMyTimeClusterAndGetSegmentIds(c, { boundaries: [ms(8), ms(9), ms(11), ms(12)], notes: ['', '', ''] }, [payload(8, 9), payload(9, 11), payload(11, 12)], now, r)).rejects.toBeInstanceOf(DatabaseError)
    expect(r.runReplaceMixed).not.toHaveBeenCalled()
    expect(r.runSplitCluster).not.toHaveBeenCalled()
    expect(updates).toHaveLength(0)
  })
})

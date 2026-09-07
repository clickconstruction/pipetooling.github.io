import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Apply Schedule %: split one closed clock session across the day's
 * Dispatch-scheduled jobs in proportion to their scheduled time and assign
 * each segment. The proportion planner and the cluster persist have their own
 * suites; this pins the gates, the single-job assign, the split hand-off (which
 * RPC set, which payloads and notes), the per-segment assigns, and the
 * warning-vs-error split.
 */
type Step = { method: string; args: unknown[] }
const updates: Array<{ table: string; steps: Step[] }> = []
let updateFails = false
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      updates.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(updateFails ? { data: null, error: { message: 'read only' } } : { data: null, error: null })
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
vi.mock('../utils/errorHandling', async (orig) => ({
  ...(await orig<typeof import('../utils/errorHandling')>()),
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}))
const persist = vi.fn(async (_c: unknown, _split: unknown, payloads: unknown[], _now: number, _rpcs: unknown) => payloads.map((_p, i) => `seg-${i}`))
vi.mock('./persistMyTimeClusterForSegmentAssign', () => ({ persistMyTimeClusterAndGetSegmentIds: (...a: [unknown, unknown, unknown[], number, unknown]) => persist(...a) }))
// vi.mock factories are hoisted above these declarations, so the RPC spies are hoisted too.
const { own, leader } = vi.hoisted(() => ({
  own: { splitOwnClockSessionSegments: vi.fn(), splitOwnClockSessionCluster: vi.fn(), replaceOwnClockSessionClusterMixed: vi.fn() },
  leader: { leaderSplitClockSessionSegments: vi.fn(), leaderSplitClockSessionCluster: vi.fn(), leaderReplaceClockSessionClusterMixed: vi.fn() },
}))
vi.mock('./splitOwnClockSessionSegments', () => own)
vi.mock('./leaderClockSessionSplit', () => leader)

import { DatabaseError } from '../utils/errorHandling'
import { applyScheduleProportionsToClockSession } from './applyScheduleProportionsToClockSession'
import { DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX } from './peopleHoursManualDraftSession'
import type { DispatchScheduledJobForAssign } from './jobScheduleBlocks'

const T = (h: number, m = 0) => `2026-09-07T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`
const row = (over: Partial<{ id: string; clocked_in_at: string; clocked_out_at: string | null; notes: string | null }> = {}) => ({ id: 's1', clocked_in_at: T(8), clocked_out_at: T(10), notes: null, ...over })
const pick = (jobId: string, scheduledMinutes: number, earliestStartMinutes: number, hcp = '', name = ''): DispatchScheduledJobForAssign =>
  ({ jobId, hcp_number: hcp, job_name: name, job_address: '', service_type_id: null, click_number: null, windowSpans: [], windowsLabel: '', scheduledMinutes, earliestStartMinutes }) as DispatchScheduledJobForAssign
const assigns = () => updates.map((u) => ({ set: u.steps.find((s) => s.method === 'update')?.args[0], id: u.steps.find((s) => s.method === 'eq')?.args[1] }))
const opts = { editingSelf: true, nowTick: Date.parse(T(20)) }

beforeEach(() => {
  updates.length = 0
  updateFails = false
  persist.mockClear()
  persist.mockImplementation(async (_c, _s, payloads: unknown[]) => payloads.map((_p, i) => `seg-${i}`))
})

describe('gates (warnings, nothing written)', () => {
  it('a draft row, an open session, or a day with nothing viable to split against', async () => {
    expect(await applyScheduleProportionsToClockSession(row({ id: `${DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX}x` }), [pick('j1', 60, 480)], opts)).toEqual({ ok: false, kind: 'warning', message: 'Save this session first, then apply the schedule split.' })
    expect(await applyScheduleProportionsToClockSession(row({ clocked_out_at: null }), [pick('j1', 60, 480)], opts)).toEqual({ ok: false, kind: 'warning', message: 'Apply Schedule % needs a clocked-out session.' })
    expect(await applyScheduleProportionsToClockSession(row(), [], opts)).toEqual({ ok: false, kind: 'warning', message: 'Could not apply schedule split for this session.' })
    expect(await applyScheduleProportionsToClockSession(row(), [pick('j1', 0, 480)], opts)).toEqual({ ok: false, kind: 'warning', message: 'Could not apply schedule split for this session.' })
    expect(updates).toHaveLength(0)
    expect(persist).not.toHaveBeenCalled()
  })
})

describe('one scheduled job', () => {
  it('assigns the whole session to it without splitting; a failed write is an error', async () => {
    expect(await applyScheduleProportionsToClockSession(row(), [pick('j1', 90, 480)], opts)).toEqual({ ok: true, segmentCount: 1 })
    expect(assigns()).toEqual([{ set: { job_ledger_id: 'j1', bid_id: null }, id: 's1' }])
    expect(persist).not.toHaveBeenCalled()
    updateFails = true
    expect(await applyScheduleProportionsToClockSession(row(), [pick('j1', 90, 480)], opts)).toEqual({ ok: false, kind: 'error', message: 'read only' })
  })
})

describe('several scheduled jobs', () => {
  const picks = [pick('j2', 120, 600, '1843', 'Elm'), pick('j1', 60, 480, '1842', 'Riverside')] // schedule order: j1 then j2; time 1 : 2

  it('splits the session in schedule order by scheduled share, hands the segments to the own-session RPC set, then assigns each new segment its job', async () => {
    expect(await applyScheduleProportionsToClockSession(row(), picks, opts)).toEqual({ ok: true, segmentCount: 2 })
    expect(persist).toHaveBeenCalledTimes(1)
    const [cluster, split, payloads, now, rpcs] = persist.mock.calls[0]! as [Array<{ id: string; clocked_in_at: string; clocked_out_at: string | null }>, { boundaries: number[]; notes: string[] }, Array<{ clocked_in_at: string; clocked_out_at: string | null; notes: string }>, number, Record<string, unknown>]
    expect(cluster.map((c) => [c.id, c.clocked_in_at, c.clocked_out_at])).toEqual([['s1', T(8), T(10)]])
    expect(payloads).toEqual([
      { clocked_in_at: T(8), clocked_out_at: T(8, 40), notes: '1842 · Riverside' },
      { clocked_in_at: T(8, 40), clocked_out_at: T(10), notes: '1843 · Elm' },
    ])
    expect(split).toEqual({ boundaries: [Date.parse(T(8)), Date.parse(T(8, 40)), Date.parse(T(10))], notes: ['1842 · Riverside', '1843 · Elm'] })
    expect(now).toBe(opts.nowTick)
    expect(rpcs).toEqual({ runSplitSeg: own.splitOwnClockSessionSegments, runSplitCluster: own.splitOwnClockSessionCluster, runReplaceMixed: own.replaceOwnClockSessionClusterMixed })
    expect(assigns()).toEqual([
      { set: { job_ledger_id: 'j1', bid_id: null }, id: 'seg-0' },
      { set: { job_ledger_id: 'j2', bid_id: null }, id: 'seg-1' },
    ])
  })

  it('editing someone else uses the leader RPC set; a session note carries onto every segment instead of the job labels', async () => {
    await applyScheduleProportionsToClockSession(row({ notes: '  Rough-in day ' }), picks, { ...opts, editingSelf: false })
    const [, split, payloads, , rpcs] = persist.mock.calls[0]! as [unknown, { notes: string[] }, Array<{ notes: string }>, number, Record<string, unknown>]
    expect(payloads.map((p) => p.notes)).toEqual(['Rough-in day', 'Rough-in day'])
    expect(split.notes).toEqual(['Rough-in day', 'Rough-in day'])
    expect(rpcs).toEqual({ runSplitSeg: leader.leaderSplitClockSessionSegments, runSplitCluster: leader.leaderSplitClockSessionCluster, runReplaceMixed: leader.leaderReplaceClockSessionClusterMixed })
  })

  it('a pick with no number or name is noted as "Scheduled work"', async () => {
    await applyScheduleProportionsToClockSession(row(), [pick('j1', 60, 480), pick('j2', 60, 540, ' ', ' ')], opts)
    const payloads = persist.mock.calls[0]![2] as Array<{ notes: string }>
    expect(payloads.map((p) => p.notes)).toEqual(['Scheduled work', 'Scheduled work'])
  })

  it('a persist that returns too few ids, a persist that throws, and a failed segment assign each come back as errors with their message', async () => {
    persist.mockResolvedValueOnce(['seg-0'])
    expect(await applyScheduleProportionsToClockSession(row(), picks, opts)).toEqual({ ok: false, kind: 'error', message: 'Split did not return an id for a schedule segment.' })
    expect(assigns()).toEqual([{ set: { job_ledger_id: 'j1', bid_id: null }, id: 'seg-0' }]) // the first segment was assigned before the gap was found

    updates.length = 0
    persist.mockRejectedValueOnce(new DatabaseError('cluster RPC refused'))
    expect(await applyScheduleProportionsToClockSession(row(), picks, opts)).toEqual({ ok: false, kind: 'error', message: 'cluster RPC refused' })
    persist.mockRejectedValueOnce('weird')
    expect(await applyScheduleProportionsToClockSession(row(), picks, opts)).toEqual({ ok: false, kind: 'error', message: 'Could not apply schedule split' })
    expect(updates).toHaveLength(0)

    updateFails = true
    expect(await applyScheduleProportionsToClockSession(row(), picks, opts)).toEqual({ ok: false, kind: 'error', message: 'read only' })
  })
})

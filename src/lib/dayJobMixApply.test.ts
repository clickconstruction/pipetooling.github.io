import { describe, expect, it } from 'vitest'
import { buildDayJobMixReplacePlan } from './dayJobMixApply'
import type { DayEditorSession } from './myTimeDayTimeline'
import type { DayJobMixRow } from './dayJobMixPercentages'

/**
 * Copy Day Job Mix: turns a source person's job percentages into a replace
 * plan over the target person's clock blocks — one call per time-contiguous
 * cluster, each cluster cut into segments by the mix. Pure kernel.
 */
const T = (h: number, m = 0, s = 0) => `2026-09-07T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.000Z`
const now = Date.parse(T(20))
const session = (id: string, inIso: string, outIso: string | null, notes = ''): DayEditorSession => ({
  id,
  clocked_in_at: inIso,
  clocked_out_at: outIso,
  work_date: '2026-09-07',
  notes,
  job_ledger_id: 'old-job',
  bid_id: null,
  approved_at: null,
  origin: 'user_punch',
  salary_segment_index: null,
})
const mix = (rows: Array<[string | null, string | null, number]>): DayJobMixRow[] => rows.map(([job_ledger_id, bid_id, pct], i) => ({ key: `k${i}`, job_ledger_id, bid_id, label: `L${i}`, seconds: 0, pct }))
const plan = (targetSessions: DayEditorSession[], sourceMix: DayJobMixRow[]) => buildDayJobMixReplacePlan({ targetSessions, nowMs: now, sourceMix, sourcePersonLabel: 'Ana' })
const seg = (p: { clocked_in_at: string; clocked_out_at: string | null; job_ledger_id?: string | null; bid_id?: string | null; notes: string }) => [p.clocked_in_at, p.clocked_out_at, p.job_ledger_id ?? null, p.bid_id ?? null, p.notes]

describe('buildDayJobMixReplacePlan', () => {
  it('refuses an empty or invalid source mix and a target with no sessions', () => {
    expect(plan([session('a', T(8), T(10))], [])).toEqual({ ok: false, error: 'Source has no eligible time on jobs for this day.' })
    expect(plan([session('a', T(8), T(10))], mix([['j1', null, 0], ['j2', null, 0]]))).toEqual({ ok: false, error: 'Source mix percentages are invalid.' })
    expect(plan([], mix([['j1', null, 1]]))).toEqual({ ok: false, error: 'Target has no sessions for this day.' })
  })

  it('cuts one two-hour block 75 / 25 between two jobs, the last segment ending exactly at the block end', () => {
    const r = plan([session('a', T(8), T(10))], mix([['j1', null, 3], ['j2', null, 1]])) // percentages normalise: 3:1
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.clusterCount).toBe(1)
    expect(r.plan.clusters[0]!.sessionIds).toEqual(['a'])
    expect(r.plan.clusters[0]!.payloads.map(seg)).toEqual([
      [T(8), T(9, 30), 'j1', null, 'Job mix (Ana)'],
      [T(9, 30), T(10), 'j2', null, 'Job mix (Ana)'],
    ])
  })

  it('contiguous sessions form one cluster whose segments inherit the longest overlapping note, else the source label', () => {
    const r = plan([session('b', T(9), T(10)), session('a', T(8), T(9), 'morning rough-in')], mix([['j1', null, 0.75], [null, 'bid-1', 0.25]])) // given out of order
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.clusters[0]!.sessionIds).toEqual(['a', 'b'])
    expect(r.plan.clusters[0]!.payloads.map(seg)).toEqual([
      [T(8), T(9, 30), 'j1', null, 'morning rough-in'], // overlaps both; the longer note wins
      [T(9, 30), T(10), null, 'bid-1', 'Job mix (Ana)'], // overlaps only the unnoted session
    ])
  })

  it('a gap makes a second cluster, each cut by the same mix; an open last session ends its cluster at now with an open last segment', () => {
    const r = plan([session('a', T(8), T(9)), session('b', T(12), null)], mix([['j1', null, 0.5], ['j2', null, 0.5]]))
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.clusterCount).toBe(2)
    expect(r.plan.clusters[0]!.payloads.map(seg)).toEqual([
      [T(8), T(8, 30), 'j1', null, 'Job mix (Ana)'],
      [T(8, 30), T(9), 'j2', null, 'Job mix (Ana)'],
    ])
    expect(r.plan.clusters[1]!.sessionIds).toEqual(['b'])
    expect(r.plan.clusters[1]!.payloads.map(seg)).toEqual([
      [T(12), T(16), 'j1', null, 'Job mix (Ana)'], // 12:00 → now (20:00) is 8 h; half is 16:00
      [T(16), null, 'j2', null, 'Job mix (Ana)'],
    ])
  })

  it('zero-percent rows produce no segment, and the last non-zero row takes the remainder to the block end', () => {
    const r = plan([session('a', T(8), T(10))], mix([['j1', null, 0.5], ['j2', null, 0], ['j3', null, 0.5]]))
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.clusters[0]!.payloads.map(seg)).toEqual([
      [T(8), T(9), 'j1', null, 'Job mix (Ana)'],
      [T(9), T(10), 'j3', null, 'Job mix (Ana)'],
    ])
  })

  it('refuses a block shorter than 0.01 h, and a mix that would leave a segment under 0.01 h', () => {
    expect(plan([session('a', T(8), T(8, 0, 20))], mix([['j1', null, 1]]))).toEqual({ ok: false, error: 'A clock block for the target is shorter than 0.01 hours (20s). Edit in My Time first.' })
    expect(plan([session('a', T(8), T(8, 1, 40))], mix([['j1', null, 0.9], ['j2', null, 0.1]]))).toEqual({
      ok: false,
      error: 'Applying this mix would create a segment under 0.01 hours on target. Adjust the source day or edit the target in My Time.',
    }) // 100 s × 10 % = 10 s
    // A single-row mix on a short-but-valid block is fine: one segment, no minimum between parts.
    expect(plan([session('a', T(8), T(8, 1, 40))], mix([['j1', null, 1]])).ok).toBe(true)
  })

  it('caps an inherited note at 4,000 characters', () => {
    const r = plan([session('a', T(8), T(10), 'x'.repeat(5000))], mix([['j1', null, 1]]))
    if (!r.ok) throw new Error(r.error)
    expect(r.plan.clusters[0]!.payloads[0]!.notes).toHaveLength(4000)
  })
})

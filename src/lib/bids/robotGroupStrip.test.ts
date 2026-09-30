import { describe, expect, it } from 'vitest'

import { buildRobotStripTiles, oldestPendingAuditDays, type RobotStripCounts } from './robotGroupStrip'

const counts = (over: Partial<RobotStripCounts> = {}): RobotStripCounts => ({
  rowCount: 39,
  liveEligible: 8,
  uncoveredLive: 1,
  sealedCount: 6,
  needsCount: 6,
  auditPending: 31,
  oldestAuditDays: 29,
  gate: { met: 0, total: 10 },
  moved: { count: 0, total: 0 },
  ...over,
})

describe("buildRobotStripTiles (v2.4256) — the group's six numbers, each a door", () => {
  it("draws the six in the mock-up's words, with the audits and needs tiles warning", () => {
    const tiles = buildRobotStripTiles(counts())
    expect(tiles.map((t) => [t.n, t.label])).toEqual([
      ['39', 'of our bids have a robot run'],
      ['7 / 8', 'live plumbing bids shadowed'],
      ['6', 'sealed, waiting on your number'],
      ['6', 'need something from a person'],
      ['31', 'audits waiting · oldest 29 d'],
      ['0 / 10', 'kinds of job earned first drafts'],
    ])
    expect(tiles.filter((t) => t.warn).map((t) => t.key)).toEqual(['shadowed', 'needs', 'audits'])
  })

  it('every tile opens the lens that works it', () => {
    const doors = Object.fromEntries(buildRobotStripTiles(counts()).map((t) => [t.key, t.door]))
    expect(doors).toEqual({ runs: 'robot-board', shadowed: 'robot-board', sealed: 'robot-board', needs: 'robot-board', audits: 'audits', gate: 'robot-scoreboard' })
  })

  it('the audits tile drops the age with nothing pending, and stops warning', () => {
    const t = buildRobotStripTiles(counts({ auditPending: 0, oldestAuditDays: null })).find((x) => x.key === 'audits')!
    expect(t.label).toBe('audits waiting')
    expect(t.warn).toBe(false)
  })

  it('the moved tile appears only when a sent bid moved off its best effort', () => {
    expect(buildRobotStripTiles(counts()).some((t) => t.key === 'moved')).toBe(false)
    const t = buildRobotStripTiles(counts({ moved: { count: 2, total: 8400 } })).find((x) => x.key === 'moved')!
    expect(t.n).toBe('2 · $8,400')
    expect(t.label).toBe("bids moved after the robot's envelope")
    expect(buildRobotStripTiles(counts({ moved: { count: 1, total: 100 } })).find((x) => x.key === 'moved')!.label).toBe("bid moved after the robot's envelope")
  })
})

describe('oldestPendingAuditDays', () => {
  const now = Date.parse('2026-09-30T12:00:00Z')
  it('counts whole days back to the oldest pending request', () => {
    expect(oldestPendingAuditDays([{ status: 'pending', requested_at: '2026-09-01T10:00:00Z' }, { status: 'pending', requested_at: '2026-09-28T10:00:00Z' }, { status: 'done', requested_at: '2026-08-01T10:00:00Z' }], now)).toBe(29)
  })
  it('is null with nothing pending', () => {
    expect(oldestPendingAuditDays([{ status: 'digested', requested_at: '2026-08-01T10:00:00Z' }], now)).toBeNull()
    expect(oldestPendingAuditDays([], now)).toBeNull()
  })
})

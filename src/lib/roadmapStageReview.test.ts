import { describe, expect, it } from 'vitest'
import type { GoalsStageRow } from './roadmapBridge'
import { recentStageUnlockEvents, stageUnlockPreviewFor } from './roadmapStageReview'

const row = (partial: Partial<GoalsStageRow> & Pick<GoalsStageRow, 'groupId' | 'title' | 'state'>): GoalsStageRow => ({
  done: 0,
  total: 0,
  openAssigned: 0,
  blockedBy: [],
  ...partial,
})

describe('recentStageUnlockEvents', () => {
  const nowMs = Date.parse('2026-08-24T12:00:00Z')
  const stageRows = [
    row({ groupId: 'trail', title: 'Cut trail', state: 'complete', done: 3, total: 3 }),
    row({ groupId: 'trees', title: 'Dead trees', state: 'current', total: 6 }),
    row({ groupId: 'land', title: 'Full Use of Land', state: 'locked', total: 2, blockedBy: ['Dead trees'] }),
  ]
  const edges = [
    { fromGroupId: 'trail', toGroupId: 'trees' },
    { fromGroupId: 'trail', toGroupId: 'land' },
  ]
  const tasks = [
    { group_id: 'trail', completed_at: '2026-08-20T00:00:00Z' },
    { group_id: 'trail', completed_at: '2026-08-22T00:00:00Z' }, // latest wins
    { group_id: 'trail', completed_at: null },
    { group_id: 'trees', completed_at: '2026-08-23T00:00:00Z' }, // stage not complete — no event
  ]

  it('emits one event per completed stage: latest task stamp, unlocked vs advanced successors', () => {
    const events = recentStageUnlockEvents({ stageRows, tasks, edges, nowMs })
    expect(events).toHaveLength(1)
    const ev = events[0]!
    expect(ev.stage).toEqual({ groupId: 'trail', number: 1, title: 'Cut trail' })
    expect(ev.completedAtMs).toBe(Date.parse('2026-08-22T00:00:00Z'))
    expect(ev.unlocked).toEqual([{ groupId: 'trees', number: 2, title: 'Dead trees' }])
    expect(ev.advanced).toEqual([{ groupId: 'land', number: 3, title: 'Full Use of Land' }])
  })

  it('drops events outside the window', () => {
    expect(recentStageUnlockEvents({ stageRows, tasks, edges, nowMs, windowDays: 1 })).toHaveLength(0)
  })

  it('skips task-less milestone stages even when complete', () => {
    const rows = [row({ groupId: 'm', title: 'Milestone', state: 'complete', total: 0 })]
    expect(recentStageUnlockEvents({ stageRows: rows, tasks: [], edges: [], nowMs })).toHaveLength(0)
  })

  it('sorts newest first', () => {
    const rows = [
      row({ groupId: 'a', title: 'A', state: 'complete', done: 1, total: 1 }),
      row({ groupId: 'b', title: 'B', state: 'complete', done: 1, total: 1 }),
    ]
    const ts = [
      { group_id: 'a', completed_at: '2026-08-20T00:00:00Z' },
      { group_id: 'b', completed_at: '2026-08-23T00:00:00Z' },
    ]
    const events = recentStageUnlockEvents({ stageRows: rows, tasks: ts, edges: [], nowMs })
    expect(events.map((e) => e.stage.groupId)).toEqual(['b', 'a'])
  })
})

describe('stageUnlockPreviewFor', () => {
  const stageRows = [
    row({ groupId: 'tools', title: 'Tools', state: 'current', total: 10 }),
    row({ groupId: 'foundry', title: 'Foundry', state: 'locked', total: 4, blockedBy: ['Tools'] }),
    row({ groupId: 'kitchen', title: 'Kitchen', state: 'locked', total: 2, blockedBy: ['Tools', 'Well'] }),
    row({ groupId: 'done-already', title: 'Open stage', state: 'current', total: 1, blockedBy: [] }),
  ]

  it('splits sole-blocker unlocks from shared-blocker helps, with stage numbers', () => {
    const preview = stageUnlockPreviewFor({ groupId: 'tools', title: 'Tools' }, stageRows)
    expect(preview.unlocks).toEqual([{ groupId: 'foundry', number: 2, title: 'Foundry' }])
    expect(preview.helps).toEqual([{ groupId: 'kitchen', number: 3, title: 'Kitchen' }])
  })

  it('a stage blocking nothing previews empty', () => {
    const preview = stageUnlockPreviewFor({ groupId: 'done-already', title: 'Open stage' }, stageRows)
    expect(preview.unlocks).toEqual([])
    expect(preview.helps).toEqual([])
  })
})

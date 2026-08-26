import { describe, expect, it } from 'vitest'
import { approxDateLabel, paceProjection, taskSlotRects, taskSlotRectsWeighted, timelineRows, timelineWaves } from './roadmapTimeline'

const t = (done: boolean) => ({ completed_at: done ? '2026-08-20T00:00:00Z' : null })

// a(2 tasks) -> c(milestone) ; b(1 task) -> c ; c -> d(2 tasks)
const groups = [
  { id: 'a', title: 'Cut trail' },
  { id: 'b', title: 'Pull trees' },
  { id: 'c', title: 'Full Use of Land' },
  { id: 'd', title: 'Build products' },
]
const edges = [
  { fromGroupId: 'a', toGroupId: 'c' },
  { fromGroupId: 'b', toGroupId: 'c' },
  { fromGroupId: 'c', toGroupId: 'd' },
]
const tasksByGroup = new Map([
  ['a', [t(true), t(false)]],
  ['b', [t(false)]],
  ['d', [t(false), t(false)]],
])

describe('timelineWaves', () => {
  it('assigns topological depth', () => {
    const w = timelineWaves(['a', 'b', 'c', 'd'], edges)
    expect(w.get('a')).toBe(0)
    expect(w.get('b')).toBe(0)
    expect(w.get('c')).toBe(1)
    expect(w.get('d')).toBe(2)
  })
  it('ignores edges to unknown groups', () => {
    const w = timelineWaves(['a'], edges)
    expect(w.get('a')).toBe(0)
  })
})

describe('timelineRows — unplanned roots', () => {
  it('a task-less stage with no prerequisites is flagged unplanned; a milestone with predecessors is not', () => {
    const rows = timelineRows({
      groups: [...groups, { id: 'e', title: 'Solar on every roof' }],
      tasksByGroup,
      edges,
      unlockedIds: new Set(['a', 'b', 'e']),
      completeIds: new Set(),
    })
    const byId = new Map(rows.map((r) => [r.groupId, r]))
    expect(byId.get('e')).toMatchObject({ isMilestone: true, unplanned: true, locked: false, done: false })
    expect(byId.get('c')).toMatchObject({ isMilestone: true, unplanned: false })
  })
})

describe('timelineRows', () => {
  const rows = timelineRows({ groups, tasksByGroup, edges, unlockedIds: new Set(['a', 'b']), completeIds: new Set() })
  it('staircase order: wave, then stage order', () => {
    expect(rows.map((r) => r.groupId)).toEqual(['a', 'b', 'c', 'd'])
    expect(rows.map((r) => r.wave)).toEqual([0, 0, 1, 2])
  })
  it('carries stage numbers from the roadmap order', () => {
    expect(rows.find((r) => r.groupId === 'c')?.stageNumber).toBe(3)
  })
  it('marks milestones, progress, and locks', () => {
    const a = rows.find((r) => r.groupId === 'a')!
    expect(a).toMatchObject({ totalTasks: 2, doneTasks: 1, remainingTasks: 1, isMilestone: false, locked: false })
    const c = rows.find((r) => r.groupId === 'c')!
    expect(c.isMilestone).toBe(true)
    expect(c.locked).toBe(true)
  })
})

describe('paceProjection', () => {
  const rows = timelineRows({ groups, tasksByGroup, edges, unlockedIds: new Set(['a', 'b']), completeIds: new Set() })
  it('serial waves: remaining ÷ pace weeks each', () => {
    const now = new Date('2026-08-21T00:00:00Z')
    const p = paceProjection(rows, 1, now) // 1 task/week
    // wave0 remaining 2 -> 2 weeks; wave1 remaining 0 -> +0; wave2 remaining 2 -> +2
    expect(p.map((w) => w.weeks)).toEqual([2, 0, 2])
    expect(p[0]!.finish.getTime()).toBe(now.getTime() + 2 * 7 * 86400000)
    expect(p[2]!.finish.getTime()).toBe(now.getTime() + 4 * 7 * 86400000)
  })
  it('clamps absurd pace to avoid division blowups', () => {
    const p = paceProjection(rows, 0, new Date('2026-08-21T00:00:00Z'))
    expect(Number.isFinite(p[0]!.weeks)).toBe(true)
  })
})

describe('approxDateLabel', () => {
  const now = new Date('2026-08-21T00:00:00Z')
  it('same year: month only; later: month + year', () => {
    expect(approxDateLabel(new Date('2026-11-10T00:00:00Z'), now)).toBe('≈ Nov')
    expect(approxDateLabel(new Date('2027-02-10T00:00:00Z'), now)).toBe("≈ Feb '27")
  })
})

describe('taskSlotRects', () => {
  it('divides the bar into equal successive slots with gaps', () => {
    const rects = taskSlotRects(0.1, 0.5, 4, 0.004)
    expect(rects).toHaveLength(4)
    expect(rects[0]!.left).toBeCloseTo(0.1, 6)
    // slots + gaps span the bar width
    const last = rects[3]!
    expect(last.left + last.width).toBeCloseTo(0.6, 6)
    // successive: each starts where the previous ends + gap
    expect(rects[1]!.left).toBeCloseTo(rects[0]!.left + rects[0]!.width + 0.004, 6)
  })

  it('floors slot width so a crowded stage stays visible', () => {
    const rects = taskSlotRects(0, 0.05, 20)
    expect(rects.every((r) => r.width >= 0.008)).toBe(true)
  })

  it('zero tasks → no slots', () => {
    expect(taskSlotRects(0, 0.5, 0)).toEqual([])
  })
})

describe('effort weighting (v2.2358)', () => {
  it('timelineRows sums days with the average filling unestimated tasks', () => {
    const rows = timelineRows({
      groups: [{ id: 'a', title: 'A' }],
      tasksByGroup: new Map([
        ['a', [
          { completed_at: '2026-08-20T00:00:00Z', estimated_days: 4 },
          { completed_at: null, estimated_days: 2 },
          { completed_at: null }, // avg fills
        ]],
      ]),
      edges: [],
      unlockedIds: new Set(['a']),
      completeIds: new Set(),
      avgDays: 3,
    })
    expect(rows[0]!.totalDays).toBe(9)
    expect(rows[0]!.doneDays).toBe(4)
    expect(rows[0]!.remainingDays).toBe(5)
  })

  it('paceProjection divides remaining days by days/week', () => {
    const rows = timelineRows({
      groups: [{ id: 'a', title: 'A' }],
      tasksByGroup: new Map([['a', [{ completed_at: null, estimated_days: 10 }]]]),
      edges: [],
      unlockedIds: new Set(['a']),
      completeIds: new Set(),
    })
    const now = new Date('2026-08-26T00:00:00')
    const proj = paceProjection(rows, 5, now)
    expect(proj[0]!.remainingDays).toBe(10)
    expect(proj[0]!.weeks).toBe(2)
  })

  it('taskSlotRectsWeighted: widths proportional; equal weights match taskSlotRects', () => {
    const w = taskSlotRectsWeighted(0, 1, [5, 1, 4], 0)
    expect(w[0]!.width).toBeCloseTo(0.5, 5)
    expect(w[1]!.width).toBeCloseTo(0.1, 5)
    expect(w[2]!.width).toBeCloseTo(0.4, 5)
    expect(w[1]!.left).toBeCloseTo(0.5, 5)
    const eq = taskSlotRectsWeighted(0.1, 0.8, [2, 2], 0.004)
    const classic = taskSlotRects(0.1, 0.8, 2, 0.004)
    expect(eq[0]!.width).toBeCloseTo(classic[0]!.width, 5)
    expect(eq[1]!.left).toBeCloseTo(classic[1]!.left, 5)
  })
})

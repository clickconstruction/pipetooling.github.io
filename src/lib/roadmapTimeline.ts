/**
 * Roadmap Timeline kernels (v2.1979): the Gantt-style third view. The x-axis
 * is dependency SEQUENCE, not calendar — waves are the topological depth of
 * the prerequisite graph, so the chart is recomputed from truth on every
 * load and can never rot. The pace slider projects approximate dates from
 * live remaining-task counts (remaining ÷ tasks-per-week, wave by wave).
 */

import type { TechTreeEdge } from './checklistTechTreeGraph'
import { taskWeightDays, type EffortTask } from './roadmapEffort'

/** Topological depth per group: no prereqs → wave 0, else 1 + max(prereq wave). */
export function timelineWaves(
  groupIds: ReadonlyArray<string>,
  edges: ReadonlyArray<TechTreeEdge>,
): Map<string, number> {
  const idSet = new Set(groupIds)
  const incoming = new Map<string, string[]>()
  for (const e of edges) {
    if (!idSet.has(e.fromGroupId) || !idSet.has(e.toGroupId)) continue
    incoming.set(e.toGroupId, [...(incoming.get(e.toGroupId) ?? []), e.fromGroupId])
  }
  const wave = new Map<string, number>()
  const visiting = new Set<string>()
  const depth = (id: string): number => {
    const known = wave.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) return 0 // cycle guard (edges are cycle-checked upstream)
    visiting.add(id)
    const preds = incoming.get(id) ?? []
    const w = preds.length === 0 ? 0 : 1 + Math.max(...preds.map(depth))
    visiting.delete(id)
    wave.set(id, w)
    return w
  }
  for (const id of groupIds) depth(id)
  return wave
}

export type TimelineRow = {
  groupId: string
  title: string
  stageNumber: number
  wave: number
  totalTasks: number
  doneTasks: number
  remainingTasks: number
  /** Effort sums in days (v2.2358): estimated_days per task, roadmap average for unestimated. */
  totalDays: number
  doneDays: number
  remainingDays: number
  /** Task-less stage — renders as a ◆ milestone at its wave boundary. */
  isMilestone: boolean
  /** Task-less AND no prerequisites — "not planned yet" (v2.2127): a hollow ◇, never reached. */
  unplanned: boolean
  locked: boolean
  done: boolean
}

/**
 * Chart rows in staircase order: wave first, then the roadmap's stage order
 * (groups must arrive in stage order — the loader's sort_index order).
 */
export function timelineRows(args: {
  groups: ReadonlyArray<{ id: string; title: string }>
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<EffortTask>>
  edges: ReadonlyArray<TechTreeEdge>
  unlockedIds: ReadonlySet<string>
  completeIds: ReadonlySet<string>
  /** Roadmap-average estimate for unestimated tasks (v2.2358); 1 preserves the old task-count math. */
  avgDays?: number
}): TimelineRow[] {
  const { groups, tasksByGroup, edges, unlockedIds, completeIds, avgDays = 1 } = args
  const waves = timelineWaves(
    groups.map((g) => g.id),
    edges,
  )
  const idSet = new Set(groups.map((g) => g.id))
  const hasIncoming = new Set(edges.filter((e) => idSet.has(e.fromGroupId) && idSet.has(e.toGroupId)).map((e) => e.toGroupId))
  const rows: TimelineRow[] = groups.map((g, i) => {
    const tasks = tasksByGroup.get(g.id) ?? []
    const done = tasks.filter((t) => t.completed_at != null).length
    const totalDays = tasks.reduce((a, t) => a + taskWeightDays(t, avgDays), 0)
    const doneDays = tasks.reduce((a, t) => a + (t.completed_at != null ? taskWeightDays(t, avgDays) : 0), 0)
    return {
      groupId: g.id,
      title: g.title,
      stageNumber: i + 1,
      wave: waves.get(g.id) ?? 0,
      totalTasks: tasks.length,
      doneTasks: done,
      remainingTasks: tasks.length - done,
      totalDays,
      doneDays,
      remainingDays: totalDays - doneDays,
      isMilestone: tasks.length === 0,
      unplanned: tasks.length === 0 && !hasIncoming.has(g.id),
      locked: !unlockedIds.has(g.id),
      done: completeIds.has(g.id),
    }
  })
  rows.sort((a, b) => a.wave - b.wave || a.stageNumber - b.stageNumber)
  return rows
}

export type TimelineWaveSummary = {
  wave: number
  totalTasks: number
  remainingTasks: number
  /** Effort remaining in days (v2.2358) — what the projection now divides. */
  remainingDays: number
  /** Weeks this wave needs at the given pace (0 when nothing remains). */
  weeks: number
  /** Projected completion of this wave (waves run serially). */
  finish: Date
}

/**
 * Serial-by-wave projection: each wave finishes (its remaining DAYS of work
 * ÷ daysPerWeek) weeks after the previous one (v2.2358 — was task counts ÷
 * tasks/week; identical when nothing is estimated, since every weight is
 * then 1). Honest and explainable — clearly a what-if, not a promise.
 */
export function paceProjection(rows: ReadonlyArray<TimelineRow>, daysPerWeek: number, now: Date): TimelineWaveSummary[] {
  const byWave = new Map<number, { total: number; remaining: number; remainingDays: number }>()
  for (const r of rows) {
    const w = byWave.get(r.wave) ?? { total: 0, remaining: 0, remainingDays: 0 }
    w.total += r.totalTasks
    w.remaining += r.remainingTasks
    w.remainingDays += r.remainingDays
    byWave.set(r.wave, w)
  }
  const waves = [...byWave.keys()].sort((a, b) => a - b)
  const pace = Math.max(daysPerWeek, 0.1) // guard divide-by-zero; observed paces can honestly be < 1/week
  let cursor = now.getTime()
  const out: TimelineWaveSummary[] = []
  for (const w of waves) {
    const info = byWave.get(w)!
    const weeks = info.remainingDays / pace
    cursor += weeks * 7 * 24 * 60 * 60 * 1000
    out.push({ wave: w, totalTasks: info.total, remainingTasks: info.remaining, remainingDays: info.remainingDays, weeks, finish: new Date(cursor) })
  }
  return out
}

export type TaskSlotRect = { left: number; width: number }

/**
 * Successive equal slots of a stage's bar for its tasks (v2.2042): task k
 * occupies slot k of the bar span, in task order — the per-task bars the
 * segmented stage bar and the expansion waterfall both render. All values
 * are lane fractions. Slots keep a minimum width so a many-task stage in a
 * narrow wave stays visible (the row may then overrun its bar slightly —
 * sequence, not calendar).
 */
export function taskSlotRects(
  barLeft: number,
  barWidth: number,
  count: number,
  gap = 0.004,
  minWidth = 0.008,
): TaskSlotRect[] {
  if (count <= 0) return []
  const width = Math.max((barWidth - gap * (count - 1)) / count, minWidth)
  const rects: TaskSlotRect[] = []
  for (let i = 0; i < count; i++) {
    rects.push({ left: barLeft + i * (width + gap), width })
  }
  return rects
}

/**
 * Weight-proportional slots (v2.2358): slot i's width is its share of the
 * total weight, floored at minWidth so a half-day task stays tappable (the
 * row may then slightly overrun its bar — sequence, not calendar, exactly
 * like the equal-slot floor before it). Equal weights reproduce
 * taskSlotRects bit-for-bit.
 */
export function taskSlotRectsWeighted(
  barLeft: number,
  barWidth: number,
  weights: ReadonlyArray<number>,
  gap = 0.004,
  minWidth = 0.008,
): TaskSlotRect[] {
  const count = weights.length
  if (count === 0) return []
  const usable = barWidth - gap * (count - 1)
  const total = weights.reduce((a, b) => a + Math.max(b, 0), 0) || 1
  const rects: TaskSlotRect[] = []
  let x = barLeft
  for (let i = 0; i < count; i++) {
    const width = Math.max((usable * Math.max(weights[i] ?? 0, 0)) / total, minWidth)
    rects.push({ left: x, width })
    x += width + gap
  }
  return rects
}

/** "≈ Nov" this year, "≈ Feb '27" beyond it. */
export function approxDateLabel(d: Date, now: Date): string {
  const month = d.toLocaleString('en-US', { month: 'short' })
  return d.getFullYear() === now.getFullYear() ? `≈ ${month}` : `≈ ${month} '${String(d.getFullYear()).slice(2)}`
}

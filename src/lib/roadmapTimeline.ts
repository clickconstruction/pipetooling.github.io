/**
 * Roadmap Timeline kernels (v2.1979): the Gantt-style third view. The x-axis
 * is dependency SEQUENCE, not calendar — waves are the topological depth of
 * the prerequisite graph, so the chart is recomputed from truth on every
 * load and can never rot. The pace slider projects approximate dates from
 * live remaining-task counts (remaining ÷ tasks-per-week, wave by wave).
 */

import type { TechTreeEdge } from './checklistTechTreeGraph'

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
  tasksByGroup: ReadonlyMap<string, ReadonlyArray<{ completed_at: string | null }>>
  edges: ReadonlyArray<TechTreeEdge>
  unlockedIds: ReadonlySet<string>
  completeIds: ReadonlySet<string>
}): TimelineRow[] {
  const { groups, tasksByGroup, edges, unlockedIds, completeIds } = args
  const waves = timelineWaves(
    groups.map((g) => g.id),
    edges,
  )
  const idSet = new Set(groups.map((g) => g.id))
  const hasIncoming = new Set(edges.filter((e) => idSet.has(e.fromGroupId) && idSet.has(e.toGroupId)).map((e) => e.toGroupId))
  const rows: TimelineRow[] = groups.map((g, i) => {
    const tasks = tasksByGroup.get(g.id) ?? []
    const done = tasks.filter((t) => t.completed_at != null).length
    return {
      groupId: g.id,
      title: g.title,
      stageNumber: i + 1,
      wave: waves.get(g.id) ?? 0,
      totalTasks: tasks.length,
      doneTasks: done,
      remainingTasks: tasks.length - done,
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
  /** Weeks this wave needs at the given pace (0 when nothing remains). */
  weeks: number
  /** Projected completion of this wave (waves run serially). */
  finish: Date
}

/**
 * Serial-by-wave projection: each wave finishes (its remaining tasks ÷
 * tasksPerWeek) weeks after the previous one. Honest and explainable —
 * clearly a what-if, not a promise.
 */
export function paceProjection(rows: ReadonlyArray<TimelineRow>, tasksPerWeek: number, now: Date): TimelineWaveSummary[] {
  const byWave = new Map<number, { total: number; remaining: number }>()
  for (const r of rows) {
    const w = byWave.get(r.wave) ?? { total: 0, remaining: 0 }
    w.total += r.totalTasks
    w.remaining += r.remainingTasks
    byWave.set(r.wave, w)
  }
  const waves = [...byWave.keys()].sort((a, b) => a - b)
  const pace = Math.max(tasksPerWeek, 0.1) // guard divide-by-zero; observed paces can honestly be < 1/week
  let cursor = now.getTime()
  const out: TimelineWaveSummary[] = []
  for (const w of waves) {
    const info = byWave.get(w)!
    const weeks = info.remaining / pace
    cursor += weeks * 7 * 24 * 60 * 60 * 1000
    out.push({ wave: w, totalTasks: info.total, remainingTasks: info.remaining, weeks, finish: new Date(cursor) })
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

/** "≈ Nov" this year, "≈ Feb '27" beyond it. */
export function approxDateLabel(d: Date, now: Date): string {
  const month = d.toLocaleString('en-US', { month: 'short' })
  return d.getFullYear() === now.getFullYear() ? `≈ ${month}` : `≈ ${month} '${String(d.getFullYear()).slice(2)}`
}

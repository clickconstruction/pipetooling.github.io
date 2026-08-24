/**
 * Stage review on the Checklist Review tab (Goals strip upgrade): pure
 * derivations for the two narratives the strip's stage rows can't tell yet —
 *
 *  1. recentStageUnlockEvents — "stage N finished → unlocked X / moved Y
 *     closer", synthesized entirely from task completion timestamps and the
 *     dependency edges (auto-unlock stays; Review narrates it after the fact).
 *  2. stageUnlockPreviewFor — the forward-looking twin for an open stage:
 *     which locked stages finishing it would unlock outright vs. help unlock.
 *
 * Both work on the same GoalsStageRow list the strip already renders, so
 * numbering matches the badges everywhere else (curated sort_index order).
 */

import type { GoalsStageRow } from './roadmapBridge'

export type StageRef = {
  groupId: string
  /** 1-based stage number in curated order — matches the strip badges. */
  number: number
  title: string
}

export type StageUnlockEvent = {
  stage: StageRef
  /** max completed_at across the stage's tasks. */
  completedAtMs: number
  /** Successors that are open ("current") now — this completion opened them. */
  unlocked: StageRef[]
  /** Successors still locked behind other stages — moved closer, not open. */
  advanced: StageRef[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Completed stages (with tasks) inside the window, newest first, each with
 * what it opened. Milestone stages (0 tasks) have no completion timestamp of
 * their own and are skipped — their feeders' events already tell the story.
 */
export function recentStageUnlockEvents(args: {
  /** The roadmap's stage rows in curated order (index+1 = stage number). */
  stageRows: readonly GoalsStageRow[]
  tasks: ReadonlyArray<{ group_id: string; completed_at: string | null }>
  edges: ReadonlyArray<{ fromGroupId: string; toGroupId: string }>
  nowMs: number
  windowDays?: number
}): StageUnlockEvent[] {
  const { stageRows, tasks, edges, nowMs, windowDays = 30 } = args
  const rowByGroupId = new Map(stageRows.map((s, i) => [s.groupId, { row: s, number: i + 1 }]))

  const latestDoneByGroup = new Map<string, number>()
  for (const t of tasks) {
    if (!t.completed_at || !rowByGroupId.has(t.group_id)) continue
    const ms = Date.parse(t.completed_at)
    if (!Number.isFinite(ms)) continue
    const prev = latestDoneByGroup.get(t.group_id)
    if (prev === undefined || ms > prev) latestDoneByGroup.set(t.group_id, ms)
  }

  const events: StageUnlockEvent[] = []
  stageRows.forEach((s, i) => {
    if (s.state !== 'complete' || s.total === 0) return
    const completedAtMs = latestDoneByGroup.get(s.groupId)
    if (completedAtMs === undefined || nowMs - completedAtMs > windowDays * DAY_MS) return
    const unlocked: StageRef[] = []
    const advanced: StageRef[] = []
    for (const e of edges) {
      if (e.fromGroupId !== s.groupId) continue
      const succ = rowByGroupId.get(e.toGroupId)
      if (!succ) continue
      const ref: StageRef = { groupId: succ.row.groupId, number: succ.number, title: succ.row.title }
      if (succ.row.state === 'current') unlocked.push(ref)
      else if (succ.row.state === 'locked') advanced.push(ref)
    }
    events.push({ stage: { groupId: s.groupId, number: i + 1, title: s.title }, completedAtMs, unlocked, advanced })
  })
  return events.sort((a, b) => b.completedAtMs - a.completedAtMs)
}

export type StageUnlockPreview = {
  /** Locked stages blocked ONLY by this one — finishing it opens them. */
  unlocks: StageRef[]
  /** Locked stages this one blocks alongside others. */
  helps: StageRef[]
}

/**
 * What finishing an open stage would open. Uses the rows' `blockedBy` titles
 * (incomplete predecessors), so it needs no edge list at render time.
 */
export function stageUnlockPreviewFor(
  stage: Pick<GoalsStageRow, 'groupId' | 'title'>,
  stageRows: readonly GoalsStageRow[],
): StageUnlockPreview {
  const unlocks: StageRef[] = []
  const helps: StageRef[] = []
  stageRows.forEach((s, i) => {
    if (s.state !== 'locked' || !s.blockedBy.includes(stage.title)) return
    const ref: StageRef = { groupId: s.groupId, number: i + 1, title: s.title }
    if (s.blockedBy.length === 1) unlocks.push(ref)
    else helps.push(ref)
  })
  return { unlocks, helps }
}

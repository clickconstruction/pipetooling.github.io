/**
 * Goals-strip stage ledger → task rows (v2.2167): when a stage row in the
 * Review tab's Goals ledger is tapped, it unfolds its tasks in place. This
 * kernel shapes those rows from the roadmap data the Goals loader already has
 * (plus title / order / pin / assignees / bridge state), reusing the same
 * numbering, Next-up picks and bridge chips as the Map and Plan so the three
 * never disagree. Pure; the Review tab renders the result.
 */

import { computeCompleteGroupIdsWithMilestones, computeUnlockedGroupIds, type TechTreeEdge } from './checklistTechTreeGraph'
import { bridgeChipFor, type BridgeChip, type BridgeState } from './roadmapBridge'
import { nextUpPicks } from './roadmapNextUp'
import { stageNumbersByGroupId, taskNumbersByTaskId } from './roadmapStageNumbers'

export type GoalsLedgerTaskInput = {
  id: string
  group_id: string
  title: string
  sort_index: number
  completed_at: string | null
  pinned_at?: string | null
  assigneeIds: string[]
}

export type GoalsLedgerTaskRow = {
  id: string
  /** "6.2" */
  number: string
  title: string
  done: boolean
  pinned: boolean
  /** On the Plan's ⚡ Next up shortlist. */
  nextUp: boolean
  /** Display names (or emails) of assignees; empty = unassigned. */
  assigneeNames: string[]
  /** User ids behind assigneeNames (same order) — stage reminders need ids. */
  assigneeIds: string[]
  chip: BridgeChip
}

/**
 * Per-stage task rows for ONE roadmap, keyed by group id. `groups` must be the
 * roadmap's stages; they are sorted by `sort_index` here so the numbers match
 * the badges everywhere else.
 */
export function goalsLedgerTaskRows(args: {
  groups: Array<{ id: string; title: string; sort_index: number }>
  tasks: GoalsLedgerTaskInput[]
  edges: TechTreeEdge[]
  nameById: ReadonlyMap<string, string>
  bridgeByTaskId?: ReadonlyMap<string, BridgeState>
}): Map<string, GoalsLedgerTaskRow[]> {
  const { groups, tasks, edges, nameById, bridgeByTaskId } = args
  const ordered = [...groups].sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id))
  const groupIds = new Set(ordered.map((g) => g.id))
  const rmEdges = edges.filter((e) => groupIds.has(e.fromGroupId) && groupIds.has(e.toGroupId))
  const tasksByGroup = new Map<string, GoalsLedgerTaskInput[]>()
  for (const t of tasks) {
    if (!groupIds.has(t.group_id)) continue
    tasksByGroup.set(t.group_id, [...(tasksByGroup.get(t.group_id) ?? []), t])
  }
  for (const [gid, list] of tasksByGroup) {
    tasksByGroup.set(gid, [...list].sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id)))
  }
  const completeIds = computeCompleteGroupIdsWithMilestones(groupIds, rmEdges, tasksByGroup)
  const unlockedIds = computeUnlockedGroupIds(groupIds, rmEdges, completeIds)
  const lanes = nextUpPicks({ groups: ordered, tasksByGroup, edges: rmEdges, unlockedIds, completeIds })
  const nextUpIds = new Set([...lanes.ready, ...lanes.needsName].map((p) => p.taskId))
  const stageNumbers = stageNumbersByGroupId(ordered)
  const taskNumbers = taskNumbersByTaskId(stageNumbers, tasksByGroup)

  const out = new Map<string, GoalsLedgerTaskRow[]>()
  for (const [gid, list] of tasksByGroup) {
    out.set(
      gid,
      list.map((t) => ({
        id: t.id,
        number: taskNumbers.get(t.id) ?? '',
        title: t.title,
        done: t.completed_at != null,
        pinned: Boolean(t.pinned_at),
        nextUp: nextUpIds.has(t.id),
        assigneeNames: t.assigneeIds.map((id) => nameById.get(id) ?? '…'),
        assigneeIds: [...t.assigneeIds],
        chip: bridgeChipFor(t.completed_at, bridgeByTaskId?.get(t.id)),
      })),
    )
  }
  return out
}

import { goalsStageRows, type GoalsStageRow } from './roadmapBridge'
import type { TechTreeEdge } from './checklistTechTreeGraph'

/**
 * View-model for the "Where this task fits" modal (v2.2087): tap a ⛰ chip on
 * a Review-tab row and see the whole roadmap bar, the task's stage up close,
 * and what finishing the stage unlocks. Pure — the modal fetches, this shapes.
 * Stage states/numbers reuse the Goals-strip kernels so the two can't disagree.
 */

export type RoadmapContextTask = {
  id: string
  group_id: string
  title: string
  sort_index: number
  completed_at: string | null
  assigneeCount: number
}

export type RoadmapTaskContextView = {
  stages: GoalsStageRow[]
  stagesDone: number
  /** 0-based index of the focus task's stage within `stages`. */
  focusStageIndex: number
  /** "5" and "5.2" — derived like every other roadmap number. */
  focusStageNumber: number
  focusTaskNumber: string
  focusStage: GoalsStageRow
  /** The focus stage's tasks in order; `isFocus` marks the clicked one. */
  stageTasks: Array<{ id: string; title: string; done: boolean; isFocus: boolean }>
  /** "10 · Rotate pigs" — stages directly downstream of the focus stage. */
  unlocksNext: string[]
}

export function buildRoadmapTaskContext(args: {
  groups: Array<{ id: string; title: string; sort_index: number }>
  tasks: RoadmapContextTask[]
  edges: TechTreeEdge[]
  focusTaskId: string
}): RoadmapTaskContextView | null {
  const { groups, tasks, edges, focusTaskId } = args
  const focusTask = tasks.find((t) => t.id === focusTaskId)
  if (!focusTask) return null
  const stages = goalsStageRows({ groups, tasks, edges })
  const focusStageIndex = stages.findIndex((s) => s.groupId === focusTask.group_id)
  if (focusStageIndex < 0) return null
  const focusStage = stages[focusStageIndex]!

  const inStage = tasks
    .filter((t) => t.group_id === focusTask.group_id)
    .sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id))
  const focusPos = inStage.findIndex((t) => t.id === focusTaskId)
  const focusStageNumber = focusStageIndex + 1

  const numberByGroupId = new Map(stages.map((s, i) => [s.groupId, i + 1]))
  const unlocksNext = edges
    .filter((e) => e.fromGroupId === focusTask.group_id)
    .map((e) => {
      const n = numberByGroupId.get(e.toGroupId)
      const title = stages.find((s) => s.groupId === e.toGroupId)?.title
      return n && title ? `${n} · ${title}` : null
    })
    .filter((s): s is string => s != null)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))

  return {
    stages,
    stagesDone: stages.filter((s) => s.state === 'complete').length,
    focusStageIndex,
    focusStageNumber,
    focusTaskNumber: `${focusStageNumber}.${focusPos + 1}`,
    focusStage,
    stageTasks: inStage.map((t) => ({
      id: t.id,
      title: t.title,
      done: t.completed_at != null,
      isFocus: t.id === focusTaskId,
    })),
    unlocksNext,
  }
}

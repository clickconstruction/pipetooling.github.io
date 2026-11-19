/**
 * What the Checklist page's tabs share (CHECKLIST_TABS map, the seam): the role the page reads and the roadmap
 * stage chip. They lived at the head of `pages/Checklist.tsx` until v2.7724; a tab in its own file reads them here.
 */
import type { RoadmapTaskEmbed } from '../../lib/tasks/personDay'

/** The roles the Checklist page tells apart, as `users.role` answers them. */
export type ChecklistRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'subcontractor'
  | 'helpers'
  | 'estimator'
  | 'primary'
  | 'superintendent'

/**
 * Stage-name chip for roadmap-born items: JUST the stage title (owner call,
 * 2026-08-25 — "cards don't need to know about ⛰ Farm 1"; the roadmap name
 * lives in the tooltip and the "Where this task fits" sheet). Shown to every
 * role on every status — assignees can read structure titles since migration
 * 20260825001101; falls back to "⛰ goal" only if RLS still hides the tree.
 * With `onOpen` it becomes a button opening "Where this task fits" (v2.2087).
 * Card surfaces render it on its own line below the title; row surfaces keep
 * it inline in their chip cluster.
 */
export function roadmapGoalChip(
  item: { roadmap_group_task_id?: string | null; checklist_tech_tree_group_tasks?: RoadmapTaskEmbed | null } | null | undefined,
  onOpen?: (roadmapGroupTaskId: string) => void,
  opts?: {
    /** Full-width bar placement (v2.2286): wrap long stage names instead of truncating. */
    wrap?: boolean
  },
) {
  if (!item?.roadmap_group_task_id) return null
  const group = item.checklist_tech_tree_group_tasks?.checklist_tech_tree_groups
  const roadmapTitle = group?.checklist_tech_tree_roadmaps?.title?.trim()
  const stageTitle = group?.title?.trim()
  const label = stageTitle || roadmapTitle || '⛰ goal'
  const fullPath = [roadmapTitle, stageTitle].filter(Boolean).join(' · ') || 'roadmap goal'
  const chipStyle = {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.12rem 0.5rem',
    borderRadius: 7,
    background: 'var(--bg-blue-tint)',
    color: 'var(--text-blue-800)',
    verticalAlign: 'middle',
    display: 'inline-block',
    ...(opts?.wrap
      ? // Bar placement: the full stage name, wrapping onto extra lines as needed.
        ({ whiteSpace: 'normal', lineHeight: 1.35, textAlign: 'left' } as const)
      : // Inline placement: one line, never two — long stage names truncate; the tooltip has the full path.
        ({ whiteSpace: 'nowrap', maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis' } as const)),
  } as const
  if (!onOpen) {
    return (
      <span title={fullPath} style={chipStyle}>
        {label}
      </span>
    )
  }
  const taskId = item.roadmap_group_task_id
  return (
    <button
      type="button"
      title={`${fullPath} — see where this task fits in the roadmap`}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(taskId)
      }}
      style={{ ...chipStyle, fontFamily: 'inherit', ...{ fontSize: chipStyle.fontSize, fontWeight: chipStyle.fontWeight }, border: 'none', cursor: 'pointer' }}
    >
      {label}
    </button>
  )
}

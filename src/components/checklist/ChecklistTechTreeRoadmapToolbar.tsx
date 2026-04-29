import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

const stopP = (e: ReactPointerEvent<HTMLButtonElement>) => e.stopPropagation()

export type TechTreeRoadmapToolbarSections = 'editor' | 'all'

type TechTreeRoadmapToolbarActionsProps = {
  sections: TechTreeRoadmapToolbarSections
  canEditTechTree: boolean
  groupCount: number
  reorderMode: boolean
  onAddGroup: () => void
  onLineUp: () => void
  onToggleReorder: () => void
  /** When false, Link Groups is omitted (e.g. shown in the Links card header instead). Default true. */
  showLineUpInToolbar?: boolean
  className?: string
  style?: CSSProperties
  /** e.g. nodrag nopan for overlay inside React Flow */
  containerClassName?: string
  buttonClassName?: string
}

/**
 * Roadmap first-row editor actions (Add group and Edit tasks when the graph is empty, Link Groups) for the page toolbar and the fullscreen flow overlay.
 * When the graph has at least one group, Add group, Edit tasks, and Collapse/Show all are on the canvas float (not here).
 */
export function TechTreeRoadmapToolbarActions({
  sections,
  canEditTechTree,
  groupCount,
  reorderMode,
  onAddGroup,
  onLineUp,
  onToggleReorder,
  showLineUpInToolbar = true,
  className,
  style,
  containerClassName = '',
  buttonClassName = '',
}: TechTreeRoadmapToolbarActionsProps) {
  const showEditor = (sections === 'editor' || sections === 'all') && canEditTechTree

  return (
    <div
      className={[containerClassName, className].filter(Boolean).join(' ') || undefined}
      style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, ...style }}
    >
      {showEditor ? (
        <>
          {groupCount === 0 ? (
            <button type="button" className={buttonClassName} onPointerDown={stopP} onClick={onAddGroup}>
              Add group
            </button>
          ) : null}
          {showLineUpInToolbar ? (
            <button
              type="button"
              className={buttonClassName}
              onPointerDown={stopP}
              onClick={onLineUp}
              disabled={groupCount < 2}
              title={groupCount < 2 ? 'Add at least two groups to add a link' : undefined}
            >
              Link Groups
            </button>
          ) : null}
          {groupCount === 0 ? (
            <button
              type="button"
              className={buttonClassName}
              onPointerDown={stopP}
              onClick={onToggleReorder}
              aria-pressed={reorderMode}
              title={
                reorderMode
                  ? 'Drag by the grip to reorder or move; press and hold a task title to edit. Click to turn off.'
                  : 'Edit mode: drag tasks by the grip, or press and hold a task title to edit. Moves tasks between groups.'
              }
              style={reorderMode ? { fontWeight: 700, boxShadow: 'inset 0 0 0 1px #3b82f6' } : undefined}
            >
              Edit Tasks
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

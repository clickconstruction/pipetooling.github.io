/**
 * Checklist → Review, one person's open tasks: the list a manager drags into order, its row (the whole row lifts
 * after a hold, and a press inside a window drawn in it never does), and the age chip a row wears. The three
 * lived at module scope in `pages/Checklist.tsx` until v2.7765 and moved here whole, with the row's type. The
 * Review tab hands the list its rows and every act; nothing here reads or writes by itself (CHECKLIST_TABS map).
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import { DndContext, closestCenter, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { waitingOnWords } from '../../lib/jobs/noteTags'
import { ChecklistTitleWithLinks } from '../ChecklistTitleWithLinks'
import { compactTimeAgo } from '../../lib/subcontractorLastActivityCompact'
import { ChecklistItemActivity } from './ChecklistItemActivity'
import { ageSeverity, oldestAgeDays } from '../../lib/checklistTeamBoard'
import { ChecklistCostButton } from './ChecklistCostButton'
import { ignoreWindowsInside } from '../../lib/windowInsideRow'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { RoadmapTaskEmbed } from '../../lib/tasks/personDay'
import { roadmapGoalChip } from './checklistPageShared'

export type OutstandingInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  checklist_items?: { title?: string; links?: string[] | null; repeat_type?: string; reminder_scope?: string | null; created_at?: string | null; created_by_user_id?: string | null; roadmap_group_task_id?: string | null; checklist_tech_tree_group_tasks?: RoadmapTaskEmbed | null } | null
}

/** Severity-tinted "Nd" age chip shared by the Review rows (v2.2012). */
function outstandingAgeChip(scheduledDate: string, todayStr: string, createdAtIso?: string | null) {
  const days = oldestAgeDays([{ scheduled_date: scheduledDate }], todayStr)
  if (days <= 0) {
    // Scheduled today: a raw ISO date reads like a bug on phones — say how
    // fresh it is instead ("15h ago"), falling back to "today" (v2.2263,
    // restored v2.2278 after a merge race reverted it).
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
        {createdAtIso ? compactTimeAgo(createdAtIso) : 'today'}
      </span>
    )
  }
  const sev = ageSeverity(days)
  const tone =
    sev === 'late'
      ? { background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }
      : sev === 'warn'
        ? { background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }
        : { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-700)' }
  return (
    <span
      title={scheduledDate}
      style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '0.1rem 0.45rem',
        borderRadius: 7,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        ...tone,
      }}
    >
      {days}d
    </span>
  )
}

function OutstandingByPersonSortableRow({
  inst,
  userId,
  dragDisabled,
  canManageChecklists,
  canActForOthers,
  canSeeCosts,
  authUserId,
  completingInstanceId,
  deletingInstanceId,
  expanded,
  notesCount,
  waitingOn = '',
  onToggleExpanded,
  onMarkComplete,
  onDeleteInstance,
  onOpenFwd,
  onCompleteFromPanel,
  onOpenRoadmapContext,
  setEditItemId,
  setError,
  missedCount = 1,
}: {
  inst: OutstandingInstance
  userId: string
  dragDisabled: boolean
  canManageChecklists: boolean
  canActForOthers: boolean
  canSeeCosts: boolean
  authUserId: string | null
  completingInstanceId: string | null
  deletingInstanceId: string | null
  expanded: boolean
  notesCount: number
  /** `waiting on Dana` (punch list #375): who a tagged note on this task still waits on. Empty when nobody. */
  waitingOn?: string
  /** Missed view: how many missed copies this row stands for (v2.2272). */
  missedCount?: number
  onToggleExpanded: (instanceId: string) => void
  onMarkComplete: (inst: OutstandingInstance) => void
  onDeleteInstance: (inst: OutstandingInstance) => void
  onOpenFwd: (inst: OutstandingInstance, rowUserId: string) => void
  onCompleteFromPanel: (args: { instanceId: string; checklistItemId: string; scheduledDate: string }) => Promise<boolean>
  onOpenRoadmapContext?: (roadmapGroupTaskId: string) => void
  setEditItemId: (id: string) => void
  setError: (s: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: inst.id,
    disabled: dragDisabled || !canManageChecklists,
  })
  // Suppresses the ghost click that follows a drop (it would toggle the
  // expansion or hit a row button). Set while dragging, consumed by the
  // li's onClickCapture, reset at the start of every fresh gesture.
  const wasDraggedRef = useRef(false)
  useEffect(() => {
    if (isDragging) wasDraggedRef.current = true
  }, [isDragging])
  const style: CSSProperties = {
    marginBottom: '0.25rem',
    // Lift (mockup 1647b4e5): while held, the card scales up and floats on a
    // shadow instead of ghosting — it should feel picked up, not dimmed.
    transform:
      isDragging && transform
        ? `${CSS.Transform.toString(transform)} scale(1.02)`
        : CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 5 : undefined,
    // The whole row is the drag surface: keep vertical scrolling alive on
    // touch until the hold activates, and stop long-press text selection.
    touchAction: 'pan-y',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    ...(isDragging
      ? {
          background: 'var(--surface)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
          borderRadius: 12,
        }
      : {}),
  }
  const title = inst.checklist_items?.title ?? '\u2014'
  const footerLink = (label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 0,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: danger ? 'var(--text-red-700)' : 'var(--text-link)',
      }}
    >
      {label}
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={style}
      // A press inside a window drawn in the row (Cost this task) does not lift it (v2.4361).
      {...(canManageChecklists ? ignoreWindowsInside(listeners) : {})}
      onPointerDownCapture={() => {
        wasDraggedRef.current = false
      }}
      onClickCapture={(e) => {
        if (wasDraggedRef.current) {
          wasDraggedRef.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      {/* Two-line phone rows (v2.2201): desktop keeps the single line; under 720px the grip hides,
          the ✓ becomes a boxed 34px target spanning both lines, the title takes the full width and
          the meta cluster (roadmap chip · age · notes · 🗑) drops to its own line. Styles: .obp-* in
          OutstandingByPersonSortableList. Hold-to-lift: drag listeners live on the <li> itself —
          the grip below is a desktop affordance, not the only handle. */}
      <div className={`obp-row${canActForOthers ? '' : ' obp-row--nocheck'}`}>
        {canManageChecklists && (
          <button
            type="button"
            {...attributes}
            disabled={dragDisabled}
            title="Drag to reorder"
            aria-label={`Drag to reorder: ${title}`}
            className="obp-grip"
            style={{
              flexShrink: 0,
              padding: '0.125rem',
              background: 'none',
              border: 'none',
              cursor: dragDisabled ? 'not-allowed' : 'grab',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              touchAction: 'none',
              opacity: dragDisabled ? 0.5 : 1,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M8 5h2v2H8V5zm3 0h2v2h-2V5zm3 0h2v2h-2V5zM8 9h2v2H8V9zm3 0h2v2h-2V9zm3 0h2v2h-2V9zM8 13h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zM8 17h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2z" />
            </svg>
          </button>
        )}
        {canActForOthers && (
          <span className="obp-check" style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkComplete(inst)
              }}
              disabled={completingInstanceId === inst.id}
              title="Mark complete"
              aria-label="Mark complete"
              className="obp-check-btn"
              style={{
                padding: '0.25rem',
                // Instant answer to the press (mockup 55d69b29): fill + pop
                // the moment the finger lands; the save runs behind it.
                background: completingInstanceId === inst.id ? '#15803d' : 'none',
                border: 'none',
                cursor: completingInstanceId === inst.id ? 'not-allowed' : 'pointer',
                color: completingInstanceId === inst.id ? 'white' : '#16a34a',
                transform: completingInstanceId === inst.id ? 'scale(1.08)' : undefined,
                transition: 'background 120ms ease, color 120ms ease, transform 120ms ease',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z" />
              </svg>
            </button>
          </span>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} activity for ${title}`}
          onClick={(e) => {
            // Links inside the title stay links \u2014 don't toggle on them.
            if ((e.target as HTMLElement).closest('a')) return
            onToggleExpanded(inst.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleExpanded(inst.id)
            }
          }}
          className="obp-main"
          style={{
            borderRadius: 8,
            cursor: 'pointer',
            background: expanded ? 'var(--bg-muted)' : undefined,
            ...(completingInstanceId === inst.id
              ? { textDecoration: 'line-through', opacity: 0.65, transition: 'opacity 150ms ease' }
              : {}),
          }}
        >
          {/* Group context first (v2.2286): the stage bar sits above the title, full width and
              wrapping, so long stage names never push the meta icons off the screen. */}
          {inst.checklist_items?.roadmap_group_task_id ? (
            <span className="obp-goalbar">{roadmapGoalChip(inst.checklist_items, onOpenRoadmapContext, { wrap: true })}</span>
          ) : null}
          <span className="obp-title" style={{ minWidth: 0 }}>
            <ChecklistTitleWithLinks title={title} links={inst.checklist_items?.links} />
          </span>
          <span className="obp-meta">
            {notesCount > 0 ? (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.1rem 0.45rem',
                  borderRadius: 7,
                  background: 'var(--bg-blue-tint)',
                  color: 'var(--text-blue-800)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {'\uD83D\uDCAC'} {notesCount}
              </span>
            ) : null}
            {waitingOn ? (
              <span data-row-waiting-on style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: 7, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {waitingOn}
              </span>
            ) : null}
            <span style={{ flexShrink: 0 }}>{outstandingAgeChip(inst.scheduled_date, todayYmdInAppTz(), inst.checklist_items?.created_at)}</span>
            {missedCount > 1 ? (
              <span
                title={`Missed on ${missedCount} scheduled days — completing or deleting this row resolves all of them`}
                style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: 7, background: 'var(--bg-muted)', border: '1px solid var(--border)', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                missed ×{missedCount}
              </span>
            ) : null}
            {canSeeCosts && (
              // Bridged roadmap tasks key their estimate by the roadmap task id so
              // Review and the roadmap Plan view share one number per task.
              <ChecklistCostButton
                costKey={inst.checklist_items?.roadmap_group_task_id ?? inst.checklist_item_id}
                taskTitle={title}
                defaultUserId={userId}
              />
            )}
            <span className="obp-sp" aria-hidden />
            {canActForOthers && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteInstance(inst)
                }}
                disabled={deletingInstanceId === inst.id}
                title="Delete"
                aria-label="Delete"
                style={{
                  flexShrink: 0,
                  padding: '0.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: deletingInstanceId === inst.id ? 'not-allowed' : 'pointer',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
            </svg>
              </button>
            )}
          </span>
        </div>
      </div>
      {expanded ? (
        <div
          className="obp-expanded"
          style={{
            padding: '0.5rem 0.65rem 0.6rem',
            background: 'var(--bg-muted)',
            borderRadius: 10,
          }}
        >
          <ChecklistItemActivity
            item={{
              id: inst.checklist_item_id,
              title,
              created_at: inst.checklist_items?.created_at ?? null,
              created_by_user_id: inst.checklist_items?.created_by_user_id ?? null,
            }}
            authUserId={authUserId}
            showInstanceDays={(inst.checklist_items?.repeat_type ?? 'once') !== 'once'}
            setError={setError}
            onComplete={(activityInst) =>
              onCompleteFromPanel({
                instanceId: activityInst.id,
                checklistItemId: inst.checklist_item_id,
                scheduledDate: activityInst.scheduledDate,
              })
            }
            footerActions={
              canActForOthers ? (
                <>
                  {footerLink('Edit', () => setEditItemId(inst.checklist_item_id))}
                  {footerLink('Forward', () => onOpenFwd(inst, userId))}
                </>
              ) : undefined
            }
          />
        </div>
      ) : null}
    </li>
  )
}

/** Exported for its render test (`windowInsideRow.render.test.tsx`). */
export function OutstandingByPersonSortableList({
  userId,
  instances,
  reorderingUserId,
  canManageChecklists,
  canActForOthers,
  canSeeCosts,
  authUserId,
  onDragEnd,
  completingInstanceId,
  deletingInstanceId,
  expandedInstanceId,
  notesByInstance,
  waitingByItem,
  missedCountByInstance,
  onToggleExpanded,
  onMarkComplete,
  onDeleteInstance,
  onOpenFwd,
  onCompleteFromPanel,
  onOpenRoadmapContext,
  setEditItemId,
  setError,
}: {
  userId: string
  instances: OutstandingInstance[]
  reorderingUserId: string | null
  canManageChecklists: boolean
  canActForOthers: boolean
  canSeeCosts: boolean
  onDragEnd: (e: DragEndEvent) => void
  completingInstanceId: string | null
  deletingInstanceId: string | null
  onMarkComplete: (inst: OutstandingInstance) => void
  onDeleteInstance: (inst: OutstandingInstance) => void
  onOpenFwd: (inst: OutstandingInstance, rowUserId: string) => void
  onCompleteFromPanel: (args: { instanceId: string; checklistItemId: string; scheduledDate: string }) => Promise<boolean>
  onOpenRoadmapContext?: (roadmapGroupTaskId: string) => void
  setEditItemId: (id: string) => void
  authUserId: string | null
  expandedInstanceId: string | null
  notesByInstance: Map<string, number>
  /** Who each task's tagged notes still wait on, by task (punch list #375). */
  waitingByItem?: ReadonlyMap<string, string[]>
  /** Missed view: representative instance id → missed-copy count (v2.2272). */
  missedCountByInstance?: Map<string, number>
  onToggleExpanded: (instanceId: string) => void
  setError: (s: string | null) => void
}) {
  // Hold-to-lift (mockup 1647b4e5): a ~300ms press anywhere on a card picks it
  // up — mouse or finger, no grip hunting. A quick tap still expands, and a
  // finger that starts scrolling (moves >8px before the delay) never lifts.
  // TouchSensor (not PointerSensor) on touch: pointer events can't stop the
  // browser's scroll, so a lifted card was dropped the moment the page panned
  // (v2.2280). TouchSensor preventDefaults touchmove only while a drag is
  // active — scroll stays locked from lift to drop, and works normally
  // otherwise (rows keep touch-action: pan-y).
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
  )
  const dragDisabled = reorderingUserId === userId

  if (!canManageChecklists) {
    return (
      <ul style={{ margin: 0, paddingLeft: '1.5rem', listStyle: 'disc' }}>
        {instances.map((inst) => (
          <li key={inst.id} style={{ marginBottom: '0.25rem' }}>
            <ChecklistTitleWithLinks title={inst.checklist_items?.title ?? '—'} links={inst.checklist_items?.links} />{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>({inst.scheduled_date})</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={instances.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {/* Two-line phone rows (v2.2201): desktop = one line (grip · ✓ · title · meta); under 720px the
            grip hides, the ✓ boxes up and spans both lines, the title runs edge to edge, and the meta
            cluster (age · 💬 · spacer · 🗑) becomes the second line. Tasks with a roadmap stage carry
            a full-width wrapping group bar above the title (v2.2286) instead of an inline chip. */}
        <style>{`
          .obp-row { display: flex; align-items: center; gap: 0.125rem; }
          .obp-main { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; padding: 0.3rem 0.35rem; }
          .obp-goalbar { flex: 1 1 100%; min-width: 0; }
          .obp-title { flex: 1; min-width: 0; }
          .obp-meta { display: inline-flex; align-items: center; gap: 0.35rem; flex-shrink: 0; }
          .obp-sp { display: none; }
          .obp-expanded { margin: 0.15rem 0 0.5rem 1.9rem; }
          @media (max-width: 719px) {
            .obp-row { align-items: flex-start; gap: 0.4rem; }
            .obp-grip { display: none !important; }
            .obp-check { align-self: flex-start; margin-top: 0.15rem; }
            .obp-check-btn { width: 34px; height: 34px; border: 1.5px solid var(--border-strong) !important; border-radius: 10px !important; background: var(--surface) !important; }
            .obp-main { flex-wrap: wrap; gap: 0.25rem 0; padding: 0.25rem 0.1rem; }
            .obp-title { flex: 1 1 100%; }
            .obp-meta { flex: 1 1 100%; display: flex; min-height: 28px; }
            .obp-sp { display: block; flex: 1; }
            .obp-expanded { margin: 0.15rem 0 0.5rem 0; }
          }
        `}</style>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {instances.map((inst) => (
            <OutstandingByPersonSortableRow
              key={inst.id}
              inst={inst}
              userId={userId}
              dragDisabled={dragDisabled}
              canManageChecklists={canManageChecklists}
              canActForOthers={canActForOthers}
              canSeeCosts={canSeeCosts}
              authUserId={authUserId}
              completingInstanceId={completingInstanceId}
              deletingInstanceId={deletingInstanceId}
              expanded={expandedInstanceId === inst.id}
              notesCount={notesByInstance.get(inst.id) ?? 0}
              waitingOn={waitingOnWords(waitingByItem?.get(inst.checklist_item_id) ?? [], [])}
              missedCount={missedCountByInstance?.get(inst.id) ?? 1}
              onToggleExpanded={onToggleExpanded}
              onMarkComplete={onMarkComplete}
              onDeleteInstance={onDeleteInstance}
              onOpenFwd={onOpenFwd}
              onCompleteFromPanel={onCompleteFromPanel}
              onOpenRoadmapContext={onOpenRoadmapContext}
              setEditItemId={setEditItemId}
              setError={setError}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

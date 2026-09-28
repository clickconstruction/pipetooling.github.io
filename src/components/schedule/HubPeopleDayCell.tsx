/**
 * One person × day cell of the Schedule Dispatch hub's People grid, with the
 * block cards and the grey "busy" placeholders it draws.
 *
 * None of the three holds state. What a cell or a card does on a tap is decided
 * from the page's modes, which arrive as props: placing a copy, picking a cell
 * for a job, selecting cells for a multi-cell add, a linked copy in progress.
 * The cell is the drop target and the card the draggable; both ids come from
 * `lib/scheduleDispatchDnd`, which the page's drag-end handler reads back, so
 * the cell must stay inside the page's `DndContext`.
 */
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import { blockCoverageKey, type BlockCoverage } from '../../lib/schedule/blockGroupCoverage'
import type { SubBadge } from '../../lib/subs/subDispatch'
import { useRef } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useToastContext } from '../../contexts/ToastContext'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import {
  scheduleBlockActionLinkedIconButtonStyle,
  scheduleBlockActionTextButtonStyle,
  scheduleBlockControlPlateBackgroundStyle,
} from '../../lib/scheduleBlockActionChromeStyle'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE } from '../../lib/scheduleDispatchDragHelp'
import { useLongPress } from '../../hooks/useLongPress'
import { formatFieldMovedFrom } from '../../lib/selfScheduleJobs'
import { scheduleDispatchCellDroppableId } from '../../lib/scheduleDispatchDnd'
import { ScheduleDispatchBlockNoteIcon } from '../icons/ScheduleDispatchBlockNoteIcon'
import { ScheduleDispatchLinkedChainsIcon } from '../icons/ScheduleDispatchLinkedChainsIcon'
import type { LinkedCopyMode } from '../../lib/scheduleDispatchLinkedCopy'
import type { LinkedGroupCardAccent } from '../../lib/scheduleDispatchLinkedGroupPalette'
import { hubPersonDayKey } from '../../lib/scheduleDispatchHub'
import { SCHEDULE_BID_VISIT_LABEL } from '../../lib/scheduleBlockTitle'
import { scheduleHiddenPlaceholderTitle, type ScheduleHiddenCell } from '../../lib/scheduleHiddenBlocks'
import { ScheduleDispatchPlusCopyMenu } from './ScheduleDispatchPlusCopyMenu'
import type { ScheduleDispatchCardPlacementMode, ScheduleDispatchCardPlacementVariant } from './ScheduleDispatchGrid'
import {
  scheduleDispatchDayColumnCellIdleBg,
  scheduleDispatchTodayColumnBoxShadow,
} from '../../lib/scheduleDispatchColumnFocus'
import type { UserTimeOffCellInfo } from '../../lib/userTimeOffByCell'
import { ScheduleDispatchTimeOffChip } from './ScheduleDispatchTimeOffChip'
import { ScheduleDispatchLateChip } from './ScheduleDispatchLateChip'
import type { PersonDayLateness } from '../../lib/scheduleLateness'
import { useDispatchNoteRequirements } from '../../contexts/DispatchNoteRequirementsContext'
import {
  editNoteIconColorForBlock,
  effectiveNoteRequirement,
  surroundingIconColorForRequirement,
} from '../../lib/dispatchNoteRequirements'

function HubPeopleBlockCard({
  block,
  linkedCopyStage = null,
  linkedCopySelected = false,
  onLinkedCopyToggle,
  workDate,
  scheduleTodayYmd,
  canEdit,
  hubMultiCellAddActive,
  linkPeerCount,
  coverage = null,
  highlightLinkedGroups,
  linkedGroupAccentByGroupId,
  onOpenLinkedGroup,
  cardPlacementMode,
  plusMenuOpen,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  getJobDisplayTitle,
  getJobAddress,
  onOpenJob,
  onOpenHubJobDetail,
  onDeleteBlock,
  onRequestEditBlockNote,
  onOpenPersonDay,
  onRequestMoveBlock,
  tapGripToMove = false,
}: {
  block: JobScheduleBlockRow
  linkedCopyStage?: 1 | 2 | null
  linkedCopySelected?: boolean
  onLinkedCopyToggle?: (blockId: string) => void
  workDate: string
  scheduleTodayYmd: string
  canEdit: boolean
  hubMultiCellAddActive: boolean
  linkPeerCount: number
  /** v2.3612 Supervision: this block's crew verdict; `unsupervised` draws the pill. */
  coverage?: BlockCoverage | null
  highlightLinkedGroups: boolean
  linkedGroupAccentByGroupId: ReadonlyMap<string, LinkedGroupCardAccent>
  onOpenLinkedGroup: (groupId: string) => void
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  plusMenuOpen: boolean
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: ScheduleDispatchCardPlacementVariant) => void
  getJobDisplayTitle: (jobId: string) => string
  /** Job address for the card's one-line ellipsized subline; empty string when none. */
  getJobAddress?: (jobId: string) => string
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
  onDeleteBlock: (id: string) => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  /** Clock button (v2.1817): open the assignee's whole-day Manage modal. */
  onOpenPersonDay?: (b: JobScheduleBlockRow) => void
  /** Press-and-hold on the card body: open the Move sheet (day + person). */
  onRequestMoveBlock?: (b: JobScheduleBlockRow) => void
  /** Phone: a tap on the grip arms Move placement (tap a day chip or a cell). Drag still works. */
  tapGripToMove?: boolean
}) {
  const { showToast } = useToastContext()
  const { requirementForBlock } = useDispatchNoteRequirements()
  const noteRequirement = requirementForBlock({
    userId: block.assignee_user_id,
    jobId: block.job_id,
  })
  const isPastWorkDate = block.work_date < scheduleTodayYmd
  const effectiveRequirement = effectiveNoteRequirement(noteRequirement, isPastWorkDate)
  const editNoteColor = editNoteIconColorForBlock({
    requirement: effectiveRequirement,
    hasNote: Boolean(block.note),
  })
  const chainsColor = surroundingIconColorForRequirement(effectiveRequirement, '#1d4ed8')
  const minusColor = surroundingIconColorForRequirement(effectiveRequirement, '#b91c1c')
  const plusColor = surroundingIconColorForRequirement(effectiveRequirement, '#1d4ed8')
  const plusButtonRef = useRef<HTMLButtonElement>(null)
  const placementPickingActive = cardPlacementMode != null
  const linkedCopyActive = linkedCopyStage != null
  const dragDisabled = !canEdit || hubMultiCellAddActive || linkedCopyActive
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    disabled: dragDisabled,
  })
  // Press-and-hold anywhere on the card body opens the Move sheet; a tap on
  // the grip (phone) arms Move placement. Both hand off to the same move
  // kernel the drop uses. Text selection stays available on desktop.
  const longPressEnabled = canEdit && !!onRequestMoveBlock && !placementPickingActive && !linkedCopyActive
  const moveLongPress = useLongPress(() => onRequestMoveBlock?.(block), { disabled: !longPressEnabled })
  const gripTapArmsMove = tapGripToMove && !dragDisabled && !placementPickingActive

  const explainDisabledDrag = () => {
    showToast(SCHEDULE_DISPATCH_DRAG_DISABLED_READONLY_MESSAGE, 'info')
  }

  const disabledStripAriaLabel =
    'Cannot drag: you do not have permission to reassign schedule blocks. Click for an explanation.'

  // Bid-anchored block (v2.1613): violet tint + "bid" chip so a bid visit never reads as
  // just another job card (Tier-2 #22, J18-F6). Both card buttons open the bid — there is no
  // Job Detail or job week for it; `onOpenJob` routes the anchor through `scheduleBlockTarget`.
  const isBidBlock = block.job_id == null
  const groupId = block.shared_block_group_id
  const showLinkedFloat = Boolean(groupId && linkPeerCount > 1)
  const showEditNoteBtn = canEdit && !placementPickingActive && !linkedCopyActive && !!onRequestEditBlockNote
  const showPersonDayBtn = !placementPickingActive && !linkedCopyActive && !!onOpenPersonDay
  const showMinusPlusButtons = canEdit && !placementPickingActive && !linkedCopyActive
  const linkedAccent =
    highlightLinkedGroups && groupId && linkPeerCount > 1
      ? linkedGroupAccentByGroupId.get(groupId)
      : undefined

  const style: CSSProperties = {
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (placementPickingActive) e.stopPropagation()
      }}
      style={{
        ...style,
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        marginBottom: 4,
        background: linkedAccent?.background ?? (isBidBlock ? 'var(--bg-violet-100)' : 'var(--bg-blue-tint)'),
        borderStyle: 'solid',
        borderColor: linkedAccent?.borderColor ?? (isBidBlock ? 'var(--border-violet)' : '#93c5fd'),
        borderWidth: linkedAccent ? '3px 1px 1px 1px' : 1,
        borderRadius: 4,
        fontSize: '0.72rem',
        color: isBidBlock ? 'var(--text-violet-800)' : 'var(--text-blue-900)',
        overflow: 'visible',
        ...(linkedCopySelected ? { boxShadow: '0 0 0 2px #4338ca' } : {}),
        ...(linkedCopyActive && !linkedCopySelected && linkedCopyStage === 2 ? { opacity: 0.55 } : {}),
      }}
      title={
        linkedAccent
          ? 'Mirrored crew block — same accent color as other people in this linked group for this week.'
          : undefined
      }
    >
      <div
        {...(dragDisabled
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                explainDisabledDrag()
              },
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                e.stopPropagation()
                explainDisabledDrag()
              },
            }
          : { ...listeners, ...attributes })}
        {...(gripTapArmsMove
          ? {
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                onStartCardPlacement(block, 'move')
              },
            }
          : {})}
        style={{
          flexShrink: 0,
          // v2.1816: the handle was a bare 14px sliver nobody could find —
          // dispatchers were deleting + re-adding blocks instead of moving
          // them. Wider, with visible grip dots and a tooltip.
          width: 22,
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: dragDisabled ? undefined : 'none',
          cursor: dragDisabled ? 'pointer' : 'grab',
          background: dragDisabled
            ? 'linear-gradient(90deg, var(--bg-red-100) 0%, var(--bg-red-200) 100%)'
            : isBidBlock
              ? 'linear-gradient(90deg, var(--bg-violet-200) 0%, var(--bg-violet-100) 100%)'
              : 'linear-gradient(90deg, var(--bg-blue-200) 0%, var(--bg-blue-tint) 100%)',
          borderRight: `1px solid ${dragDisabled ? 'var(--border-red)' : isBidBlock ? 'var(--border-violet)' : 'var(--border-blue)'}`,
          outline: 'none',
        }}
        title={
          dragDisabled
            ? undefined
            : gripTapArmsMove
              ? 'Tap to move this block to another day or person (or drag it)'
              : 'Drag to move this block to another day or person'
        }
        aria-label={
          dragDisabled
            ? disabledStripAriaLabel
            : gripTapArmsMove
              ? 'Move block: tap, then tap a day or a person row'
              : 'Drag to move block to another day or person row'
        }
      >
        <span
          aria-hidden
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            fontSize: '0.7rem',
            lineHeight: 1,
            letterSpacing: '-1px',
            color: dragDisabled ? 'var(--text-red-600)' : isBidBlock ? 'var(--text-violet-800)' : 'var(--text-blue-900)',
            opacity: 0.6,
          }}
        >
          ⠿
        </span>
      </div>
      <div
        {...moveLongPress.handlers}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          ...(longPressEnabled && tapGripToMove ? { WebkitTouchCallout: 'none', userSelect: 'none' } : {}),
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (moveLongPress.consumeLongPress()) return
            if (placementPickingActive) return
            if (isBidBlock) {
              onOpenJob(scheduleBlockAnchorId(block))
              return
            }
            onOpenHubJobDetail(block, workDate)
          }}
          title={isBidBlock ? 'Open this bid' : undefined}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.35rem 0.45rem',
            margin: 0,
            border: 'none',
            borderBottom: `1px solid ${isBidBlock ? 'var(--border-violet)' : 'var(--border-blue)'}`,
            background: 'transparent',
            cursor: placementPickingActive ? 'default' : 'pointer',
            textAlign: 'left',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          {isBidBlock ? (
            <span
              aria-label={SCHEDULE_BID_VISIT_LABEL}
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                marginRight: 4,
                padding: '0 0.35rem',
                fontSize: '0.6rem',
                fontWeight: 700,
                lineHeight: 1.5,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: 'var(--text-violet-800)',
                background: 'var(--bg-violet-200)',
                border: '1px solid var(--border-violet)',
                borderRadius: 999,
              }}
            >
              bid
            </span>
          ) : null}
          <span
            style={{
              fontWeight: 700,
              color: isBidBlock ? 'var(--text-violet-800)' : 'var(--text-blue-900)',
              wordBreak: 'break-word',
            }}
          >
            {getJobDisplayTitle(scheduleBlockAnchorId(block))}
          </span>
          {(() => {
            const addr = getJobAddress?.(scheduleBlockAnchorId(block)) ?? ''
            if (!addr) return null
            return (
              <span
                title={addr}
                style={{
                  display: 'block',
                  color: 'var(--text-600)',
                  fontWeight: 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {addr}
              </span>
            )
          })()}
        </button>
        <button
          type="button"
          onClick={() => {
            if (moveLongPress.consumeLongPress()) return
            if (placementPickingActive) return
            onOpenJob(scheduleBlockAnchorId(block))
          }}
          title={block.job_id == null ? 'Open this bid' : "Open this job's week"}
          style={{
            display: 'block',
            width: '100%',
            minWidth: 0,
            padding: '0.35rem 0.45rem',
            margin: 0,
            border: 'none',
            background: 'transparent',
            cursor: placementPickingActive ? 'default' : 'pointer',
            textAlign: 'left',
            font: 'inherit',
            color: 'inherit',
          }}
        >
          <div
            style={{
              color: isBidBlock ? 'var(--text-violet-700)' : 'var(--text-blue-800)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
            }}
          >
            <span>{scheduleFormatWindow(block.time_start, block.time_end)}</span>
            {/* v2.3612 Supervision: nobody on this crew can run the job. A warning, never a refusal. */}
            {coverage === 'unsupervised' ? (
              <span
                data-testid="hub-unsupervised-pill"
                title="Unsupervised — everyone on this block needs supervision. Add a master, or someone who can run a job, as a linked copy. The block is fine to keep as it is if the office knows better."
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  color: 'var(--text-amber-800)',
                  background: 'var(--bg-amber-100)',
                  border: '1px solid #f59e0b',
                  borderRadius: 999,
                  padding: '0.05rem 0.4rem',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em',
                }}
              >
                unsupervised
              </span>
            ) : null}
            {/* v2.1568 self-scheduling trail: the assignee moved this dispatch-made
                block themselves — movement is allowed, silence isn't. */}
            {block.field_moved_at ? (
              <span
                title={`Moved by the assignee — ${formatFieldMovedFrom(block as { field_moved_from?: { work_date?: string; time_start?: string; time_end?: string } | null }) ?? 'original window unknown'}`}
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: 'var(--text-amber-800)',
                  background: 'var(--bg-orange-tint)',
                  border: '1px solid #f59e0b',
                  borderRadius: 999,
                  padding: '0.05rem 0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                moved by tech{(() => {
                  const was = formatFieldMovedFrom(
                    block as { field_moved_from?: { work_date?: string; time_start?: string; time_end?: string } | null },
                  )
                  return was ? ` · ${was.replace(/^was /, 'was ')}` : ''
                })()}
              </span>
            ) : null}
          </div>
          {block.note ? (
            <div style={{ color: 'var(--text-600)', marginTop: 2, overflowWrap: 'anywhere' }}>{block.note}</div>
          ) : null}
        </button>
      </div>
      {showEditNoteBtn ? (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            zIndex: 3,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 0,
          }}
        >
          <button
            type="button"
            title="Edit job instructions"
            aria-label="Edit job instructions"
            onClick={(e) => {
              e.stopPropagation()
              onRequestEditBlockNote?.(block)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 51,
              height: 51,
              minWidth: 51,
              minHeight: 51,
              boxSizing: 'border-box',
              padding: 0,
              color: editNoteColor,
              cursor: 'pointer',
              fontFamily: 'inherit',
              margin: 0,
              ...scheduleBlockControlPlateBackgroundStyle,
              ...scheduleBlockActionLinkedIconButtonStyle,
            }}
          >
            <ScheduleDispatchBlockNoteIcon size={32} />
          </button>
        </div>
      ) : null}
      {showPersonDayBtn ? (
        <button
          type="button"
          title="See this person's whole day — rearrange times, unlink"
          aria-label="See this person's whole day"
          onClick={(e) => {
            e.stopPropagation()
            onOpenPersonDay?.(block)
          }}
          style={{
            position: 'absolute',
            // Top-left corner of the note plate, mirroring the chain (top-right)
            // and −/+ (bottom corners); falls left of the chain when no plate.
            top: 2,
            right: showEditNoteBtn ? 33 : 24,
            zIndex: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-700)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            ...scheduleBlockActionLinkedIconButtonStyle,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden focusable={false}>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
      {showLinkedFloat ? (
        <button
          type="button"
          disabled={placementPickingActive || linkedCopyActive}
          title={
            placementPickingActive || linkedCopyActive
              ? undefined
              : 'Linked: time and instructions stay in sync. Click to see every block in this group.'
          }
          aria-label="View linked schedule group details"
          onClick={(e) => {
            e.stopPropagation()
            if (placementPickingActive || !groupId) return
            onOpenLinkedGroup(groupId)
          }}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            zIndex: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            color: chainsColor,
            cursor: placementPickingActive ? 'default' : 'pointer',
            fontFamily: 'inherit',
            filter:
              'drop-shadow(0 0 1px var(--surface)) drop-shadow(0 0 2px var(--surface))',
          }}
        >
          <ScheduleDispatchLinkedChainsIcon size={12} />
        </button>
      ) : null}
      {showMinusPlusButtons ? (
        <button
          type="button"
          aria-label="Remove block"
          title="Remove block"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteBlock(block.id)
          }}
          style={{
            position: 'absolute',
            top: showEditNoteBtn ? 33 : 28,
            right: showEditNoteBtn ? 33 : 18,
            zIndex: 4,
            width: 20,
            height: 20,
            padding: 0,
            margin: 0,
            lineHeight: '18px',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: minusColor,
            cursor: 'pointer',
            ...scheduleBlockActionTextButtonStyle,
          }}
        >
          −
        </button>
      ) : null}
      {showMinusPlusButtons ? (
        <div
          style={{
            position: 'absolute',
            top: showEditNoteBtn ? 33 : 28,
            right: 2,
            zIndex: 4,
          }}
        >
          <button
            ref={plusButtonRef}
            type="button"
            aria-label="Copy block to another cell"
            title="Copy to another person & day"
            onClick={(e) => {
              e.stopPropagation()
              onPlusMenuBlockIdChange(plusMenuOpen ? null : block.id)
            }}
            style={{
              width: 20,
              height: 20,
              padding: 0,
              margin: 0,
              lineHeight: '18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: plusColor,
              cursor: 'pointer',
              ...scheduleBlockActionTextButtonStyle,
            }}
          >
            +
          </button>
          <ScheduleDispatchPlusCopyMenu
            open={plusMenuOpen}
            anchorRef={plusButtonRef}
            onClose={() => onPlusMenuBlockIdChange(null)}
            onLinkedCopy={() => {
              onPlusMenuBlockIdChange(null)
              onStartCardPlacement(block, 'linked')
            }}
            onSoloCopy={() => {
              onPlusMenuBlockIdChange(null)
              onStartCardPlacement(block, 'unlinked')
            }}
          />
        </div>
      ) : null}
      {linkedCopyStage != null ? (
        <button
          type="button"
          aria-label={
            linkedCopyStage === 1
              ? linkedCopySelected
                ? 'Deselect this block for linked copy'
                : 'Select this block for linked copy'
              : linkedCopySelected
                ? 'Selected for linked copy'
                : 'Not selected'
          }
          aria-pressed={linkedCopySelected}
          onClick={(e) => {
            e.stopPropagation()
            if (linkedCopyStage === 1) onLinkedCopyToggle?.(block.id)
          }}
          style={{
            position: 'absolute',
            inset: -1,
            zIndex: 8,
            padding: 0,
            margin: 0,
            borderRadius: 4,
            border:
              linkedCopyStage === 1 && !linkedCopySelected
                ? '2px dashed rgba(67, 56, 202, 0.55)'
                : 'none',
            background: linkedCopySelected ? 'rgba(67, 56, 202, 0.14)' : 'transparent',
            cursor: linkedCopyStage === 1 ? 'pointer' : 'default',
          }}
        />
      ) : null}
    </div>
  )
}


/**
 * Grey "busy" placeholders for blocks the viewer's RLS hides (journey map Tier-2 #23): one box
 * per hidden block, no job identity, no times. The person is booked — just not on your projects.
 */
function HubHiddenBusyPlaceholders({ info }: { info: ScheduleHiddenCell }) {
  const title = scheduleHiddenPlaceholderTitle(info)
  return (
    <div
      data-testid="hub-hidden-busy"
      role="note"
      aria-label={title}
      title={title}
      style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}
    >
      {Array.from({ length: Math.min(info.count, 6) }, (_, i) => (
        <div
          key={i}
          style={{
            padding: '0.2rem 0.35rem',
            border: '1px dashed var(--border)',
            borderRadius: 4,
            background: 'var(--bg-muted)',
            color: 'var(--text-muted)',
            fontSize: '0.7rem',
            fontWeight: 600,
            lineHeight: 1.2,
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          busy
        </div>
      ))}
      {info.count > 6 ? (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          +{info.count - 6} more
        </div>
      ) : null}
    </div>
  )
}

export function HubPeopleDayCell({
  personUserId,
  workDate,
  scheduleTodayYmd,
  columnFocusDayYmd,
  cellBlocks,
  canEdit,
  cardPlacementMode,
  placementSourceWorkDate,
  plusMenuBlockId,
  onPlusMenuBlockIdChange,
  onStartCardPlacement,
  onCardPlacementCellPick,
  onRequestMoveBlock,
  tapGripToMove = false,
  groupMemberCountByGroupId,
  blockCoverageByKey,
  getJobDisplayTitle,
  getJobAddress,
  onOpenJob,
  onOpenHubJobDetail,
  highlightLinkedGroups,
  linkedGroupAccentByGroupId,
  onOpenLinkedGroup,
  hubAssignJobPlacement,
  onHubAssignJobCellPick,
  onDeleteBlock,
  onEmptyCellClick,
  onAddJobToScheduleForCell,
  hubMultiCellAddActive,
  hubMultiCellAddSelectedKeys,
  onHubMultiCellAddToggle,
  onRequestEditBlockNote,
  onOpenPersonDay,
  timeOffInfo,
  lateInfo,
  onRequestUndoNotComingIn,
  onMarkNotComingInForCell,
  hiddenInfo = null,
  subBadge = null,
  linkedCopyMode = null,
  onLinkedCopyToggleBlock,
  isBottomRow = false,
}: {
  personUserId: string
  workDate: string
  scheduleTodayYmd: string
  columnFocusDayYmd: string
  cellBlocks: JobScheduleBlockRow[]
  canEdit: boolean
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  placementSourceWorkDate: string | null
  plusMenuBlockId: string | null
  onPlusMenuBlockIdChange: (blockId: string | null) => void
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: ScheduleDispatchCardPlacementVariant) => void
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
  /** Long-press on a card (phone-first): open the Move sheet for this block. */
  onRequestMoveBlock?: (b: JobScheduleBlockRow) => void
  tapGripToMove?: boolean
  groupMemberCountByGroupId: ReadonlyMap<string, number>
  /** v2.3612 Supervision: covered / unsupervised per linked group or solo block (`blockCoverageKey`). */
  blockCoverageByKey?: ReadonlyMap<string, BlockCoverage>
  getJobDisplayTitle: (jobId: string) => string
  /** Job address for the card's one-line ellipsized subline; empty string when none. */
  getJobAddress?: (jobId: string) => string
  onOpenJob: (jobId: string) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
  highlightLinkedGroups: boolean
  linkedGroupAccentByGroupId: ReadonlyMap<string, LinkedGroupCardAccent>
  onOpenLinkedGroup: (groupId: string) => void
  hubAssignJobPlacement: { jobId: string } | null
  onHubAssignJobCellPick: (assigneeUserId: string, workDate: string) => void
  onDeleteBlock: (id: string) => void
  onEmptyCellClick?: (personUserId: string, workDate: string) => void
  onAddJobToScheduleForCell?: (assigneeUserId: string, workDate: string) => void
  hubMultiCellAddActive: boolean
  hubMultiCellAddSelectedKeys: ReadonlySet<string>
  onHubMultiCellAddToggle?: (personUserId: string, workDate: string) => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  onOpenPersonDay?: (b: JobScheduleBlockRow) => void
  timeOffInfo?: UserTimeOffCellInfo | null
  /** Derived lateness for this person-day (v2.2550); suppressed while a time-off chip shows. */
  lateInfo?: PersonDayLateness | null
  onRequestUndoNotComingIn?: (personUserId: string, workDate: string) => void
  onMarkNotComingInForCell?: (personUserId: string, workDate: string) => void
  /** Blocks on this person-day the viewer's RLS hides (superintendent board) — drawn as grey "busy" placeholders. */
  hiddenInfo?: ScheduleHiddenCell | null
  /** v2.2929: subs definitely on one of this person's jobs that day. */
  subBadge?: SubBadge | null
  linkedCopyMode?: LinkedCopyMode | null
  onLinkedCopyToggleBlock?: (blockId: string) => void
  /** Last grid row closes the orange today-column outline with a bottom edge. */
  isBottomRow?: boolean
}) {
  const cellHasTimeOff = timeOffInfo != null
  const hiddenCount = hiddenInfo?.count ?? 0
  const droppableId = scheduleDispatchCellDroppableId(workDate, personUserId)
  const { isOver, setNodeRef } = useDroppable({ id: droppableId, disabled: cellHasTimeOff })
  const idleBg = scheduleDispatchDayColumnCellIdleBg(workDate, {
    scheduleTodayYmd,
    columnFocusDayYmd,
  })
  const assignJobPickingActive = hubAssignJobPlacement != null && canEdit
  const placementPickingActive = cardPlacementMode != null && canEdit
  const linkedWrongDay =
    cardPlacementMode?.variant === 'linked' &&
    placementSourceWorkDate != null &&
    workDate !== placementSourceWorkDate
  let cellBg = isOver ? 'var(--bg-blue-200)' : idleBg
  if (assignJobPickingActive) {
    cellBg = isOver ? 'var(--bg-green-100)' : 'var(--bg-emerald-tint)'
  } else if (placementPickingActive && linkedWrongDay) {
    cellBg = 'var(--bg-muted)'
  } else if (placementPickingActive && !linkedWrongDay) {
    cellBg = isOver ? 'var(--bg-blue-200)' : 'var(--bg-sky-tint)'
  }
  // Time-off days are not valid scheduling targets in the picker / placement
  // flows: gray them out the same way the existing "linked wrong day" cells
  // do, so they read as "not a target".
  if (cellHasTimeOff && (assignJobPickingActive || placementPickingActive)) {
    cellBg = 'var(--bg-muted)'
  }

  const cellClickable =
    (assignJobPickingActive || placementPickingActive) && !linkedWrongDay && !cellHasTimeOff
  const emptyCellClickable =
    canEdit &&
    cellBlocks.length === 0 &&
    hiddenCount === 0 &&
    onEmptyCellClick != null &&
    !assignJobPickingActive &&
    !placementPickingActive &&
    !hubMultiCellAddActive &&
    linkedCopyMode == null &&
    !cellHasTimeOff
  const multiSelectCellActive =
    hubMultiCellAddActive && canEdit && onHubMultiCellAddToggle != null && !cellHasTimeOff
  const multiSelectKey = hubPersonDayKey(personUserId, workDate)
  const isMultiSelected = hubMultiCellAddSelectedKeys.has(multiSelectKey)
  if (multiSelectCellActive && isMultiSelected) {
    cellBg = isOver ? 'var(--bg-amber-100)' : 'var(--bg-amber-tint)'
  }
  const showCellAddJobTriangle =
    canEdit &&
    onAddJobToScheduleForCell != null &&
    (cellBlocks.length > 0 || hiddenCount > 0) &&
    !assignJobPickingActive &&
    !placementPickingActive &&
    !hubMultiCellAddActive &&
    linkedCopyMode == null &&
    !cellHasTimeOff

  return (
    <td
      ref={setNodeRef}
      onClick={() => {
        if (cellHasTimeOff) return
        if (multiSelectCellActive) {
          onHubMultiCellAddToggle(personUserId, workDate)
          return
        }
        if (assignJobPickingActive) {
          onHubAssignJobCellPick(personUserId, workDate)
          return
        }
        if (placementPickingActive) {
          if (linkedWrongDay) return
          onCardPlacementCellPick(personUserId, workDate)
          return
        }
        if (emptyCellClickable) {
          onEmptyCellClick(personUserId, workDate)
        }
      }}
      style={{
        position: 'relative',
        isolation: 'isolate',
        padding: '0.35rem',
        border: isMultiSelected && multiSelectCellActive ? '2px solid #ca8a04' : '1px solid var(--border)',
        boxShadow: scheduleDispatchTodayColumnBoxShadow(workDate === scheduleTodayYmd, {
          bottom: isBottomRow,
        }),
        verticalAlign: 'top',
        maxWidth: 200,
        maxHeight: 180,
        overflowY: 'auto',
        background: cellBg,
        cursor:
          multiSelectCellActive || cellClickable || emptyCellClickable ? 'pointer' : undefined,
      }}
    >
      {subBadge ? (
        <div
          data-testid="hub-sub-badge"
          title={subBadge.titles.join('\n')}
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'inline-block', marginBottom: 3, padding: '1px 6px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', border: '1px solid var(--border-green)', cursor: 'help' }}
        >
          {subBadge.count === 1 ? 'sub' : `${subBadge.count} subs`}
        </div>
      ) : null}
      {timeOffInfo && cellBlocks.length === 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.35rem',
            pointerEvents: 'none',
          }}
        >
          <span style={{ pointerEvents: 'auto' }}>
            <ScheduleDispatchTimeOffChip
              info={timeOffInfo}
              onClick={
                canEdit &&
                onRequestUndoNotComingIn &&
                (timeOffInfo.variant === 'not_coming_in' || timeOffInfo.variant === 'ncns')
                  ? () => onRequestUndoNotComingIn(personUserId, workDate)
                  : undefined
              }
              interactiveTitle={
                timeOffInfo.variant === 'ncns'
                  ? 'Click to clear the schedule marking (the attendance incident stays on record)'
                  : 'Click to mark as coming in'
              }
            />
          </span>
        </div>
      ) : timeOffInfo ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <ScheduleDispatchTimeOffChip
            info={timeOffInfo}
            onClick={
              canEdit &&
              onRequestUndoNotComingIn &&
              (timeOffInfo.variant === 'not_coming_in' || timeOffInfo.variant === 'ncns')
                ? () => onRequestUndoNotComingIn(personUserId, workDate)
                : undefined
            }
            interactiveTitle={
              timeOffInfo.variant === 'ncns'
                ? 'Click to clear the schedule marking (the attendance incident stays on record)'
                : 'Click to mark as coming in'
            }
          />
        </div>
      ) : lateInfo ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <ScheduleDispatchLateChip info={lateInfo} />
        </div>
      ) : null}
      {cellBlocks.length === 0 ? (
        timeOffInfo ? null : hiddenCount > 0 ? (
          <HubHiddenBusyPlaceholders info={hiddenInfo!} />
        ) : emptyCellClickable ? (
          // Empty person-day: the add affordance is a full-width bar (same action
          // as clicking the cell) instead of the corner triangle used on cells
          // that already have blocks; "off" beside it marks the day not-coming-in.
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
            <button
              type="button"
              aria-label="Add job to schedule for this person and day"
              title="Add job to schedule for this person and day"
              onClick={(e) => {
                e.stopPropagation()
                onEmptyCellClick(personUserId, workDate)
              }}
              style={{
                display: 'block',
                flex: '1 1 auto',
                minWidth: 0,
                padding: '0.1rem 0',
                margin: 0,
                border: 'none',
                borderRadius: 4,
                background: '#1d4ed8',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                lineHeight: 1.2,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
              }}
            >
              +
            </button>
            {onMarkNotComingInForCell ? (
              <button
                type="button"
                aria-label="Mark as not coming in this day"
                title="Mark as not coming in this day"
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkNotComingInForCell(personUserId, workDate)
                }}
                style={{
                  flex: '0 0 auto',
                  padding: '0.1rem 0.45rem',
                  margin: 0,
                  border: 'none',
                  borderRadius: 4,
                  background: '#ea580c',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
                }}
              >
                off
              </button>
            ) : null}
          </div>
        ) : (
          <span style={{ color: 'var(--text-faint-300)' }}>—</span>
        )
      ) : (
        cellBlocks.map((b) => {
          const g = b.shared_block_group_id
          const linkPeerCount = g ? groupMemberCountByGroupId.get(g) ?? 0 : 0
          const coverage = blockCoverageByKey?.get(blockCoverageKey(b)) ?? null
          return (
            <HubPeopleBlockCard
              key={b.id}
              block={b}
              coverage={coverage}
              linkedCopyStage={linkedCopyMode?.stage ?? null}
              linkedCopySelected={linkedCopyMode?.selectedBlockIds.has(b.id) ?? false}
              onLinkedCopyToggle={onLinkedCopyToggleBlock}
              workDate={workDate}
              scheduleTodayYmd={scheduleTodayYmd}
              canEdit={canEdit}
              hubMultiCellAddActive={hubMultiCellAddActive}
              linkPeerCount={linkPeerCount}
              highlightLinkedGroups={highlightLinkedGroups}
              linkedGroupAccentByGroupId={linkedGroupAccentByGroupId}
              onOpenLinkedGroup={onOpenLinkedGroup}
              cardPlacementMode={cardPlacementMode}
              plusMenuOpen={plusMenuBlockId === b.id}
              onPlusMenuBlockIdChange={onPlusMenuBlockIdChange}
              onStartCardPlacement={onStartCardPlacement}
              getJobDisplayTitle={getJobDisplayTitle}
              getJobAddress={getJobAddress}
              onOpenJob={onOpenJob}
              onOpenHubJobDetail={onOpenHubJobDetail}
              onDeleteBlock={onDeleteBlock}
              onRequestEditBlockNote={onRequestEditBlockNote}
              onOpenPersonDay={onOpenPersonDay}
              onRequestMoveBlock={onRequestMoveBlock}
              tapGripToMove={tapGripToMove}
            />
          )
        })
      )}
      {cellBlocks.length > 0 && hiddenCount > 0 ? <HubHiddenBusyPlaceholders info={hiddenInfo!} /> : null}
      {showCellAddJobTriangle ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: 24,
            height: 24,
            zIndex: 6,
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            aria-label="Add job to schedule for this person and day"
            title="Add job to schedule for this person and day"
            onClick={(e) => {
              e.stopPropagation()
              onAddJobToScheduleForCell(personUserId, workDate)
            }}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              height: '100%',
              padding: 0,
              margin: 0,
              border: 'none',
              cursor: 'pointer',
              clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
              background: '#1d4ed8',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-start',
              paddingLeft: 3,
              paddingBottom: 2,
              fontFamily: 'inherit',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
            }}
          >
            +
          </button>
        </div>
      ) : null}
    </td>
  )
}

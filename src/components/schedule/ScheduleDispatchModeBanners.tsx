import type { ScheduleDispatchCardPlacementMode } from './ScheduleDispatchGrid'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { buildMoveDayChips } from '../../lib/scheduleDispatchMoveBlock'
import type { LinkedCopyMode } from '../../lib/scheduleDispatchLinkedCopy'

/**
 * The Dispatch hub's mode banners (the SCHEDULE_DISPATCH map's step 5): the strip above the board
 * while a block is being moved or copied (with the move's day chips), the two-stage linked-copy
 * strip, and the assign-placement strip, each hidden while the phone board is up. Moved verbatim
 * from `ScheduleDispatchHubPage`, which still owns every mode and every handler; these only draw
 * them and call back. The floating multi-cell "Choose job" bar is `ScheduleDispatchMultiCellBar`
 * below, mounted where it always was, after the board.
 */
export type ScheduleDispatchModeBannersProps = {
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  linkedCopyMode: LinkedCopyMode | null
  linkedCopyApplyBusy: boolean
  hubAssignJobPlacement: { jobId: string } | null
  /** The page's phone board (quirk #17): every banner hides while it is up. */
  phoneBoardActive: boolean
  /** The block being moved or copied, when it is on the board this week. */
  placementSourceBlock: JobScheduleBlockRow | null
  visibleDayKeys: string[]
  getHubJobDisplayTitle: (anchorId: string) => string
  onCardPlacementPickCell: (assigneeUserId: string, workDate: string) => Promise<void>
  /** The banners only ever clear the modes, so these take nothing but null. */
  setCardPlacementMode: (next: null) => void
  setPlusMenuBlockId: (next: null) => void
  setLinkedCopyMode: (next: null) => void
  onLinkedCopySetStage: (stage: 1 | 2) => void
  onCancelHubAssignJobPlacement: () => void
}

export function ScheduleDispatchModeBanners({
  cardPlacementMode,
  linkedCopyMode,
  linkedCopyApplyBusy,
  hubAssignJobPlacement,
  phoneBoardActive,
  placementSourceBlock,
  visibleDayKeys,
  getHubJobDisplayTitle,
  onCardPlacementPickCell,
  setCardPlacementMode,
  setPlusMenuBlockId,
  setLinkedCopyMode,
  onLinkedCopySetStage,
  onCancelHubAssignJobPlacement,
}: ScheduleDispatchModeBannersProps) {
  return (
    <>
        {cardPlacementMode && !phoneBoardActive ? (
          <div
            style={{
              margin: '0 1.25rem',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-blue-200)',
              border: '1px solid var(--border-indigo)',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: 'var(--text-blue-900)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {cardPlacementMode.variant === 'move' ? (
              <>
                <span style={{ flexBasis: '100%' }}>
                  Moving{' '}
                  <strong>
                    {placementSourceBlock ? getHubJobDisplayTitle(scheduleBlockAnchorId(placementSourceBlock)) : 'this block'}
                  </strong>
                  {placementSourceBlock
                    ? ` (${scheduleFormatWindow(placementSourceBlock.time_start, placementSourceBlock.time_end)})`
                    : ''}
                  . Tap a day, or a person&apos;s cell.
                </span>
                {placementSourceBlock ? (
                  <div role="group" aria-label="Move to day" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                    {buildMoveDayChips(visibleDayKeys, placementSourceBlock.work_date).map((chip) => (
                      <button
                        key={chip.ymd}
                        type="button"
                        disabled={chip.isSource}
                        aria-label={chip.isSource ? `${chip.weekday} ${chip.date} (where it is now)` : `Move to ${chip.weekday} ${chip.date}`}
                        onClick={() => void onCardPlacementPickCell(placementSourceBlock.assignee_user_id, chip.ymd)}
                        style={{
                          font: 'inherit',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.35rem 0.6rem',
                          borderRadius: 8,
                          border: chip.isSource ? '1.5px dashed var(--border-strong)' : '1.5px solid var(--text-link)',
                          background: chip.isSource ? 'transparent' : 'var(--surface)',
                          color: chip.isSource ? 'var(--text-muted)' : 'var(--text-link)',
                          cursor: chip.isSource ? 'default' : 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          lineHeight: 1.15,
                          minWidth: 46,
                        }}
                      >
                        <span>{chip.weekday}</span>
                        <span style={{ fontSize: '0.66rem', fontWeight: 500 }}>{chip.date}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <span>
                Adding a <strong>{cardPlacementMode.variant === 'linked' ? 'linked' : 'solo'}</strong> copy from{' '}
                {placementSourceBlock
                  ? scheduleFormatWindow(placementSourceBlock.time_start, placementSourceBlock.time_end)
                  : 'this block'}
                . Click a team member&apos;s day cell
                {cardPlacementMode.variant === 'linked'
                  ? ` on ${placementSourceBlock?.work_date ?? 'that day'}.`
                  : '.'}{' '}
                Press Esc to cancel.
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setCardPlacementMode(null)
                setPlusMenuBlockId(null)
              }}
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                border: '1px solid #4338ca',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text-blue-900)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        {linkedCopyMode && !phoneBoardActive ? (
          <div
            role="status"
            style={{
              margin: '0 1.25rem',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-blue-200)',
              border: '1px solid var(--border-indigo)',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: 'var(--text-blue-900)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {linkedCopyMode.stage === 1 ? (
              <>
                <span>
                  <strong>1 of 2</strong> — Click the job blocks you want to copy linked (
                  {linkedCopyMode.selectedBlockIds.size} selected). Press Esc to cancel.
                </span>
                <button
                  type="button"
                  disabled={linkedCopyMode.selectedBlockIds.size === 0}
                  onClick={() => onLinkedCopySetStage(2)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.75rem',
                    border: '1px solid #4338ca',
                    borderRadius: 4,
                    background:
                      linkedCopyMode.selectedBlockIds.size === 0 ? 'var(--bg-muted)' : '#4338ca',
                    color: linkedCopyMode.selectedBlockIds.size === 0 ? 'var(--text-muted)' : '#fff',
                    cursor: linkedCopyMode.selectedBlockIds.size === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Next: pick people
                </button>
              </>
            ) : (
              <>
                <span>
                  <strong>2 of 2</strong> — Click the people to apply{' '}
                  <strong>{linkedCopyMode.selectedBlockIds.size}</strong> linked{' '}
                  {linkedCopyMode.selectedBlockIds.size === 1 ? 'copy' : 'copies'} to
                  {linkedCopyApplyBusy ? ' (applying…)' : ''}. Each copy lands on its source
                  block&apos;s day. In the swim-lanes grouping, clicking a lane heading applies
                  to the whole crew. Press Esc when done.
                </span>
                <button
                  type="button"
                  onClick={() => onLinkedCopySetStage(1)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.75rem',
                    border: '1px solid #4338ca',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    color: 'var(--text-blue-900)',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setLinkedCopyMode(null)}
                  style={{
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.75rem',
                    border: '1px solid #4338ca',
                    borderRadius: 4,
                    background: '#4338ca',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Done
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setLinkedCopyMode(null)}
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                border: '1px solid #4338ca',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text-blue-900)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
        {hubAssignJobPlacement && !phoneBoardActive ? (
          <div
            style={{
              margin: '0 1.25rem',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-emerald-tint)',
              border: '1px solid #6ee7b7',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: 'var(--text-emerald-800)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>
              Placing schedule for <strong>{getHubJobDisplayTitle(hubAssignJobPlacement.jobId)}</strong>. Click a
              person&apos;s day cell. Press Esc to cancel.
            </span>
            <button
              type="button"
              onClick={() => onCancelHubAssignJobPlacement()}
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                border: '1px solid #047857',
                borderRadius: 4,
                background: 'var(--surface)',
                color: 'var(--text-emerald-800)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
    </>
  )
}

export type ScheduleDispatchMultiCellBarProps = {
  hubMultiCellAddActive: boolean
  /** The job picker the bar opens; the bar steps aside while it is up. */
  hubAssignJobPickerOpen: boolean
  hubMultiCellAddSelection: ReadonlySet<string>
  onRequestHubMultiCellAddChooseJob: () => void
}

/** The floating "Choose job for multi-cell add" bar, at the foot of the screen while cells are being picked. */
export function ScheduleDispatchMultiCellBar({
  hubMultiCellAddActive,
  hubAssignJobPickerOpen,
  hubMultiCellAddSelection,
  onRequestHubMultiCellAddChooseJob,
}: ScheduleDispatchMultiCellBarProps) {
  return (
    <>
        {hubMultiCellAddActive && !hubAssignJobPickerOpen ? (
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1002,
              display: 'flex',
              justifyContent: 'center',
              padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
              pointerEvents: 'none',
            }}
          >
            <button
              type="button"
              disabled={hubMultiCellAddSelection.size === 0}
              onClick={onRequestHubMultiCellAddChooseJob}
              style={{
                pointerEvents: 'auto',
                padding: '0.65rem 1.25rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 8,
                background: hubMultiCellAddSelection.size === 0 ? '#9ca3af' : '#2563eb',
                color: '#fff',
                cursor: hubMultiCellAddSelection.size === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              }}
            >
              Choose job for multi-cell add
              {hubMultiCellAddSelection.size > 0 ? ` (${hubMultiCellAddSelection.size})` : ''}
            </button>
          </div>
        ) : null}
    </>
  )
}

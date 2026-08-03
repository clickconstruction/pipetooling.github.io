import { Fragment, memo, useMemo, type CSSProperties, type ReactNode } from 'react'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToHHmm,
  dispatchMinutesToSlotIndex,
  dispatchSlotIndexToMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
} from '../../lib/dispatchAddBlockTime'
import {
  DISPATCH_ADD_BLOCK_ORIENTATION_MARKS,
  DispatchAddBlockTimeRange,
  dispatchAddBlockTrackThumbLeftPct,
  type DispatchOccupiedBand,
  type DispatchSecondaryBand,
} from './DispatchAddBlockTimeRange'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import { segmentsToOccupiedBands } from '../../lib/quickfillScheduleSegments'
import type { BoundaryDot } from '../../lib/dayScheduleDotDrag'

/** Matches per-row name column so shared 8 AM / 12 PM / 4 PM labels align with each timeline. */
export const QUICKFILL_SCHEDULE_NAME_COL_WIDTH = 'clamp(5.5rem, 24vw, 8.5rem)'
export const QUICKFILL_SCHEDULE_ADD_COL_WIDTH = '2rem'
export const QUICKFILL_SCHEDULE_ROW_GAP = '0.5rem'

const noopSlot = () => {}

/**
 * Renders the shared "8 AM / 12 PM / 4 PM" orientation labels above one or more
 * `QuickfillScheduleUserRow` strips, using the same flex layout (leading name
 * column spacer and optional trailing add-column spacer) so the labels line up
 * with the slider track underneath.
 */
export function QuickfillScheduleOrientationLabelsRow({
  showNameColumn,
  showAddColumn = false,
  marginBottom = '0.15rem',
  railTrimWindow,
}: {
  /** Mirrors the strip's `showNameColumn`. When true, inserts a leading spacer. */
  showNameColumn: boolean
  /** Mirrors the presence of `onScheduleAddClick`. When true, inserts a trailing spacer. */
  showAddColumn?: boolean
  marginBottom?: CSSProperties['marginBottom']
  /** Mirrors `<QuickfillScheduleUserRow railTrimWindow>` so the shared
      header labels track the same rescale as the strips below. Default
      `undefined` keeps existing un-rescaled positions; `null` (empty
      view) renders no labels because the strip has nothing to align to. */
  railTrimWindow?: { loSlotIndex: number; hiSlotIndex: number } | null
}) {
  const slotCount = DISPATCH_ADD_BLOCK_SLOT_COUNT
  const maxIdx = slotCount - 1
  const visibleMarks =
    railTrimWindow === null
      ? []
      : DISPATCH_ADD_BLOCK_ORIENTATION_MARKS.filter((m) => {
          if (m.slotIndex > maxIdx) return false
          if (!railTrimWindow) return true
          const lo = Math.max(0, Math.min(railTrimWindow.loSlotIndex, maxIdx))
          const hi = Math.max(lo, Math.min(railTrimWindow.hiSlotIndex, maxIdx))
          return m.slotIndex >= lo && m.slotIndex <= hi
        })
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: QUICKFILL_SCHEDULE_ROW_GAP,
        width: '100%',
        marginBottom,
        pointerEvents: 'none',
      }}
    >
      {showNameColumn ? (
        <div style={{ width: QUICKFILL_SCHEDULE_NAME_COL_WIDTH, flexShrink: 0 }} />
      ) : null}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          height: 12,
        }}
      >
        {visibleMarks.map(({ slotIndex, label }) => (
          <span
            key={slotIndex}
            style={{
              position: 'absolute',
              left: dispatchAddBlockTrackThumbLeftPct(slotIndex, slotCount, railTrimWindow),
              transform: 'translateX(-50%)',
              fontSize: '0.65rem',
              color: 'var(--text-faint)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        ))}
      </div>
      {showAddColumn ? (
        <div style={{ width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH, flexShrink: 0 }} />
      ) : null}
    </div>
  )
}

export const QuickfillScheduleUserRow = memo(function QuickfillScheduleUserRow({
  userId,
  displayName,
  scheduleDayYmd,
  segments,
  secondaryBands,
  onScheduleAddClick,
  onReorderClick,
  onOpenMyTimeForSessionStrip,
  onOpenPersonMyTime,
  onNameColumnClick,
  onOccupiedBandClick,
  showNameColumn = true,
  nameColumnLabel,
  nameColumnSubline,
  compactRow = false,
  railTrimWindow,
  nameColumnIndent = false,
  travelGapChips,
  sharedDotWarnings,
  boundaryDots,
  onBoundaryDotDrag,
  onBoundaryDotDragEnd,
  onSharedDotSeparate,
  agendaVariant = false,
}: {
  userId: string
  displayName: string
  /** Calendar day for this row (YYYY-MM-DD); used for name-button accessibility when opening My Time. */
  scheduleDayYmd: string
  segments: AddBlockTimelineSegment[]
  secondaryBands?: DispatchSecondaryBand[]
  onScheduleAddClick?: () => void
  /** Day view, editors with 2+ blocks: opens the Reorder-day modal. Renders a ⇅ button stacked under the + (same column, so orientation labels stay aligned). */
  onReorderClick?: () => void
  onOpenMyTimeForSessionStrip?: (uid: string, name: string) => void
  /** Opens My Time day editor (NCNS / Not coming in) from the person name — same handler as strip when provided. */
  onOpenPersonMyTime?: (uid: string, name: string) => void
  /** Generic name-column click handler. When provided, takes precedence over
      `onOpenPersonMyTime`: the name column renders as a button calling this
      handler with neutral title / aria copy. Used by the User Review modal's
      Week / Month day rows to surface the per-day Summary modal instead of
      jumping straight to My Time. */
  onNameColumnClick?: (uid: string, name: string) => void
  onOccupiedBandClick?: (band: DispatchOccupiedBand) => void
  /** When false, only the track (+ optional add column) is shown; use when the name is shown elsewhere (e.g. modal title). */
  showNameColumn?: boolean
  /** Visible text override for the leading name column. Defaults to `displayName`.
      The underlying My-Time button, title, aria-label, and groupAriaLabel still use displayName. */
  nameColumnLabel?: string
  /** Optional softer subline rendered below `nameColumnLabel` in the leading name column.
      Used by the User Review modal's Week/Month day rows to surface a relative-day phrase
      like "(3 days ago)" under "Sat · 05/16". When the name column is rendered as a button,
      the subline sits inside the same button so the entire chip remains one click target. */
  nameColumnSubline?: ReactNode
  /** When true, the row uses tighter vertical padding (0.15rem 0) and drops the
      bottom hairline. Used by surfaces that already provide their own separation
      (e.g. the User Review modal's week-mode day list, which uses grid gap). */
  compactRow?: boolean
  /** Clips the underlying grey rail to a slot window (or hides it when `null`).
      Threaded directly into `<DispatchAddBlockTimeRange railTrimWindow>`. Used
      by the User Review modal to align rails across rows; default-undefined
      preserves Quickfill / Schedule Dispatch full-rail behavior. */
  railTrimWindow?: { loSlotIndex: number; hiSlotIndex: number } | null
  /** Indent the name column (Day view: names sit right of the flush-left role headings). */
  nameColumnIndent?: boolean
  /** Day-view boundary dots + drag callbacks (editors only) — threaded into the range control. */
  boundaryDots?: BoundaryDot[]
  onBoundaryDotDrag?: (dot: BoundaryDot, targetMinutes: number) => void
  onBoundaryDotDragEnd?: () => void
  onSharedDotSeparate?: (dot: Extract<BoundaryDot, { kind: 'shared' }>) => void
  /** Travel estimates (Day view): chips in the gaps + red shared dots for infeasible back-to-backs. */
  travelGapChips?: Array<{
    id: string
    gapStartMin: number
    gapEndMin: number
    label: string
    title: string
    severity: 'ok' | 'tight'
  }>
  sharedDotWarnings?: ReadonlyMap<string, string>
  /** Phone agenda rendering (v2.1350): text-first time-chip rows instead of the
      proportional track. Boundary-dot dragging is not rendered in this mode —
      block edits go through the band tap / add / reorder affordances. */
  agendaVariant?: boolean
}) {
  const occupiedBands = useMemo(() => segmentsToOccupiedBands(segments), [segments])

  const { startSlotIndex, endSlotIndex } = useMemo(() => {
    const def = defaultNewBlockRangeInFirstGap({ segments, draftByBlockId: {} })
    if (def) {
      return {
        startSlotIndex: dispatchMinutesToSlotIndex(def.startMin),
        endSlotIndex: dispatchMinutesToSlotIndex(def.endMin),
      }
    }
    return {
      startSlotIndex: dispatchMinutesToSlotIndex(timeInputToMinutesSafe('08:00')),
      endSlotIndex: dispatchMinutesToSlotIndex(timeInputToMinutesSafe('16:00')),
    }
  }, [segments])

  if (agendaVariant) {
    return (
      <QuickfillScheduleUserAgendaRow
        userId={userId}
        displayName={displayName}
        scheduleDayYmd={scheduleDayYmd}
        segments={segments}
        occupiedBands={occupiedBands}
        secondaryBands={secondaryBands}
        travelGapChips={travelGapChips}
        onScheduleAddClick={onScheduleAddClick}
        onReorderClick={onReorderClick}
        onOpenMyTimeForSessionStrip={onOpenMyTimeForSessionStrip}
        onOpenPersonMyTime={onOpenPersonMyTime}
        onOccupiedBandClick={onOccupiedBandClick}
        nameColumnIndent={nameColumnIndent}
      />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: QUICKFILL_SCHEDULE_ROW_GAP,
        padding: compactRow ? '0.15rem 0' : '0.45rem 0',
        borderBottom: compactRow ? 'none' : '1px solid var(--border)',
      }}
    >
      {showNameColumn ? (
        <div
          style={{
            width: QUICKFILL_SCHEDULE_NAME_COL_WIDTH,
            flexShrink: 0,
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text-strong)',
            whiteSpace: 'normal',
            overflow: 'hidden',
            lineHeight: 1.2,
            padding: nameColumnIndent ? '0.15rem 0.25rem 0.15rem 1rem' : '0.15rem 0.25rem',
          }}
        >
          {onNameColumnClick ? (
            <button
              type="button"
              onClick={() => onNameColumnClick(userId, displayName)}
              title={`Open day summary for ${displayName} (${scheduleDayYmd})`}
              aria-label={`Open day summary for ${displayName} on ${scheduleDayYmd}`}
              style={{
                display: 'block',
                width: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'none',
                font: 'inherit',
                fontWeight: 600,
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                whiteSpace: 'normal',
              }}
            >
              {nameColumnLabel ?? displayName}
              {nameColumnSubline}
            </button>
          ) : onOpenPersonMyTime ? (
            <button
              type="button"
              onClick={() => onOpenPersonMyTime(userId, displayName)}
              title={`Time and attendance for ${displayName} (${scheduleDayYmd})`}
              aria-label={`Time and attendance for ${displayName} on ${scheduleDayYmd}`}
              style={{
                display: 'block',
                width: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'none',
                font: 'inherit',
                fontWeight: 600,
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                whiteSpace: 'normal',
              }}
            >
              {nameColumnLabel ?? displayName}
              {nameColumnSubline}
            </button>
          ) : (
            <>
              {nameColumnLabel ?? displayName}
              {nameColumnSubline}
            </>
          )}
        </div>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <DispatchAddBlockTimeRange
          compact
          showOrientationLabels={false}
          showProposedRange={false}
          slotCount={DISPATCH_ADD_BLOCK_SLOT_COUNT}
          startSlotIndex={startSlotIndex}
          endSlotIndex={endSlotIndex}
          onStartChange={noopSlot}
          onEndChange={noopSlot}
          formatAriaValue={(i) =>
            formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dispatchSlotIndexToMinutes(i)))
          }
          disabled
          groupAriaLabel={`${displayName}: scheduled blocks preview (read-only), 30-minute steps from 4:00 AM to 8:00 PM Central${
            secondaryBands?.length
              ? ` Includes ${secondaryBands.length} clock session${secondaryBands.length === 1 ? '' : 's'}.`
              : ''
          }`}
          occupiedBands={occupiedBands.length > 0 ? occupiedBands : undefined}
          boundaryDots={boundaryDots}
          onBoundaryDotDrag={onBoundaryDotDrag}
          onBoundaryDotDragEnd={onBoundaryDotDragEnd}
          onSharedDotSeparate={onSharedDotSeparate}
          travelGapChips={travelGapChips}
          sharedDotWarnings={sharedDotWarnings}
          secondaryBands={secondaryBands}
          onSecondaryBandClick={
            onOpenMyTimeForSessionStrip && (secondaryBands?.length ?? 0) > 0
              ? () => onOpenMyTimeForSessionStrip(userId, displayName)
              : undefined
          }
          onOccupiedBandClick={onOccupiedBandClick}
          railTrimWindow={railTrimWindow}
        />
      </div>
      {onScheduleAddClick ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onScheduleAddClick}
            title={`Add job to schedule for ${displayName}`}
            aria-label={`Add schedule block for ${displayName} on this day`}
            style={{
              width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
              height: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
              padding: 0,
              margin: 0,
              border: 'none',
              borderRadius: 6,
              background: 'var(--bg-muted)',
              color: 'var(--text-faint)',
              fontSize: '1.125rem',
              fontWeight: 600,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
          {onReorderClick ? (
            <button
              type="button"
              onClick={onReorderClick}
              title={`Reorder ${displayName}'s jobs for this day`}
              aria-label={`Reorder ${displayName}'s jobs on this day`}
              style={{
                width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
                height: QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
                padding: 0,
                margin: 0,
                border: 'none',
                borderRadius: 6,
                background: 'var(--bg-muted)',
                color: 'var(--text-faint)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ⇅
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})

/** "8:00 AM" → "8a" · "12:30 PM" → "12:30p" — compact chip times for the agenda rows. */
function agendaShortTime(hhmm: string): string {
  const full = formatDispatchQuickTimeLabel(hhmm)
  return full.replace(':00', '').replace(' AM', 'a').replace(' PM', 'p')
}

const AGENDA_SMALL_BUTTON: CSSProperties = {
  width: '1.75rem',
  height: '1.75rem',
  padding: 0,
  margin: 0,
  border: 'none',
  borderRadius: 6,
  background: 'var(--bg-muted)',
  color: 'var(--text-faint)',
  fontWeight: 600,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/**
 * Phone agenda rendering of one person's day (v2.1350): name + "8a–4p · N stops"
 * summary line with the +/⇅ actions, then one text row per scheduled block
 * (orange time chip → same onOccupiedBandClick as the track band), travel-gap
 * chips interleaved by time, and a teal "Clocked" row per clock-session strip
 * (→ My Time, same as tapping the strip). No proportional track, no drag dots.
 */
function QuickfillScheduleUserAgendaRow({
  userId,
  displayName,
  scheduleDayYmd,
  segments,
  occupiedBands,
  secondaryBands,
  travelGapChips,
  onScheduleAddClick,
  onReorderClick,
  onOpenMyTimeForSessionStrip,
  onOpenPersonMyTime,
  onOccupiedBandClick,
  nameColumnIndent,
}: {
  userId: string
  displayName: string
  scheduleDayYmd: string
  segments: AddBlockTimelineSegment[]
  occupiedBands: DispatchOccupiedBand[]
  secondaryBands?: DispatchSecondaryBand[]
  travelGapChips?: Array<{ id: string; gapStartMin: number; gapEndMin: number; label: string; title: string; severity: 'ok' | 'tight' }>
  onScheduleAddClick?: () => void
  onReorderClick?: () => void
  onOpenMyTimeForSessionStrip?: (uid: string, name: string) => void
  onOpenPersonMyTime?: (uid: string, name: string) => void
  onOccupiedBandClick?: (band: DispatchOccupiedBand) => void
  nameColumnIndent?: boolean
}) {
  const sorted = useMemo(
    () => [...segments].sort((a, b) => timeInputToMinutesSafe(a.time_start) - timeInputToMinutesSafe(b.time_start)),
    [segments],
  )
  const summary = useMemo(() => {
    if (sorted.length === 0) return null
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (!first || !last) return null
    const stops = sorted.length
    return `${agendaShortTime(first.time_start)}–${agendaShortTime(last.time_end)} · ${stops} ${stops === 1 ? 'stop' : 'stops'}`
  }, [sorted])
  const bandByBlockId = useMemo(() => {
    const m = new Map<string, DispatchOccupiedBand>()
    for (const b of occupiedBands) m.set(b.blockId, b)
    return m
  }, [occupiedBands])
  const chipsAfterBlockId = useMemo(() => {
    const m = new Map<string, Array<{ id: string; label: string; title: string; severity: 'ok' | 'tight' }>>()
    for (const chip of travelGapChips ?? []) {
      // Attach each travel chip to the block whose end matches the gap start.
      const before = sorted.find((s) => timeInputToMinutesSafe(s.time_end) === chip.gapStartMin)
      if (!before) continue
      const list = m.get(before.blockId) ?? []
      list.push({ id: chip.id, label: chip.label, title: chip.title, severity: chip.severity })
      m.set(before.blockId, list)
    }
    return m
  }, [travelGapChips, sorted])
  const clockedStrips = secondaryBands ?? []
  const isFree = sorted.length === 0 && clockedStrips.length === 0

  return (
    <div
      style={{
        padding: '0.45rem 0',
        paddingLeft: nameColumnIndent ? '1rem' : 0,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {onOpenPersonMyTime ? (
          <button
            type="button"
            onClick={() => onOpenPersonMyTime(userId, displayName)}
            title={`Time and attendance for ${displayName} (${scheduleDayYmd})`}
            aria-label={`Time and attendance for ${displayName} on ${scheduleDayYmd}`}
            style={{ margin: 0, padding: 0, border: 'none', background: 'none', font: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-strong)', cursor: 'pointer', textAlign: 'left' }}
          >
            {displayName}
          </button>
        ) : (
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-strong)' }}>{displayName}</span>
        )}
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isFree ? 'Free' : summary}
        </span>
        {onScheduleAddClick ? (
          <button type="button" onClick={onScheduleAddClick} title={`Add job to schedule for ${displayName}`} aria-label={`Add schedule block for ${displayName} on this day`} style={{ ...AGENDA_SMALL_BUTTON, fontSize: '1rem' }}>
            +
          </button>
        ) : null}
        {onReorderClick ? (
          <button type="button" onClick={onReorderClick} title={`Reorder ${displayName}'s jobs for this day`} aria-label={`Reorder ${displayName}'s jobs on this day`} style={{ ...AGENDA_SMALL_BUTTON, fontSize: '0.875rem' }}>
            ⇅
          </button>
        ) : null}
      </div>
      {sorted.map((seg) => {
        const band = bandByBlockId.get(seg.blockId)
        const chips = chipsAfterBlockId.get(seg.blockId) ?? []
        const timeChip = `${agendaShortTime(seg.time_start)}–${agendaShortTime(seg.time_end)}`
        const rowInner = (
          <>
            <span style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: 600, background: '#fed7aa', color: 'var(--text-orange-800)', borderRadius: 6, padding: '0.15rem 0.5rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {timeChip}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
              {seg.label}
            </span>
            {seg.shared_block_group_id ? (
              <span aria-hidden title="Linked crew block — legs move together" style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-orange-800)' }}>
                ⛓
              </span>
            ) : null}
          </>
        )
        return (
          <Fragment key={seg.blockId}>
            {band && onOccupiedBandClick ? (
              <button
                type="button"
                onClick={() => onOccupiedBandClick(band)}
                title={`${seg.label} — open in Schedule Dispatch`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', margin: 0, marginTop: '0.35rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
              >
                {rowInner}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>{rowInner}</div>
            )}
            {chips.map((chip) => (
              <div key={chip.id} title={chip.title} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', paddingLeft: '0.35rem', fontSize: '0.7rem', color: chip.severity === 'tight' ? 'var(--text-red-600)' : 'var(--text-muted)' }}>
                <span aria-hidden>⇢</span>
                {chip.label}
                {chip.severity === 'tight' ? ' — tight' : ''}
              </div>
            ))}
          </Fragment>
        )
      })}
      {clockedStrips.map((strip) => {
        const stripLabel = strip.displayLabel ?? strip.label ?? 'Clock session'
        const inner = (
          <>
            <span style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', borderRadius: 6, padding: '0.15rem 0.5rem', whiteSpace: 'nowrap' }}>
              Clocked
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
              {stripLabel}
            </span>
          </>
        )
        return onOpenMyTimeForSessionStrip ? (
          <button
            key={strip.id}
            type="button"
            onClick={() => onOpenMyTimeForSessionStrip(userId, displayName)}
            title={`Open My Time for ${displayName}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', margin: 0, marginTop: '0.35rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            {inner}
          </button>
        ) : (
          <div key={strip.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

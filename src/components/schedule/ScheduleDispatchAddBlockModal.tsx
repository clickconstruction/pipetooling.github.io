import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  clampDispatchEndStartForMinDuration,
  clampDispatchStartEndForMinDuration,
  dispatchMinutesToHHmm,
  dispatchMinutesToSlotIndex,
  dispatchSlotIndexToMinutes,
  formatBlockDurationAriaLabel,
  formatBlockDurationMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
} from '../../lib/dispatchAddBlockTime'
import {
  applySegmentMoveToAbsoluteStart,
  clampNewBlockRangeToGaps,
  endDragRangeAcrossGaps,
  gapsFromOccupied,
  occupiedUnionFromSegments,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import { scheduleFormatWeekdayLong } from '../../lib/jobScheduleChicago'
import { DispatchAddBlockTimeRange, type DispatchOccupiedBand } from './DispatchAddBlockTimeRange'

export function ScheduleDispatchAddBlockModal({
  open,
  mode,
  jobTitle,
  personLabel,
  workDate,
  timeStart,
  timeEnd,
  note,
  saving,
  error,
  onClose,
  onChangeStart,
  onChangeEnd,
  onChangeNote,
  onSave,
  addTimeline,
}: {
  open: boolean
  mode: 'add' | 'edit'
  jobTitle: string
  personLabel: string
  workDate: string
  timeStart: string
  timeEnd: string
  note: string
  saving: boolean
  error: string | null
  onClose: () => void
  onChangeStart: (v: string) => void
  onChangeEnd: (v: string) => void
  onChangeNote: (v: string) => void
  onSave: () => void
  addTimeline?: {
    segments: AddBlockTimelineSegment[]
    draftByBlockId: Record<string, { time_start: string; time_end: string }>
    setDraftByBlockId: Dispatch<SetStateAction<Record<string, { time_start: string; time_end: string }>>>
  }
}) {
  const startMin = useMemo(() => timeInputToMinutesSafe(timeStart), [timeStart])
  const endMin = useMemo(() => timeInputToMinutesSafe(timeEnd), [timeEnd])
  const startSlotIndex = useMemo(() => dispatchMinutesToSlotIndex(startMin), [startMin])
  const endSlotIndex = useMemo(() => dispatchMinutesToSlotIndex(endMin), [endMin])

  const occupiedBands = useMemo((): DispatchOccupiedBand[] | undefined => {
    if (mode !== 'add' || !addTimeline?.segments.length) return undefined
    return addTimeline.segments.map((s) => {
      const d = addTimeline.draftByBlockId[s.blockId]
      const ts = (d?.time_start ?? s.time_start).slice(0, 5)
      const te = (d?.time_end ?? s.time_end).slice(0, 5)
      const sm = timeInputToMinutesSafe(ts)
      const em = timeInputToMinutesSafe(te)
      return {
        blockId: s.blockId,
        jobId: s.jobId,
        label: s.label,
        startSlotIndex: dispatchMinutesToSlotIndex(sm),
        endSlotIndex: dispatchMinutesToSlotIndex(em),
      }
    })
  }, [mode, addTimeline?.segments, addTimeline?.draftByBlockId])

  const onOccupiedAbsoluteStart = useCallback(
    (blockId: string, desiredStartMin: number) => {
      if (!addTimeline || mode !== 'add') return
      addTimeline.setDraftByBlockId((prev) => {
        const next = applySegmentMoveToAbsoluteStart({
          segments: addTimeline.segments,
          draftByBlockId: prev,
          seedBlockId: blockId,
          desiredStartMin,
        })
        return next ?? prev
      })
    },
    [addTimeline, mode],
  )

  const addModalTimeRef = useRef({ start: timeStart, end: timeEnd })
  addModalTimeRef.current = { start: timeStart, end: timeEnd }

  useEffect(() => {
    if (mode !== 'add' || !addTimeline) return
    const gaps = gapsFromOccupied(occupiedUnionFromSegments(addTimeline.segments, addTimeline.draftByBlockId))
    const { start: ts, end: te } = addModalTimeRef.current
    const sm = timeInputToMinutesSafe(ts)
    const em = timeInputToMinutesSafe(te)
    const c = clampNewBlockRangeToGaps({ desiredStartMin: sm, desiredEndMin: em, gaps })
    const ns = dispatchMinutesToHHmm(c.startMin)
    const ne = dispatchMinutesToHHmm(c.endMin)
    if (ns !== ts || ne !== te) {
      onChangeStart(ns)
      onChangeEnd(ne)
    }
  }, [mode, addTimeline?.segments, addTimeline?.draftByBlockId, onChangeStart, onChangeEnd])

  const { durationDisplay, durationAriaLabel } = useMemo(() => {
    const dm = endMin > startMin ? endMin - startMin : Number.NaN
    return {
      durationDisplay: formatBlockDurationMinutes(dm),
      durationAriaLabel: formatBlockDurationAriaLabel(dm),
    }
  }, [startMin, endMin])

  const onStartSliderChange = useCallback(
    (slotIndex: number) => {
      const sMin = dispatchSlotIndexToMinutes(slotIndex)
      const eMinCur = timeInputToMinutesSafe(timeEnd)
      let { s, e } = clampDispatchStartEndForMinDuration(sMin, eMinCur)
      if (mode === 'add' && addTimeline) {
        const gaps = gapsFromOccupied(
          occupiedUnionFromSegments(addTimeline.segments, addTimeline.draftByBlockId),
        )
        const c = clampNewBlockRangeToGaps({ desiredStartMin: s, desiredEndMin: e, gaps })
        s = c.startMin
        e = c.endMin
      }
      onChangeStart(dispatchMinutesToHHmm(s))
      onChangeEnd(dispatchMinutesToHHmm(e))
    },
    [timeEnd, onChangeStart, onChangeEnd, mode, addTimeline],
  )

  const onEndSliderChange = useCallback(
    (slotIndex: number) => {
      const eMin = dispatchSlotIndexToMinutes(slotIndex)
      const sMinCur = timeInputToMinutesSafe(timeStart)
      if (mode === 'add' && addTimeline) {
        // End-drag picks its gap by the dragged END point so the block can hop
        // across occupied bands: once the pointer clears a band by the minimum
        // duration, the start jumps to just after the band and the end keeps
        // following the pointer (see endDragRangeAcrossGaps).
        const gaps = gapsFromOccupied(
          occupiedUnionFromSegments(addTimeline.segments, addTimeline.draftByBlockId),
        )
        const c = endDragRangeAcrossGaps({ currentStartMin: sMinCur, desiredEndMin: eMin, gaps })
        onChangeStart(dispatchMinutesToHHmm(c.startMin))
        onChangeEnd(dispatchMinutesToHHmm(c.endMin))
        return
      }
      const { s, e } = clampDispatchEndStartForMinDuration(eMin, sMinCur)
      onChangeStart(dispatchMinutesToHHmm(s))
      onChangeEnd(dispatchMinutesToHHmm(e))
    },
    [timeStart, onChangeStart, onChangeEnd, mode, addTimeline],
  )

  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1002,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="schedule-dispatch-add-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '92%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="schedule-dispatch-add-title"
          style={{
            margin: '0 0 0.75rem',
            fontSize: '1.05rem',
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}
        >
          {mode === 'edit' ? 'Edit schedule block' : 'Add schedule block'}
          {jobTitle.trim() ? (
            <>
              {' '}
              <span aria-hidden>·</span>{' '}
              <span title={jobTitle} style={{ fontSize: '0.9rem', color: 'var(--text-700)', fontWeight: 600 }}>
                {jobTitle}
              </span>
            </>
          ) : null}
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.35, wordBreak: 'break-word' }}>
          <strong>{personLabel}</strong>
          {workDate.trim() ? (
            <>
              {' '}
              <span aria-hidden>·</span>{' '}
              <span title={workDate}>{scheduleFormatWeekdayLong(workDate)}</span>
            </>
          ) : null}
        </p>
        {error ? (
          <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: '0 0 0.75rem', whiteSpace: 'pre-wrap' }}>{error}</p>
        ) : null}
        <div style={{ marginBottom: '0.75rem' }}>
          <DispatchAddBlockTimeRange
            slotCount={DISPATCH_ADD_BLOCK_SLOT_COUNT}
            startSlotIndex={startSlotIndex}
            endSlotIndex={endSlotIndex}
            onStartChange={onStartSliderChange}
            onEndChange={onEndSliderChange}
            formatAriaValue={(i) =>
              formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dispatchSlotIndexToMinutes(i)))
            }
            disabled={saving}
            groupAriaLabel="Scheduled block time, 30-minute steps from 4:00 AM to 8:00 PM Central"
            occupiedBands={occupiedBands}
            onOccupiedAbsoluteStart={mode === 'add' && addTimeline ? onOccupiedAbsoluteStart : undefined}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'flex-end' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: '1 1 120px' }}>
            Start
            <input
              type="time"
              value={timeStart}
              onChange={(e) => onChangeStart(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.35rem' }}
            />
          </label>
          <div
            role="status"
            aria-live="polite"
            aria-label={durationAriaLabel}
            style={{
              flex: '0 0 auto',
              textAlign: 'center',
              minWidth: 72,
              paddingBottom: 2,
            }}
          >
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>Duration</div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-700)',
              }}
            >
              {durationDisplay}
            </div>
          </div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: '1 1 120px' }}>
            End
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => onChangeEnd(e.target.value)}
              style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.35rem' }}
            />
          </label>
        </div>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => onChangeNote(e.target.value)}
            maxLength={500}
            style={{ display: 'block', marginTop: 4, width: '100%', padding: '0.4rem', fontSize: '0.875rem' }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.45rem 1rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave()}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: saving ? 'var(--bg-200)' : '#2563eb',
              color: saving ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

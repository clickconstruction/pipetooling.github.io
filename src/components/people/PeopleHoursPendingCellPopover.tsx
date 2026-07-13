import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { approveClockSessions } from '../../lib/approveClockSessions'
import { supabase } from '../../lib/supabase'
import { shortJobOrBidLabelFromEmbeds } from '../../types/clockSessions'
import type { ClockSessionRow } from '../../types/clockSessions'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import type { PeopleHoursPendingCellEntry } from '../../lib/peopleHoursPendingByCell'

type Props = {
  entry: PeopleHoursPendingCellEntry
  anchorEl: HTMLElement | null
  authUserId: string | null
  canApprove: boolean
  canReject: boolean
  onClose: () => void
  /** Called after a successful approve/reject; parent should reload pending sessions and people_hours. */
  onChanged: () => void
  onError: (message: string) => void
  onShowToast: (message: string, variant: 'success' | 'error' | 'warning' | 'info') => void
  onOpenInMyTime: () => void
}

const POPOVER_WIDTH = 320

export function PeopleHoursPendingCellPopover({
  entry,
  anchorEl,
  authUserId,
  canApprove,
  canReject,
  onClose,
  onChanged,
  onError,
  onShowToast,
  onOpenInMyTime,
}: Props) {
  const prefixMap = useLedgerPrefixMap()
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [busyApprove, setBusyApprove] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (!anchorEl) return
    function place() {
      if (!anchorEl) return
      const rect = anchorEl.getBoundingClientRect()
      const margin = 6
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = rect.right - POPOVER_WIDTH
      if (left < margin) left = margin
      if (left + POPOVER_WIDTH > vw - margin) left = vw - margin - POPOVER_WIDTH
      let top = rect.bottom + margin
      const measuredHeight = popoverRef.current?.offsetHeight ?? 220
      if (top + measuredHeight > vh - margin) {
        const above = rect.top - margin - measuredHeight
        top = above >= margin ? above : Math.max(margin, vh - margin - measuredHeight)
      }
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorEl])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!popoverRef.current) return
      if (popoverRef.current.contains(e.target as Node)) return
      if (anchorEl && anchorEl.contains(e.target as Node)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchorEl, onClose])

  async function handleApproveAll() {
    if (!canApprove || busyApprove || entry.sessionIds.length === 0) return
    setBusyApprove(true)
    const { data, error } = await approveClockSessions(entry.sessionIds)
    setBusyApprove(false)
    if (error) {
      onError(error.message)
      return
    }
    const result = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
    const row = result[0]
    if (row?.error_message) {
      onError(row.error_message)
      return
    }
    onShowToast(
      `Approved ${row?.approved_count ?? entry.sessionIds.length} session(s) — added to payroll`,
      'success',
    )
    onChanged()
    onClose()
  }

  async function handleReject(sessionId: string) {
    if (!canReject || rejectingId) return
    if (rejectConfirmId !== sessionId) {
      setRejectConfirmId(sessionId)
      return
    }
    setRejectingId(sessionId)
    const { error } = await supabase
      .from('clock_sessions')
      .update({ rejected_at: new Date().toISOString(), rejected_by: authUserId })
      .eq('id', sessionId)
    setRejectingId(null)
    setRejectConfirmId(null)
    if (error) {
      onError(error.message)
      return
    }
    onShowToast('Session rejected', 'success')
    onChanged()
    if (entry.sessionIds.length <= 1) onClose()
  }

  if (!anchorEl) return null

  const dayLabel = new Date(entry.workDate + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const node = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Pending sessions for ${entry.personName} on ${dayLabel}`}
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: POPOVER_WIDTH,
        zIndex: 50,
        background: 'var(--surface)',
        border: '1px solid #f59e0b',
        borderRadius: 8,
        boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
        fontSize: '0.8125rem',
        color: 'var(--text-strong)',
        padding: '0.5rem 0.6rem 0.6rem',
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.35rem',
          marginBottom: '0.35rem',
        }}
      >
        <div style={{ fontWeight: 600, lineHeight: 1.2 }}>
          Pending — {entry.personName}, {dayLabel}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '1rem',
            lineHeight: 1,
            padding: '0 0.15rem',
          }}
        >
          ×
        </button>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          maxHeight: 180,
          overflowY: 'auto',
          borderTop: '1px solid #f3f4f6',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        {entry.sessions.map((s) => {
          const inMs = new Date(s.clocked_in_at).getTime()
          const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : inMs
          const dur = Math.max(0, (outMs - inMs) / 3_600_000)
          const label =
            shortJobOrBidLabelFromEmbeds(s as ClockSessionRow, prefixMap) ?? 'No job/bid'
          const confirming = rejectConfirmId === s.id
          const rejecting = rejectingId === s.id
          return (
            <li
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.4rem 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatDenverTimeOnly(inMs)}
                  {' – '}
                  {s.clocked_out_at ? formatDenverTimeOnly(outMs) : '—'}
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                    {dur.toFixed(2)}h
                  </span>
                </div>
                <div
                  style={{
                    color: 'var(--text-700)',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={label}
                >
                  {label}
                </div>
              </div>
              {canReject ? (
                <button
                  type="button"
                  onClick={() => handleReject(s.id)}
                  disabled={rejecting || busyApprove}
                  title={confirming ? 'Click again to confirm reject' : 'Reject this session'}
                  aria-label={confirming ? 'Confirm reject session' : 'Reject session'}
                  style={{
                    flexShrink: 0,
                    padding: '0.15rem 0.45rem',
                    border: '1px solid',
                    borderColor: confirming ? '#dc2626' : '#fca5a5',
                    background: confirming ? 'var(--bg-red-100)' : 'var(--bg-red-tint)',
                    color: 'var(--text-red-700)',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    cursor: rejecting || busyApprove ? 'not-allowed' : 'pointer',
                    opacity: rejecting || busyApprove ? 0.6 : 1,
                  }}
                >
                  {rejecting ? '…' : confirming ? 'Confirm ✕' : '✕'}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      <div style={{ margin: '0.5rem 0 0.6rem', color: 'var(--text-700)', lineHeight: 1.35 }}>
        Approving adds <strong>{entry.pendingHours.toFixed(2)} h</strong> to payroll for this day
        {entry.peopleHoursValue > 0 ? (
          <>
            {' '}
            (currently counts {entry.peopleHoursValue.toFixed(2)} h).
          </>
        ) : (
          <>.</>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
        <button
          type="button"
          onClick={() => {
            onOpenInMyTime()
            onClose()
          }}
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.8125rem',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text-700)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          View in My Time
        </button>
        <button
          type="button"
          onClick={() => void handleApproveAll()}
          disabled={!canApprove || busyApprove}
          style={{
            padding: '0.3rem 0.7rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: '1px solid #15803d',
            background: !canApprove || busyApprove ? '#86efac' : '#22c55e',
            color: 'white',
            borderRadius: 4,
            cursor: !canApprove || busyApprove ? 'not-allowed' : 'pointer',
          }}
          title={
            !canApprove
              ? 'You don’t have permission to approve clock sessions'
              : 'Approve all pending sessions for this day'
          }
        >
          {busyApprove ? 'Approving…' : `Approve all (${entry.count})`}
        </button>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

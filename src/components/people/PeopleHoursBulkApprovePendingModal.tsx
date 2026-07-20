import { useState } from 'react'
import { approveClockSessions } from '../../lib/approveClockSessions'
import { shortJobOrBidLabelFromEmbeds } from '../../types/clockSessions'
import type { ClockSessionRow } from '../../types/clockSessions'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import type { PeopleHoursPendingByCellMap } from '../../lib/peopleHoursPendingByCell'
import { summarizePeopleHoursPendingByCell } from '../../lib/peopleHoursPendingByCell'

type Props = {
  pendingByCellMap: PeopleHoursPendingByCellMap
  onClose: () => void
  onApproved: () => void
  onError: (message: string) => void
  onShowToast: (message: string, variant: 'success' | 'error' | 'warning' | 'info') => void
}

export function PeopleHoursBulkApprovePendingModal({
  pendingByCellMap,
  onClose,
  onApproved,
  onError,
  onShowToast,
}: Props) {
  const prefixMap = useLedgerPrefixMap()
  const [busy, setBusy] = useState(false)
  const summary = summarizePeopleHoursPendingByCell(pendingByCellMap)
  const entries = Array.from(pendingByCellMap.values()).sort((a, b) => {
    if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate)
    return a.personName.localeCompare(b.personName)
  })

  async function handleApproveAll() {
    if (busy || summary.allSessionIds.length === 0) return
    setBusy(true)
    const { data, error } = await approveClockSessions(summary.allSessionIds)
    setBusy(false)
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
      `Approved ${row?.approved_count ?? summary.allSessionIds.length} session(s) — added to payroll`,
      'success',
    )
    onApproved()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Approve pending hours"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1rem 1.1rem',
          width: 'min(560px, 92vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.5rem',
            gap: '0.75rem',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.125rem', lineHeight: 1.2 }}>
            Approve pending hours
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              color: 'var(--text-muted)',
              padding: '0 0.15rem',
            }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.6rem', color: 'var(--text-700)', fontSize: '0.875rem', lineHeight: 1.4 }}>
          <strong>{summary.totalSessions}</strong> closed clock session
          {summary.totalSessions === 1 ? '' : 's'} across{' '}
          <strong>{summary.peopleCount}</strong>{' '}
          {summary.peopleCount === 1 ? 'person' : 'people'} on{' '}
          <strong>{summary.workDates.length}</strong>{' '}
          {summary.workDates.length === 1 ? 'day' : 'days'}.
          Approving adds <strong>{summary.totalDiffHours.toFixed(2)} h</strong> to payroll.
        </p>
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'auto',
            flex: 1,
            marginBottom: '0.75rem',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  Day
                </th>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  Person
                </th>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                  Sessions
                </th>
                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                  Adds
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const dayLabel = new Date(e.workDate + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'numeric',
                  day: 'numeric',
                })
                const ranges = e.sessions
                  .map((s) => {
                    const inMs = new Date(s.clocked_in_at).getTime()
                    const outMs = s.clocked_out_at
                      ? new Date(s.clocked_out_at).getTime()
                      : inMs
                    const label =
                      shortJobOrBidLabelFromEmbeds(s as ClockSessionRow, prefixMap) ?? 'No job/bid'
                    return `${formatDenverTimeOnly(inMs)}–${formatDenverTimeOnly(outMs)} · ${label}`
                  })
                  .join('\n')
                return (
                  <tr key={`${e.personName}|${e.workDate}`}>
                    <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                      {dayLabel}
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                      {e.personName}
                    </td>
                    <td
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'right',
                        whiteSpace: 'pre-line',
                      }}
                      title={ranges}
                    >
                      {e.count}
                    </td>
                    <td
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      +{e.diffHours.toFixed(2)} h
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-700)',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApproveAll()}
            disabled={busy || summary.totalSessions === 0}
            style={{
              padding: '0.4rem 0.9rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid #15803d',
              background: busy || summary.totalSessions === 0 ? '#86efac' : '#22c55e',
              color: 'white',
              borderRadius: 4,
              cursor: busy || summary.totalSessions === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Approving…' : `Approve all ${summary.totalSessions} session${summary.totalSessions === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

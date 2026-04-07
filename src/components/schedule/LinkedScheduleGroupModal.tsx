import { useEffect, useState } from 'react'
import { fetchJobScheduleBlocksForSharedGroupId, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { fetchUserNamesForIds } from '../../lib/scheduleDispatchHub'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { useToastContext } from '../../contexts/ToastContext'

type Props = {
  open: boolean
  onClose: () => void
  groupId: string | null
  weekStart: string
  weekEnd: string
  getJobDisplayTitle: (jobId: string) => string
}

function rowInHubWeek(workDate: string, weekStart: string, weekEnd: string): boolean {
  return workDate >= weekStart && workDate <= weekEnd
}

export function LinkedScheduleGroupModal({
  open,
  onClose,
  groupId,
  weekStart,
  weekEnd,
  getJobDisplayTitle,
}: Props) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<JobScheduleBlockRow[]>([])
  const [nameByUserId, setNameByUserId] = useState<Map<string, string>>(() => new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !groupId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, groupId])

  useEffect(() => {
    if (!open || !groupId) {
      setRows([])
      setNameByUserId(new Map())
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: fetchErr } = await fetchJobScheduleBlocksForSharedGroupId(groupId)
      if (cancelled) return
      if (fetchErr) {
        setRows([])
        setError(fetchErr)
        setLoading(false)
        showToast(fetchErr, 'error')
        return
      }
      setRows(data)
      const uids = [...new Set(data.map((r) => r.assignee_user_id))]
      const { data: names, error: nameErr } = await fetchUserNamesForIds(uids)
      if (cancelled) return
      if (nameErr) showToast(`Names: ${nameErr}`, 'warning')
      setNameByUserId(names)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, groupId, showToast])

  if (!open || !groupId) return null

  const inWeekCount = rows.filter((r) => rowInHubWeek(r.work_date, weekStart, weekEnd)).length
  const hasOutsideWeek = rows.length > inWeekCount

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="linked-group-modal-title"
        style={{
          background: 'white',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="linked-group-modal-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
          Linked schedule blocks
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#4b5563' }}>
          Mirrored crew blocks share time and note. This list includes every block in the group you can read, even
          outside the week shown in the hub grid.
        </p>

        {loading ? <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p> : null}
        {error && !loading ? (
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{error}</p>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No blocks found for this group.</p>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid #e5e7eb' }}>Work date</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid #e5e7eb' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid #e5e7eb' }}>Person</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid #e5e7eb' }}>Job</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid #e5e7eb' }}>Hub week</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const inWeek = rowInHubWeek(r.work_date, weekStart, weekEnd)
                  return (
                    <tr key={r.id}>
                      <td style={{ padding: '0.45rem', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {r.work_date}
                      </td>
                      <td style={{ padding: '0.45rem', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {scheduleFormatWindow(r.time_start, r.time_end)}
                      </td>
                      <td style={{ padding: '0.45rem', border: '1px solid #e5e7eb' }}>
                        {nameByUserId.get(r.assignee_user_id) ?? '…'}
                      </td>
                      <td style={{ padding: '0.45rem', border: '1px solid #e5e7eb', wordBreak: 'break-word' }}>
                        {getJobDisplayTitle(r.job_id)}
                      </td>
                      <td style={{ padding: '0.45rem', border: '1px solid #e5e7eb' }}>
                        {inWeek ? 'In view' : 'Outside week'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {hasOutsideWeek && !loading && !error ? (
          <p style={{ margin: '1rem 0 0', fontSize: '0.8125rem', color: '#92400e' }}>
            Some peers are outside the week shown in the grid.
          </p>
        ) : null}

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.875rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

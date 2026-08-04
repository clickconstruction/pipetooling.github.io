import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteJobScheduleBlock,
  fetchJobScheduleBlocksForSharedGroupId,
  insertJobScheduleBlock,
  updateJobScheduleBlock,
  type JobScheduleBlockRow,
} from '../../lib/jobScheduleBlocks'
import { fetchUserNamesForIds } from '../../lib/scheduleDispatchHub'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'

type Props = {
  open: boolean
  onClose: () => void
  groupId: string | null
  /** Hub-week context columns; omit both (e.g. Dispatch Mode) to hide them. */
  weekStart?: string
  weekEnd?: string
  getJobDisplayTitle: (jobId: string) => string
  /** Crew management (v2.1368): per-leg Unlink/Remove + Add person. */
  canManage?: boolean
  /** People offered by "Add person to crew"; required for the add row to show. */
  addPeople?: Array<{ userId: string; displayName: string }>
  /** Fired after any successful unlink/remove/add so the host can refetch. */
  onChanged?: () => void
}

function rowInHubWeek(workDate: string, weekStart: string, weekEnd: string): boolean {
  return workDate >= weekStart && workDate <= weekEnd
}

const actionBtn = (danger = false): React.CSSProperties => ({
  padding: '0.25rem 0.6rem',
  fontSize: '0.75rem',
  borderRadius: 6,
  border: danger ? '1px solid #dc2626' : '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: danger ? 'var(--text-red-700)' : 'var(--text-700)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

export function LinkedScheduleGroupModal({
  open,
  onClose,
  groupId,
  weekStart,
  weekEnd,
  getJobDisplayTitle,
  canManage = false,
  addPeople,
  onChanged,
}: Props) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<JobScheduleBlockRow[]>([])
  const [nameByUserId, setNameByUserId] = useState<Map<string, string>>(() => new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addUserId, setAddUserId] = useState('')
  const [adding, setAdding] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const hasWeekContext = weekStart != null && weekEnd != null

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
      setAddUserId('')
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
  }, [open, groupId, showToast, reloadKey])

  const memberIds = useMemo(() => new Set(rows.map((r) => r.assignee_user_id)), [rows])
  const addCandidates = useMemo(
    () => (addPeople ?? []).filter((p) => !memberIds.has(p.userId)),
    [addPeople, memberIds],
  )

  const afterMutation = useCallback(() => {
    setReloadKey((k) => k + 1)
    onChanged?.()
  }, [onChanged])

  const unlinkRow = useCallback(
    async (r: JobScheduleBlockRow) => {
      setBusyId(r.id)
      const { error: err } = await updateJobScheduleBlock(r.id, { shared_block_group_id: null })
      setBusyId(null)
      if (err) {
        showToast(err, 'error')
        return
      }
      showToast(
        `Unlinked ${nameByUserId.get(r.assignee_user_id) ?? 'person'} — their block stays but no longer moves with the crew.`,
        'success',
      )
      afterMutation()
    },
    [afterMutation, nameByUserId, showToast],
  )

  const removeRow = useCallback(
    async (r: JobScheduleBlockRow) => {
      const who = nameByUserId.get(r.assignee_user_id) ?? 'this person'
      if (!window.confirm(`Remove ${who}'s block on ${r.work_date}? The block is deleted.`)) return
      setBusyId(r.id)
      const { error: err } = await deleteJobScheduleBlock(r.id)
      setBusyId(null)
      if (err) {
        showToast(err, 'error')
        return
      }
      showToast(`Removed ${who} from the crew.`, 'success')
      afterMutation()
    },
    [afterMutation, nameByUserId, showToast],
  )

  const addPerson = useCallback(async () => {
    if (!addUserId || !groupId || rows.length === 0 || !authUser?.id) return
    // Joining the crew = one leg per distinct (job, date, window) already in the
    // group, so multi-day linked groups stay symmetric.
    const legs = new Map<string, JobScheduleBlockRow>()
    for (const r of rows) {
      legs.set(`${r.job_id}|${r.work_date}|${r.time_start}|${r.time_end}`, r)
    }
    setAdding(true)
    let inserted = 0
    let firstErr: string | null = null
    for (const leg of legs.values()) {
      const { error: err } = await insertJobScheduleBlock({
        job_id: leg.job_id,
        assignee_user_id: addUserId,
        work_date: leg.work_date,
        time_start: leg.time_start,
        time_end: leg.time_end,
        note: leg.note,
        shared_block_group_id: groupId,
        created_by: authUser.id,
      })
      if (err) {
        firstErr = firstErr ?? err
        continue
      }
      inserted++
    }
    setAdding(false)
    const who = (addPeople ?? []).find((p) => p.userId === addUserId)?.displayName ?? 'person'
    if (inserted > 0) {
      showToast(`Added ${who} to the crew (${inserted} ${inserted === 1 ? 'block' : 'blocks'}).`, 'success')
      setAddUserId('')
      afterMutation()
    }
    if (firstErr) showToast(`Some blocks failed: ${firstErr}`, 'error')
  }, [addUserId, groupId, rows, authUser?.id, addPeople, afterMutation, showToast])

  if (!open || !groupId) return null

  const inWeekCount = hasWeekContext
    ? rows.filter((r) => rowInHubWeek(r.work_date, weekStart, weekEnd)).length
    : rows.length
  const hasOutsideWeek = hasWeekContext && rows.length > inWeekCount

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
          background: 'var(--surface)',
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
          {canManage ? 'Linked crew' : 'Linked schedule blocks'}
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-600)' }}>
          {canManage
            ? 'Changing any member’s time moves the whole crew. Unlink keeps a block but stops it moving with the group; Remove deletes it.'
            : 'Mirrored crew blocks share time and instructions. This list includes every block in the group you can read, even outside the week shown in the hub grid.'}
        </p>

        {loading ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p> : null}
        {error && !loading ? (
          <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{error}</p>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No blocks found for this group.</p>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid var(--border)' }}>Work date</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid var(--border)' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid var(--border)' }}>Person</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid var(--border)' }}>Job</th>
                  {hasWeekContext ? (
                    <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid var(--border)' }}>Hub week</th>
                  ) : null}
                  {canManage ? (
                    <th style={{ textAlign: 'left', padding: '0.45rem', border: '1px solid var(--border)' }}>Manage</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const inWeek = hasWeekContext ? rowInHubWeek(r.work_date, weekStart, weekEnd) : true
                  return (
                    <tr key={r.id}>
                      <td style={{ padding: '0.45rem', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {r.work_date}
                      </td>
                      <td style={{ padding: '0.45rem', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {scheduleFormatWindow(r.time_start, r.time_end)}
                      </td>
                      <td style={{ padding: '0.45rem', border: '1px solid var(--border)' }}>
                        {nameByUserId.get(r.assignee_user_id) ?? '…'}
                      </td>
                      <td style={{ padding: '0.45rem', border: '1px solid var(--border)', wordBreak: 'break-word' }}>
                        {getJobDisplayTitle(r.job_id)}
                      </td>
                      {hasWeekContext ? (
                        <td style={{ padding: '0.45rem', border: '1px solid var(--border)' }}>
                          {inWeek ? 'In view' : 'Outside week'}
                        </td>
                      ) : null}
                      {canManage ? (
                        <td style={{ padding: '0.45rem', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => void unlinkRow(r)}
                              title="Keep the block but stop it moving with the crew"
                              style={actionBtn()}
                            >
                              Unlink
                            </button>
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => void removeRow(r)}
                              title="Delete this person's block"
                              style={actionBtn(true)}
                            >
                              Remove
                            </button>
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {canManage && addCandidates.length > 0 && !loading && !error && rows.length > 0 ? (
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Add person to crew
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                aria-label="Person to add to the crew"
                style={{ padding: '0.3rem', fontSize: '0.8125rem', maxWidth: 200 }}
              >
                <option value="">Choose…</option>
                {addCandidates.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!addUserId || adding}
              onClick={() => void addPerson()}
              style={{
                ...actionBtn(),
                border: '1px solid #2563eb',
                color: 'var(--text-blue-700)',
                background: addUserId && !adding ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
              }}
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Gets the crew&rsquo;s times and instructions.
            </span>
          </div>
        ) : null}

        {hasOutsideWeek && !loading && !error ? (
          <p style={{ margin: '1rem 0 0', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
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
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
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

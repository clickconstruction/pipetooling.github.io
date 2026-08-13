/**
 * "My day" editor (v2.1568): reflow your OWN schedule. Every block assigned to
 * you is movable (±30m nudges, retime, push to another day); only blocks you
 * created yourself are deletable — dispatch-made visits can be moved, never
 * removed, and moving one leaves the trail (thread note + amber badge on the
 * office Schedule page, stamped server-side by the move RPC).
 */
import { useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { scheduleFormatWeekdayShort } from '../../lib/jobScheduleChicago'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import {
  findOwnScheduleOverlap,
  selfMoveScheduleBlock,
  selfRemoveScheduleBlock,
  shiftPgTime,
} from '../../lib/selfScheduleJobs'

type Draft = { workDate: string; timeStart: string; timeEnd: string; removed: boolean }

const timeInputStyle = {
  padding: '0.2rem 0.35rem',
  fontSize: '0.8125rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  fontFamily: 'inherit',
}

const nudgeStyle = {
  padding: '0.2rem 0.5rem',
  fontSize: '0.75rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--bg-subtle)',
  color: 'var(--text-700)',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
}

export function DashboardMyDayEditorModal({
  authUserId,
  blocks,
  blockLabels,
  onClose,
  onSaved,
}: {
  authUserId: string
  /** My blocks (today + tomorrow rows from the schedule engine). */
  blocks: JobScheduleBlockRow[]
  blockLabels: Map<string, string>
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const [drafts, setDrafts] = useState<Map<string, Draft>>(
    () =>
      new Map(
        blocks.map((b) => [
          b.id,
          { workDate: b.work_date, timeStart: b.time_start.slice(0, 5), timeEnd: b.time_end.slice(0, 5), removed: false },
        ]),
      ),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => {
      const next = new Map(prev)
      const cur = next.get(id)
      if (cur) next.set(id, { ...cur, ...patch })
      return next
    })

  const sorted = useMemo(
    () =>
      [...blocks].sort((a, b) => a.work_date.localeCompare(b.work_date) || a.time_start.localeCompare(b.time_start)),
    [blocks],
  )

  /** Overlaps computed against the DRAFT windows (removed blocks drop out). */
  const overlapIds = useMemo(() => {
    const live = sorted
      .map((b) => {
        const d = drafts.get(b.id)
        return d && !d.removed
          ? { id: b.id, work_date: d.workDate, time_start: d.timeStart, time_end: d.timeEnd }
          : null
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
    const flagged = new Set<string>()
    for (const b of live) {
      const hit = findOwnScheduleOverlap(
        live,
        { workDate: b.work_date, timeStart: b.time_start, timeEnd: b.time_end },
        b.id,
      )
      if (hit) {
        flagged.add(b.id)
        flagged.add(hit.id)
      }
    }
    return flagged
  }, [sorted, drafts])

  async function save() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      for (const b of sorted) {
        const d = drafts.get(b.id)
        if (!d) continue
        if (d.removed) {
          await selfRemoveScheduleBlock(b.id)
          continue
        }
        const changed =
          d.workDate !== b.work_date || d.timeStart !== b.time_start.slice(0, 5) || d.timeEnd !== b.time_end.slice(0, 5)
        if (changed) {
          await selfMoveScheduleBlock({ blockId: b.id, workDate: d.workDate, timeStart: d.timeStart, timeEnd: d.timeEnd })
        }
      }
      showToast('Your schedule is updated.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1002,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '2rem 0.75rem',
        overflowY: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit my schedule"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          padding: '1rem 1.1rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>My day</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Moving a visit dispatch set for you posts a note to the job and flags the change for the office.
        </p>
        {error ? <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p> : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {sorted.map((b) => {
            const d = drafts.get(b.id)
            if (!d) return null
            const mine = b.created_by === authUserId
            const label = blockLabels.get(b.job_id ?? `bid:${b.bid_id ?? ''}`) ?? (b.job_id == null ? 'Bid visit' : 'Job')
            return (
              <div
                key={b.id}
                style={{
                  border: `1px solid ${overlapIds.has(b.id) && !d.removed ? '#f59e0b' : 'var(--border)'}`,
                  borderRadius: 6,
                  padding: '0.5rem 0.6rem',
                  background: 'var(--bg-subtle)',
                  opacity: d.removed ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, flex: 1, minWidth: '8rem' }}>
                    {label}{' '}
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        color: mine ? 'var(--text-green-600)' : 'var(--text-muted)',
                        border: `1px solid ${mine ? 'var(--border-green)' : 'var(--border-strong)'}`,
                        borderRadius: 999,
                        padding: '0.05rem 0.4rem',
                        verticalAlign: '1px',
                      }}
                    >
                      {mine ? 'added by you' : 'set by dispatch'}
                    </span>
                  </span>
                  {d.removed ? (
                    <button type="button" onClick={() => setDraft(b.id, { removed: false })} style={nudgeStyle}>
                      undo remove
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft(b.id, { timeStart: shiftPgTime(d.timeStart, -30), timeEnd: shiftPgTime(d.timeEnd, -30) })
                        }
                        title="Shift 30 minutes earlier"
                        style={nudgeStyle}
                      >
                        −30m
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft(b.id, { timeStart: shiftPgTime(d.timeStart, 30), timeEnd: shiftPgTime(d.timeEnd, 30) })
                        }
                        title="Shift 30 minutes later"
                        style={nudgeStyle}
                      >
                        +30m
                      </button>
                      {mine ? (
                        <button
                          type="button"
                          onClick={() => setDraft(b.id, { removed: true })}
                          title="Remove from my schedule"
                          aria-label={`Remove ${label} from my schedule`}
                          style={nudgeStyle}
                        >
                          🗑
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
                {!d.removed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      value={d.workDate}
                      onChange={(e) => e.target.value && setDraft(b.id, { workDate: e.target.value })}
                      aria-label={`Day for ${label}`}
                      style={timeInputStyle}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{scheduleFormatWeekdayShort(d.workDate)}</span>
                    <input
                      type="time"
                      value={d.timeStart}
                      onChange={(e) => e.target.value && setDraft(b.id, { timeStart: e.target.value })}
                      aria-label={`Start time for ${label}`}
                      style={timeInputStyle}
                    />
                    –
                    <input
                      type="time"
                      value={d.timeEnd}
                      onChange={(e) => e.target.value && setDraft(b.id, { timeEnd: e.target.value })}
                      aria-label={`End time for ${label}`}
                      style={timeInputStyle}
                    />
                    {overlapIds.has(b.id) ? (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-amber-800)' }}>⚠ overlaps</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            style={{ padding: '0.45rem 1rem', border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Saving…' : 'Save my day'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  alignQueueUserIdsByDay,
  buildAlignHoursQueue,
  formatAlignDurationHours,
  recentAssignedPicksForUser,
  type AlignHoursQueueRow,
  type AlignRecentPick,
} from '../../lib/people/alignHoursQueue'
import {
  fetchDispatchScheduledJobsForAssigneesOnDay,
  type DispatchScheduledJobForAssign,
} from '../../lib/jobScheduleBlocks'
import { useApplyScheduleProportions } from '../../hooks/useApplyScheduleProportions'
import { ApplyScheduleApprovedConfirmModal } from '../clock-sessions/ApplyScheduleApprovedConfirmModal'
import {
  AssignSessionJobPopover,
  type AssignSessionJobSavedPatch,
} from '../clock-sessions/AssignSessionJobPopover'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import {
  formatErrorMessage,
  withSupabaseRetry,
} from '../../utils/errorHandling'
import { formatUnifiedResult } from '../../utils/unifiedJobBidSearch'
import {
  formatDenverTimeOnly,
  formatWorkDateYmdWeekdayLongFriendly,
} from '../../utils/dateUtils'
import {
  shortJobOrBidLabelFromEmbeds,
  type ClockSessionRow,
} from '../../types/clockSessions'

type AlignedEntry = {
  label: string
  /** Single job/bid assigns can be undone (set back to unassigned); splits cannot. */
  undoable: boolean
}

type Props = {
  /** Week sessions already loaded by People → Hours (pending + approved lists, merged). */
  sessions: ClockSessionRow[]
  authUserId: string | undefined
  /** Escape hatch for splits/time fixes — opens the My Time day editor for this session. */
  onOpenDayEditor: (s: ClockSessionRow) => void
  onClose: () => void
}

const chipStyle: CSSProperties = {
  padding: '0.2rem 0.6rem',
  fontSize: '0.8125rem',
  border: '1px solid #3b82f6',
  borderRadius: 999,
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-link)',
  cursor: 'pointer',
}

const mutedActionStyle: CSSProperties = {
  padding: '0.2rem 0.55rem',
  fontSize: '0.8125rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
}

/**
 * People → Hours "Align hours": one pass over the week's closed clock sessions that have no
 * job/bid — inline quick-picks from that person's Dispatch schedule, Split by schedule % when
 * they had multiple scheduled jobs, search for anything else, day editor for surgery.
 *
 * The queue is snapshotted on mount so aligned rows stay visible (green, with Undo) instead of
 * vanishing under the parent's realtime refreshes; the parent refetches on close.
 */
export function PeopleHoursAlignModal({
  sessions,
  authUserId,
  onOpenDayEditor,
  onClose,
}: Props) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const { showToast } = useToastContext()
  const [initialSessions] = useState(sessions)
  const queue = useMemo(
    () => buildAlignHoursQueue(initialSessions),
    [initialSessions],
  )
  const recentByUser = useMemo(() => {
    const m = new Map<string, AlignRecentPick[]>()
    for (const d of queue.days) {
      for (const r of d.rows) {
        if (!m.has(r.session.user_id)) {
          m.set(
            r.session.user_id,
            recentAssignedPicksForUser(initialSessions, r.session.user_id),
          )
        }
      }
    }
    return m
  }, [queue, initialSessions])

  const [scheduledPicks, setScheduledPicks] = useState<
    Map<string, DispatchScheduledJobForAssign[]>
  >(new Map())
  const [picksLoading, setPicksLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const merged = new Map<string, DispatchScheduledJobForAssign[]>()
      const plan = alignQueueUserIdsByDay(queue)
      await Promise.all(
        plan.map(async ({ workDate, userIds }) => {
          const { data, error } =
            await fetchDispatchScheduledJobsForAssigneesOnDay(userIds, workDate)
          if (error) return
          for (const [uid, picks] of data)
            merged.set(`${workDate}:${uid}`, picks)
        }),
      )
      if (!cancelled) {
        setScheduledPicks(merged)
        setPicksLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [queue])

  const [aligned, setAligned] = useState<Map<string, AlignedEntry>>(new Map())
  const [busyId, setBusyId] = useState<string | null>(null)
  const pendingSplitRef = useRef<{
    sessionId: string
    jobCount: number
  } | null>(null)
  const { requestApply, approvedConfirm } = useApplyScheduleProportions({
    authUserId,
    onApplied: () => {
      const p = pendingSplitRef.current
      pendingSplitRef.current = null
      if (!p) return
      setAligned((prev) =>
        new Map(prev).set(p.sessionId, {
          label: `Split across ${p.jobCount} scheduled jobs`,
          undoable: false,
        }),
      )
    },
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !approvedConfirm.open && busyId == null)
        onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [approvedConfirm.open, busyId, onClose])

  function markAligned(sessionId: string, label: string, undoable: boolean) {
    setAligned((prev) => new Map(prev).set(sessionId, { label, undoable }))
  }

  async function updateSessionJobBid(
    sessionId: string,
    jobId: string | null,
    bidId: string | null,
  ) {
    await withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .update({ job_ledger_id: jobId, bid_id: bidId })
          .eq('id', sessionId),
      'align hours assign session',
    )
  }

  async function assignScheduledJob(
    row: AlignHoursQueueRow<ClockSessionRow>,
    pick: DispatchScheduledJobForAssign,
  ) {
    setBusyId(row.session.id)
    try {
      await updateSessionJobBid(row.session.id, pick.jobId, null)
      markAligned(
        row.session.id,
        `${pick.hcp_number || '—'} · ${pick.job_name}`,
        true,
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not assign the job.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function assignRecentPick(
    row: AlignHoursQueueRow<ClockSessionRow>,
    pick: AlignRecentPick,
  ) {
    setBusyId(row.session.id)
    try {
      await updateSessionJobBid(
        row.session.id,
        pick.source === 'job' ? pick.id : null,
        pick.source === 'bid' ? pick.id : null,
      )
      markAligned(
        row.session.id,
        shortJobOrBidLabelFromEmbeds(pick.embeds, prefixMap) ?? 'Assigned',
        true,
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not assign.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function undoAlign(row: AlignHoursQueueRow<ClockSessionRow>) {
    setBusyId(row.session.id)
    try {
      await updateSessionJobBid(row.session.id, null, null)
      setAligned((prev) => {
        const next = new Map(prev)
        next.delete(row.session.id)
        return next
      })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not undo.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  function splitBySchedule(
    row: AlignHoursQueueRow<ClockSessionRow>,
    picks: DispatchScheduledJobForAssign[],
  ) {
    pendingSplitRef.current = {
      sessionId: row.session.id,
      jobCount: picks.length,
    }
    requestApply(row.session, picks)
  }

  function onPopoverSaved(patch?: AssignSessionJobSavedPatch) {
    if (!patch) return
    if (patch.selection) {
      markAligned(
        patch.sessionId,
        formatUnifiedResult(patch.selection, prefixMap),
        true,
      )
    }
  }

  const alignedCount = aligned.size

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => {
        if (busyId == null) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="align-hours-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 940,
          width: '95%',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 id="align-hours-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            Align hours
          </h2>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {alignedCount} of {queue.totalSessions} aligned
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={mutedActionStyle}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '0.5rem 1rem 1rem' }}>
          {queue.totalSessions === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>
              Nothing to align — every closed session in this week range already
              has a job or bid.
            </p>
          ) : (
            queue.days.map((day) => (
              <div key={day.workDate}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    padding: '0.75rem 0 0.25rem',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--surface)',
                  }}
                >
                  {formatWorkDateYmdWeekdayLongFriendly(day.workDate)}
                </div>
                {day.rows.map((row) => {
                  const s = row.session
                  const done = aligned.get(s.id)
                  const busy = busyId === s.id
                  const picks =
                    scheduledPicks.get(`${day.workDate}:${s.user_id}`) ?? []
                  const recents =
                    picks.length === 0
                      ? (recentByUser.get(s.user_id) ?? [])
                      : []
                  const notes = (s.notes ?? '').trim()
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem 1rem',
                        alignItems: 'flex-start',
                        padding: '0.6rem 0.5rem',
                        borderBottom: '1px solid var(--border)',
                        borderRadius: 4,
                        background: done
                          ? 'var(--bg-green-tint, rgba(34,197,94,0.08))'
                          : 'transparent',
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      <div style={{ flex: '1 1 260px', minWidth: 240 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                          {row.personName}
                          {s.origin === 'salary_schedule' ? (
                            <span
                              style={{
                                color: 'var(--text-muted)',
                                fontWeight: 400,
                              }}
                            >
                              {' '}
                              (s)
                            </span>
                          ) : null}{' '}
                          <span
                            style={{
                              fontWeight: 400,
                              color: 'var(--text-muted)',
                            }}
                          >
                            {formatDenverTimeOnly(
                              new Date(s.clocked_in_at).getTime(),
                            )}
                            –
                            {s.clocked_out_at
                              ? formatDenverTimeOnly(
                                  new Date(s.clocked_out_at).getTime(),
                                )
                              : '…'}{' '}
                            · {formatAlignDurationHours(row.durationHours)}
                          </span>
                          {s.approved_at ? (
                            <span
                              style={{
                                marginLeft: '0.4rem',
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: 999,
                                background:
                                  'var(--bg-green-tint, rgba(34,197,94,0.12))',
                                color: 'var(--text-green-700, #15803d)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              approved
                            </span>
                          ) : null}
                        </div>
                        {notes ? (
                          <div
                            title={notes}
                            style={{
                              fontSize: '0.8125rem',
                              color: 'var(--text-muted)',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 420,
                            }}
                          >
                            “{notes}”
                          </div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          flex: '1 1 300px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                          alignItems: 'center',
                        }}
                      >
                        {done ? (
                          <>
                            <span
                              style={{
                                fontSize: '0.8125rem',
                                color: 'var(--text-green-700, #15803d)',
                              }}
                            >
                              ✓ {done.label}
                            </span>
                            {done.undoable ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void undoAlign(row)}
                                style={mutedActionStyle}
                              >
                                Undo
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <>
                            {picks.map((p) => (
                              <button
                                key={p.jobId}
                                type="button"
                                disabled={busy}
                                title={p.windowsLabel}
                                onClick={() => void assignScheduledJob(row, p)}
                                style={chipStyle}
                              >
                                {p.hcp_number || '—'} · {p.job_name}
                              </button>
                            ))}
                            {picks.length >= 2 ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => splitBySchedule(row, picks)}
                                style={mutedActionStyle}
                                title="Split this session across the scheduled jobs, proportional to scheduled time"
                              >
                                Split by schedule %
                              </button>
                            ) : null}
                            {recents.length > 0 ? (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                recent:
                              </span>
                            ) : null}
                            {recents.map((p) => (
                              <button
                                key={`${p.source}:${p.id}`}
                                type="button"
                                disabled={busy}
                                onClick={() => void assignRecentPick(row, p)}
                                style={chipStyle}
                              >
                                {shortJobOrBidLabelFromEmbeds(
                                  p.embeds,
                                  prefixMap,
                                ) ?? '—'}
                              </button>
                            ))}
                            {picksLoading ? (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                Loading schedule…
                              </span>
                            ) : null}
                            <AssignSessionJobPopover
                              session={s}
                              popoverZIndex={1100}
                              compactTrigger
                              onSaved={onPopoverSaved}
                              onError={(msg) => showToast(msg, 'error')}
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onOpenDayEditor(s)}
                              style={mutedActionStyle}
                              title="Open the My Time day editor for splits and time fixes"
                            >
                              Day editor
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Assigning marks the session with that job or bid; splits need lead
            re-approval.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
      <ApplyScheduleApprovedConfirmModal {...approvedConfirm} />
    </div>
  )
}

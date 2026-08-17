import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { fetchUserNamesForIds } from '../../lib/scheduleDispatchHub'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  buildJobHoursPrintHtml,
  buildJobHoursStoryDays,
  buildJobHoursSummaryText,
  formatMinutesAsHhMm,
  jobHoursStoryTotals,
  type JobHoursClockSession,
  type JobHoursScheduleBlock,
} from '../../lib/jobs/jobHoursStory'

/**
 * The job's work story (v2.1766): opened from the man-hours chip on a
 * Pipeline row. Lists every clock session (who / when / how long) with an
 * editable description, optionally overlaid with the dispatch calendar's
 * scheduled blocks (their notes editable too) — so "what did you do on the
 * job?" has a one-screen answer, with Copy and Print to hand it over.
 *
 * Edits write clock_sessions.notes / job_schedule_blocks.note directly; RLS
 * decides who may (pay-approved office for sessions, dispatch editors for
 * blocks) and denials surface as a toast.
 */

type Props = {
  jobId: string
  hcpNumber: string | null
  clickNumber?: string | null
  jobName: string | null
  onClose: () => void
}

export default function JobHoursStoryModal({ jobId, hcpNumber, clickNumber, jobName, onClose }: Props) {
  const { showToast } = useToastContext()
  const narrow = useMatchMedia('(max-width: 700px)')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<JobHoursClockSession[]>([])
  const [blocks, setBlocks] = useState<JobHoursScheduleBlock[]>([])
  const [overlay, setOverlay] = useState(false)
  const [editing, setEditing] = useState<{ kind: 'clock' | 'schedule'; id: string } | null>(null)
  const [draft, setDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [copied, setCopied] = useState(false)

  useBodyScrollLock(true)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // One layer at a time: don't let the follow-up deck (window listener)
      // close underneath this modal on the same keypress.
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [sessRows, blockRows] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .select('id, user_id, clocked_in_at, clocked_out_at, work_date, notes')
                .eq('job_ledger_id', jobId)
                .order('clocked_in_at', { ascending: true }),
            'job hours sessions',
          ),
          withSupabaseRetry(
            async () =>
              supabase
                .from('job_schedule_blocks')
                .select('id, assignee_user_id, work_date, time_start, time_end, note')
                .eq('job_id', jobId)
                .order('work_date', { ascending: true }),
            'job hours schedule blocks',
          ),
        ])
        if (cancelled) return
        const rawSessions = (sessRows ?? []) as Array<{
          id: string
          user_id: string
          clocked_in_at: string
          clocked_out_at: string | null
          work_date: string
          notes: string
        }>
        const rawBlocks = (blockRows ?? []) as Array<{
          id: string
          assignee_user_id: string
          work_date: string
          time_start: string
          time_end: string
          note: string | null
        }>
        const { data: names } = await fetchUserNamesForIds([
          ...rawSessions.map((s) => s.user_id),
          ...rawBlocks.map((b) => b.assignee_user_id),
        ])
        if (cancelled) return
        setSessions(
          rawSessions.map((s) => ({
            id: s.id,
            userName: names.get(s.user_id) ?? 'Unknown',
            clockedInAt: s.clocked_in_at,
            clockedOutAt: s.clocked_out_at,
            workDate: s.work_date,
            notes: s.notes ?? '',
          })),
        )
        setBlocks(
          rawBlocks.map((b) => ({
            id: b.id,
            userName: names.get(b.assignee_user_id) ?? 'Unknown',
            workDate: b.work_date,
            timeStart: b.time_start,
            timeEnd: b.time_end,
            note: b.note,
          })),
        )
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load hours')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  const days = useMemo(() => buildJobHoursStoryDays(sessions, blocks, overlay), [sessions, blocks, overlay])
  const totals = useMemo(() => jobHoursStoryTotals(sessions), [sessions])
  const jobLabel = `${effectiveJobLedgerNumber(hcpNumber, clickNumber ?? null) || '—'} · ${(jobName ?? '').trim() || 'Job'}`

  const startEdit = (kind: 'clock' | 'schedule', id: string, current: string) => {
    setEditing({ kind, id })
    setDraft(current)
  }

  const saveEdit = useCallback(async () => {
    if (!editing) return
    setSavingEdit(true)
    const value = draft.trim()
    try {
      if (editing.kind === 'clock') {
        const { error: e } = await supabase.from('clock_sessions').update({ notes: value }).eq('id', editing.id)
        if (e) throw new Error(e.message)
        setSessions((prev) => prev.map((s) => (s.id === editing.id ? { ...s, notes: value } : s)))
      } else {
        const { error: e } = await supabase.from('job_schedule_blocks').update({ note: value || null }).eq('id', editing.id)
        if (e) throw new Error(e.message)
        setBlocks((prev) => prev.map((b) => (b.id === editing.id ? { ...b, note: value || null } : b)))
      }
      setEditing(null)
      setDraft('')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the description', 'error')
    } finally {
      setSavingEdit(false)
    }
  }, [editing, draft, showToast])

  const copySummary = async () => {
    const text = buildJobHoursSummaryText(buildJobHoursStoryDays(sessions, blocks, overlay), jobLabel)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast('Could not copy — your browser blocked clipboard access.', 'error')
    }
  }

  const printStory = () => {
    const body = buildJobHoursPrintHtml(jobLabel, buildJobHoursStoryDays(sessions, blocks, overlay), totals)
    // Printing pins light (app convention for customer-facing paper).
    printHtmlInNewWindow(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Work on ${jobLabel.replace(/</g, '')}</title><style>
  body { font-family: sans-serif; margin: 0.75in; color: #111; }
  @media print { body { margin: 0.5in; } }
</style></head><body>${body}</body></html>`,
    )
  }

  const entryButtonStyle: React.CSSProperties = {
    border: 'none',
    background: 'none',
    color: 'var(--text-link)',
    cursor: 'pointer',
    padding: 0,
    font: 'inherit',
    fontSize: '0.78rem',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Hours on ${jobLabel}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: narrow
          ? 'env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px)'
          : 'calc(1.5rem + env(safe-area-inset-top, 0px)) 1.5rem calc(1.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: narrow ? 0 : 14,
          width: '100%',
          maxWidth: narrow ? 'none' : 640,
          maxHeight: '100%',
          height: narrow ? '100%' : undefined,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: narrow ? 'none' : '0 24px 70px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.8rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Hours on {jobLabel}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {loading
                ? 'Loading…'
                : `${formatMinutesAsHhMm(totals.totalMinutes)} worked · ${totals.peopleCount} ${totals.peopleCount === 1 ? 'person' : 'people'} · ${totals.dayCount} ${totals.dayCount === 1 ? 'day' : 'days'}${totals.openSessionCount > 0 ? ` · ${totals.openSessionCount} clocked in now` : ''}`}
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--text-slate-600)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} style={{ margin: 0, cursor: 'pointer' }} />
            Overlay schedule
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close job hours"
            style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.05rem', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.25rem 0 0.5rem' }}>
          {error ? (
            <p style={{ color: 'var(--text-red-700)', fontSize: '0.85rem', padding: '0.75rem 0.9rem' }}>{error}</p>
          ) : loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.75rem 0.9rem' }}>Loading…</p>
          ) : days.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.75rem 0.9rem' }}>
              No clock sessions on this job yet{overlay ? ' and nothing scheduled' : ''}.
            </p>
          ) : (
            days.map((d) => (
              <div key={d.ymd}>
                <div style={{ padding: '0.6rem 0.9rem 0.15rem', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-slate-500)' }}>
                  {d.label}
                </div>
                {d.entries.map((e) => {
                  const isEditing = editing?.kind === e.kind && editing.id === e.id
                  return (
                    <div
                      key={`${e.kind}-${e.id}`}
                      style={{
                        display: 'flex',
                        gap: 8,
                        padding: '0.4rem 0.9rem',
                        borderTop: '1px solid var(--border)',
                        background: e.kind === 'schedule' ? 'var(--bg-blue-tint)' : undefined,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span aria-hidden style={{ fontSize: '0.8rem', flexShrink: 0, marginTop: 1 }}>{e.kind === 'schedule' ? '📅' : '⏱'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem' }}>
                          <b>{e.who}</b>{' '}
                          <span style={{ color: 'var(--text-muted)' }}>
                            · {e.timeLabel}
                            {e.durationMinutes != null
                              ? ` · ${formatMinutesAsHhMm(e.durationMinutes)}`
                              : e.kind === 'schedule'
                                ? ' · scheduled'
                                : e.stillClockedIn
                                  ? ' · in progress'
                                  : ''}
                          </span>
                        </div>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <input
                              type="text"
                              value={draft}
                              autoFocus
                              onChange={(ev) => setDraft(ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter') void saveEdit()
                                if (ev.key === 'Escape') {
                                  ev.stopPropagation()
                                  setEditing(null)
                                }
                              }}
                              placeholder="What was done?"
                              style={{ flex: 1, padding: '0.3rem 0.45rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                            />
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => void saveEdit()}
                              style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingEdit ? 'wait' : 'pointer' }}
                            >
                              {savingEdit ? '…' : 'Save'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.82rem', color: e.note ? 'var(--text-slate-600)' : 'var(--text-faint)', marginTop: 1 }}>
                            {e.note || 'No description'}{' '}
                            <button
                              type="button"
                              onClick={() => startEdit(e.kind, e.id, e.note)}
                              aria-label={`Edit the description of ${e.who}'s ${e.kind === 'schedule' ? 'scheduled block' : 'session'} on ${d.label}`}
                              style={entryButtonStyle}
                            >
                              {e.note ? 'edit' : '+ add'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.9rem calc(0.6rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void copySummary()}
            disabled={loading}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {copied ? 'Copied' : 'Copy work summary'}
          </button>
          <button
            type="button"
            onClick={printStory}
            disabled={loading}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-700)' }}
          >
            Print
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>for “what did you do on the job?”</span>
        </div>
      </div>
    </div>
  )
}

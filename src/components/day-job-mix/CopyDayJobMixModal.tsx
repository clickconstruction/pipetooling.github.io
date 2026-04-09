import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ClockedInTodayStripRow } from '../../hooks/useDashboardMyTeamSectionState'
import { CLOCK_SESSION_CALENDAR_SELECT } from '../../lib/clockSessionSelect'
import { assertTargetSessionsAllowJobMixReplace } from '../../lib/copyDayJobMixTargetGate'
import { buildDayJobMixReplacePlan } from '../../lib/dayJobMixApply'
import { sessionsToMixRows, totalMixSeconds } from '../../lib/dayJobMixPercentages'
import { leaderReplaceClockSessionClusterMixed } from '../../lib/leaderClockSessionSplit'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import { supabase } from '../../lib/supabase'
import { DatabaseError, formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

type CalendarSessionRow = {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string | null
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
  origin: string | null
}

function toDayEditorSession(r: CalendarSessionRow): DayEditorSession {
  return {
    id: r.id,
    clocked_in_at: r.clocked_in_at,
    clocked_out_at: r.clocked_out_at,
    work_date: r.work_date,
    notes: r.notes ?? '',
    job_ledger_id: r.job_ledger_id,
    bid_id: r.bid_id,
    approved_at: r.approved_at,
  }
}

function formatPct(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '0%'
  return `${(p * 100).toFixed(1)}%`
}

function formatHoursFromSeconds(sec: number): string {
  return `${(sec / 3600).toFixed(2)} h`
}

export function CopyDayJobMixModal({
  open,
  onClose,
  workDateYmd,
  sourceUserId,
  sourceDisplayName,
  clockedInTodayRows,
  nowMs,
  onApplied,
}: {
  open: boolean
  onClose: () => void
  workDateYmd: string
  sourceUserId: string
  sourceDisplayName: string
  clockedInTodayRows: readonly ClockedInTodayStripRow[]
  nowMs: number
  onApplied: () => void
}) {
  const [step, setStep] = useState<'pick' | 'confirm'>('pick')
  const [targetUserId, setTargetUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('pick')
    setTargetUserId('')
    setError(null)
  }, [open, sourceUserId])

  const sourceRow = useMemo(
    () => clockedInTodayRows.find((r) => r.userId === sourceUserId),
    [clockedInTodayRows, sourceUserId],
  )

  const sourceMix = useMemo(
    () => (sourceRow ? sessionsToMixRows(sourceRow.todaySessions, nowMs) : []),
    [sourceRow, nowMs],
  )

  const targetCandidates = useMemo(
    () =>
      clockedInTodayRows.filter(
        (r) => r.userId !== sourceUserId && r.todaySessions.length > 0 && totalMixSeconds(sessionsToMixRows(r.todaySessions, nowMs)) > 0,
      ),
    [clockedInTodayRows, sourceUserId, nowMs],
  )

  const targetRow = useMemo(
    () => clockedInTodayRows.find((r) => r.userId === targetUserId),
    [clockedInTodayRows, targetUserId],
  )

  const targetPreviewMix = useMemo(
    () => (targetRow ? sessionsToMixRows(targetRow.todaySessions, nowMs) : []),
    [targetRow, nowMs],
  )

  const targetHasApproved = useMemo(
    () => targetRow?.todaySessions.some((s) => s.approved_at) ?? false,
    [targetRow],
  )

  const resetAndClose = useCallback(() => {
    setStep('pick')
    setTargetUserId('')
    setError(null)
    setBusy(false)
    onClose()
  }, [onClose])

  const handleApply = useCallback(async () => {
    if (!targetRow || sourceMix.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select(CLOCK_SESSION_CALENDAR_SELECT)
            .eq('user_id', targetUserId)
            .eq('work_date', workDateYmd),
        'load target clock sessions for job mix',
      )

      const raw = (data ?? []) as CalendarSessionRow[]
      const eligible = raw.filter((s) => !s.rejected_at && !s.revoked_at)
      const gate = assertTargetSessionsAllowJobMixReplace(eligible)
      if (!gate.ok) {
        throw new DatabaseError(gate.message)
      }

      const targetSessions = eligible.map(toDayEditorSession)
      const built = buildDayJobMixReplacePlan({
        targetSessions,
        nowMs,
        sourceMix,
        sourcePersonLabel: sourceDisplayName,
      })
      if (!built.ok) {
        throw new DatabaseError(built.error)
      }

      const clusters = built.plan.clusters
      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i]!
        try {
          await leaderReplaceClockSessionClusterMixed(cluster.sessionIds, cluster.payloads)
        } catch (e: unknown) {
          const inner = e instanceof DatabaseError ? e.message : formatErrorMessage(e, 'Unknown error')
          throw new DatabaseError(
            `Could not update clock block ${i + 1} of ${clusters.length}: ${inner}`,
          )
        }
      }

      onApplied()
      resetAndClose()
    } catch (e: unknown) {
      setError(formatErrorMessage(e, e instanceof DatabaseError ? e.message : 'Apply failed'))
    } finally {
      setBusy(false)
    }
  }, [
    targetRow,
    targetUserId,
    workDateYmd,
    sourceMix,
    sourceDisplayName,
    nowMs,
    onApplied,
    resetAndClose,
  ])

  if (!open) return null

  const sourceTotal = totalMixSeconds(sourceMix)
  const canPickContinue =
    targetUserId.length > 0 && sourceTotal > 0 && targetCandidates.some((r) => r.userId === targetUserId)

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={busy ? undefined : resetAndClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="copy-day-job-mix-title"
        style={{
          background: 'white',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="copy-day-job-mix-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem' }}>
          {step === 'pick' ? 'Copy job time mix' : 'Confirm overwrite'}
        </h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
          Date <strong>{workDateYmd}</strong>. Template: <strong>{sourceDisplayName}</strong>
          {step === 'confirm' && targetRow ? (
            <>
              {' '}
              → Target: <strong>{targetRow.displayName}</strong>
            </>
          ) : null}
        </p>

        {error ? (
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#b91c1c' }}>{error}</p>
        ) : null}

        {step === 'pick' ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#6b7280' }}>Template mix</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                      <th style={{ padding: '0.35rem 0' }}>Job / bid</th>
                      <th style={{ padding: '0.35rem 0' }}>%</th>
                      <th style={{ padding: '0.35rem 0' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceMix.map((r) => (
                      <tr key={r.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.35rem 0.25rem 0.35rem 0', verticalAlign: 'top' }}>{r.label}</td>
                        <td style={{ padding: '0.35rem 0.25rem', whiteSpace: 'nowrap' }}>{formatPct(r.pct)}</td>
                        <td style={{ padding: '0.35rem 0', whiteSpace: 'nowrap' }}>
                          {formatHoursFromSeconds(r.seconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sourceTotal <= 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#b45309', margin: '0.5rem 0 0' }}>
                    No recorded time for this template today.
                  </p>
                ) : null}
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#6b7280' }}>Target person</h3>
                <select
                  id="copy-mix-target"
                  aria-label="Choose person whose job and bid time mix will be updated"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    borderRadius: 4,
                    border: '1px solid #d1d5db',
                    marginBottom: '0.75rem',
                  }}
                >
                  <option value="">Select person…</option>
                  {targetCandidates.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.displayName}
                    </option>
                  ))}
                </select>
                {targetCandidates.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                    No one else has time on the clock today to receive this mix.
                  </p>
                ) : null}
                {targetPreviewMix.length > 0 ? (
                  <>
                    <h4 style={{ margin: '0.75rem 0 0.35rem 0', fontSize: '0.78rem', color: '#6b7280' }}>
                      Target current mix
                    </h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <tbody>
                        {targetPreviewMix.map((r) => (
                          <tr key={r.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.25rem 0' }}>{r.label}</td>
                            <td style={{ padding: '0.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {formatPct(r.pct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy}
                onClick={resetAndClose}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: 'white',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canPickContinue || busy}
                onClick={() => setStep('confirm')}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: 'none',
                  borderRadius: 4,
                  background: canPickContinue ? '#2563eb' : '#9ca3af',
                  color: 'white',
                  cursor: canPickContinue && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#374151', lineHeight: 1.55 }}>
              This will update <strong>{targetRow?.displayName}</strong>’s clock sessions on {workDateYmd} so time on
              each job or bid matches <strong>{sourceDisplayName}</strong>’s <strong>percent mix</strong>. Clock-in
              and clock-out times stay the same; sessions may be split or re-linked. Saved rows are recreated as
              regular clock entries—scheduled (<strong>salary_schedule</strong>) sessions will not stay marked as
              schedule-driven after this. If any segment was already approved, saving can affect payroll until hours
              are approved again.
            </p>
            {targetHasApproved ? (
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#b45309' }}>
                Target has at least one approved session today.
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep('pick')
                  setError(null)
                }}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: 'white',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleApply()}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: 'none',
                  borderRadius: 4,
                  background: busy ? '#9ca3af' : '#b45309',
                  color: 'white',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'Applying…' : 'Apply mix'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Small copy icon (Font Awesome–style “copy”) for strip rows / header */
export function CopyDayJobMixIcon({ active }: { active?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 640"
      width={16}
      height={16}
      fill="currentColor"
      style={{ display: 'block', opacity: active ? 1 : 0.85 }}
      aria-hidden
    >
      <path d="M352 528L128 528C119.2 528 112 520.8 112 512L112 288C112 279.2 119.2 272 128 272L176 272L176 224L128 224C92.7 224 64 252.7 64 288L64 512C64 547.3 92.7 576 128 576L352 576C387.3 576 416 547.3 416 512L416 464L368 464L368 512C368 520.8 360.8 528 352 528zM288 368C279.2 368 272 360.8 272 352L272 128C272 119.2 279.2 112 288 112L512 112C520.8 112 528 119.2 528 128L528 352C528 360.8 520.8 368 512 368L288 368zM224 352C224 387.3 252.7 416 288 416L512 416C547.3 416 576 387.3 576 352L576 128C576 92.7 547.3 64 512 64L288 64C252.7 64 224 92.7 224 128L224 352z" />
    </svg>
  )
}

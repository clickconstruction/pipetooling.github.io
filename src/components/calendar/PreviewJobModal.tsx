import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { fetchPreviewJobModalStageSummary, type PreviewJobModalStepLite } from '../../lib/previewJobModalStages'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

type CalendarStepLite = PreviewJobModalStepLite

type AssignedJobRow = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  google_drive_link: string | null
  job_plans_link: string | null
  project_id: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  projectId: string
  stepId?: string
  contextDateKey: string | null
  /** Omit to load project + your stages inside this modal (e.g. Schedule Dispatch). Pass array (incl. empty) for Calendar props-only path. */
  steps?: CalendarStepLite[]
  authUserId: string | undefined
  /** Subcontractors omit Jobs page link */
  showJobsDeepLink: boolean
}

export function PreviewJobModal({
  open,
  onClose,
  projectId,
  stepId: _stepId,
  contextDateKey,
  steps,
  authUserId,
  showJobsDeepLink,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignedJobs, setAssignedJobs] = useState<AssignedJobRow[]>([])
  const [scheduleRows, setScheduleRows] = useState<JobScheduleBlockRow[]>([])
  const [fetchedSummary, setFetchedSummary] = useState<{ projectName: string | null; stages: CalendarStepLite[] } | null>(
    null,
  )

  const usePropsSteps = steps !== undefined
  const displayStages = useMemo(() => {
    if (usePropsSteps && steps) return steps.filter((s) => s.project_id === projectId)
    return fetchedSummary?.stages ?? []
  }, [usePropsSteps, steps, projectId, fetchedSummary])

  const displayProjectName = useMemo(() => {
    if (usePropsSteps) return displayStages[0]?.project_name ?? '—'
    return fetchedSummary?.projectName ?? displayStages[0]?.project_name ?? '—'
  }, [usePropsSteps, displayStages, fetchedSummary])

  useEffect(() => {
    if (!open || !authUserId) {
      setAssignedJobs([])
      setScheduleRows([])
      setFetchedSummary(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        if (steps === undefined) {
          const summaryRes = await fetchPreviewJobModalStageSummary(projectId, authUserId)
          if (cancelled) return
          if (summaryRes.error) {
            setError(summaryRes.error)
            setFetchedSummary(null)
          } else {
            setFetchedSummary(summaryRes.data ?? { projectName: null, stages: [] })
          }
        } else {
          setFetchedSummary(null)
        }

        const rpcRows = await withSupabaseRetry(
          async () => await supabase.rpc('list_assigned_jobs_for_dashboard'),
          'PreviewJobModal list_assigned_jobs',
        )
        if (cancelled) return
        const jobs = ((rpcRows ?? []) as AssignedJobRow[]).filter((r) => r.project_id === projectId)
        setAssignedJobs(jobs)
        const jobIds = jobs.map((j) => j.id)
        if (jobIds.length === 0) {
          setScheduleRows([])
          return
        }
        const rangeStart = contextDateKey ?? '1970-01-01'
        const rangeEnd = contextDateKey ?? '2099-12-31'
        const blk = await withSupabaseRetry(
          async () =>
            await supabase
              .from('job_schedule_blocks')
              .select(
                'id, job_id, assignee_user_id, work_date, time_start, time_end, note, created_at, created_by, updated_at',
              )
              .eq('assignee_user_id', authUserId)
              .in('job_id', jobIds)
              .gte('work_date', rangeStart)
              .lte('work_date', rangeEnd)
              .order('work_date', { ascending: true })
              .order('time_start', { ascending: true }),
          'PreviewJobModal schedule blocks',
        )
        if (cancelled) return
        setScheduleRows((blk ?? []) as JobScheduleBlockRow[])
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, authUserId, projectId, contextDateKey, steps])

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
        zIndex: 1003,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="preview-job-modal-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 520,
          width: '92%',
          maxHeight: '88vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <h2 id="preview-job-modal-title" style={{ margin: 0, fontSize: '1.1rem' }}>
            Job preview
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.875rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.5rem 0 0' }}>
          Project: <strong>{displayProjectName}</strong>
        </p>

        {loading ? <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading…</p> : null}
        {error ? <p style={{ fontSize: '0.875rem', color: '#b91c1c', whiteSpace: 'pre-wrap' }}>{error}</p> : null}

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
            Your stages on this project
          </div>
          {displayStages.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No matching stages.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
              {displayStages.map((s) => (
                <li key={s.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: '#6b7280' }}> · {s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
            Your jobs on this project (team)
          </div>
          {assignedJobs.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              No assigned working jobs linked to this project, or none in your team list.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {assignedJobs.map((j) => (
                <li
                  key={j.id}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {effectiveJobLedgerNumber(j.hcp_number) || '—'} · {(j.job_name ?? '').trim() || 'Job'}
                  </div>
                  <div style={{ color: '#4b5563', marginTop: 2 }}>{j.job_address}</div>
                  {showJobsDeepLink ? (
                    <Link
                      to={`/jobs?edit=${encodeURIComponent(j.id)}`}
                      onClick={onClose}
                      style={{ fontSize: '0.8125rem', marginTop: 6, display: 'inline-block' }}
                    >
                      Open in Jobs
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
            Scheduled time (you)
          </div>
          {scheduleRows.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No planned blocks for these jobs yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {scheduleRows.map((r) => (
                <li
                  key={r.id}
                  style={{
                    fontSize: '0.8125rem',
                    padding: '0.35rem 0',
                    borderBottom: '1px solid #f9fafb',
                  }}
                >
                  <strong>{r.work_date}</strong> · {scheduleFormatWindow(r.time_start, r.time_end)}
                  {r.note ? <span style={{ color: '#4b5563' }}> — {r.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginTop: '1rem', fontSize: '0.8125rem' }}>
          <Link to={`/workflows/${projectId}`} onClick={onClose} style={{ color: '#2563eb' }}>
            Open workflow
          </Link>
        </div>
      </div>
    </div>
  )
}

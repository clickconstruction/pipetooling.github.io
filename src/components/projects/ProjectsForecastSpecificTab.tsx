/**
 * Projects → Forecast → Specific sub-tab.
 *
 * Renders one selected job's `project_workflow_steps` as a **sparse-calendar Gantt**:
 * every row shares the same horizontal x-axis (one row per stage, ordered by
 * `sequence_order`), but the column list is compressed so no single stage forces dozens
 * of days of horizontal scroll. Specifically:
 *
 *   - Each stage contributes only its first 2 + last 2 calendar days as columns (or all
 *     days for 1–5 day stages).
 *   - Runs of days that no stage marks visible collapse into a single "…" column.
 *   - Bars span the columns of their date range, automatically passing through any
 *     ellipsis cells inside that range — so a 6-month stage still reads as one
 *     continuous bar but only takes ~5 columns of horizontal real estate.
 *
 * See `src/lib/projectsForecastSpecificColumns.ts` for the column-building algorithm and
 * the worked example matching the user's "Aug 1 / Aug 2 / … / Jan 25 / Jan 26 / Jan 27 /
 * Jan 28 / … / Feb 2 / Feb 3 / Feb 4" layout.
 *
 * Render pipeline: `resolveForecastStages` (chains + infers dates) →
 * `buildSpecificForecastColumns` (sparse columns + per-stage spans) →
 * `ProjectsForecastSpecificGrid` (2-tier header, today line, weekend tinting, bars).
 *
 * The All Stages sub-tab continues to use the dense `ProjectsForecastTimelineGrid` for
 * cross-job calendar comparison — the Specific tab no longer shares that grid because
 * the column model is fundamentally different (sparse vs. contiguous).
 *
 * Toolbar:
 *   - **Job search**: typeahead suggesting `{prefix}{hcp} · {jobName}` filtered to
 *     jobs-with-project (the parent's `jobs` list); selecting one persists `selectedJobId`
 *     in `localStorage` + URL.
 *
 * Click handlers:
 *   - Stage gutter label or bar → opens `ProjectsForecastSpecificStageModal` with the
 *     full `project_workflow_steps` row for that stage (status, assignee, planned /
 *     actual dates, notes, inspector, etc.). Roles allowed by the table's UPDATE RLS
 *     (dev / master_technician / assistant / superintendent) also see editors for the
 *     scheduled start / end dates — date inputs, quick +1d / +1w / +1m extend buttons,
 *     a length-in-days input, and an optional "also push next stage start" checkbox.
 *     The modal still exposes an "Open in Workflow" link for users who want the full
 *     editor on the Workflow page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
  type LedgerPrefixMap,
} from '../../lib/ledgerDisplayPrefixes'
import {
  resolveForecastStages,
  type ResolvedStageBar,
} from '../../lib/projectsForecastStageResolver'
import { forecastBarSwatch } from '../../lib/projectsForecastColors'
import {
  filterForecastJobsBySearch,
  normalizeForecastJobSearchQuery,
} from '../../lib/projectsForecastJobSearch'
import {
  forecastSearchClearButtonStyle,
  forecastSearchInputStyle,
  forecastToolbarRowStyle,
} from '../../lib/projectsForecastToolbarStyles'
import {
  buildSpecificForecastColumns,
  type SpecificForecastStageSpan,
} from '../../lib/projectsForecastSpecificColumns'
import type {
  ForecastJob,
  ForecastStage,
  ForecastWorkflowMap,
} from '../../lib/projectsForecastData'
import { ProjectsForecastSpecificGrid } from './ProjectsForecastSpecificGrid'
import { ProjectsForecastSpecificStageModal } from './ProjectsForecastSpecificStageModal'

type Props = {
  jobs: readonly ForecastJob[]
  workflowByProject: ForecastWorkflowMap
  stagesByWorkflow: ReadonlyMap<string, ForecastStage[]>
  prefixMap: LedgerPrefixMap
  loading: boolean
  /** Current user's role — forwarded into the stage detail modal to gate its edit
   *  controls. The modal degrades to a read-only details view when the role isn't
   *  allowed to write to `project_workflow_steps`. */
  myRole: string | null
}

const SELECTED_JOB_STORAGE_KEY = 'projects_forecast_specific_selected_job_v1'

function todayYmdCentral(): string {
  // Local-clock based "today" is fine: the resolver only uses today as a fallback anchor
  // when nothing else is scheduled, and the grid's today line snaps to a calendar day —
  // a one-hour offset still picks the right day 23 of 24 hours per day, mirroring Job
  // History's stance on the same input.
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function readStoredJobId(urlValue: string | null): string | null {
  if (urlValue && urlValue.length > 0) return urlValue
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(SELECTED_JOB_STORAGE_KEY)
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

function writeStoredJobId(jobId: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (jobId) window.localStorage.setItem(SELECTED_JOB_STORAGE_KEY, jobId)
    else window.localStorage.removeItem(SELECTED_JOB_STORAGE_KEY)
  } catch {
    /* ignore quota errors */
  }
}

function buildJobLabel(job: ForecastJob, prefixMap: LedgerPrefixMap): string {
  const prefix = resolveJobLedgerPrefix(job.service_type_id, prefixMap)
  const hcpLabel = formatJobLedgerNumberLabel(prefix, job.hcp_number)
  return `${hcpLabel} · ${(job.job_name ?? '').trim() || '—'}`
}

export function ProjectsForecastSpecificTab({
  jobs,
  workflowByProject,
  stagesByWorkflow,
  prefixMap,
  loading,
  myRole,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlJobId = searchParams.get('forecastJob')
  const [selectedJobId, setSelectedJobIdState] = useState<string | null>(() =>
    readStoredJobId(urlJobId),
  )
  const [jobSearch, setJobSearch] = useState<string>('')
  const [jobSearchOpen, setJobSearchOpen] = useState<boolean>(false)
  const [openStageId, setOpenStageId] = useState<string | null>(null)

  // Sync URL → state when the URL value changes (e.g. user paste-navigates a different
  // `?forecastJob=` link).
  useEffect(() => {
    if (urlJobId && urlJobId !== selectedJobId) {
      setSelectedJobIdState(urlJobId)
    }
  }, [urlJobId, selectedJobId])

  const setSelectedJobId = useCallback(
    (next: string | null) => {
      setSelectedJobIdState(next)
      writeStoredJobId(next)
      const nextParams = new URLSearchParams(searchParams)
      if (next) nextParams.set('forecastJob', next)
      else nextParams.delete('forecastJob')
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const todayYmd = useMemo(() => todayYmdCentral(), [])

  const selectedJob = useMemo<ForecastJob | null>(
    () => jobs.find((j) => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  )
  const selectedWorkflowId = selectedJob
    ? workflowByProject.get(selectedJob.project_id) ?? null
    : null
  const selectedStages = useMemo<readonly ForecastStage[]>(
    () => (selectedWorkflowId ? stagesByWorkflow.get(selectedWorkflowId) ?? [] : []),
    [selectedWorkflowId, stagesByWorkflow],
  )
  const resolvedBars = useMemo<ResolvedStageBar[]>(
    () => resolveForecastStages(selectedStages, todayYmd),
    [selectedStages, todayYmd],
  )

  // Sparse-calendar layout: global columns + per-stage spans + day index.
  const layout = useMemo(
    () =>
      buildSpecificForecastColumns(
        resolvedBars.map((b) => ({
          stageId: b.stageId,
          startYmd: b.startYmd,
          endYmd: b.endYmd,
        })),
      ),
    [resolvedBars],
  )

  const spanByStageId = useMemo<ReadonlyMap<string, SpecificForecastStageSpan>>(() => {
    const m = new Map<string, SpecificForecastStageSpan>()
    for (const s of layout.stageSpans) m.set(s.stageId, s)
    return m
  }, [layout.stageSpans])

  // Job-search dropdown — substring match on the parent's jobs list.
  const filteredJobChoices = useMemo(() => {
    if (!jobSearchOpen) return [] as ForecastJob[]
    if (normalizeForecastJobSearchQuery(jobSearch).length === 0) {
      const head = selectedJob ? [selectedJob] : []
      const tail = jobs.filter((j) => j.id !== selectedJobId).slice(0, 15)
      return [...head, ...tail]
    }
    return filterForecastJobsBySearch(jobs, jobSearch, prefixMap).slice(0, 25) as ForecastJob[]
  }, [jobs, jobSearch, jobSearchOpen, prefixMap, selectedJob, selectedJobId])

  const wrapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!jobSearchOpen) return
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (e.target instanceof Node && !wrapRef.current.contains(e.target)) {
        setJobSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [jobSearchOpen])

  const onPickJob = useCallback(
    (job: ForecastJob) => {
      setSelectedJobId(job.id)
      setJobSearch('')
      setJobSearchOpen(false)
    },
    [setSelectedJobId],
  )

  // Stage click → open the detail modal (instead of navigating away from the page).
  // The modal itself exposes an "Open in Workflow ↗" link for users who want the full
  // Workflow page editor, so we no longer perform a navigation from this callback.
  const onOpenStage = useCallback((stageId: string) => {
    setOpenStageId(stageId)
  }, [])

  const renderGutterLabel = useCallback(
    (stage: ResolvedStageBar) => (
      <StageGutterLabel resolved={stage} onClick={() => onOpenStage(stage.stageId)} />
    ),
    [onOpenStage],
  )

  const openStageBar = useMemo<ResolvedStageBar | null>(() => {
    if (!openStageId) return null
    return resolvedBars.find((b) => b.stageId === openStageId) ?? null
  }, [openStageId, resolvedBars])

  // Close the modal automatically if the underlying job changes (so we don't leave a
  // stale modal mounted with bar data from a different job).
  useEffect(() => {
    if (openStageId == null) return
    if (!resolvedBars.some((b) => b.stageId === openStageId)) {
      setOpenStageId(null)
    }
  }, [openStageId, resolvedBars])

  const hasJob = selectedJob != null
  const emptyState: string = !hasJob
    ? loading
      ? 'Loading jobs…'
      : jobs.length === 0
        ? 'No jobs with projects are available.'
        : 'Pick a job above to see its forecast.'
    : loading
      ? 'Loading stages…'
      : resolvedBars.length === 0
        ? 'This job has no workflow stages yet.'
        : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={forecastToolbarRowStyle}>
        <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <input
            type="search"
            value={
              jobSearchOpen || jobSearch.length > 0
                ? jobSearch
                : selectedJob
                  ? buildJobLabel(selectedJob, prefixMap)
                  : ''
            }
            onChange={(e) => {
              setJobSearch(e.target.value)
              setJobSearchOpen(true)
            }}
            onFocus={() => setJobSearchOpen(true)}
            placeholder={selectedJob ? buildJobLabel(selectedJob, prefixMap) : 'Search a job…'}
            aria-label="Search for a job to forecast"
            style={{ ...forecastSearchInputStyle, minWidth: 320 }}
          />
          {(jobSearch.length > 0 || selectedJob) && (
            <button
              type="button"
              onClick={() => {
                if (jobSearch.length > 0) {
                  setJobSearch('')
                } else {
                  setSelectedJobId(null)
                }
              }}
              aria-label={jobSearch.length > 0 ? 'Clear search' : 'Clear selected job'}
              title={jobSearch.length > 0 ? 'Clear search' : 'Clear selected job'}
              style={forecastSearchClearButtonStyle}
            >
              ×
            </button>
          )}

          {jobSearchOpen && filteredJobChoices.length > 0 && (
            <div
              role="listbox"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                boxShadow: '0 6px 24px rgba(15, 23, 42, 0.12)',
                minWidth: 360,
                maxHeight: 360,
                overflowY: 'auto',
                zIndex: 50,
              }}
            >
              {filteredJobChoices.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  role="option"
                  aria-selected={job.id === selectedJobId}
                  onClick={() => onPickJob(job)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.7rem',
                    border: 'none',
                    background: job.id === selectedJobId ? '#eff6ff' : '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{buildJobLabel(job, prefixMap)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {job.project_name ?? '(no project name)'}
                    {job.job_address ? ` · ${job.job_address}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProjectsForecastSpecificGrid
        columns={layout.columns}
        stages={resolvedBars}
        spanByStageId={spanByStageId}
        dayKeyIndex={layout.dayKeyIndex}
        todayYmd={todayYmd}
        rowLabel={renderGutterLabel}
        onOpenWorkflow={onOpenStage}
        emptyState={emptyState ? <span>{emptyState}</span> : null}
      />

      {openStageBar && selectedJob ? (
        <ProjectsForecastSpecificStageModal
          stage={openStageBar}
          projectId={selectedJob.project_id}
          myRole={myRole}
          onClose={() => setOpenStageId(null)}
        />
      ) : null}
    </div>
  )
}

function StageGutterLabel({
  resolved,
  onClick,
}: {
  resolved: ResolvedStageBar
  onClick: () => void
}) {
  const swatch = forecastBarSwatch(resolved.colorKey)
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open in Workflow — ${resolved.name}`}
      aria-label={`Open stage ${resolved.name} in Workflow`}
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 22,
          height: 18,
          padding: '0 6px',
          borderRadius: 4,
          background: swatch.background,
          color: swatch.textColor,
          border: `1px solid ${swatch.borderColor}`,
          fontSize: '0.6875rem',
          fontWeight: 700,
        }}
      >
        {resolved.sequenceOrder}
      </span>
      <span
        style={{
          fontWeight: 600,
          color: '#0f172a',
          textDecoration: swatch.textDecoration,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: '0 1 auto',
        }}
      >
        {resolved.name}
      </span>
      {resolved.assignee ? (
        <span
          style={{
            fontSize: '0.75rem',
            color: '#2563eb',
            textDecoration: 'underline',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: '1 1 auto',
          }}
          title={resolved.assignee}
        >
          {resolved.assignee}
        </span>
      ) : null}
    </button>
  )
}

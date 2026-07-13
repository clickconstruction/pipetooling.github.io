/**
 * Projects → Forecast → All Stages sub-tab.
 *
 * Renders one row per job (`status` any), with the job's `project_workflow_steps` laid out
 * side-by-side as Gantt bars. The bar palette + chaining + 1-day-grey fallbacks all come
 * from `resolveForecastStages`, so visual behavior matches the Specific tab exactly — the
 * only difference is row composition: stages live IN a row instead of being the row.
 *
 * Toolbar:
 *   - **From / To**: defaults to today − 7d → today + 90d (forward-leaning), persisted under
 *     `projects_forecast_all_range_v1`.
 *   - **Search**: jobs by HCP / name / address / project name via `projectsForecastJobSearch`.
 *   - **Only show jobs with active stages**: filters out jobs whose every stage is
 *     `completed` / `approved` / `skipped`, persisted under `projects_forecast_all_active_only_v1`.
 *
 * Click handlers:
 *   - Job label or stage bar → opens `/workflows/${project_id}#step-${stage_id}` (or just
 *     `/workflows/${project_id}` for the label) in a new tab.
 */

import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { ymdAddDays } from '../../utils/dateUtils'
import {
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
  type LedgerPrefixMap,
} from '../../lib/ledgerDisplayPrefixes'
import { enumerateDaysInRange } from '../../lib/projectsJobHistoryData'
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
  forecastChipStyle,
  forecastDateInputStyle,
  forecastSearchClearButtonStyle,
  forecastSearchInputStyle,
  forecastToolbarLabelStyle,
  forecastToolbarRowStyle,
} from '../../lib/projectsForecastToolbarStyles'
import type {
  ForecastJob,
  ForecastStage,
  ForecastStageStatus,
  ForecastWorkflowMap,
} from '../../lib/projectsForecastData'
import {
  buildForecastDayKeyIndex,
  forecastBarColumnSpan,
  FORECAST_COL_W,
  ProjectsForecastTimelineGrid,
} from './ProjectsForecastTimelineGrid'

type Props = {
  jobs: readonly ForecastJob[]
  workflowByProject: ForecastWorkflowMap
  stagesByWorkflow: ReadonlyMap<string, ForecastStage[]>
  prefixMap: LedgerPrefixMap
  loading: boolean
}

const RANGE_STORAGE_KEY = 'projects_forecast_all_range_v1'
const ACTIVE_ONLY_STORAGE_KEY = 'projects_forecast_all_active_only_v1'
const YMD_RX = /^\d{4}-\d{2}-\d{2}$/

const FINISHED_STATUSES = new Set<ForecastStageStatus>(['completed', 'approved', 'skipped'])

function todayYmdCentral(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function defaultRange(): { start: string; end: string } {
  const today = todayYmdCentral()
  return { start: ymdAddDays(today, -7), end: ymdAddDays(today, 90) }
}

function readStoredRange(): { start: string; end: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(RANGE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { start?: unknown; end?: unknown }
    const start = typeof parsed.start === 'string' && YMD_RX.test(parsed.start) ? parsed.start : null
    const end = typeof parsed.end === 'string' && YMD_RX.test(parsed.end) ? parsed.end : null
    if (!start || !end || start > end) return null
    return { start, end }
  } catch {
    return null
  }
}

function writeStoredRange(value: { start: string; end: string }) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* ignore quota errors */
  }
}

function readActiveOnly(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ACTIVE_ONLY_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeActiveOnly(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACTIVE_ONLY_STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore quota errors */
  }
}

function buildJobLabel(job: ForecastJob, prefixMap: LedgerPrefixMap): string {
  const prefix = resolveJobLedgerPrefix(job.service_type_id, prefixMap)
  const hcpLabel = formatJobLedgerNumberLabel(prefix, job.hcp_number)
  return `${hcpLabel} · ${(job.job_name ?? '').trim() || '—'}`
}

type JobRow = {
  job: ForecastJob
  resolved: ResolvedStageBar[]
}

export function ProjectsForecastAllStagesTab({
  jobs,
  workflowByProject,
  stagesByWorkflow,
  prefixMap,
  loading,
}: Props) {
  const initialRange = useMemo(() => readStoredRange() ?? defaultRange(), [])
  const [rangeStart, setRangeStart] = useState<string>(initialRange.start)
  const [rangeEnd, setRangeEnd] = useState<string>(initialRange.end)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeOnly, setActiveOnlyState] = useState<boolean>(() => readActiveOnly())

  const persistRange = useCallback((start: string, end: string) => {
    setRangeStart(start)
    setRangeEnd(end)
    if (YMD_RX.test(start) && YMD_RX.test(end) && start <= end) {
      writeStoredRange({ start, end })
    }
  }, [])

  const setActiveOnly = useCallback((value: boolean) => {
    setActiveOnlyState(value)
    writeActiveOnly(value)
  }, [])

  const todayYmd = useMemo(() => todayYmdCentral(), [])
  const dayKeys = useMemo(() => enumerateDaysInRange(rangeStart, rangeEnd), [rangeStart, rangeEnd])
  const dayKeyIndex = useMemo(() => buildForecastDayKeyIndex(dayKeys), [dayKeys])

  // Resolve every job's stages, dropping jobs without a workflow (parent already filters those
  // out of `workflowByProject`, but the join may yield a workflow with zero rows yet).
  const allRows = useMemo<JobRow[]>(() => {
    const rows: JobRow[] = []
    for (const job of jobs) {
      const wfId = workflowByProject.get(job.project_id)
      if (!wfId) continue
      const stages = stagesByWorkflow.get(wfId) ?? []
      const resolved = resolveForecastStages(stages, todayYmd)
      rows.push({ job, resolved })
    }
    return rows
  }, [jobs, workflowByProject, stagesByWorkflow, todayYmd])

  // Apply Active-only toggle first (filters the population the search reports against).
  const activeFilteredRows = useMemo<JobRow[]>(() => {
    if (!activeOnly) return allRows
    return allRows.filter((row) => {
      if (row.resolved.length === 0) return true
      // Active = at least one stage NOT in {completed, approved, skipped}.
      for (const r of row.resolved) {
        if (r.status == null || !FINISHED_STATUSES.has(r.status)) return true
      }
      return false
    })
  }, [allRows, activeOnly])

  const searchActive = normalizeForecastJobSearchQuery(searchQuery).length > 0
  const searchFilteredRows = useMemo<JobRow[]>(() => {
    if (!searchActive) return activeFilteredRows
    // Filter via job match — keep row references intact.
    const matchedJobs = filterForecastJobsBySearch(
      activeFilteredRows.map((r) => r.job),
      searchQuery,
      prefixMap,
    )
    const matchedIds = new Set(matchedJobs.map((j) => j.id))
    return activeFilteredRows.filter((r) => matchedIds.has(r.job.id))
  }, [activeFilteredRows, searchQuery, prefixMap, searchActive])

  // Window the rows we actually render to those with at least one bar overlapping the visible
  // range. Mirrors Job History's `bar.lastWorkDateYmd < rangeStart || bar.firstWorkDateYmd > rangeEnd`
  // guard so a job whose stages are entirely outside the window doesn't take up a blank row.
  const visibleRows = useMemo<JobRow[]>(() => {
    if (dayKeys.length === 0) return []
    const start = rangeStart
    const end = rangeEnd
    return searchFilteredRows.filter((row) => {
      for (const r of row.resolved) {
        if (r.endYmd >= start && r.startYmd <= end) return true
      }
      return false
    })
  }, [searchFilteredRows, dayKeys.length, rangeStart, rangeEnd])

  const onOpenWorkflow = useCallback(
    (projectId: string, stageId: string | null) => {
      const url = `/workflows/${projectId}${stageId ? `#step-${stageId}` : ''}`
      try {
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch {
        window.location.href = url
      }
    },
    [],
  )

  const rangeInvalid = !YMD_RX.test(rangeStart) || !YMD_RX.test(rangeEnd) || rangeStart > rangeEnd
  const summaryText: string = loading
    ? 'Loading…'
    : visibleRows.length === 0
      ? searchActive
        ? 'No jobs match this search in the current range.'
        : activeOnly
          ? 'No jobs with active stages in this range.'
          : 'No jobs with project workflows in this range.'
      : `${visibleRows.length} job${visibleRows.length === 1 ? '' : 's'} · ${dayKeys.length} day${dayKeys.length === 1 ? '' : 's'}`
  const searchMatchStatus: string | null = searchActive
    ? `${visibleRows.length} of ${activeFilteredRows.length} match${activeFilteredRows.length === 1 ? '' : 'es'}`
    : null

  // Memo so the empty-state element is stable between renders when the same string is shown.
  const emptyState = useMemo(() => <span>{summaryText}</span>, [summaryText])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={forecastToolbarRowStyle}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={summaryText}
              aria-label="Search jobs by HCP #, name, address, or project name"
              style={forecastSearchInputStyle}
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                title="Clear search"
                style={forecastSearchClearButtonStyle}
              >
                ×
              </button>
            )}
          </div>
          {searchMatchStatus && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} aria-live="polite">
              {searchMatchStatus}
            </span>
          )}
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
          role="group"
          aria-label="Forecast All Stages date range"
        >
          <label style={forecastToolbarLabelStyle}>
            From
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => persistRange(e.target.value, rangeEnd)}
              max={rangeEnd || undefined}
              aria-label="Forecast All Stages range start"
              title={rangeStart}
              style={forecastDateInputStyle}
            />
          </label>
          <label style={forecastToolbarLabelStyle}>
            To
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => persistRange(rangeStart, e.target.value)}
              min={rangeStart || undefined}
              aria-label="Forecast All Stages range end"
              title={rangeEnd}
              style={forecastDateInputStyle}
            />
          </label>
          {rangeInvalid && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Pick both dates to set the range.
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              const r = defaultRange()
              persistRange(r.start, r.end)
            }}
            style={forecastChipStyle}
            title="Reset to default (today − 7d to today + 90d)"
          >
            Reset to default
          </button>
        </div>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.875rem',
            color: 'var(--text-700)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          Only show jobs with active stages
        </label>
      </div>

      <ProjectsForecastTimelineGrid<JobRow>
        rows={visibleRows}
        rowKey={(r) => r.job.id}
        dayKeys={dayKeys}
        todayYmd={todayYmd}
        labelGutterWidth={260}
        rowLabel={(r) => (
          <JobGutterLabel
            job={r.job}
            prefixMap={prefixMap}
            onClick={() => onOpenWorkflow(r.job.project_id, null)}
          />
        )}
        renderRow={(r) => (
          <JobStageBars
            row={r}
            dayKeyIndex={dayKeyIndex}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onStageClick={(stageId) => onOpenWorkflow(r.job.project_id, stageId)}
          />
        )}
        emptyState={emptyState}
      />
    </div>
  )
}

function JobGutterLabel({
  job,
  prefixMap,
  onClick,
}: {
  job: ForecastJob
  prefixMap: LedgerPrefixMap
  onClick: () => void
}) {
  const label = buildJobLabel(job, prefixMap)
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open workflow — ${label}`}
      aria-label={`Open workflow for ${label}`}
      style={{
        all: 'unset',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        overflow: 'hidden',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontWeight: 600,
          color: 'var(--text-slate-900)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {job.project_name ? (
        <span
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {job.project_name}
        </span>
      ) : null}
    </button>
  )
}

function JobStageBars({
  row,
  dayKeyIndex,
  rangeStart,
  rangeEnd,
  onStageClick,
}: {
  row: JobRow
  dayKeyIndex: ReadonlyMap<string, number>
  rangeStart: string
  rangeEnd: string
  onStageClick: (stageId: string) => void
}) {
  if (row.resolved.length === 0) return null
  return (
    <>
      {row.resolved.map((r) => {
        const span = forecastBarColumnSpan(r.startYmd, r.endYmd, dayKeyIndex, rangeStart, rangeEnd)
        if (!span) return null
        const swatch = forecastBarSwatch(r.colorKey)
        const barStyle: CSSProperties = {
          gridColumn: `${span.startCol} / ${span.endCol}`,
          gridRow: 1,
          alignSelf: 'center',
          height: 26,
          minWidth: Math.max(FORECAST_COL_W - 4, 18),
          borderRadius: 4,
          background: swatch.background,
          border: `${r.isUnscheduled ? '1.5px' : '1px'} ${swatch.borderStyle} ${swatch.borderColor}`,
          color: swatch.textColor,
          display: 'flex',
          alignItems: 'center',
          padding: '0 6px',
          fontSize: '0.7rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
          textDecoration: swatch.textDecoration,
        }
        const tooltipParts = [
          `${r.sequenceOrder}. ${r.name}`,
          `${r.startYmd} → ${r.endYmd}`,
          r.isUnscheduled ? '(unscheduled — placeholder)' : null,
          r.assignee ? `Assignee: ${r.assignee}` : null,
        ].filter(Boolean)
        return (
          <button
            key={r.stageId}
            type="button"
            onClick={() => onStageClick(r.stageId)}
            title={tooltipParts.join('\n')}
            aria-label={`Stage ${r.name} from ${r.startYmd} to ${r.endYmd}`}
            style={barStyle}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
          </button>
        )
      })}
    </>
  )
}

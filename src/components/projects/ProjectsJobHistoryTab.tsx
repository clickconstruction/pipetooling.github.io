/**
 * Projects → Job History tab.
 *
 * Loads all `status = working` jobs (optionally filtered by `?customer=`), loads their approved
 * `clock_sessions`, and renders a horizontally-scrollable Gantt timeline of bars from each
 * job's first clock-in to its last clock-out (open-ended when no closed session yet).
 *
 * Each row is one job. Each column is one Chicago calendar day. Within a bar, days with actual
 * approved sessions are highlighted by distinct user count with a numeric badge; the HCP # +
 * job name floats on the bar via `position: sticky` while the bar is in the horizontal viewport.
 *
 * Range picker mirrors the People → Review custom-range block (cross-bounding From / To inputs);
 * default = today − 90d → today, persisted under `projects_job_history_range_v1`.
 *
 * Realtime: `clock_sessions` and `jobs_ledger` postgres_changes with `job_ledger_id=in.(...)` /
 * `id=in.(...)` filters (up to 80 ids) + 280 ms debounce, mirroring useDashboardMyTeamSectionState.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useDocumentVisibility } from '../../hooks/useDocumentVisibility'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'
import {
  buildLedgerPrefixMap,
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
  type LedgerPrefixMap,
} from '../../lib/ledgerDisplayPrefixes'
import {
  aggregateClockSessionsToBars,
  enumerateDaysInRange,
  type ProjectsJobHistoryBar,
  type ProjectsJobHistoryJob,
} from '../../lib/projectsJobHistoryData'
import { fetchProjectsJobHistoryClockSessions } from '../../lib/fetchProjectsJobHistoryClockSessions'
import {
  readProjectsJobHistoryLayoutMode,
  writeProjectsJobHistoryLayoutMode,
  type ProjectsJobHistoryLayoutMode,
} from '../../lib/projectsJobHistoryLanePacking'
import {
  filterBarsBySearch,
  normalizeBarSearchQuery,
} from '../../lib/projectsJobHistoryBarSearch'
import { ProjectsJobHistoryTimeline } from './ProjectsJobHistoryTimeline'
import { ProjectsJobHistoryDayModal } from './ProjectsJobHistoryDayModal'

type Props = {
  customerId: string | null
}

type ServiceTypeRow = { id: string; ledger_job_prefix: string | null; ledger_bid_prefix: string | null }

const RANGE_STORAGE_KEY = 'projects_job_history_range_v1'
const ONLY_WITH_PROJECTS_STORAGE_KEY = 'projects_job_history_only_with_projects_v1'
const MAX_REALTIME_IN_IDS = 80
const REALTIME_DEBOUNCE_MS = 280

const YMD_RX = /^\d{4}-\d{2}-\d{2}$/

function todayChicagoYmd(): string {
  return denverCalendarDayKey(Date.now())
}

function defaultRange(): { start: string; end: string } {
  const end = todayChicagoYmd()
  const start = ymdAddDays(end, -90)
  return { start, end }
}

function readPersistedRange(): { start: string; end: string } | null {
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

function writePersistedRange(start: string, end: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify({ start, end }))
  } catch {
    /* ignore quota errors */
  }
}

function readOnlyWithProjects(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ONLY_WITH_PROJECTS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeOnlyWithProjects(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ONLY_WITH_PROJECTS_STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore quota errors */
  }
}

export function ProjectsJobHistoryTab({ customerId }: Props) {
  const { user: authUser, role: authRole } = useAuth()
  const authUserId = authUser?.id ?? null
  const isDocVisible = useDocumentVisibility()
  const jobDetailModal = useJobDetailModal()
  const jobFormModal = useJobFormModal()
  const [dayModal, setDayModal] = useState<{ bar: ProjectsJobHistoryBar; workDateYmd: string } | null>(null)

  const initialRange = useMemo(() => readPersistedRange() ?? defaultRange(), [])
  const [rangeStart, setRangeStart] = useState<string>(initialRange.start)
  const [rangeEnd, setRangeEnd] = useState<string>(initialRange.end)
  const [layoutMode, setLayoutModeState] = useState<ProjectsJobHistoryLayoutMode>(
    () => readProjectsJobHistoryLayoutMode(),
  )
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [onlyWithProjects, setOnlyWithProjectsState] = useState<boolean>(() => readOnlyWithProjects())

  const setOnlyWithProjects = useCallback((value: boolean) => {
    setOnlyWithProjectsState(value)
    writeOnlyWithProjects(value)
  }, [])

  const setLayoutMode = useCallback((mode: ProjectsJobHistoryLayoutMode) => {
    setLayoutModeState(mode)
    writeProjectsJobHistoryLayoutMode(mode)
  }, [])

  const [jobs, setJobs] = useState<ProjectsJobHistoryJob[]>([])
  const [prefixMap, setPrefixMap] = useState<LedgerPrefixMap>({})
  const [bars, setBars] = useState<ProjectsJobHistoryBar[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadGenRef = useRef(0)

  const persistRange = useCallback((start: string, end: string) => {
    setRangeStart(start)
    setRangeEnd(end)
    writePersistedRange(start, end)
  }, [])

  // ---- Load working jobs + service-type prefix map ----
  const loadJobs = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingJobs(true)
      setError(null)
      const gen = ++loadGenRef.current
      try {
        let query = supabase
          .from('jobs_ledger')
          .select('id, hcp_number, click_number, job_name, job_address, service_type_id, project_id, customer_id, status')
          .eq('status', 'working')
          .order('hcp_number', { ascending: false })
        if (customerId) query = query.eq('customer_id', customerId)
        const data = (await withSupabaseRetry(
          async () => query,
          'fetch jobs_ledger working for projects job history',
        )) as unknown as Array<{
          id: string
          hcp_number: string
          click_number: string
          job_name: string
          job_address: string | null
          service_type_id: string | null
          project_id: string | null
          customer_id: string | null
          status: string
        }> | null
        if (gen !== loadGenRef.current) return
        const rows = data ?? []
        const slim: ProjectsJobHistoryJob[] = rows.map((r) => ({
          id: r.id,
          hcp_number: r.hcp_number,
          click_number: r.click_number,
          job_name: r.job_name,
          job_address: r.job_address ?? '',
          service_type_id: r.service_type_id ?? null,
          project_id: r.project_id ?? null,
        }))
        setJobs(slim)

        // Service types — small global list; one query is fine and gives the prefix map for sticky labels.
        const stData = (await withSupabaseRetry(
          async () =>
            supabase
              .from('service_types')
              .select('id, ledger_job_prefix, ledger_bid_prefix'),
          'fetch service_types for projects job schedule prefix map',
        )) as unknown as ServiceTypeRow[] | null
        if (gen !== loadGenRef.current) return
        setPrefixMap(buildLedgerPrefixMap(stData ?? []))
      } catch (e) {
        if (gen !== loadGenRef.current) return
        setError(formatErrorMessage(e, 'Failed to load working jobs'))
        setJobs([])
        setPrefixMap({})
      } finally {
        if (gen === loadGenRef.current) setLoadingJobs(false)
      }
    },
    [customerId],
  )

  // ---- Load clock sessions for those jobs and aggregate to bars ----
  const loadSessions = useCallback(
    async (silent = false) => {
      const ids = jobs.map((j) => j.id)
      if (!silent) setLoadingSessions(true)
      if (ids.length === 0) {
        setBars([])
        setLoadingSessions(false)
        return
      }
      const gen = loadGenRef.current
      const res = await fetchProjectsJobHistoryClockSessions(ids)
      if (gen !== loadGenRef.current) return
      if (!res.ok) {
        setError(res.error)
        setBars([])
        setLoadingSessions(false)
        return
      }
      const today = todayChicagoYmd()
      const built = aggregateClockSessionsToBars(jobs, res.rows, today)
      setBars(built)
      setLoadingSessions(false)
    },
    [jobs],
  )

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  // ---- Realtime: refresh sessions on clock_sessions changes + refetch jobs on jobs_ledger updates. ----
  useEffect(() => {
    if (!authUserId) return
    const jobIds = jobs.map((j) => j.id)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const schedule = (kind: 'sessions' | 'jobs') => {
      if (!isDocVisible) return
      if (debounceTimer != null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
        if (kind === 'jobs') {
          void loadJobs(true)
        } else {
          void loadSessions(true)
        }
      }, REALTIME_DEBOUNCE_MS)
    }
    const channel = supabase.channel(`projects-job-history-${authUserId}`)
    const idsSorted = jobIds.filter(Boolean).sort()
    const useIn = idsSorted.length > 0 && idsSorted.length <= MAX_REALTIME_IN_IDS
    if (useIn) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clock_sessions',
          filter: `job_ledger_id=in.(${idsSorted.join(',')})`,
        },
        () => schedule('sessions'),
      )
    } else {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clock_sessions' },
        () => schedule('sessions'),
      )
    }
    // Always listen unfiltered for jobs_ledger changes so we catch jobs flipping INTO `working`
    // (not yet in `idsSorted`) as well as jobs leaving the working set. Event volume on this
    // table is low compared to clock_sessions.
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'jobs_ledger' },
      () => schedule('jobs'),
    )
    channel.subscribe()
    return () => {
      if (debounceTimer != null) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [authUserId, jobs, isDocVisible, loadJobs, loadSessions])

  const dayKeys = useMemo(() => enumerateDaysInRange(rangeStart, rangeEnd), [rangeStart, rangeEnd])
  // Today's Chicago calendar key is effectively stable across a session for this UI; we don't
  // need to re-derive it on every render.
  const todayKey = useMemo(() => todayChicagoYmd(), [])

  // Apply the "only show jobs with projects" toggle BEFORE the search filter so the
  // search match counter reflects the same population the user sees on screen. When the
  // toggle is off, this is a stable reference to `bars` so downstream `useMemo`
  // dependencies don't see a new array on every render.
  const projectFilteredBars = useMemo(
    () => (onlyWithProjects ? bars.filter((b) => b.projectId != null) : bars),
    [bars, onlyWithProjects],
  )

  // Client-side search filter — case-insensitive substring across HCP label / job name /
  // address. When the query is blank, the helper returns the same `projectFilteredBars`
  // array reference so downstream `useMemo` callsites (`detailAssignedRows`, the
  // timeline's compact-mode pack) don't recompute unnecessarily.
  const filteredBars = useMemo(
    () => filterBarsBySearch(projectFilteredBars, searchQuery, prefixMap),
    [projectFilteredBars, searchQuery, prefixMap],
  )
  const searchActive = normalizeBarSearchQuery(searchQuery).length > 0

  // Summary line that doubles as the search input's placeholder when no query is active.
  // When the search is active we instead surface the match count next to the input as a
  // small inline status, since the placeholder would be hidden by the user's text anyway.
  const summaryText: string = loadingJobs || loadingSessions
    ? 'Loading…'
    : projectFilteredBars.length === 0
      ? (onlyWithProjects
          ? 'No working jobs linked to a project in scope.'
          : 'No working jobs with approved clock sessions in scope.')
      : `${projectFilteredBars.length} job${projectFilteredBars.length === 1 ? '' : 's'} · ${dayKeys.length} day${dayKeys.length === 1 ? '' : 's'}`
  const searchMatchStatus: string | null = searchActive
    ? `${filteredBars.length} of ${projectFilteredBars.length} match${projectFilteredBars.length === 1 ? '' : 'es'}`
    : null

  // Lazy `assignedJobsRows` snapshot built off the bars we just rendered. Used to seed Job Detail
  // modal's job-picker — keeps navigation context local to the timeline rather than relying on
  // JobsListCache (which may not have hydrated when a user lands on /projects directly). Built
  // from the **filtered** bars so the job-picker matches what the user sees on screen.
  const detailAssignedRows = useMemo(
    () =>
      filteredBars.map((b) => ({
        id: b.jobId,
        hcp_number: b.hcpNumber,
        job_name: b.jobName,
        job_address: b.jobAddress,
        google_drive_link: null as string | null,
        job_plans_link: null as string | null,
        revenue: null as number | null,
        project_id: null as string | null,
      })),
    [filteredBars],
  )

  const buildJobLabel = useCallback(
    (bar: ProjectsJobHistoryBar): string => {
      const prefix = resolveJobLedgerPrefix(bar.serviceTypeId, prefixMap)
      const hcpLabel = formatJobLedgerNumberLabel(prefix, bar.hcpNumber, bar.clickNumber)
      return `${hcpLabel} · ${(bar.jobName ?? '').trim() || '—'}`
    },
    [prefixMap],
  )

  const onJobLabelClick = useCallback(
    (bar: ProjectsJobHistoryBar) => {
      if (!jobFormModal) return
      jobFormModal.openEditJob(bar.jobId)
    },
    [jobFormModal],
  )

  const onBarClick = useCallback(
    (bar: ProjectsJobHistoryBar) => {
      if (!jobDetailModal) return
      jobDetailModal.openJobDetail({
        jobId: bar.jobId,
        scheduleContext: null,
        prefillRowLabel: buildJobLabel(bar),
        prefillAddress: (bar.jobAddress ?? '').trim() || null,
        assignedJobsRows: detailAssignedRows,
      })
    },
    [jobDetailModal, buildJobLabel, detailAssignedRows],
  )

  const onDayCellClick = useCallback(
    (bar: ProjectsJobHistoryBar, workDateYmd: string) => {
      setDayModal({ bar, workDateYmd })
    },
    [],
  )

  const closeDayModal = useCallback(() => setDayModal(null), [])

  const onDayModalOpenEditJob = useCallback(() => {
    if (!dayModal || !jobFormModal) return
    jobFormModal.openEditJob(dayModal.bar.jobId)
    closeDayModal()
  }, [dayModal, jobFormModal, closeDayModal])

  const onDayModalOpenJobDetail = useCallback(() => {
    if (!dayModal || !jobDetailModal) return
    const { bar } = dayModal
    jobDetailModal.openJobDetail({
      jobId: bar.jobId,
      scheduleContext: null,
      prefillRowLabel: buildJobLabel(bar),
      prefillAddress: (bar.jobAddress ?? '').trim() || null,
      assignedJobsRows: detailAssignedRows,
    })
    closeDayModal()
  }, [dayModal, jobDetailModal, buildJobLabel, detailAssignedRows, closeDayModal])

  // Jump the day modal to a different day for the same bar — wired to the mini-Gantt's
  // clickable cells. Keeps the existing `bar` so the strip context stays correct; the modal's
  // own useEffect on `workDateYmd` re-fetches sessions / reports / costs for the new day.
  const onDayModalSelectWorkDate = useCallback((ymd: string) => {
    setDayModal((prev) => (prev && prev.workDateYmd !== ymd ? { ...prev, workDateYmd: ymd } : prev))
  }, [])

  const onPreset = useCallback(
    (deltaDays: number) => {
      const end = todayChicagoYmd()
      const start = ymdAddDays(end, -deltaDays)
      persistRange(start, end)
    },
    [persistRange],
  )

  const rangeInvalid = !rangeStart || !rangeEnd || rangeStart > rangeEnd

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={summaryText}
                aria-label="Search jobs by HCP #, name, or address"
                style={searchInputStyle}
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  title="Clear search"
                  style={searchClearButtonStyle}
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
            aria-label="Job History date range"
          >
            <label style={labelStyle}>
              From
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => persistRange(e.target.value, rangeEnd)}
                max={rangeEnd || undefined}
                aria-label="Job History range start"
                title={rangeStart || undefined}
                style={dateInputStyle}
              />
            </label>
            <label style={labelStyle}>
              To
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => persistRange(rangeStart, e.target.value)}
                min={rangeStart || undefined}
                aria-label="Job History range end"
                title={rangeEnd || undefined}
                style={dateInputStyle}
              />
            </label>
            {rangeInvalid && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Pick both dates to set the range.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => onPreset(90)} style={chipStyle}>
              Last 90d
            </button>
            <button type="button" onClick={() => onPreset(365)} style={chipStyle}>
              Last 365d
            </button>
            <div
              role="group"
              aria-label="Job History layout mode"
              style={{ display: 'inline-flex', gap: 0, marginLeft: '0.25rem' }}
            >
              <button
                type="button"
                aria-pressed={layoutMode === 'expanded'}
                onClick={() => setLayoutMode('expanded')}
                style={layoutToggleStyle(layoutMode === 'expanded', 'left')}
                title="One row per job"
              >
                Expanded
              </button>
              <button
                type="button"
                aria-pressed={layoutMode === 'compact'}
                onClick={() => setLayoutMode('compact')}
                style={layoutToggleStyle(layoutMode === 'compact', 'right')}
                title="Pack non-overlapping jobs onto shared rows"
              >
                Compact
              </button>
            </div>
          </div>
        </div>
      </div>

      {(() => {
        const linkedCount = bars.filter((b) => b.projectId != null).length
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '-0.25rem',
              marginBottom: '0.75rem',
              fontSize: '0.875rem',
              color: 'var(--text-700)',
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              title="Hide jobs that are not linked to a multi-phase project"
            >
              <input
                type="checkbox"
                checked={onlyWithProjects}
                onChange={(e) => setOnlyWithProjects(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Only show jobs with projects
            </label>
            {!loadingJobs && bars.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} aria-live="polite">
                {linkedCount} of {bars.length} linked
              </span>
            )}
          </div>
        )
      })()}

      {error && (
        <p role="alert" style={{ color: 'var(--text-red-700)', marginTop: 0 }}>
          {error}
        </p>
      )}

      {!rangeInvalid && projectFilteredBars.length > 0 && dayKeys.length > 0 && filteredBars.length > 0 && (
        <ProjectsJobHistoryTimeline
          bars={filteredBars}
          dayKeys={dayKeys}
          todayYmd={todayKey}
          prefixMap={prefixMap}
          appCalendarTz={APP_CALENDAR_TZ}
          onJobLabelClick={onJobLabelClick}
          onBarClick={onBarClick}
          onDayCellClick={onDayCellClick}
          layoutMode={layoutMode}
        />
      )}

      {!rangeInvalid && projectFilteredBars.length > 0 && dayKeys.length > 0 && filteredBars.length === 0 && searchActive && (
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          No jobs match &ldquo;{searchQuery.trim()}&rdquo;
          {onlyWithProjects ? ' among jobs linked to a project' : ''}.
        </p>
      )}

      {!rangeInvalid && bars.length > 0 && projectFilteredBars.length === 0 && onlyWithProjects && (
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          No working jobs in scope are linked to a project.{' '}
          <button
            type="button"
            onClick={() => setOnlyWithProjects(false)}
            style={{
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-link)',
              textDecoration: 'underline',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Show all jobs
          </button>
        </p>
      )}

      {dayModal && (
        <ProjectsJobHistoryDayModal
          open
          onClose={closeDayModal}
          jobId={dayModal.bar.jobId}
          jobTitle={buildJobLabel(dayModal.bar)}
          workDateYmd={dayModal.workDateYmd}
          bar={dayModal.bar}
          todayYmd={todayKey}
          authUserId={authUserId}
          userRole={authRole}
          onOpenEditJob={onDayModalOpenEditJob}
          onOpenJobDetail={onDayModalOpenJobDetail}
          onSelectWorkDate={onDayModalSelectWorkDate}
        />
      )}
    </div>
  )
}

const chipStyle: React.CSSProperties = {
  padding: '0.25rem 0.6rem',
  fontSize: '0.8125rem',
  background: 'var(--bg-slate-100)',
  color: 'var(--text-sky-700)',
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.875rem',
  color: 'var(--text-700)',
}

/**
 * Compact From / To date input.
 *
 * Native `<input type="date">` does not expose a way to hide the year — the browser owns
 * the visible rendering. Instead we shrink the field's width to roughly the size of
 * `MM/DD/` plus the calendar-picker icon, which lets the browser clip the trailing `YYYY`
 * (using its default `text-overflow: clip` behavior). Clicking the field still opens the
 * full native calendar picker with year navigation, and the underlying `value` remains a
 * full `YYYY-MM-DD` string — so all the existing range logic and serialization keep
 * working. The `title` attribute on the `<input>` exposes the complete date on hover.
 *
 * 92 px is the sweet spot on Chrome / Safari at this `fontSize: 0.875rem`: the year
 * clips cleanly without cutting into the day portion.
 */
const dateInputStyle: React.CSSProperties = {
  padding: '0.35rem 0.3rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.875rem',
  width: 92,
  boxSizing: 'border-box',
}

const searchInputStyle: React.CSSProperties = {
  padding: '0.35rem 1.6rem 0.35rem 0.7rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  fontSize: '0.875rem',
  minWidth: 240,
  background: 'var(--surface)',
}

/** Floating × inside the rounded search pill — visible only when the input has content. */
const searchClearButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 6,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 20,
  height: 20,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '1rem',
  lineHeight: 1,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/**
 * Segmented two-button style for the Expanded / Compact toggle. Buttons sit flush against
 * one another (no inter-button gap), share an outer rounded shape, and the active button
 * picks up a light-blue inset background that visually distinguishes it from chips.
 */
function layoutToggleStyle(active: boolean, side: 'left' | 'right'): React.CSSProperties {
  return {
    padding: '0.25rem 0.65rem',
    fontSize: '0.8125rem',
    background: active ? 'var(--bg-blue-200)' : 'var(--surface)',
    color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
    border: active ? '1px solid #1d4ed8' : '1px solid var(--border-strong)',
    borderRadius: side === 'left' ? '999px 0 0 999px' : '0 999px 999px 0',
    marginLeft: side === 'right' ? -1 : 0,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  }
}

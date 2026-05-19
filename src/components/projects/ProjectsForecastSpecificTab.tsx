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

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import {
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
  type LedgerPrefixMap,
} from '../../lib/ledgerDisplayPrefixes'
import {
  resolveForecastStages,
  resolvedStagesEnvelope,
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
  forecastSecondaryButtonStyle,
  forecastToolbarRowStyle,
} from '../../lib/projectsForecastToolbarStyles'
import {
  buildSpecificForecastColumns,
  type SpecificForecastStageSpan,
} from '../../lib/projectsForecastSpecificColumns'
import { canAlignStages } from '../../lib/projectsForecastAlignStages'
import {
  buildDragEditPlan,
  type DragEditMode,
  type DragEditOverride,
  type DragEditStageInput,
} from '../../lib/projectsForecastDragEdit'
import { enumerateDaysInRange } from '../../lib/projectsJobHistoryData'
import { ymdAddDays } from '../../utils/dateUtils'
import type {
  ForecastJob,
  ForecastStage,
  ForecastWorkflowMap,
} from '../../lib/projectsForecastData'
import { ProjectsForecastSpecificGrid } from './ProjectsForecastSpecificGrid'
import { ProjectsForecastSpecificStageModal } from './ProjectsForecastSpecificStageModal'
import { ProjectsForecastAlignStagesModal } from './ProjectsForecastAlignStagesModal'
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
  /** Current user's role — forwarded into the stage detail modal to gate its edit
   *  controls. The modal degrades to a read-only details view when the role isn't
   *  allowed to write to `project_workflow_steps`. */
  myRole: string | null
}

const SELECTED_JOB_STORAGE_KEY = 'projects_forecast_specific_selected_job_v1'
const SHOW_DATES_STORAGE_KEY = 'projects_forecast_specific_show_dates_v1'

/** When "Show dates" is on, pad the dense calendar this many days past the last
 *  resolved stage so users can see future planning runway after the workflow ends. */
const SHOW_DATES_TRAILING_DAYS = 90

/** Minimum horizontal travel (in CSS pixels) before a body-drag in drag-edit mode
 *  promotes itself from a tentative click into an actual translate gesture. Below
 *  this threshold the pointerup falls through to the bar's native onClick so the
 *  user can still tap a bar to open its stage modal in drag-edit mode. */
const BODY_DRAG_THRESHOLD_PX = 4

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

function readShowDates(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SHOW_DATES_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeShowDates(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SHOW_DATES_STORAGE_KEY, value ? '1' : '0')
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
  const [alignModalOpen, setAlignModalOpen] = useState<boolean>(false)
  const [showDates, setShowDatesState] = useState<boolean>(() => readShowDates())

  const setShowDates = useCallback((next: boolean) => {
    setShowDatesState(next)
    writeShowDates(next)
  }, [])

  // Drag-edit mode: when on, every dense-mode bar gets a right-edge resize handle and
  // dragging it shifts that stage's end (and every later stage) by Δdays. State below
  // also lives at the parent so a single drag can update many stages' visual positions
  // atomically.
  const [dragEdit, setDragEdit] = useState<boolean>(false)
  const [dragOverrides, setDragOverrides] = useState<ReadonlyMap<string, DragEditOverride>>(
    new Map(),
  )
  const [dragSaving, setDragSaving] = useState<boolean>(false)
  const { showToast } = useToastContext()

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

  // Apply any in-flight drag overrides on top of the resolved bars. While the user is
  // mid-drag (or the commit is still in-flight) this map points the affected stages at
  // their pending dates so the dense calendar paints the live preview. Empty map ->
  // returns `resolvedBars` directly (no allocation).
  const effectiveResolvedBars = useMemo<ResolvedStageBar[]>(() => {
    if (dragOverrides.size === 0) return resolvedBars
    return resolvedBars.map((b) => {
      const ov = dragOverrides.get(b.stageId)
      return ov ? { ...b, startYmd: ov.startYmd, endYmd: ov.endYmd } : b
    })
  }, [resolvedBars, dragOverrides])

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

  // Dense-calendar layout (only computed when "Show dates" is on): every day in the
  // resolved-bar envelope becomes its own column, mirroring the All Stages tab.
  //
  // The envelope is intentionally derived from `resolvedBars` (the persisted source of
  // truth) — NOT from `effectiveResolvedBars` — so the column structure stays stable
  // during a drag. If we re-derived from the override-merged bars, every tick that
  // crossed a day boundary would grow `dayKeys`, which would invalidate the grid's
  // header memos and re-fire its auto-scroll-to-today effect, yanking the scroll
  // position out from under the cursor and making the drag feel laggy. With the
  // +90-day trailing pad below, forward drags up to ~90 days fit inside the existing
  // columns; a bar that exceeds the pad clips cleanly via `forecastBarColumnSpan`,
  // matching the "very long envelope" edge case in the All Stages tab.
  const denseEnvelope = useMemo(
    () => resolvedStagesEnvelope(resolvedBars),
    [resolvedBars],
  )
  const denseDayKeys = useMemo(
    () =>
      showDates && denseEnvelope
        ? enumerateDaysInRange(
            denseEnvelope.startYmd,
            ymdAddDays(denseEnvelope.endYmd, SHOW_DATES_TRAILING_DAYS),
          )
        : [],
    [showDates, denseEnvelope],
  )
  const denseDayKeyIndex = useMemo(
    () => buildForecastDayKeyIndex(denseDayKeys),
    [denseDayKeys],
  )
  const denseRangeStart = denseDayKeys[0] ?? ''
  const denseRangeEnd = denseDayKeys[denseDayKeys.length - 1] ?? ''

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
    (stage: ResolvedStageBar, idx: number) => (
      // Show the user-facing row position (1, 2, 3, …) in the chip — the raw
      // `sequence_order` is sparse (template authors leave gaps for future inserts and
      // copy/insert operations on the Workflow page also create gaps), which made the chip
      // numbers look arbitrary (e.g. 3, 5, 7, 16, 17, 21, 22). The raw value is still
      // available on `stage.sequenceOrder` and surfaced in the chip's tooltip so it can be
      // cross-referenced with the Workflow page when needed.
      <StageGutterLabel
        resolved={stage}
        displayNumber={idx + 1}
        onClick={() => onOpenStage(stage.stageId)}
      />
    ),
    [onOpenStage],
  )

  const openStageBar = useMemo<ResolvedStageBar | null>(() => {
    if (!openStageId) return null
    return effectiveResolvedBars.find((b) => b.stageId === openStageId) ?? null
  }, [openStageId, effectiveResolvedBars])

  // Close the modal automatically if the underlying job changes (so we don't leave a
  // stale modal mounted with bar data from a different job).
  useEffect(() => {
    if (openStageId == null) return
    if (!resolvedBars.some((b) => b.stageId === openStageId)) {
      setOpenStageId(null)
    }
  }, [openStageId, resolvedBars])

  const hasJob = selectedJob != null
  const canAlign = canAlignStages(myRole)
  const alignDisabledReason = !hasJob
    ? 'Pick a job first'
    : selectedStages.length < 2
      ? 'Need at least 2 stages to align'
      : null
  const dragDisabledReason = !hasJob
    ? 'Pick a job first'
    : resolvedBars.length === 0
      ? 'No stages to drag'
      : null

  // ── Drag-edit handlers ────────────────────────────────────────────────────────
  // Refs are needed inside document-level pointer handlers so the handlers always
  // see the latest stages snapshot regardless of React render scheduling.
  //
  // Baseline = `effectiveResolvedBars` (post-override) so a chained drag started
  // before the previous commit's realtime refresh has reconciled uses the visual
  // position as its origin, not the stale persisted position.
  const dragStages = useMemo<DragEditStageInput[]>(
    () =>
      effectiveResolvedBars.map((b) => ({
        stageId: b.stageId,
        sequenceOrder: b.sequenceOrder,
        startYmd: b.startYmd,
        endYmd: b.endYmd,
      })),
    [effectiveResolvedBars],
  )
  const stagesForDragRef = useRef<readonly DragEditStageInput[]>(dragStages)
  useEffect(() => {
    stagesForDragRef.current = dragStages
  }, [dragStages])
  const dragSessionRef = useRef<{
    stageId: string
    startX: number
    originalStages: readonly DragEditStageInput[]
    /** Stage IDs the drag is allowed to override (the dragged stage + every later
     *  stage by sequence order). The move handler only mutates entries inside this
     *  set, so pending-reconciliation overrides on unrelated stages from a previous
     *  commit are preserved across the new drag. */
    affectedStageIds: ReadonlySet<string>
    /** Which gesture this session represents — drives the `mode` arg passed to
     *  `buildDragEditPlan`. */
    mode: DragEditMode
    /** Right-edge drags activate immediately on pointerdown (gesture is unambiguous
     *  thanks to the dedicated handle). Body drags stay inactive until the cursor
     *  moves past `BODY_DRAG_THRESHOLD_PX` so a no-move pointerup falls through to
     *  the bar's native click handler (which opens the stage modal). */
    activated: boolean
  } | null>(null)
  const moveHandlerRef = useRef<((ev: PointerEvent) => void) | null>(null)
  const upHandlerRef = useRef<((ev: PointerEvent) => void) | null>(null)

  const teardownDragListeners = useCallback(() => {
    if (moveHandlerRef.current) {
      document.removeEventListener('pointermove', moveHandlerRef.current)
      moveHandlerRef.current = null
    }
    if (upHandlerRef.current) {
      document.removeEventListener('pointerup', upHandlerRef.current)
      upHandlerRef.current = null
    }
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  const commitDragEdit = useCallback(
    async (overrides: ReadonlyMap<string, DragEditOverride>) => {
      if (overrides.size === 0) return
      setDragSaving(true)
      const entries = Array.from(overrides.entries())
      const results = await Promise.all(
        entries.map(async ([stageId, ov]) => {
          try {
            await withSupabaseRetry(
              async () =>
                supabase
                  .from('project_workflow_steps')
                  .update({
                    scheduled_start_date: ov.startYmd,
                    scheduled_end_date: ov.endYmd,
                  })
                  .eq('id', stageId),
              `drag-edit project_workflow_steps row ${stageId}`,
            )
            return { stageId, ok: true as const }
          } catch (e) {
            return {
              stageId,
              ok: false as const,
              error: formatErrorMessage(e, 'Save failed'),
            }
          }
        }),
      )
      const okCount = results.filter((r) => r.ok).length
      const failCount = results.length - okCount
      // Clear ONLY the failed-row overrides so those bars revert to the persisted
      // (pre-drag) position, signaling the rejection. Successful rows keep their
      // override entries until the reconciler effect drops them once `resolvedBars`
      // catches up via realtime refetch — this prevents a visible "snap-back" in the
      // ~280ms-plus window between commit and the parent's realtime debouncer
      // running `loadStages`.
      const failedIds = new Set(
        results.filter((r) => !r.ok).map((r) => r.stageId),
      )
      if (failedIds.size > 0) {
        setDragOverrides((prev) => {
          const next = new Map(prev)
          for (const id of failedIds) next.delete(id)
          return next
        })
      }
      setDragSaving(false)
      if (failCount === 0) {
        showToast(
          `Saved ${okCount} ${okCount === 1 ? 'stage' : 'stages'}.`,
          'success',
        )
      } else if (okCount === 0) {
        const firstError = results.find((r) => !r.ok)
        showToast(
          firstError && !firstError.ok ? firstError.error : 'Drag-edit save failed.',
          'error',
        )
      } else {
        showToast(
          `Saved ${okCount} of ${results.length}; ${failCount} failed.`,
          'error',
        )
      }
    },
    [showToast],
  )

  const onBarDragStart = useCallback(
    (stageId: string, e: ReactPointerEvent<HTMLElement>) => {
      // Avoid interfering with the bar's click handler — drag is the explicit gesture
      // here, so we suppress the rest of the event chain.
      e.preventDefault()
      e.stopPropagation()
      // Release any in-flight session before starting a new one (defensive — should
      // not happen in normal usage because pointerup tears down listeners).
      teardownDragListeners()
      const stages = stagesForDragRef.current
      const dragged = stages.find((s) => s.stageId === stageId)
      if (!dragged) return
      // Precompute the affected set so the move/up handlers can drop only the
      // dragged stage's overrides (and the cascading later stages) without
      // wiping pending-reconciliation entries from a prior commit.
      const affectedStageIds = new Set(
        stages
          .filter((s) => s.sequenceOrder >= dragged.sequenceOrder)
          .map((s) => s.stageId),
      )
      dragSessionRef.current = {
        stageId,
        startX: e.clientX,
        originalStages: stages,
        affectedStageIds,
        mode: 'extend',
        // Right-edge gesture is unambiguous — the user clicked the dedicated
        // handle, so we activate the drag overlay immediately.
        activated: true,
      }

      const handleMove = (ev: PointerEvent) => {
        const sess = dragSessionRef.current
        if (!sess) return
        const deltaDays = Math.round((ev.clientX - sess.startX) / FORECAST_COL_W)
        const plan = buildDragEditPlan(
          sess.originalStages,
          sess.stageId,
          deltaDays,
          sess.mode,
        )
        setDragOverrides((prev) => {
          const next = new Map(prev)
          for (const id of sess.affectedStageIds) next.delete(id)
          for (const [id, ov] of plan.overrides) next.set(id, ov)
          return next
        })
      }
      const handleUp = (ev: PointerEvent) => {
        teardownDragListeners()
        const sess = dragSessionRef.current
        dragSessionRef.current = null
        if (!sess) return
        const deltaDays = Math.round((ev.clientX - sess.startX) / FORECAST_COL_W)
        const plan = buildDragEditPlan(
          sess.originalStages,
          sess.stageId,
          deltaDays,
          sess.mode,
        )
        if (plan.effectiveDeltaDays === 0 || plan.overrides.size === 0) {
          setDragOverrides((prev) => {
            if (sess.affectedStageIds.size === 0) return prev
            const next = new Map(prev)
            for (const id of sess.affectedStageIds) next.delete(id)
            return next
          })
          return
        }
        // Don't await here — we're inside a DOM event handler. The async commit
        // updates state on its own when done.
        void commitDragEdit(plan.overrides)
      }

      moveHandlerRef.current = handleMove
      upHandlerRef.current = handleUp
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [commitDragEdit, teardownDragListeners],
  )

  // Body drag (translate). Mirrors `onBarDragStart` but:
  //   - calls `buildDragEditPlan(..., 'translate')` so the dragged stage shifts
  //     both ends together while later stages still cascade by the same delta;
  //   - waits for the cursor to move past `BODY_DRAG_THRESHOLD_PX` before
  //     activating, so a stationary pointerdown falls through to the bar's
  //     native `onClick` (which opens the stage modal);
  //   - does NOT call preventDefault / stopPropagation on the initial pointer
  //     event for the same reason.
  const onBarBodyDragStart = useCallback(
    (stageId: string, e: ReactPointerEvent<HTMLElement>) => {
      teardownDragListeners()
      const stages = stagesForDragRef.current
      const dragged = stages.find((s) => s.stageId === stageId)
      if (!dragged) return
      const affectedStageIds = new Set(
        stages
          .filter((s) => s.sequenceOrder >= dragged.sequenceOrder)
          .map((s) => s.stageId),
      )
      dragSessionRef.current = {
        stageId,
        startX: e.clientX,
        originalStages: stages,
        affectedStageIds,
        mode: 'translate',
        activated: false,
      }

      const handleMove = (ev: PointerEvent) => {
        const sess = dragSessionRef.current
        if (!sess) return
        const deltaPx = ev.clientX - sess.startX
        if (!sess.activated) {
          if (Math.abs(deltaPx) < BODY_DRAG_THRESHOLD_PX) return
          sess.activated = true
          document.body.style.userSelect = 'none'
          document.body.style.cursor = 'grabbing'
        }
        const deltaDays = Math.round(deltaPx / FORECAST_COL_W)
        const plan = buildDragEditPlan(
          sess.originalStages,
          sess.stageId,
          deltaDays,
          sess.mode,
        )
        setDragOverrides((prev) => {
          const next = new Map(prev)
          for (const id of sess.affectedStageIds) next.delete(id)
          for (const [id, ov] of plan.overrides) next.set(id, ov)
          return next
        })
      }
      const handleUp = (ev: PointerEvent) => {
        teardownDragListeners()
        const sess = dragSessionRef.current
        dragSessionRef.current = null
        if (!sess) return
        // Sub-threshold pointerup → treat as a click. Don't suppress, don't
        // touch overrides — the bar's native onClick will open the modal.
        if (!sess.activated) return
        // Real drag ended — swallow the synthetic click that fires after
        // pointerup so the modal doesn't pop up at the end of the gesture.
        const swallow = (cev: MouseEvent) => {
          cev.stopPropagation()
          cev.preventDefault()
        }
        document.addEventListener('click', swallow, { capture: true, once: true })
        const deltaDays = Math.round((ev.clientX - sess.startX) / FORECAST_COL_W)
        const plan = buildDragEditPlan(
          sess.originalStages,
          sess.stageId,
          deltaDays,
          sess.mode,
        )
        if (plan.effectiveDeltaDays === 0 || plan.overrides.size === 0) {
          setDragOverrides((prev) => {
            if (sess.affectedStageIds.size === 0) return prev
            const next = new Map(prev)
            for (const id of sess.affectedStageIds) next.delete(id)
            return next
          })
          return
        }
        void commitDragEdit(plan.overrides)
      }

      moveHandlerRef.current = handleMove
      upHandlerRef.current = handleUp
      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [commitDragEdit, teardownDragListeners],
  )

  // Cleanup on unmount in case a drag is in flight when the component goes away.
  useEffect(() => {
    return () => {
      teardownDragListeners()
      dragSessionRef.current = null
    }
  }, [teardownDragListeners])

  // Reconciler: drop override entries whose (startYmd, endYmd) match the
  // persisted resolvedBars values. This is the only path that removes entries
  // on the success branch — overrides stay populated through the
  // commit-realtime-fetch round-trip so the bar never visually snaps back.
  // Empty-map early-return prevents an effect-loop on the final cleared state.
  useEffect(() => {
    if (dragOverrides.size === 0) return
    const resolvedById = new Map(resolvedBars.map((b) => [b.stageId, b]))
    let changed = false
    const next = new Map<string, DragEditOverride>()
    for (const [stageId, ov] of dragOverrides) {
      const r = resolvedById.get(stageId)
      if (r && r.startYmd === ov.startYmd && r.endYmd === ov.endYmd) {
        changed = true
        continue
      }
      next.set(stageId, ov)
    }
    if (changed) setDragOverrides(next)
  }, [resolvedBars, dragOverrides])

  // Defensive: clear overrides when the user switches jobs so stale entries
  // keyed by stageIds from a prior workflow can't briefly re-activate after a
  // navigate-back inside the realtime debounce window.
  useEffect(() => {
    setDragOverrides(new Map())
  }, [selectedJobId])

  const onToggleDragEdit = useCallback(() => {
    setDragEdit((prev) => {
      const next = !prev
      if (next && !showDates) setShowDates(true)
      return next
    })
  }, [showDates, setShowDates])
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

          {/* Job suggestions dropdown is anchored to the search wrapper */}
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
        <div
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            gap: '0.5rem',
            alignItems: 'center',
          }}
        >
          {canAlign && (
            <button
              type="button"
              onClick={onToggleDragEdit}
              aria-pressed={dragEdit}
              disabled={dragDisabledReason != null || dragSaving}
              title={
                dragDisabledReason ??
                (dragEdit
                  ? 'Drag the right edge of any stage to extend it; toggle off to disable drag handles'
                  : 'Drag the right edge of any stage to extend it; later stages shift to keep their gaps')
              }
              style={{
                ...forecastSecondaryButtonStyle,
                background: dragEdit ? '#eff6ff' : '#ffffff',
                borderColor: dragEdit ? '#bfdbfe' : '#cbd5e1',
                color: dragEdit ? '#1d4ed8' : '#374151',
                opacity:
                  dragDisabledReason != null || dragSaving ? 0.55 : 1,
                cursor:
                  dragDisabledReason != null || dragSaving
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {dragEdit ? 'Drag editing' : 'Drag edit'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDates(!showDates)}
            aria-pressed={showDates}
            disabled={dragEdit}
            title={
              dragEdit
                ? 'Turn off Drag edit to change Show dates'
                : showDates
                  ? 'Hide individual calendar days (collapse with ellipses)'
                  : 'Show every calendar day in the stage range'
            }
            style={{
              ...forecastSecondaryButtonStyle,
              background: showDates ? '#eff6ff' : '#ffffff',
              borderColor: showDates ? '#bfdbfe' : '#cbd5e1',
              color: showDates ? '#1d4ed8' : '#374151',
              opacity: dragEdit ? 0.55 : 1,
              cursor: dragEdit ? 'not-allowed' : 'pointer',
            }}
          >
            {showDates ? 'Showing dates' : 'Show dates'}
          </button>
          {canAlign && (
            <button
              type="button"
              onClick={() => setAlignModalOpen(true)}
              disabled={alignDisabledReason != null}
              title={
                alignDisabledReason ??
                "Chain each stage to start at the previous one\u2019s end"
              }
              aria-label="Align stages"
              style={{
                ...forecastSecondaryButtonStyle,
                opacity: alignDisabledReason != null ? 0.55 : 1,
                cursor: alignDisabledReason != null ? 'not-allowed' : 'pointer',
              }}
            >
              Align stages
            </button>
          )}
        </div>
      </div>

      {showDates ? (
        <ProjectsForecastTimelineGrid<ResolvedStageBar>
          rows={effectiveResolvedBars}
          rowKey={(s) => s.stageId}
          dayKeys={denseDayKeys}
          todayYmd={todayYmd}
          labelGutterWidth={260}
          rowLabel={renderGutterLabel}
          renderRow={(s) => (
            <SpecificDenseStageBar
              stage={s}
              dayKeyIndex={denseDayKeyIndex}
              rangeStart={denseRangeStart}
              rangeEnd={denseRangeEnd}
              onClick={() => onOpenStage(s.stageId)}
              draggable={dragEdit}
              onDragStart={onBarDragStart}
              onBodyDragStart={dragEdit ? onBarBodyDragStart : undefined}
            />
          )}
          emptyState={emptyState ? <span>{emptyState}</span> : null}
        />
      ) : (
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
      )}

      {openStageBar && selectedJob ? (
        <ProjectsForecastSpecificStageModal
          stage={openStageBar}
          projectId={selectedJob.project_id}
          myRole={myRole}
          onClose={() => setOpenStageId(null)}
        />
      ) : null}

      {alignModalOpen && selectedJob ? (
        <ProjectsForecastAlignStagesModal
          jobLabel={buildJobLabel(selectedJob, prefixMap)}
          stages={selectedStages}
          todayYmd={todayYmd}
          onClose={() => setAlignModalOpen(false)}
          onApplied={() => setAlignModalOpen(false)}
        />
      ) : null}
    </div>
  )
}

function StageGutterLabel({
  resolved,
  displayNumber,
  onClick,
}: {
  resolved: ResolvedStageBar
  /** Row-position number (1..N) shown in the chip — see callsite for rationale. */
  displayNumber: number
  onClick: () => void
}) {
  const swatch = forecastBarSwatch(resolved.colorKey)
  // Surface the raw `sequence_order` in the tooltip so it remains discoverable when
  // cross-referencing with the Workflow page (which renders the raw DB value).
  const tooltip =
    `Step ${displayNumber} of this job's workflow\n` +
    `Open in Workflow — ${resolved.name}\n` +
    `(sequence_order: ${resolved.sequenceOrder})`
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={`Step ${displayNumber}: open ${resolved.name} in Workflow`}
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
        {displayNumber}
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

/**
 * Single-bar row body used by the dense-calendar mode of the Specific tab.
 *
 * Mirrors the visual idiom of `JobStageBars` in `ProjectsForecastAllStagesTab` (same
 * swatch palette, same dashed border for unscheduled placeholders, same tooltip
 * format) but renders exactly one bar — the row itself is a stage, not a job.
 */
function SpecificDenseStageBar({
  stage,
  dayKeyIndex,
  rangeStart,
  rangeEnd,
  onClick,
  draggable = false,
  onDragStart,
  onBodyDragStart,
}: {
  stage: ResolvedStageBar
  dayKeyIndex: ReadonlyMap<string, number>
  rangeStart: string
  rangeEnd: string
  onClick: () => void
  /** When true, render a right-edge resize handle that the user can drag to extend
   *  the stage. Drag math + persistence live on the parent. */
  draggable?: boolean
  /** Called on pointerdown of the right-edge handle; the parent owns the document
   *  pointermove / pointerup listeners. */
  onDragStart?: (stageId: string, e: ReactPointerEvent<HTMLElement>) => void
  /** Called on pointerdown anywhere inside the bar body (the right-edge handle's
   *  own onPointerDown stops propagation, so the body listener never fires for
   *  handle interactions). The parent owns the click-vs-drag threshold so a
   *  no-move pointerup falls through to the bar's native onClick. */
  onBodyDragStart?: (stageId: string, e: ReactPointerEvent<HTMLElement>) => void
}) {
  const [handleHover, setHandleHover] = useState(false)
  const span = forecastBarColumnSpan(
    stage.startYmd,
    stage.endYmd,
    dayKeyIndex,
    rangeStart,
    rangeEnd,
  )
  if (!span) return null
  const swatch = forecastBarSwatch(stage.colorKey)
  const isUnscheduled = stage.isUnscheduled
  const isInferred = stage.isInferred && !isUnscheduled
  // Show the grip-style handle only when the bar is draggable. Reserve right
  // padding so the bar's label can't slide under the grip on narrow stages.
  const showDragHandle = draggable && !!onDragStart
  // Body-drag is opt-in via `onBodyDragStart`. When wired, the bar's cursor
  // hints at the gesture (grab) without affecting the right-edge handle, which
  // overrides cursor to col-resize via its own inline style.
  const bodyDragEnabled = !!onBodyDragStart
  const barStyle: CSSProperties = {
    gridColumn: `${span.startCol} / ${span.endCol}`,
    gridRow: 1,
    alignSelf: 'center',
    height: 26,
    minWidth: Math.max(FORECAST_COL_W - 4, 18),
    borderRadius: 4,
    background: swatch.background,
    border: `${isUnscheduled ? '1.5px' : '1px'} ${swatch.borderStyle} ${swatch.borderColor}`,
    color: swatch.textColor,
    display: 'flex',
    alignItems: 'center',
    padding: showDragHandle ? '0 14px 0 6px' : '0 6px',
    fontSize: '0.7rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: bodyDragEnabled ? 'grab' : 'pointer',
    textDecoration: swatch.textDecoration,
    boxSizing: 'border-box',
    position: 'relative',
  }
  const tooltipParts = [
    stage.name,
    `${stage.startYmd} → ${stage.endYmd}`,
    isUnscheduled
      ? '(unscheduled — placeholder)'
      : isInferred
        ? '(some dates inferred)'
        : null,
    stage.assignee ? `Assignee: ${stage.assignee}` : null,
  ].filter(Boolean)
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={
        onBodyDragStart
          ? (e) => onBodyDragStart(stage.stageId, e)
          : undefined
      }
      title={tooltipParts.join('\n')}
      aria-label={`Stage ${stage.name} from ${stage.startYmd} to ${stage.endYmd}`}
      style={barStyle}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {stage.name}
        {isInferred ? ' (inferred)' : ''}
      </span>
      {showDragHandle && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Drag to extend ${stage.name}`}
          title="Drag to extend"
          // Stop the click that fires after pointerup-without-move so the parent
          // button's onClick (which opens the stage modal) does not also fire.
          onClick={(e) => {
            e.stopPropagation()
          }}
          onPointerDown={(e) => {
            onDragStart!(stage.stageId, e)
          }}
          onPointerEnter={() => setHandleHover(true)}
          onPointerLeave={() => setHandleHover(false)}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: 12,
            cursor: 'col-resize',
            // Tinted band + thin divider so the handle reads as a distinct
            // grabbable region across every swatch (saturated, dashed
            // unscheduled, light inferred).
            background: handleHover ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.18)',
            borderLeft: '1px solid rgba(0,0,0,0.22)',
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            transition: 'background 120ms ease',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 1.5,
              height: handleHover ? 14 : 12,
              background: 'rgba(255,255,255,0.85)',
              borderRadius: 1,
            }}
          />
          <span
            aria-hidden
            style={{
              width: 1.5,
              height: handleHover ? 14 : 12,
              background: 'rgba(255,255,255,0.85)',
              borderRadius: 1,
            }}
          />
        </span>
      )}
    </button>
  )
}

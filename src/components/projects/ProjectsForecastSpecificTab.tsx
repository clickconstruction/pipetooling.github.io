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
  useLayoutEffect,
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
  type ResolvedStageBar,
} from '../../lib/projectsForecastStageResolver'
import { forecastBarSwatch, forecastStageColorKey } from '../../lib/projectsForecastColors'
import { parsePercentCompleteInput } from '../../lib/parsePercentCompleteInput'
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
import {
  computeForecastSpecificDefaultWindow,
  computeForecastSpecificEffectiveWindow,
  extendForecastSpecificWindowLeft,
  extendForecastSpecificWindowRight,
  FORECAST_SPECIFIC_EXTEND_DAYS,
} from '../../lib/projectsForecastSpecificWindow'
import type {
  ForecastJob,
  ForecastStage,
  ForecastWorkflowMap,
} from '../../lib/projectsForecastData'
import { ProjectsForecastSpecificGrid } from './ProjectsForecastSpecificGrid'
import { ProjectsForecastSpecificStageModal } from './ProjectsForecastSpecificStageModal'
import { ProjectsForecastAlignStagesModal } from './ProjectsForecastAlignStagesModal'
import { ProjectsForecastInsertStageModal } from './ProjectsForecastInsertStageModal'
import {
  planInsertStageAfter,
  type ForecastInsertStageInput,
} from '../../lib/projectsForecastInsertStage'
import {
  buildForecastDayKeyIndex,
  forecastBarColumnSpan,
  FORECAST_COL_W,
  ProjectsForecastTimelineGrid,
  type ForecastTimelineGridHandle,
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
  /** Parent-owned silent refetch — used after a successful % commit when realtime
   *  may not fire promptly in dev. */
  refreshStages?: () => void
}

const SELECTED_JOB_STORAGE_KEY = 'projects_forecast_specific_selected_job_v1'
const SHOW_DATES_STORAGE_KEY = 'projects_forecast_specific_show_dates_v1'

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
  const hcpLabel = formatJobLedgerNumberLabel(prefix, job.hcp_number, job.click_number)
  return `${hcpLabel} · ${(job.job_name ?? '').trim() || '—'}`
}

export function ProjectsForecastSpecificTab({
  jobs,
  workflowByProject,
  stagesByWorkflow,
  prefixMap,
  loading,
  myRole,
  refreshStages,
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
  // "+ Insert stage" modal target. `undefined` = modal closed; `null` = insert at the
  // start of the workflow (sequence_order 1); string = id of the stage to insert AFTER.
  // Tri-state (vs a simple `string | null`) is intentional so we can express "no modal"
  // separately from "insert-at-start" without overloading null's meaning.
  const [insertAfterStageId, setInsertAfterStageId] = useState<string | null | undefined>(
    undefined,
  )
  // Optimistic "new row" overlay: stages we've successfully INSERTed but haven't yet
  // received back via the parent's realtime-driven `resolvedBars`. Without this overlay,
  // the user sees the cascade animate (other stages shift via `dragOverrides`) but no
  // new bar materializes until the ~280ms realtime debounce + `fetchForecastStages`
  // round-trip completes — perceived as "I had to refresh to see the new stage." The
  // reconciler effect below drops entries once `resolvedBars` contains a matching id.
  const [pendingInsertedRows, setPendingInsertedRows] = useState<readonly ResolvedStageBar[]>([])
  // Symmetric to `dragOverrides`, but for `sequence_order`. Required so the merged +
  // sorted `effectiveResolvedBars` puts the new row at the correct visual slot even
  // before the cascade's sequence-order bumps land in `resolvedBars`. Without this, the
  // new row's `after + 1` order would tie with the not-yet-bumped existing row at the
  // same number and the sort would produce a non-deterministic visual position.
  const [pendingSequenceOrderBumps, setPendingSequenceOrderBumps] = useState<
    ReadonlyMap<string, number>
  >(new Map())
  // Optimistic % overlay — applied immediately on commit so the gutter read-only cell
  // reflects the saved value even when Supabase Realtime doesn't refetch promptly.
  // Dropped by the reconciler once `resolvedBars` catches up from a parent refetch.
  const [pendingPercentByStageId, setPendingPercentByStageId] = useState<
    ReadonlyMap<string, number | null>
  >(new Map())
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

  // Apply any in-flight drag overrides + optimistic-insert overlays on top of the
  // resolved bars. Three sources of "this is what the user should see right now,
  // ahead of the persisted DB state":
  //   - `dragOverrides`        — date shifts for existing rows mid-drag or mid-insert-cascade
  //   - `pendingSequenceOrderBumps` — sequence_order bumps from an insert cascade
  //   - `pendingInsertedRows`  — brand-new rows from a successful INSERT awaiting realtime
  //   - `pendingPercentByStageId` — percent_complete writes awaiting parent refetch
  // Drag-only edits (no inserts) skip the bump merge AND the sort to preserve the
  // existing per-tick allocation characteristic. The two reconciler effects below
  // drop overlay entries once `resolvedBars` reflects them.
  const effectiveResolvedBars = useMemo<ResolvedStageBar[]>(() => {
    const hasOverrides = dragOverrides.size > 0
    const hasBumps = pendingSequenceOrderBumps.size > 0
    const hasPending = pendingInsertedRows.length > 0
    const hasPct = pendingPercentByStageId.size > 0
    if (!hasOverrides && !hasBumps && !hasPending && !hasPct) return resolvedBars

    // Defensive: if a pending row's persisted twin already arrived in `resolvedBars`,
    // skip the pending entry so we don't render two bars for the same stageId until
    // the reconciler effect runs (effects run AFTER the next render).
    const resolvedIds = new Set(resolvedBars.map((b) => b.stageId))
    const novelPending = hasPending
      ? pendingInsertedRows.filter((p) => !resolvedIds.has(p.stageId))
      : []

    let merged: ResolvedStageBar[] = resolvedBars.map((b) => {
      let next = b
      const newOrder = pendingSequenceOrderBumps.get(b.stageId)
      if (newOrder != null && newOrder !== b.sequenceOrder) {
        next = { ...next, sequenceOrder: newOrder }
      }
      const ov = dragOverrides.get(b.stageId)
      if (ov) next = { ...next, startYmd: ov.startYmd, endYmd: ov.endYmd }
      if (hasPct && pendingPercentByStageId.has(b.stageId)) {
        next = { ...next, percentComplete: pendingPercentByStageId.get(b.stageId) ?? null }
      }
      return next
    })

    if (novelPending.length > 0) merged = merged.concat(novelPending)

    // Only sort when an insert is in-flight (bumps or new rows). Drag-only edits never
    // reorder rows, so we keep the prior render's `resolvedBars` ordering implicitly.
    if (hasBumps || hasPending) {
      merged.sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    }
    return merged
  }, [resolvedBars, dragOverrides, pendingSequenceOrderBumps, pendingInsertedRows, pendingPercentByStageId])

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

  // Dense-calendar window: `[today − 90, today + 90]` by default, growable in 90-day
  // chunks via the sticky `←` / `→` pan-pillar buttons rendered at the timeline's
  // edges. The window is intentionally anchored to TODAY rather than the resolved-bar
  // envelope — different jobs all open at the same temporal anchor (today centered),
  // so opening a historical job no longer scrolls the user back a year automatically.
  // Stages outside the visible window can be reached by clicking a pillar (each click
  // adds 90 days to that edge); resets to default on job switch.
  //
  // Pan state: `null` for each edge means "use the default". When the user clicks `→`
  // the right ymd is set to `default.endYmd + 90`; the next click extends it another
  // 90 days; etc. Mirror for `←`. Reset to null on `selectedJobId` change (handled in
  // the shared reset effect below alongside drag overrides / pending inserts).
  const [extendedRangeLeftYmd, setExtendedRangeLeftYmd] = useState<string | null>(null)
  const [extendedRangeRightYmd, setExtendedRangeRightYmd] = useState<string | null>(null)

  // Counter incremented by the toolbar's `Today` button. Composed into the grid's
  // `autoCenterTodayResetKey` so clicking `Today` re-fires the auto-center-on-today
  // effect even when `selectedJobId` hasn't changed. The `Today` callback also
  // clears both pan overrides so the visible window snaps back to the default
  // `[today − 90, today + 90]` window — same end state as opening the page or
  // switching to a different job.
  const [todayResetTick, setTodayResetTick] = useState<number>(0)

  // `denseDayKeys` is now derived from a today-relative window rather than the job's
  // stage envelope. Stable across drags because the window only changes on (a) job
  // switch — which resets pan offsets via the reset effect — and (b) explicit pan
  // clicks. Drag overrides modify bar positions, not the column structure, so the
  // grid's auto-center effect (gated on `selectedJobId`) doesn't re-fire during drags
  // either.
  const denseDayKeys = useMemo(() => {
    if (!showDates) return []
    const eff = computeForecastSpecificEffectiveWindow(
      todayYmd,
      extendedRangeLeftYmd,
      extendedRangeRightYmd,
    )
    return enumerateDaysInRange(eff.startYmd, eff.endYmd)
  }, [showDates, todayYmd, extendedRangeLeftYmd, extendedRangeRightYmd])
  const denseDayKeyIndex = useMemo(
    () => buildForecastDayKeyIndex(denseDayKeys),
    [denseDayKeys],
  )
  const denseRangeStart = denseDayKeys[0] ?? ''
  const denseRangeEnd = denseDayKeys[denseDayKeys.length - 1] ?? ''

  // Imperative scroll handle on the dense grid: used by the `←` pan callback below
  // to preserve the user's visual position after the rail grows on the left (see
  // `ForecastTimelineGridHandle` docs). Ref is attached only to the dense grid
  // because the sparse `ProjectsForecastSpecificGrid` doesn't have a pannable
  // window (sparse mode just renders one column per stage).
  const denseGridRef = useRef<ForecastTimelineGridHandle | null>(null)

  // Pending scroll adjustment (in pixels) consumed by the `useLayoutEffect` below
  // after `denseDayKeys` re-flows. Non-null = "shift scrollLeft by this many px to
  // keep the user's visual position fixed." A ref instead of state because the
  // signal is one-shot and should not trigger a re-render.
  //
  // The pan callbacks intentionally DO NOT snap the scroller to the freshly-loaded
  // edge — the user asked for "load the days but don't move me." `←` clicks need an
  // explicit shift (new columns inserted at the start push existing cells right by
  // `addedDays * COL_W`, so `scrollLeft` has to grow by the same amount to keep the
  // viewport on the same cell). `→` clicks need no adjustment — new columns appear
  // beyond the right edge, which doesn't move any already-visible cell.
  const pendingScrollAdjustPxRef = useRef<number | null>(null)

  const onPanLeft = useCallback(() => {
    setExtendedRangeLeftYmd((prev) => {
      const startBase =
        prev ?? computeForecastSpecificDefaultWindow(todayYmd).startYmd
      return extendForecastSpecificWindowLeft(startBase)
    })
    pendingScrollAdjustPxRef.current = FORECAST_SPECIFIC_EXTEND_DAYS * FORECAST_COL_W
  }, [todayYmd])

  const onPanRight = useCallback(() => {
    setExtendedRangeRightYmd((prev) => {
      const endBase = prev ?? computeForecastSpecificDefaultWindow(todayYmd).endYmd
      return extendForecastSpecificWindowRight(endBase)
    })
    // `→` extension: no scroll adjustment — new columns are off-screen to the right
    // and don't shift any visible cell.
  }, [todayYmd])

  // Toolbar `Today` button: restore the "fresh page load" view — clear both pan
  // overrides so the visible window snaps back to the default `[today − 90, today + 90]`
  // and bump `todayResetTick` so the grid's auto-center-on-today effect re-fires
  // (centering "today" in the viewport with the `leftPillarOffsetPx` term applied).
  // We don't stamp `pendingScrollAdjustPxRef` here — the auto-center effect owns
  // the scroll position when the key changes, and the visual-preservation effect
  // is for pan clicks specifically.
  const onTodayClick = useCallback(() => {
    setExtendedRangeLeftYmd(null)
    setExtendedRangeRightYmd(null)
    setTodayResetTick((prev) => prev + 1)
  }, [])

  // After `←` adds 90 columns to the start of the rail, every existing cell shifts
  // right by `90 * FORECAST_COL_W` pixels relative to `scrollLeft = 0`. Adding the
  // same delta to `scrollLeft` cancels the shift and keeps the user looking at the
  // exact same cells they were a moment before the click. `useLayoutEffect` so the
  // adjustment lands before the browser paints — no flash of "moved 90 days into
  // the past." `→` clicks leave `pendingScrollAdjustPxRef` null, so this effect is
  // a no-op for that path.
  useLayoutEffect(() => {
    const adjustPx = pendingScrollAdjustPxRef.current
    if (adjustPx == null) return
    pendingScrollAdjustPxRef.current = null
    denseGridRef.current?.adjustScrollLeftByPx(adjustPx)
  }, [denseDayKeys.length])

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

  // Gate the per-row "+" button on the same role + drag-edit predicates the toolbar's
  // "Add stage to start" button uses. We compute via `canAlignStages(myRole)` inline
  // (cheap Set.has) rather than the `canAlign` const further down because hoisting that
  // declaration would tangle it with several other ordering dependencies; this is the
  // smaller refactor.
  const insertButtonVisible = dragEdit && canAlignStages(myRole)

  // Editing the percent-complete cell on Forecast Specific requires BOTH the same role
  // set that can drag-edit dates AND the page's Edit toggle (mirrors the `+` insert
  // button above). When Edit is off, every role sees the same muted read-only `NN%`
  // text — keeps the page calm by default and matches the user's mental model that the
  // Edit button is the single switch for "I'm about to change things here."
  //
  // The Workflow page has a wider, untoggled gate that also lets the stage's assignee
  // edit their own % — see [Workflow.tsx] for that path.
  const canEditPercentComplete = dragEdit && canAlignStages(myRole)

  // Hide the entire `%` column (header AND per-row cells) when nothing about the current
  // job uses it AND the user isn't in Edit mode. Two cases unlock the column:
  //   1) Edit is on — give the user an empty cell to type the first value into.
  //   2) At least one stage already has a value — keep the column so values stay legible
  //      for every role (read-only ones included).
  // When the column is hidden we also shrink `labelGutterWidth` back to the pre-v2.559
  // 260px so the freed space reclaims into the stage name's ellipsis budget. The flip
  // only fires when both `dragEdit` and the per-job presence signal change, so toggling
  // Edit on/off on a job with at least one value does NOT reflow the timeline.
  const anyStageHasPercent = useMemo(
    () =>
      resolvedBars.some((b) => b.percentComplete != null) ||
      pendingPercentByStageId.size > 0,
    [resolvedBars, pendingPercentByStageId],
  )
  const showPercentColumn = dragEdit || anyStageHasPercent

  // Persist a percent-complete edit from the gutter cell. Applies an optimistic overlay
  // immediately so the read-only cell reflects the new value when Edit toggles off,
  // then triggers a parent refetch because Realtime may not fire promptly in dev.
  const onCommitPercentComplete = useCallback(
    async (stageId: string, next: number | null) => {
      setPendingPercentByStageId((prev) => {
        const m = new Map(prev)
        m.set(stageId, next)
        return m
      })
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('project_workflow_steps')
              .update({ percent_complete: next })
              .eq('id', stageId),
          'update project_workflow_steps.percent_complete',
        )
        refreshStages?.()
      } catch (err) {
        setPendingPercentByStageId((prev) => {
          const m = new Map(prev)
          m.delete(stageId)
          return m
        })
        showToast(`Could not save % complete: ${formatErrorMessage(err)}`, 'error')
      }
    },
    [showToast, refreshStages],
  )

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
        insertButtonVisible={insertButtonVisible}
        insertButtonDisabled={dragSaving}
        onInsertAfter={() => setInsertAfterStageId(stage.stageId)}
        percentComplete={stage.percentComplete}
        percentEditable={canEditPercentComplete}
        onPercentCommit={(next) => onCommitPercentComplete(stage.stageId, next)}
        showPercentCell={showPercentColumn}
      />
    ),
    [
      onOpenStage,
      insertButtonVisible,
      dragSaving,
      canEditPercentComplete,
      onCommitPercentComplete,
      showPercentColumn,
    ],
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

  // Stage rows the insert modal feeds into `planInsertStageAfter`. We use the same
  // post-override `dragStages` snapshot the drag handlers consume so an insert mid-
  // drag-commit (rare but possible) sees the live visual position rather than the
  // stale persisted one. Statuses come from the resolver-derived bars on `resolvedBars`
  // — which mirror the DB — so historical-stage filtering is accurate.
  const insertStageInputs = useMemo<readonly ForecastInsertStageInput[]>(
    () =>
      effectiveResolvedBars.map((b) => ({
        stageId: b.stageId,
        sequenceOrder: b.sequenceOrder,
        startYmd: b.startYmd,
        endYmd: b.endYmd,
        status: b.status ?? null,
      })),
    [effectiveResolvedBars],
  )

  // Persist an "insert a new stage" plan. Runs the same shape of optimistic-override +
  // serial-DB-write + revert-on-failure flow `commitDragEdit` uses, with an extra
  // `INSERT` at the end for the new row. The existing reconciler at the bottom of this
  // component clears the optimistic overrides automatically once `resolvedBars` catches
  // up via the parent's realtime channel — no manual reload needed.
  const onConfirmInsertStage = useCallback(
    async (name: string, lengthDays: number) => {
      if (insertAfterStageId === undefined) return
      if (!selectedWorkflowId) {
        showToast('Could not find the workflow for this job.', 'error')
        return
      }
      const plan = planInsertStageAfter({
        stages: insertStageInputs,
        afterStageId: insertAfterStageId,
        todayYmd,
        lengthDays,
      })

      // (a) Optimistically merge the cascade shift into `dragOverrides` so the bars
      //     visually move BEFORE we hit the DB. The reconciler handles cleanup on
      //     success; the catch block below handles cleanup on failure.
      const shiftedIds = Array.from(plan.shiftedOverrides.keys())
      if (plan.shiftedOverrides.size > 0) {
        setDragOverrides((prev) => {
          const next = new Map(prev)
          for (const [id, ov] of plan.shiftedOverrides) next.set(id, ov)
          return next
        })
      }
      setDragSaving(true)
      try {
        // (b) Bump sequence_orders DESCENDING (highest first) so we never collide on a
        //     hypothetical UNIQUE(workflow_id, sequence_order) index. Combine the date
        //     shift into the same UPDATE per row so each row only touches once.
        for (const bump of plan.sequenceOrderBumps) {
          const shift = plan.shiftedOverrides.get(bump.stageId) ?? null
          await withSupabaseRetry(
            async () =>
              supabase
                .from('project_workflow_steps')
                .update({
                  sequence_order: bump.to,
                  ...(shift
                    ? {
                        scheduled_start_date: shift.startYmd,
                        scheduled_end_date: shift.endYmd,
                      }
                    : {}),
                })
                .eq('id', bump.stageId),
            `insert-stage bump ${bump.stageId}`,
          )
        }

        // (c) Insert the new row. `status: 'pending'` mirrors what `Workflow.tsx`
        //     `saveStep` uses for new rows. The workflow_id comes from the parent's
        //     `selectedWorkflowId` which is already memoized from the project's
        //     workflow map.
        const { data: inserted, error: insErr } = await supabase
          .from('project_workflow_steps')
          .insert({
            workflow_id: selectedWorkflowId,
            sequence_order: plan.newRow.sequenceOrder,
            name,
            status: 'pending',
            scheduled_start_date: plan.newRow.startYmd,
            scheduled_end_date: plan.newRow.endYmd,
          })
          .select('id')
          .single()
        if (insErr || !inserted) {
          throw insErr ?? new Error('Insert returned no row')
        }

        // Optimistic-on-success: stage the new bar + sequence_order bumps into the
        // overlay state BEFORE closing the modal, so React batches all three state
        // updates into one transition and the user sees the new bar appear in the
        // same frame the modal vanishes (instead of waiting on the parent's ~280ms
        // realtime debounce + fetchForecastStages round-trip). The reconciler effects
        // below drop these entries once `resolvedBars` catches up. Color matches what
        // `resolveForecastStages` would produce for a fresh pending row, so the
        // optimistic bar is visually indistinguishable from its post-reconcile state.
        const insertedId = (inserted as { id: string }).id
        const newBar: ResolvedStageBar = {
          stageId: insertedId,
          sequenceOrder: plan.newRow.sequenceOrder,
          name,
          status: 'pending',
          assignee: null,
          startYmd: plan.newRow.startYmd,
          endYmd: plan.newRow.endYmd,
          isInferred: false,
          isUnscheduled: false,
          colorKey: forecastStageColorKey('pending', false),
          percentComplete: null,
        }
        setPendingInsertedRows((prev) => [...prev, newBar])
        if (plan.sequenceOrderBumps.length > 0) {
          setPendingSequenceOrderBumps((prev) => {
            const next = new Map(prev)
            for (const bump of plan.sequenceOrderBumps) next.set(bump.stageId, bump.to)
            return next
          })
        }

        setInsertAfterStageId(undefined)
        showToast('Stage added.', 'success')
      } catch (e) {
        // Revert the optimistic shifts so the bars don't lie about the persisted
        // state. The realtime channel will reconcile the bumped sequence_orders /
        // shifted dates automatically if (b) partially succeeded before (c) failed —
        // we just need to make sure our local override map doesn't keep claiming a
        // movement that didn't fully land.
        if (shiftedIds.length > 0) {
          setDragOverrides((prev) => {
            const next = new Map(prev)
            for (const id of shiftedIds) next.delete(id)
            return next
          })
        }
        showToast(formatErrorMessage(e, 'Add stage failed'), 'error')
      } finally {
        setDragSaving(false)
      }
    },
    [insertAfterStageId, selectedWorkflowId, insertStageInputs, todayYmd, showToast],
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

  // Reconciler: drop pending inserted rows whose persisted twin has arrived in
  // resolvedBars. Same idiom as the dragOverrides reconciler — wait for the realtime
  // refetch to surface the row from the DB, then stop double-rendering the optimistic
  // copy. The merge in `effectiveResolvedBars` filters duplicates defensively for the
  // one render between "resolvedBars updated" and "this effect runs."
  useEffect(() => {
    if (pendingInsertedRows.length === 0) return
    const resolvedIds = new Set(resolvedBars.map((b) => b.stageId))
    const stillPending = pendingInsertedRows.filter((p) => !resolvedIds.has(p.stageId))
    if (stillPending.length !== pendingInsertedRows.length) {
      setPendingInsertedRows(stillPending)
    }
  }, [resolvedBars, pendingInsertedRows])

  // Reconciler: drop pending sequence_order bumps whose persisted value matches the
  // target. Mirrors the dragOverrides reconciler exactly, just on `.sequenceOrder`.
  useEffect(() => {
    if (pendingSequenceOrderBumps.size === 0) return
    const resolvedById = new Map(resolvedBars.map((b) => [b.stageId, b.sequenceOrder]))
    let changed = false
    const next = new Map(pendingSequenceOrderBumps)
    for (const [id, target] of pendingSequenceOrderBumps) {
      if (resolvedById.get(id) === target) {
        next.delete(id)
        changed = true
      }
    }
    if (changed) setPendingSequenceOrderBumps(next)
  }, [resolvedBars, pendingSequenceOrderBumps])

  // Reconciler: drop pending percent overlays once `resolvedBars` matches.
  useEffect(() => {
    if (pendingPercentByStageId.size === 0) return
    const resolvedById = new Map(
      resolvedBars.map((b) => [b.stageId, b.percentComplete ?? null]),
    )
    let changed = false
    const next = new Map(pendingPercentByStageId)
    for (const [id, target] of pendingPercentByStageId) {
      if (resolvedById.get(id) === target) {
        next.delete(id)
        changed = true
      }
    }
    if (changed) setPendingPercentByStageId(next)
  }, [resolvedBars, pendingPercentByStageId])

  // Defensive: clear all three overlays when the user switches jobs so stale entries
  // keyed by stageIds from a prior workflow can't briefly re-render against the new
  // job's `resolvedBars` inside the realtime debounce window before each reconciler
  // independently catches up. Also clears the pan overrides so the window reverts to
  // the default `[today − 90, today + 90]` for every job switch — each job opens at
  // the same temporal anchor regardless of how the previous job was panned (per the
  // `reset_per_job` UX decision; no persistence).
  useEffect(() => {
    setDragOverrides(new Map())
    setPendingInsertedRows([])
    setPendingSequenceOrderBumps(new Map())
    setPendingPercentByStageId(new Map())
    setExtendedRangeLeftYmd(null)
    setExtendedRangeRightYmd(null)
  }, [selectedJobId])

  const onToggleDragEdit = useCallback(() => {
    // When leaving edit mode, blur any focused % input so onBlur commits before the
    // input unmounts (otherwise typed values — especially 0 to clear — are lost).
    if (dragEdit) {
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement &&
        active.dataset.forecastPct === 'true'
      ) {
        active.blur()
      }
    }
    setDragEdit((prev) => {
      const next = !prev
      if (next && !showDates) setShowDates(true)
      return next
    })
  }, [showDates, setShowDates, dragEdit])
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
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
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
                    background: job.id === selectedJobId ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: 'var(--text-slate-900)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{buildJobLabel(job, prefixMap)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
          {/* `Today` toolbar button — restores the "fresh page load" view: clears
              both pan overrides so the visible window snaps back to the default
              `[today − 90, today + 90]` and re-centers the scroller on today.
              Gated on `hasJob && showDates` because the button only matters when
              the dense day rail is on screen (sparse mode has no horizontal scroll
              to recenter and no pan overrides to clear). Sits to the LEFT of the
              Edit button in the right-side toolbar cluster so it's the first
              "reset to home" affordance the user encounters. */}
          {hasJob && showDates && (
            <button
              type="button"
              onClick={onTodayClick}
              aria-label="Re-center the timeline on today (clears any pan-pillar extensions)"
              title="Re-center the timeline on today (clears any pan-pillar extensions)"
              style={{
                ...forecastSecondaryButtonStyle,
              }}
            >
              Today
            </button>
          )}
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
                background: dragEdit ? 'var(--bg-blue-tint)' : 'var(--surface)',
                borderColor: dragEdit ? 'var(--border-blue)' : 'var(--border-strong)',
                color: dragEdit ? 'var(--text-blue-700)' : 'var(--text-700)',
                opacity:
                  dragDisabledReason != null || dragSaving ? 0.55 : 1,
                cursor:
                  dragDisabledReason != null || dragSaving
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {dragEdit ? 'Editing' : 'Edit'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDates(!showDates)}
            aria-pressed={showDates}
            disabled={dragEdit}
            title={
              dragEdit
                ? 'Turn off Edit to change Show dates'
                : showDates
                  ? 'Hide individual calendar days (collapse with ellipses)'
                  : 'Show every calendar day in the stage range'
            }
            style={{
              ...forecastSecondaryButtonStyle,
              background: showDates ? 'var(--bg-blue-tint)' : 'var(--surface)',
              borderColor: showDates ? 'var(--border-blue)' : 'var(--border-strong)',
              color: showDates ? 'var(--text-blue-700)' : 'var(--text-700)',
              opacity: dragEdit ? 0.55 : 1,
              cursor: dragEdit ? 'not-allowed' : 'pointer',
            }}
          >
            {showDates ? 'Showing dates' : 'Show dates'}
          </button>
          {canAlign && dragEdit && (
            <button
              type="button"
              onClick={() => setInsertAfterStageId(null)}
              disabled={!hasJob || dragSaving}
              aria-label="Add a new stage to the very start of this workflow"
              title={
                !hasJob
                  ? 'Pick a job first'
                  : dragSaving
                    ? 'Wait for the current save to finish'
                    : 'Add a new stage as Step 1 — every existing stage shifts forward'
              }
              style={{
                ...forecastSecondaryButtonStyle,
                opacity: !hasJob || dragSaving ? 0.55 : 1,
                cursor: !hasJob || dragSaving ? 'not-allowed' : 'pointer',
              }}
            >
              + Add stage to start
            </button>
          )}
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
          ref={denseGridRef}
          rows={effectiveResolvedBars}
          rowKey={(s) => s.stageId}
          dayKeys={denseDayKeys}
          todayYmd={todayYmd}
          // When the `%` column is visible we widen to 300px to make room for
          // PERCENT_CELL_WIDTH_PX + the trailing "+" button + breathing room without
          // squeezing the stage name's ellipsis budget. When the column is hidden (no
          // values + not in Edit mode) we drop back to the pre-v2.559 260px so the
          // stage name reclaims the freed space.
          labelGutterWidth={showPercentColumn ? 300 : 260}
          rowLabel={renderGutterLabel}
          gutterHeader={showPercentColumn ? <PercentColumnGutterHeader /> : undefined}
          // Pan-pillar wiring: the grid renders in-line `←` / `→` columns at the
          // rail's start / end (visible only when scrolled to that edge); clicks
          // invoke these handlers which extend the visible window in 90-day chunks.
          // Pan clicks DON'T snap the scroller — the user explicitly asked for
          // "load the days but don't move me." `←` clicks preserve visual position
          // via `adjustScrollLeftByPx` (see the `useLayoutEffect` above); `→` clicks
          // need no adjustment. `autoCenterTodayResetKey` is composed from the
          // selected job AND a `todayResetTick` counter so two paths re-center on
          // today: (a) switching to a different job, and (b) clicking the toolbar
          // `Today` button. Panning alone (which mutates `dayKeys`) does NOT change
          // the key, so the scroll position survives pan clicks.
          onPanLeft={onPanLeft}
          onPanRight={onPanRight}
          autoCenterTodayResetKey={`${selectedJobId ?? ''}::${todayResetTick}`}
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
          // Same conditional gutter sizing as the dense grid above: 300 when the `%`
          // column is showing (cell + "+" button fit), 260 when it's hidden so the
          // stage name reclaims the freed space.
          labelGutterWidth={showPercentColumn ? 300 : 260}
          rowLabel={renderGutterLabel}
          gutterHeader={showPercentColumn ? <PercentColumnGutterHeader /> : undefined}
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

      {insertAfterStageId !== undefined && selectedJob ? (
        (() => {
          // Look up the "after stage" display info (chip number + name) so the modal
          // can show "After: Step N · {name}" in its subtitle. The chip number is the
          // 1-based row position, NOT the raw sequence_order — matches what the user
          // sees in the gutter (per the v2.553 / v2.554 chip change). When inserting
          // at the start (`afterStageId === null`) both values are null and the modal
          // renders "At the start of the workflow" instead.
          let afterDisplayNumber: number | null = null
          let afterName: string | null = null
          if (insertAfterStageId !== null) {
            const idx = effectiveResolvedBars.findIndex(
              (b) => b.stageId === insertAfterStageId,
            )
            if (idx >= 0) {
              afterDisplayNumber = idx + 1
              afterName = effectiveResolvedBars[idx]!.name
            }
          }
          return (
            <ProjectsForecastInsertStageModal
              stages={insertStageInputs}
              afterStageId={insertAfterStageId}
              afterStageDisplayNumber={afterDisplayNumber}
              afterStageName={afterName}
              todayYmd={todayYmd}
              applying={dragSaving}
              onConfirm={onConfirmInsertStage}
              onClose={() => setInsertAfterStageId(undefined)}
            />
          )
        })()
      ) : null}
    </div>
  )
}

/** Width of the right-side percent-complete cell inside `StageGutterLabel`. Kept as a
 *  module-level constant so the column header in `ProjectsForecastSpecificTab` can use the
 *  same value when positioning the `%` label, ensuring header + cell stay aligned. The 14px
 *  + 4px gap + 6px breathing room after the `+` button is the reason we bump
 *  `labelGutterWidth` on this tab — see callsite. */
const PERCENT_CELL_WIDTH_PX = 58
/** Right-side padding for the `%` column header so it visually sits over the percent cell
 *  (which itself sits before the optional 18px `+` button + a 2px gap). */
const PERCENT_HEADER_RIGHT_PADDING_PX = 28

/** Right-aligned `%` label rendered into the grid's sticky gutter header. Sized so it
 *  visually sits over the per-row percent cell on the right of the gutter (which itself
 *  sits to the LEFT of the optional `+` insert button, so we pad in by roughly that
 *  button's footprint). Kept as a tiny presentational component so both grid invocations
 *  (dense + sparse) share the same markup without re-typing it. */
function PercentColumnGutterHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
        paddingRight: PERCENT_HEADER_RIGHT_PADDING_PX,
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
      }}
      aria-hidden
    >
      %
    </div>
  )
}

function StageGutterLabel({
  resolved,
  displayNumber,
  onClick,
  insertButtonVisible,
  onInsertAfter,
  insertButtonDisabled,
  percentComplete,
  percentEditable,
  onPercentCommit,
  showPercentCell = true,
}: {
  resolved: ResolvedStageBar
  /** Row-position number (1..N) shown in the chip — see callsite for rationale. */
  displayNumber: number
  onClick: () => void
  /** When true, render a circular "+" button at the right edge of the gutter cell that
   *  triggers `onInsertAfter`. Drag-edit only — gated upstream by
   *  `dragEdit && canAlignStages(myRole)`. */
  insertButtonVisible?: boolean
  /** Greys out the "+" button while another save is in flight (drag commit or another
   *  insert) so concurrent writers can't race on `sequence_order`. */
  insertButtonDisabled?: boolean
  onInsertAfter?: () => void
  /** Current persisted percent-complete value (0-100) or null when not tracked. The cell
   *  re-keys off this value (see `key=` below) so an incoming realtime refresh causes the
   *  uncontrolled input to pick up the new defaultValue without us having to manage a
   *  controlled value. */
  percentComplete: number | null
  /** When true, the cell renders an editable input; when false, a plain right-aligned text
   *  span (or empty when null). Gated upstream by `canAlignStages(myRole)`. */
  percentEditable: boolean
  /** When false, the entire percent cell wrapper is omitted from the row so the stage
   *  name reclaims that space and the gutter can shrink. Set by the parent based on
   *  `showPercentColumn` — true whenever Edit is on or at least one stage in the
   *  current job has a percent value. Defaults to `true` to preserve the existing
   *  contract for any future caller that doesn't think about this. */
  showPercentCell?: boolean
  /** Called on input blur with the parsed/clamped percent value (or null when cleared).
   *  No-op when `percentEditable` is false. */
  onPercentCommit?: (next: number | null) => void
}) {
  const swatch = forecastBarSwatch(resolved.colorKey)
  // Surface the raw `sequence_order` in the tooltip so it remains discoverable when
  // cross-referencing with the Workflow page (which renders the raw DB value).
  const tooltip =
    `Step ${displayNumber} of this job's workflow\n` +
    `Open in Workflow — ${resolved.name}\n` +
    `(sequence_order: ${resolved.sequenceOrder})`
  // The wrapper is a flex row with the main "open stage" button on the left (shrinks /
  // ellipsis-clips) and the optional "+" button pinned to the right (never shrinks).
  // We can't nest the "+" inside the main button (nested <button>s are invalid HTML and
  // would also swallow each other's click handlers), so the two affordances live as
  // sibling interactive elements inside a presentational <div>.
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
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
          flex: '1 1 auto',
          // `minWidth: 0` lets the flex item shrink past its intrinsic width so the
          // ellipsis on the name span actually engages instead of forcing the row to
          // grow past the gutter's bounds (would push the "+" button off-screen).
          minWidth: 0,
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
            flexShrink: 0,
          }}
        >
          {displayNumber}
        </span>
        <span
          style={{
            fontWeight: 600,
            color: 'var(--text-slate-900)',
            textDecoration: swatch.textDecoration,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: '0 1 auto',
            minWidth: 0,
          }}
        >
          {resolved.name}
        </span>
        {resolved.assignee ? (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-link)',
              textDecoration: 'underline',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: '1 1 auto',
              minWidth: 0,
            }}
            title={resolved.assignee}
          >
            {resolved.assignee}
          </span>
        ) : null}
      </button>
      {/* Per-row percent-complete cell — sits between the main "open stage" button and the
          optional "+" insert button. Width is fixed (PERCENT_CELL_WIDTH_PX) and aligned
          right so the trailing `%` glyph lands near the column boundary; the column header
          in the parent uses the same width + right padding to stay aligned.
          - Editable mode: uncontrolled <input>, re-keyed off `percentComplete` so a realtime
            refresh updates the defaultValue without us managing a controlled value. Blur
            parses + clamps + rounds via `parsePercentCompleteInput`, then commits.
            stopPropagation on pointer + key events keeps the surrounding gutter click handler
            (which opens the stage detail modal) from firing while the user is typing.
          - Read-only mode: a plain text node (`45%` or blank).
          The entire wrapper is omitted when `showPercentCell` is false so the stage name
          reclaims the freed space and the gutter can shrink (see callsite for the matching
          `labelGutterWidth` flip). */}
      {showPercentCell ? (
      <div
        style={{
          width: PERCENT_CELL_WIDTH_PX,
          minWidth: PERCENT_CELL_WIDTH_PX,
          maxWidth: PERCENT_CELL_WIDTH_PX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 2,
          flexShrink: 0,
          fontSize: '0.8125rem',
          color: percentComplete == null ? 'var(--text-slate-400)' : 'var(--text-slate-900)',
        }}
      >
        {percentEditable ? (
          <>
            <input
              key={`pct-${resolved.stageId}-${percentComplete ?? 'null'}`}
              type="number"
              data-forecast-pct="true"
              // `no-spinner` hides the browser's up/down stepper arrows so the cell stays
              // visually quiet — the cell is narrow, the value is bounded 0-100, and the
              // numeric keypad on mobile (via `inputMode`) covers the small fraction of
              // users who would otherwise reach for the spinner.
              className="no-spinner"
              min={0}
              max={100}
              inputMode="numeric"
              defaultValue={percentComplete == null ? '' : String(percentComplete)}
              aria-label={`Percent complete for ${resolved.name}`}
              title="Optional 0-100 progress estimate. Leave empty when not tracked."
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
              }}
              onBlur={(e) => {
                // `parsePercentCompleteInput` already maps `0` (and any negative
                // or `0.4`-shaped fractional that clamps / rounds to 0) to null,
                // so a user typing `0` in this gutter cell clears the cell — same
                // semantic as deleting the value (see the helper's JSDoc).
                const next = parsePercentCompleteInput(e.currentTarget.value)
                // Visually blank the input immediately when we're committing null
                // but the DOM still shows a non-empty string (e.g. the user typed
                // `0` and the helper mapped it to null). Two cases need this:
                //   1. value was non-null, user typed 0 → without this the input
                //      briefly shows "0" until the realtime round-trip (~280ms)
                //      re-keys it blank.
                //   2. value was already null, user typed 0 → `next === percentComplete`
                //      bails out below (no commit needed), so the cell would
                //      otherwise keep showing the stale "0" the user typed.
                if (next == null && e.currentTarget.value !== '') {
                  e.currentTarget.value = ''
                }
                if (next === percentComplete) return
                onPercentCommit?.(next)
              }}
              style={{
                width: 36,
                padding: '0.15rem 0.25rem',
                fontSize: '0.8125rem',
                textAlign: 'right',
                border: 'none',
                borderBottom: '1px solid var(--border-strong)',
                borderRadius: 0,
                background: 'transparent',
                color: 'var(--text-slate-900)',
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>%</span>
          </>
        ) : percentComplete == null ? null : (
          <span style={{ color: 'var(--text-slate-900)' }}>{`${percentComplete}%`}</span>
        )}
      </div>
      ) : null}
      {insertButtonVisible ? (
        <button
          type="button"
          onClick={(e) => {
            // Stop propagation so the per-row click handler on the wider gutter cell
            // (or on the bar) does not fire and yank the stage-detail modal open.
            e.stopPropagation()
            if (insertButtonDisabled) return
            onInsertAfter?.()
          }}
          disabled={insertButtonDisabled}
          aria-label={`Insert a stage after Step ${displayNumber} — ${resolved.name}`}
          title={
            insertButtonDisabled
              ? 'Wait for the current save to finish'
              : `Insert a stage after Step ${displayNumber} — later stages shift to make room`
          }
          style={{
            all: 'unset',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: `1px solid ${insertButtonDisabled ? '#cbd5e1' : '#2563eb'}`,
            color: insertButtonDisabled ? 'var(--text-slate-400)' : 'var(--text-link)',
            fontSize: '0.875rem',
            fontWeight: 700,
            lineHeight: 1,
            cursor: insertButtonDisabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            // Tiny right-edge offset so the button visually rests against the gutter's
            // right border without touching it.
            marginRight: 2,
          }}
        >
          +
        </button>
      ) : null}
    </div>
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

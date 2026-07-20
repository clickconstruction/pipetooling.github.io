import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import {
  fetchScheduleBlocksForAssigneesOnDay,
  updateJobScheduleBlock,
  type JobScheduleBlockRow,
} from '../../lib/jobScheduleBlocks'
import {
  boundaryDotsFromBlocks,
  dotMinutesToPgTime,
  resolveDotDrag,
  separateSharedDot,
  type BoundaryDot,
  type DotBlock,
} from '../../lib/dayScheduleDotDrag'
import {
  buildDayTravelGaps,
  TRAVEL_TOUCHING_WARN_MINUTES,
  type DayTravelGap,
  type LatLng,
  type TravelEstimate,
} from '../../lib/jobTravelEstimate'
import {
  loadTravelHintsConfig,
  TRAVEL_HINTS_CONFIG_CHANGED_EVENT,
  TRAVEL_HINTS_DEFAULTS,
  type TravelHintsConfig,
} from '../../lib/travelHintsConfig'
import {
  fetchRoutedTravelTimes,
  travelPairKey,
  type TravelPairRequest,
} from '../../lib/routedTravelTimes'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import { batchGeocodeCacheKeys } from '../../lib/map/geocodeCacheBatches'
import {
  fetchJobsLedgerForScheduleDispatchHub,
  fetchUserNamesForIds,
  fetchUsersTabRosterForScheduleDispatchHub,
  formatScheduleDispatchHubJobTitle,
  type ScheduleDispatchHubJobRow,
} from '../../lib/scheduleDispatchHub'
import {
  defaultNewBlockRangeInFirstGap,
  type AddBlockTimelineSegment,
} from '../../lib/scheduleDispatchAddBlockTimeline'
import { scheduleTimeToMinutesFromMidnight } from '../../lib/jobScheduleOverlap'
import { scheduleFormatWeekdayLong } from '../../lib/jobScheduleChicago'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES } from '../../lib/scheduleDispatchEditRoles'
import { saveNewScheduleBlockForPersonDay } from '../../lib/scheduleDispatchAddBlockSave'
import { ScheduleDispatchAddBlockModal } from '../schedule/ScheduleDispatchAddBlockModal'
import { ScheduleDispatchAssignJobPickerModal } from '../schedule/ScheduleDispatchAssignJobPickerModal'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  dispatchMinutesToHHmm,
  formatDispatchQuickTimeLabel,
  MAX_MIN,
  MIN_MIN,
  timeInputToMinutesSafe,
  timeInputToPg,
} from '../../lib/dispatchAddBlockTime'
import {
  DISPATCH_ADD_BLOCK_ORIENTATION_MARKS,
  dispatchAddBlockTrackThumbLeftPct,
  type DispatchOccupiedBand,
  type DispatchSecondaryBand,
} from '../schedule/DispatchAddBlockTimeRange'
import {
  clockSessionsToDispatchSecondaryBands,
  type ClockSessionForDispatchBand,
} from '../../lib/clockSessionsToDispatchSecondaryBands'
import { recordNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import {
  companyWeekStartSundayContaining,
  denverCalendarDayKey,
  formatDenverCalendarDayWithWeekdayAndYear,
  getDefaultWeekRange,
  referenceDateForWorkDateYmd,
  ymdAddDays,
} from '../../utils/dateUtils'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerShortLine } from '../../lib/ledgerDisplayPrefixes'
import { QUICKFILL_SECTION_BANNER_BOX_STYLE } from '../../lib/quickfillSectionBannerStyle'
import { groupRosterUsersByAuthRoleSection } from '../../lib/usersTabRosterRoleSections'
import { blocksToSegments } from '../../lib/quickfillScheduleSegments'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  QuickfillScheduleUserRow,
  QUICKFILL_SCHEDULE_ADD_COL_WIDTH,
  QUICKFILL_SCHEDULE_NAME_COL_WIDTH,
  QUICKFILL_SCHEDULE_ROW_GAP,
} from '../schedule/QuickfillScheduleUserRow'

const SCHEDULE_CONFLICTS_DEFAULT_PROMPT = 'Are there any obvious schedule conflicts?'

const QUICKFILL_SCHEDULE_HIDE_ASSISTANT_ESTIMATOR_KEY = 'quickfill_schedule_hide_assistant_estimator'

function readHideAssistantsEstimatorsFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(QUICKFILL_SCHEDULE_HIDE_ASSISTANT_ESTIMATOR_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Quickfill overview: one read-only Add-block-style timeline per user (Schedule Dispatch roster) for a chosen day.
 * Edits happen on Schedule Dispatch. Section header does not show a Quickfill “open” backlog count (not comparable to inbox-style sections).
 *
 * On the Quickfill page, pass `hideConflictPrompt` so the section wrapper’s configurable banner is the only callout.
 */
type QuickfillBlockModalState = { kind: 'add'; assigneeUserId: string; workDate: string; jobId: string }

export function QuickfillScheduleSection({
  hideConflictPrompt = false,
  initialWorkDateYmd,
  onBlocksSaved,
  showDaySettings = false,
}: {
  hideConflictPrompt?: boolean
  /** When set (e.g. Dispatch hub / Quickfill tomorrow), use this as the initial schedule day. */
  initialWorkDateYmd?: string
  /** Fires after this section writes schedule blocks (dot auto-save, separation, add-block) so host views (e.g. the Dispatch hub People/Jobs tabs) can refresh their own caches. */
  onBlocksSaved?: () => void
  /** Dispatch Day tab only: show the gear that opens the visible-hours (rail window) settings modal. The stored window applies wherever this section renders. */
  showDaySettings?: boolean
} = {}) {
  const navigate = useNavigate()
  const { role, user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()
  const canEditSchedule = role != null && CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const showStripSubjectMyTimeEditor = showClockStripScopeToggle || role === 'superintendent'
  const [scheduleMyTimeEditor, setScheduleMyTimeEditor] = useState<{
    subjectUserId: string
    subjectDisplayName: string
  } | null>(null)
  const [workDate, setWorkDate] = useState(
    () => (initialWorkDateYmd != null && initialWorkDateYmd !== '' ? initialWorkDateYmd : denverCalendarDayKey(Date.now())),
  )
  useEffect(() => {
    if (initialWorkDateYmd != null && initialWorkDateYmd !== '') setWorkDate(initialWorkDateYmd)
  }, [initialWorkDateYmd])
  const [loading, setLoading] = useState(true)
  const [userIds, setUserIds] = useState<string[]>([])
  const [nameById, setNameById] = useState<Map<string, string>>(() => new Map())
  const [blocksByUserId, setBlocksByUserId] = useState<Map<string, JobScheduleBlockRow[]>>(() => new Map())
  /** Live boundary-dot drag draft: applied over `blocksByUserId` for bars + dots until the debounced auto-save persists. */
  const [dotDraft, setDotDraft] = useState<{
    userId: string
    updates: Map<string, { startMin: number; endMin: number }>
  } | null>(null)
  const [dotSaving, setDotSaving] = useState(false)
  const dotDraftRef = useRef<typeof dotDraft>(null)
  useEffect(() => {
    dotDraftRef.current = dotDraft
  }, [dotDraft])
  /** Latest host callback for the unmount flush (the cleanup closure is mount-scoped). */
  const onBlocksSavedRef = useRef(onBlocksSaved)
  useEffect(() => {
    onBlocksSavedRef.current = onBlocksSaved
  }, [onBlocksSaved])
  /** Auto-save fires this long after the last dot touch (drag release / keyboard nudge). */
  const DOT_AUTOSAVE_DEBOUNCE_MS = 2000
  const dotSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Per-device visible-hours window for the day rail (within the 04:00–20:00 block bounds); null = full day. */
  const DAY_RAIL_WINDOW_STORAGE_KEY = 'pipetooling_dispatch_day_rail_window_v1'
  const [dayRailWindow, setDayRailWindow] = useState<{ startMin: number; endMin: number } | null>(() => {
    try {
      const raw = localStorage.getItem(DAY_RAIL_WINDOW_STORAGE_KEY)
      if (!raw) return null
      const v = JSON.parse(raw) as { startMin?: unknown; endMin?: unknown }
      const s = typeof v.startMin === 'number' ? v.startMin : NaN
      const e = typeof v.endMin === 'number' ? v.endMin : NaN
      if (!Number.isFinite(s) || !Number.isFinite(e)) return null
      if (s < MIN_MIN || e > MAX_MIN || e - s < 60) return null
      if (s === MIN_MIN && e === MAX_MIN) return null
      return { startMin: s, endMin: e }
    } catch {
      return null
    }
  })
  const [daySettingsOpen, setDaySettingsOpen] = useState(false)
  const [daySettingsDraftStart, setDaySettingsDraftStart] = useState(MIN_MIN)
  const [daySettingsDraftEnd, setDaySettingsDraftEnd] = useState(MAX_MIN)
  const dayRailTrimWindow = useMemo(
    () =>
      dayRailWindow
        ? {
            loSlotIndex: (dayRailWindow.startMin - MIN_MIN) / 30,
            hiSlotIndex: (dayRailWindow.endMin - MIN_MIN) / 30,
          }
        : undefined,
    [dayRailWindow],
  )
  const openDaySettings = useCallback(() => {
    setDaySettingsDraftStart(dayRailWindow?.startMin ?? MIN_MIN)
    setDaySettingsDraftEnd(dayRailWindow?.endMin ?? MAX_MIN)
    setDaySettingsOpen(true)
  }, [dayRailWindow])
  const saveDaySettings = useCallback(() => {
    const s = daySettingsDraftStart
    const e = daySettingsDraftEnd
    const next = s === MIN_MIN && e === MAX_MIN ? null : { startMin: s, endMin: e }
    setDayRailWindow(next)
    try {
      if (next) localStorage.setItem(DAY_RAIL_WINDOW_STORAGE_KEY, JSON.stringify(next))
      else localStorage.removeItem(DAY_RAIL_WINDOW_STORAGE_KEY)
    } catch {
      /* private mode etc. — the in-memory setting still applies */
    }
    setDaySettingsOpen(false)
  }, [daySettingsDraftStart, daySettingsDraftEnd])
  /** 30-minute choices across the block bounds for the settings selects. */
  const dayWindowChoices = useMemo(() => {
    const out: number[] = []
    for (let m = MIN_MIN; m <= MAX_MIN; m += 30) out.push(m)
    return out
  }, [])

  /**
   * Travel estimates (Option A, straight-line): job coordinates for the day's
   * blocks, via jobs_ledger.job_address → address_geocodes. Jobs without a
   * cached geocode simply get no chip (the Map page is the geocode filler).
   * Option B will layer routed times over this and fall back here.
   */
  const [jobCoordsByJobId, setJobCoordsByJobId] = useState<ReadonlyMap<string, LatLng>>(
    () => new Map(),
  )
  /** Org travel-hints settings (Dispatch Settings → Travel time hints). */
  const [travelConfig, setTravelConfig] = useState<TravelHintsConfig>(TRAVEL_HINTS_DEFAULTS)
  useEffect(() => {
    let cancelled = false
    const reload = () => {
      void loadTravelHintsConfig().then((c) => {
        if (!cancelled) setTravelConfig(c)
      })
    }
    reload()
    window.addEventListener(TRAVEL_HINTS_CONFIG_CHANGED_EVENT, reload)
    return () => {
      cancelled = true
      window.removeEventListener(TRAVEL_HINTS_CONFIG_CHANGED_EVENT, reload)
    }
  }, [])
  const travelJobIdsKey = useMemo(() => {
    if (!travelConfig.enabled) return ''
    const ids = new Set<string>()
    for (const [, rows] of blocksByUserId) for (const r of rows) ids.add(r.job_id)
    return [...ids].sort().join(',')
  }, [blocksByUserId, travelConfig.enabled])
  useEffect(() => {
    if (!travelJobIdsKey) {
      setJobCoordsByJobId(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const jobIds = travelJobIdsKey.split(',')
        const jobRows = await withSupabaseRetry<Array<{ id: string; job_address: string | null }>>(
          async () => supabase.from('jobs_ledger').select('id, job_address').in('id', jobIds),
          'load day travel job addresses',
        )
        const keyByJobId = new Map<string, string>()
        for (const j of jobRows ?? []) {
          const addr = (j.job_address ?? '').trim()
          if (addr) keyByJobId.set(j.id, normalizeAddressForGeocodeKey(addr))
        }
        const uniqueKeys = [...new Set(keyByJobId.values())]
        const coordByKey = new Map<string, LatLng>()
        for (const batch of batchGeocodeCacheKeys(uniqueKeys)) {
          const rows = await withSupabaseRetry<
            Array<{ address_normalized: string; lat: number; lng: number }>
          >(
            async () =>
              supabase
                .from('address_geocodes')
                .select('address_normalized, lat, lng')
                .in('address_normalized', batch),
            'load day travel geocodes',
          )
          for (const r of rows ?? []) coordByKey.set(r.address_normalized, { lat: r.lat, lng: r.lng })
        }
        if (cancelled) return
        const out = new Map<string, LatLng>()
        for (const [jobId, key] of keyByJobId) {
          const c = coordByKey.get(key)
          if (c) out.set(jobId, c)
        }
        setJobCoordsByJobId(out)
      } catch {
        if (!cancelled) setJobCoordsByJobId(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [travelJobIdsKey])

  /** Option B: routed times for this day's consecutive pairs; empty map = straight-line everywhere. */
  const [routedByPairKey, setRoutedByPairKey] = useState<ReadonlyMap<string, TravelEstimate>>(
    () => new Map(),
  )
  useEffect(() => {
    if (!travelConfig.enabled || !travelConfig.useRouting || jobCoordsByJobId.size === 0) {
      setRoutedByPairKey(new Map())
      return
    }
    const pairByKey = new Map<string, TravelPairRequest>()
    for (const [, rows] of blocksByUserId) {
      const sorted = [...rows].sort((a, b) => a.time_start.localeCompare(b.time_start))
      for (let i = 0; i + 1 < sorted.length; i++) {
        const fromJobId = sorted[i]!.job_id
        const toJobId = sorted[i + 1]!.job_id
        if (fromJobId === toJobId) continue
        const from = jobCoordsByJobId.get(fromJobId)
        const to = jobCoordsByJobId.get(toJobId)
        if (!from || !to) continue
        pairByKey.set(travelPairKey(fromJobId, toJobId), { fromJobId, toJobId, from, to })
      }
    }
    if (pairByKey.size === 0) {
      setRoutedByPairKey(new Map())
      return
    }
    let cancelled = false
    void fetchRoutedTravelTimes([...pairByKey.values()]).then((m) => {
      if (!cancelled) setRoutedByPairKey(m)
    })
    return () => {
      cancelled = true
    }
  }, [travelConfig.enabled, travelConfig.useRouting, jobCoordsByJobId, blocksByUserId])

  /** Chips for open gaps + red shared-dot warnings for infeasible back-to-backs, per user. */
  const travelUiForUser = useCallback(
    (userId: string, rows: JobScheduleBlockRow[]) => {
      if (!travelConfig.enabled || jobCoordsByJobId.size === 0)
        return { chips: undefined, warnings: undefined }
      const gaps = buildDayTravelGaps(
        rows.map((r) => ({
          blockId: r.id,
          jobId: r.job_id,
          startMin: timeInputToMinutesSafe(r.time_start.slice(0, 5)),
          endMin: timeInputToMinutesSafe(r.time_end.slice(0, 5)),
        })),
        jobCoordsByJobId,
        { mph: travelConfig.assumedMph, routedByPairKey },
      )
      if (gaps.length === 0) return { chips: undefined, warnings: undefined }
      const chips: Array<{
        id: string
        gapStartMin: number
        gapEndMin: number
        label: string
        title: string
        severity: 'ok' | 'tight'
      }> = []
      const warnings = new Map<string, string>()
      const prefix = (g: DayTravelGap) => (g.estimate.source === 'routed' ? '~' : '≥')
      const describe = (g: DayTravelGap) =>
        g.estimate.source === 'routed'
          ? `Estimated drive between these jobs: about ${g.estimate.minutes} min (route estimate).`
          : `Estimated drive between these jobs: at least ${g.estimate.minutes} min (straight-line estimate).`
      for (const g of gaps) {
        if (g.boundaryKind === 'gap') {
          chips.push({
            id: `travel-${userId}-${g.fromBlockId}-${g.toBlockId}`,
            gapStartMin: g.gapStartMin,
            gapEndMin: g.gapEndMin,
            label: `${prefix(g)}${g.estimate.minutes}m`,
            title: g.feasible
              ? describe(g)
              : `${describe(g)} Only ${g.gapMinutes} min of schedule gap — likely not enough.`,
            severity: g.feasible ? 'ok' : 'tight',
          })
        } else if (g.estimate.minutes >= TRAVEL_TOUCHING_WARN_MINUTES) {
          warnings.set(
            `shared:${g.fromBlockId}:${g.toBlockId}`,
            g.estimate.source === 'routed'
              ? `Back-to-back jobs, but the drive between them is about ${g.estimate.minutes} min (route estimate).`
              : `Back-to-back jobs, but the drive between them is at least ${g.estimate.minutes} min (straight-line estimate).`,
          )
        }
      }
      return {
        chips: chips.length > 0 ? chips : undefined,
        warnings: warnings.size > 0 ? warnings : undefined,
      }
    },
    [jobCoordsByJobId, travelConfig, routedByPairKey],
  )
  const [jobTitleById, setJobTitleById] = useState<Map<string, string>>(() => new Map())
  const [bidTitleById, setBidTitleById] = useState<Map<string, string>>(() => new Map())
  const [sessionsByUserId, setSessionsByUserId] = useState<Map<string, ClockSessionForDispatchBand[]>>(
    () => new Map(),
  )
  const [roleByUserId, setRoleByUserId] = useState<Map<string, string>>(() => new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const [hideAssistantsEstimators, setHideAssistantsEstimators] = useState(readHideAssistantsEstimatorsFromStorage)
  const [hubJobsForPicker, setHubJobsForPicker] = useState<ScheduleDispatchHubJobRow[]>([])
  const [cellAddContext, setCellAddContext] = useState<{ assigneeUserId: string; workDate: string } | null>(null)
  const [assignJobPickerOpen, setAssignJobPickerOpen] = useState(false)
  const [assignJobPickerSearch, setAssignJobPickerSearch] = useState('')
  const [blockModalState, setBlockModalState] = useState<QuickfillBlockModalState | null>(null)
  const [addBlockTimelineSegments, setAddBlockTimelineSegments] = useState<AddBlockTimelineSegment[]>([])
  const [addBlockDraftByBlockId, setAddBlockDraftByBlockId] = useState<
    Record<string, { time_start: string; time_end: string }>
  >({})
  const [addTimeStart, setAddTimeStart] = useState('08:00')
  const [addTimeEnd, setAddTimeEnd] = useState('16:00')
  const [addNote, setAddNote] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSaving, setAddSaving] = useState(false)

  const sortedUsers = useMemo(() => {
    const rows = userIds.map((id) => ({ id, name: (nameById.get(id) ?? 'Unknown').trim() || 'Unknown' }))
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return rows
  }, [userIds, nameById])

  /** Visible roster after role filter; then search runs in filteredSortedUsers. */
  const rosterFilteredUsers = useMemo(() => {
    if (!hideAssistantsEstimators) return sortedUsers
    return sortedUsers.filter(({ id }) => {
      const r = roleByUserId.get(id)
      return !isAssistantLike(r) && r !== 'estimator'
    })
  }, [sortedUsers, hideAssistantsEstimators, roleByUserId])

  const filteredSortedUsers = useMemo(() => {
    const q = searchQuery.trim()
    if (q === '') return rosterFilteredUsers
    const n = q.toLowerCase()
    return rosterFilteredUsers.filter(({ id, name }) => {
      if (name.toLowerCase().includes(n)) return true
      for (const b of blocksByUserId.get(id) ?? []) {
        const title = jobTitleById.get(b.job_id) ?? formatScheduleDispatchHubJobTitle(null, null)
        if (title.toLowerCase().includes(n)) return true
      }
      return false
    })
  }, [rosterFilteredUsers, searchQuery, blocksByUserId, jobTitleById])

  const scheduleUsersByRoleSection = useMemo(
    () => groupRosterUsersByAuthRoleSection(filteredSortedUsers, roleByUserId),
    [filteredSortedUsers, roleByUserId],
  )

  const scheduleSecondaryByUserId = useMemo(() => {
    const now = Date.now()
    const m = new Map<string, DispatchSecondaryBand[]>()
    for (const id of userIds) {
      const bands = clockSessionsToDispatchSecondaryBands(
        sessionsByUserId.get(id) ?? [],
        workDate,
        now,
        jobTitleById,
        bidTitleById,
      )
      if (bands.length > 0) m.set(id, bands)
    }
    return m
  }, [userIds, sessionsByUserId, workDate, jobTitleById, bidTitleById])

  const jobLabelsRecord = useMemo(() => Object.fromEntries(jobTitleById), [jobTitleById])
  const bidLabelsRecord = useMemo(() => Object.fromEntries(bidTitleById), [bidTitleById])

  const openMyTimeForSessionStrip = useCallback((uid: string, name: string) => {
    setScheduleMyTimeEditor({ subjectUserId: uid, subjectDisplayName: name })
  }, [])

  const closeQuickfillAddBlock = useCallback(() => {
    setBlockModalState(null)
    setAddError(null)
    setAddBlockTimelineSegments([])
    setAddBlockDraftByBlockId({})
  }, [])

  const closeQuickfillJobPicker = useCallback(() => {
    setAssignJobPickerOpen(false)
    setCellAddContext(null)
    setAssignJobPickerSearch('')
  }, [])

  const openQuickfillAddBlock = useCallback(
    (args: { assigneeUserId: string; workDate: string; jobId: string }) => {
      setAssignJobPickerOpen(false)
      setCellAddContext(null)
      setAssignJobPickerSearch('')
      setBlockModalState({ kind: 'add', assigneeUserId: args.assigneeUserId, workDate: args.workDate, jobId: args.jobId })
      const rows = blocksByUserId.get(args.assigneeUserId) ?? []
      const labelFor = (jid: string) => jobTitleById.get(jid) ?? formatScheduleDispatchHubJobTitle(null, null)
      const segments: AddBlockTimelineSegment[] = [...rows]
        .map((b) => ({
          blockId: b.id,
          jobId: b.job_id,
          label: labelFor(b.job_id),
          time_start: b.time_start,
          time_end: b.time_end,
          shared_block_group_id: b.shared_block_group_id,
        }))
        .sort(
          (a, b) =>
            scheduleTimeToMinutesFromMidnight(timeInputToPg(a.time_start.slice(0, 5))) -
            scheduleTimeToMinutesFromMidnight(timeInputToPg(b.time_start.slice(0, 5))),
        )
      setAddBlockTimelineSegments(segments)
      setAddBlockDraftByBlockId({})
      const def = defaultNewBlockRangeInFirstGap({ segments, draftByBlockId: {} })
      if (def) {
        setAddTimeStart(dispatchMinutesToHHmm(def.startMin))
        setAddTimeEnd(dispatchMinutesToHHmm(def.endMin))
      } else {
        setAddTimeStart('08:00')
        setAddTimeEnd('16:00')
      }
      setAddNote('')
      setAddError(null)
    },
    [blocksByUserId, jobTitleById],
  )

  /** Unique jobs_ledger ids from this person’s clock sessions on the picker day (first clock-in order). */
  const quickfillOrderedSessionJobLedgerIds = useMemo(() => {
    if (!cellAddContext) return [] as string[]
    const sessions = sessionsByUserId.get(cellAddContext.assigneeUserId) ?? []
    const out: string[] = []
    const seen = new Set<string>()
    for (const s of sessions) {
      const jid = s.job_ledger_id?.trim()
      if (!jid || seen.has(jid)) continue
      seen.add(jid)
      out.push(jid)
    }
    return out
  }, [cellAddContext, sessionsByUserId])

  const quickfillSessionJobOrderIndex = useMemo(() => {
    const m = new Map<string, number>()
    quickfillOrderedSessionJobLedgerIds.forEach((id, i) => m.set(id, i))
    return m
  }, [quickfillOrderedSessionJobLedgerIds])

  const quickfillPickerJobsSorted = useMemo(
    () =>
      [...hubJobsForPicker].sort((a, b) => {
        const ia = quickfillSessionJobOrderIndex.get(a.id)
        const ib = quickfillSessionJobOrderIndex.get(b.id)
        const aIn = ia !== undefined
        const bIn = ib !== undefined
        if (aIn && !bIn) return -1
        if (!aIn && bIn) return 1
        if (aIn && bIn && ia !== ib) return ia - ib
        const ha = (a.hcp_number ?? '').trim()
        const hb = (b.hcp_number ?? '').trim()
        return hb.localeCompare(ha, undefined, { numeric: true })
      }),
    [hubJobsForPicker, quickfillSessionJobOrderIndex],
  )

  const quickfillAssignJobPickerRows = useMemo(() => {
    const q = assignJobPickerSearch.trim().toLowerCase()
    const sessionTodaySet = new Set(quickfillOrderedSessionJobLedgerIds)
    let list = quickfillPickerJobsSorted
    if (q) {
      list = list.filter(
        (j) =>
          (j.hcp_number ?? '').toLowerCase().includes(q) ||
          (j.job_name ?? '').toLowerCase().includes(q) ||
          formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name).toLowerCase().includes(q),
      )
    }
    return list.map((j) => ({
      id: j.id,
      displayTitle: formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name),
      sessionToday: sessionTodaySet.has(j.id),
    }))
  }, [assignJobPickerSearch, quickfillOrderedSessionJobLedgerIds, quickfillPickerJobsSorted])

  const quickfillCellChoiceSubtitle = useMemo(() => {
    if (!cellAddContext) return ''
    const name = (nameById.get(cellAddContext.assigneeUserId) ?? 'Unknown').trim() || 'Unknown'
    return `${name} · ${scheduleFormatWeekdayLong(cellAddContext.workDate)} (${cellAddContext.workDate})`
  }, [cellAddContext, nameById])

  const quickfillAssignJobPickerSubtitle = useMemo((): ReactNode => {
    if (!cellAddContext) return null
    return (
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-600)' }}>
        Pick a job to add a block for <strong>{quickfillCellChoiceSubtitle}</strong>.
      </p>
    )
  }, [cellAddContext, quickfillCellChoiceSubtitle])

  const blockModalPersonLabel = useMemo(() => {
    if (!blockModalState) return ''
    return (nameById.get(blockModalState.assigneeUserId) ?? 'Unknown').trim() || 'Unknown'
  }, [blockModalState, nameById])

  const blockModalJobTitle = useMemo(() => {
    if (!blockModalState) return ''
    return jobTitleById.get(blockModalState.jobId) ?? formatScheduleDispatchHubJobTitle(null, null)
  }, [blockModalState, jobTitleById])

  const addBlockModalTimeline = useMemo(() => {
    if (!blockModalState) return undefined
    return {
      segments: addBlockTimelineSegments,
      draftByBlockId: addBlockDraftByBlockId,
      setDraftByBlockId: setAddBlockDraftByBlockId,
    }
  }, [blockModalState, addBlockTimelineSegments, addBlockDraftByBlockId])

  useEffect(() => {
    setAssignJobPickerOpen(false)
    setCellAddContext(null)
    setAssignJobPickerSearch('')
    closeQuickfillAddBlock()
  }, [workDate, closeQuickfillAddBlock])

  useReportQuickfillSectionMetric('schedule', null, false)

  const dayLabel = useMemo(() => {
    const ms = referenceDateForWorkDateYmd(workDate).getTime()
    return formatDenverCalendarDayWithWeekdayAndYear(ms)
  }, [workDate])

  const scheduleDispatchHref = useMemo(() => {
    const weekStart = companyWeekStartSundayContaining(workDate) ?? getDefaultWeekRange().start
    return `/schedule-dispatch?week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDate)}`
  }, [workDate])

  const openOccupiedBandOnScheduleDispatch = useCallback(
    (band: DispatchOccupiedBand) => {
      const jid = band.jobId?.trim()
      if (!jid) return
      const weekStart = companyWeekStartSundayContaining(workDate) ?? getDefaultWeekRange().start
      const target = `/schedule-dispatch?jobId=${encodeURIComponent(jid)}&week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDate)}`
      navigate(target)
    },
    [navigate, workDate],
  )

  const toggleHideAssistantsEstimators = useCallback(() => {
    setHideAssistantsEstimators((prev) => {
      const next = !prev
      try {
        localStorage.setItem(QUICKFILL_SCHEDULE_HIDE_ASSISTANT_ESTIMATOR_KEY, next ? '1' : '0')
      } catch {
        /* ignore quota / private mode */
      }
      return next
    })
  }, [])

  const loadData = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet === true
    if (!quiet) setLoading(true)
    try {
      const [usersRes, jobsRes] = await Promise.all([
        fetchUsersTabRosterForScheduleDispatchHub(role === 'dev'),
        fetchJobsLedgerForScheduleDispatchHub(),
      ])
      if (usersRes.error) {
        showToast(usersRes.error, 'error')
        setUserIds([])
        setRoleByUserId(new Map())
        setBlocksByUserId(new Map())
        setSessionsByUserId(new Map())
        setBidTitleById(new Map())
        setHubJobsForPicker([])
        return
      }
      const roster = usersRes.data
      const ids = roster.map((r) => r.id)
      setRoleByUserId(new Map(roster.map((r) => [r.id, r.role])))
      const jMap = new Map<string, string>()
      if (!jobsRes.error) {
        setHubJobsForPicker(jobsRes.data)
        for (const j of jobsRes.data) {
          jMap.set(j.id, formatScheduleDispatchHubJobTitle(j.hcp_number, j.job_name))
        }
      } else {
        setHubJobsForPicker([])
      }
      setJobTitleById(jMap)

      const namesRes = await fetchUserNamesForIds(ids)
      if (namesRes.error) {
        showToast(namesRes.error, 'warning')
      }
      setNameById(namesRes.data)

      if (ids.length === 0) {
        setUserIds([])
        setBlocksByUserId(new Map())
        setSessionsByUserId(new Map())
        setBidTitleById(new Map())
        return
      }

      const { data: blockRows, error: blockErr } = await fetchScheduleBlocksForAssigneesOnDay(ids, workDate)
      if (blockErr) {
        showToast(blockErr, 'error')
      }

      let sessionRows: ClockSessionForDispatchBand[] = []
      try {
        const raw = await withSupabaseRetry(
          async () =>
            await supabase
              .from('clock_sessions')
              .select('id, user_id, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, notes')
              .in('user_id', ids)
              .eq('work_date', workDate)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .order('clocked_in_at', { ascending: true }),
          'quickfill schedule clock_sessions',
        )
        sessionRows = (raw ?? []) as ClockSessionForDispatchBand[]
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not load clock sessions'), 'warning')
      }

      const bidIds = new Set<string>()
      for (const r of sessionRows) {
        if (r.bid_id) bidIds.add(r.bid_id)
      }
      const bidMap = new Map<string, string>()
      if (bidIds.size > 0) {
        try {
          const bidRows = await withSupabaseRetry(
            async () =>
              await supabase
                .from('bids')
                .select('id, bid_number, project_name, service_type_id')
                .in('id', [...bidIds]),
            'quickfill schedule bids for clock sessions',
          )
          for (const br of bidRows ?? []) {
            const b = br as {
              id: string
              bid_number: string | null
              project_name: string | null
              service_type_id: string | null
            }
            const num = b.bid_number?.trim()
            const pn = (b.project_name ?? '').trim()
            const label = num
              ? formatBidLedgerShortLine(ledgerPrefixMap, b.service_type_id, b.bid_number, b.project_name)
              : pn || 'Bid'
            bidMap.set(b.id, label)
          }
        } catch (e) {
          showToast(formatErrorMessage(e, 'Could not load bid names for clock sessions'), 'warning')
        }
      }
      setBidTitleById(bidMap)

      const sessionsByUser = new Map<string, ClockSessionForDispatchBand[]>()
      for (const id of ids) {
        sessionsByUser.set(id, [])
      }
      for (const r of sessionRows) {
        const arr = sessionsByUser.get(r.user_id) ?? []
        arr.push(r)
        sessionsByUser.set(r.user_id, arr)
      }
      setSessionsByUserId(sessionsByUser)

      const byUser = new Map<string, JobScheduleBlockRow[]>()
      for (const id of ids) {
        byUser.set(id, [])
      }
      if (!blockErr) {
        for (const b of blockRows) {
          const arr = byUser.get(b.assignee_user_id) ?? []
          arr.push(b)
          byUser.set(b.assignee_user_id, arr)
        }
      }
      for (const [, arr] of byUser) {
        arr.sort((a, c) => a.time_start.localeCompare(c.time_start))
      }
      setUserIds(ids)
      setBlocksByUserId(byUser)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load schedule overview'), 'error')
      setUserIds([])
      setRoleByUserId(new Map())
      setBlocksByUserId(new Map())
      setSessionsByUserId(new Map())
      setBidTitleById(new Map())
      setHubJobsForPicker([])
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [workDate, role, showToast, ledgerPrefixMap])

  /** Rows with the live dot-drag draft applied (bars + dots track the pointer until persist). */
  const effectiveRowsForUser = useCallback(
    (userId: string): JobScheduleBlockRow[] => {
      const rows = blocksByUserId.get(userId) ?? []
      if (!dotDraft || dotDraft.userId !== userId) return rows
      return rows.map((r) => {
        const u = dotDraft.updates.get(r.id)
        return u
          ? { ...r, time_start: dotMinutesToPgTime(u.startMin), time_end: dotMinutesToPgTime(u.endMin) }
          : r
      })
    },
    [blocksByUserId, dotDraft],
  )

  const rowsToDotBlocks = (rows: JobScheduleBlockRow[]): DotBlock[] =>
    rows.map((r) => ({
      blockId: r.id,
      startMin: timeInputToMinutesSafe(r.time_start.slice(0, 5)),
      endMin: timeInputToMinutesSafe(r.time_end.slice(0, 5)),
    }))

  /**
   * Dots keep their identity (kind/ids) from the BASE rows for the whole
   * gesture — only positions come from the draft. Otherwise dragging an edge
   * onto a neighbor would flip the dot to `shared` mid-drag, unmounting the
   * element that holds pointer capture. Structure refreshes on reload.
   */
  const boundaryDotsForUser = useCallback(
    (userId: string): BoundaryDot[] => {
      const base = boundaryDotsFromBlocks(rowsToDotBlocks(blocksByUserId.get(userId) ?? []))
      if (!dotDraft || dotDraft.userId !== userId) return base
      const effective = new Map(
        rowsToDotBlocks(effectiveRowsForUser(userId)).map((b) => [b.blockId, b]),
      )
      return base.map((d) => {
        if (d.kind === 'start') {
          const b = effective.get(d.blockId)
          return b ? { ...d, min: b.startMin } : d
        }
        if (d.kind === 'end') {
          const b = effective.get(d.blockId)
          return b ? { ...d, min: b.endMin } : d
        }
        const before = effective.get(d.beforeBlockId)
        return before ? { ...d, min: before.endMin } : d
      })
    },
    [blocksByUserId, dotDraft, effectiveRowsForUser],
  )

  /** Write a draft's updates; keeps the draft rendered until the quiet reload lands, then notifies the host. */
  const persistDotDraft = useCallback(
    (draft: { userId: string; updates: Map<string, { startMin: number; endMin: number }> }) => {
      if (draft.updates.size === 0) {
        setDotDraft(null)
        return
      }
      setDotSaving(true)
      void (async () => {
        try {
          for (const [blockId, u] of draft.updates) {
            const { error } = await updateJobScheduleBlock(blockId, {
              time_start: dotMinutesToPgTime(u.startMin),
              time_end: dotMinutesToPgTime(u.endMin),
            })
            if (error) {
              showToast(error, 'error')
              break
            }
          }
          await loadData({ quiet: true })
          onBlocksSaved?.()
        } finally {
          setDotSaving(false)
          dotDraftRef.current = null
          setDotDraft(null)
        }
      })()
    },
    [loadData, showToast, onBlocksSaved],
  )

  const flushPendingDotSave = useCallback(() => {
    if (dotSaveTimerRef.current != null) {
      clearTimeout(dotSaveTimerRef.current)
      dotSaveTimerRef.current = null
    }
    const draft = dotDraftRef.current
    if (draft) persistDotDraft(draft)
  }, [persistDotDraft])

  /** Auto-save: (re)arm the timer; fires DOT_AUTOSAVE_DEBOUNCE_MS after the last touch. */
  const scheduleDotSave = useCallback(() => {
    if (dotSaveTimerRef.current != null) clearTimeout(dotSaveTimerRef.current)
    dotSaveTimerRef.current = setTimeout(() => {
      dotSaveTimerRef.current = null
      const draft = dotDraftRef.current
      if (draft) persistDotDraft(draft)
    }, DOT_AUTOSAVE_DEBOUNCE_MS)
  }, [persistDotDraft])

  /** Pending edits must not be lost if the section unmounts (e.g. switching to the People tab) — flush immediately. */
  useEffect(() => {
    return () => {
      if (dotSaveTimerRef.current != null) {
        clearTimeout(dotSaveTimerRef.current)
        dotSaveTimerRef.current = null
      }
      const draft = dotDraftRef.current
      if (draft && draft.updates.size > 0) {
        dotDraftRef.current = null
        void (async () => {
          for (const [blockId, u] of draft.updates) {
            await updateJobScheduleBlock(blockId, {
              time_start: dotMinutesToPgTime(u.startMin),
              time_end: dotMinutesToPgTime(u.endMin),
            })
          }
          onBlocksSavedRef.current?.()
        })()
      }
    }
  }, [])

  const handleDotDrag = useCallback(
    (userId: string, dot: BoundaryDot, targetMin: number) => {
      if (dotSaving) return
      // Touching a different person's dot while a save is pending flushes the old draft first.
      const pending = dotDraftRef.current
      if (pending && pending.userId !== userId) flushPendingDotSave()
      else if (dotSaveTimerRef.current != null) {
        clearTimeout(dotSaveTimerRef.current)
        dotSaveTimerRef.current = null
      }
      const blocks = rowsToDotBlocks(effectiveRowsForUser(userId))
      const r = resolveDotDrag(dot, targetMin, blocks)
      if (r.updates.size === 0) return
      // Ref updates synchronously so the pointerup handler (same tick) sees the draft.
      const prevDraft = dotDraftRef.current
      const merged = new Map<string, { startMin: number; endMin: number }>(
        prevDraft && prevDraft.userId === userId ? prevDraft.updates : [],
      )
      for (const [bid, u] of r.updates) merged.set(bid, u)
      const next = { userId, updates: merged }
      dotDraftRef.current = next
      setDotDraft(next)
    },
    [dotSaving, effectiveRowsForUser, flushPendingDotSave],
  )

  const handleDotDragEnd = useCallback(
    (userId: string) => {
      const draft = dotDraftRef.current
      if (!draft || draft.userId !== userId || draft.updates.size === 0) return
      scheduleDotSave()
    },
    [scheduleDotSave],
  )

  const handleSharedDotSeparate = useCallback(
    (userId: string, dot: Extract<BoundaryDot, { kind: 'shared' }>) => {
      if (dotSaving) return
      const r = separateSharedDot(dot, rowsToDotBlocks(blocksByUserId.get(userId) ?? []))
      if (!r) {
        showToast('Cannot separate — the later job is already at the 30-minute minimum.', 'info')
        return
      }
      setDotSaving(true)
      void (async () => {
        try {
          const { error } = await updateJobScheduleBlock(r.blockId, {
            time_start: dotMinutesToPgTime(r.startMin),
            time_end: dotMinutesToPgTime(r.endMin),
          })
          if (error) showToast(error, 'error')
          else showToast('Moved the later job 15 minutes later.', 'success')
          await loadData({ quiet: true })
          onBlocksSaved?.()
        } finally {
          setDotSaving(false)
          dotDraftRef.current = null
          setDotDraft(null)
        }
      })()
    },
    [blocksByUserId, dotSaving, loadData, showToast, onBlocksSaved],
  )

  const saveQuickfillBlockModal = useCallback(async () => {
    if (!blockModalState || !authUser?.id) return
    setAddSaving(true)
    setAddError(null)
    const res = await saveNewScheduleBlockForPersonDay({
      authUserId: authUser.id,
      assigneeUserId: blockModalState.assigneeUserId,
      workDate: blockModalState.workDate,
      targetJobId: blockModalState.jobId,
      addTimeStart,
      addTimeEnd,
      addNote,
      addBlockDraftByBlockId,
    })
    setAddSaving(false)
    if (!res.ok) {
      setAddError(res.error)
      return
    }
    showToast('Block added.', 'success')
    closeQuickfillAddBlock()
    void loadData({ quiet: true })
    onBlocksSaved?.()
  }, [
    addBlockDraftByBlockId,
    addNote,
    addTimeEnd,
    addTimeStart,
    authUser?.id,
    blockModalState,
    closeQuickfillAddBlock,
    loadData,
    showToast,
    onBlocksSaved,
  ])

  const handleScheduleMarkNotComingIn = useCallback(async () => {
    const editor = scheduleMyTimeEditor
    if (!editor) return
    const result = await recordNotComingInForUserAsStaff({
      subjectUserId: editor.subjectUserId,
      workDateYmd: workDate,
    })
    if (result.ok && result.alreadyMarked) {
      showToast(`${editor.subjectDisplayName} already has unpaid time off on ${workDate}.`, 'warning')
      return
    }
    if (!result.ok) {
      showToast(result.message, 'error')
      return
    }
    showToast(`Marked ${editor.subjectDisplayName} as not coming in (${workDate}).`, 'success')
    if (result.syncWarning) {
      showToast(`Salary sync: ${result.syncWarning}`, 'warning')
    }
    void loadData({ quiet: true })
  }, [scheduleMyTimeEditor, workDate, showToast, loadData])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const scheduleBlocksFilters = useMemo(
    () => [
      { event: '*' as const, schema: 'public', table: 'job_schedule_blocks', filter: `work_date=eq.${workDate}` },
    ],
    [workDate],
  )
  useRealtimeChannel(
    true,
    `quickfill-schedule-blocks-${workDate}`,
    scheduleBlocksFilters,
    () => {
      void loadData({ quiet: true })
    },
    { debounceMs: 400 },
  )

  /** Day label + Previous/Next/Dispatch/Today (+ Visible hours gear). On the Dispatch Day tab it renders ABOVE the conflict banner; elsewhere it keeps its spot below the search row. */
  const dayNavRow = (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          fontSize: '0.875rem',
        }}
      >
        <button
          type="button"
          onClick={() => setWorkDate((d) => ymdAddDays(d, -1))}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            cursor: 'pointer',
          }}
        >
          ← Previous Day
        </button>
        <span style={{ color: 'var(--text-700)', fontWeight: 600 }}>{dayLabel}</span>
        <button
          type="button"
          onClick={() => setWorkDate((d) => ymdAddDays(d, 1))}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            cursor: 'pointer',
          }}
        >
          Next Day →
        </button>
        <Link
          to={scheduleDispatchHref}
          aria-label="Open Schedule Dispatch for the week of this day"
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            color: 'var(--text-700)',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Dispatch
        </Link>
        {workDate !== denverCalendarDayKey(Date.now()) ? (
          <button
            type="button"
            onClick={() => setWorkDate(denverCalendarDayKey(Date.now()))}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8125rem',
              border: '1px solid #2563eb',
              borderRadius: 4,
              background: 'var(--bg-blue-tint)',
              color: 'var(--text-blue-700)',
              cursor: 'pointer',
            }}
          >
            Today
          </button>
        ) : null}
        {showDaySettings ? (
          <button
            type="button"
            onClick={openDaySettings}
            title="Day view settings — visible hours"
            aria-label="Open Day view settings (visible hours)"
            style={{
              marginLeft: 'auto',
              padding: '0.25rem 0.5rem',
              fontSize: '0.8125rem',
              border: dayRailWindow ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: dayRailWindow ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: dayRailWindow ? 'var(--text-blue-700)' : 'var(--text-700)',
              cursor: 'pointer',
            }}
          >
            {dayRailWindow
              ? `${formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dayRailWindow.startMin))}–${formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(dayRailWindow.endMin))} ⚙`
              : 'Visible hours ⚙'}
          </button>
        ) : null}
      </div>
  )

  return (
    <div>
      {showDaySettings ? dayNavRow : null}
      {!hideConflictPrompt ? (
        <div role="note" style={QUICKFILL_SECTION_BANNER_BOX_STYLE}>
          {SCHEDULE_CONFLICTS_DEFAULT_PROMPT}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by person or job…"
          aria-label="Search by person or job"
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            padding: '0.4rem 0.5rem',
            fontSize: '0.875rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
          }}
        />
        {searchQuery.trim() !== '' ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              padding: '0.4rem 0.6rem',
              fontSize: '0.8125rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              color: 'var(--text-700)',
            }}
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleHideAssistantsEstimators}
          style={{
            padding: '0.4rem 0.6rem',
            fontSize: '0.8125rem',
            border: hideAssistantsEstimators ? '1px solid #2563eb' : '1px solid var(--border-strong)',
            borderRadius: 4,
            background: hideAssistantsEstimators ? 'var(--bg-blue-tint)' : 'var(--surface)',
            color: hideAssistantsEstimators ? 'var(--text-blue-700)' : 'var(--text-700)',
            cursor: 'pointer',
            fontWeight: hideAssistantsEstimators ? 600 : 400,
          }}
        >
          {hideAssistantsEstimators
            ? 'Unhide assistants and estimators'
            : 'Hide assistants and estimators'}
        </button>
      </div>
      {!showDaySettings ? dayNavRow : null}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : sortedUsers.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No users in the Schedule Dispatch roster.</p>
      ) : rosterFilteredUsers.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          No one to show with assistants and estimators hidden. Click “Unhide assistants and estimators” to see them.
        </p>
      ) : filteredSortedUsers.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No people match this search.</p>
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: QUICKFILL_SCHEDULE_ROW_GAP,
              marginBottom: '0.15rem',
            }}
          >
            <div style={{ width: QUICKFILL_SCHEDULE_NAME_COL_WIDTH, flexShrink: 0 }} aria-hidden />
            <div
              aria-hidden
              style={{
                position: 'relative',
                flex: 1,
                minWidth: 0,
                height: 12,
                pointerEvents: 'none',
              }}
            >
              {DISPATCH_ADD_BLOCK_ORIENTATION_MARKS.filter((m) => {
                if (m.slotIndex > DISPATCH_ADD_BLOCK_SLOT_COUNT - 1) return false
                if (!dayRailTrimWindow) return true
                return (
                  m.slotIndex >= dayRailTrimWindow.loSlotIndex &&
                  m.slotIndex <= dayRailTrimWindow.hiSlotIndex
                )
              }).map(({ slotIndex, label }) => (
                <span
                  key={slotIndex}
                  style={{
                    position: 'absolute',
                    left: dispatchAddBlockTrackThumbLeftPct(
                      slotIndex,
                      DISPATCH_ADD_BLOCK_SLOT_COUNT,
                      dayRailTrimWindow,
                    ),
                    transform: 'translateX(-50%)',
                    fontSize: '0.65rem',
                    color: 'var(--text-faint)',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
            {canEditSchedule ? (
              <div style={{ width: QUICKFILL_SCHEDULE_ADD_COL_WIDTH, flexShrink: 0 }} aria-hidden />
            ) : null}
          </div>
          {scheduleUsersByRoleSection.map((roleSection, sectionIndex) => {
            const headingId = `quickfill-schedule-role-${roleSection.sectionKey}`
            return (
              <section
                key={roleSection.sectionKey}
                aria-labelledby={headingId}
                style={{ marginTop: sectionIndex > 0 ? '1.25rem' : 0 }}
              >
                <h2
                  id={headingId}
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-strong)',
                    textAlign: 'left',
                    textDecoration: 'underline',
                  }}
                >
                  {roleSection.label}
                </h2>
                <div>
                  {roleSection.rows.map(({ id, name }) => {
                    const rows = effectiveRowsForUser(id)
                    const segments = blocksToSegments(rows, jobTitleById)
                    const secondary = scheduleSecondaryByUserId.get(id)
                    const dots = canEditSchedule && rows.length > 0 ? boundaryDotsForUser(id) : undefined
                    const travelUi = travelUiForUser(id, rows)
                    return (
                      <QuickfillScheduleUserRow
                        key={id}
                        userId={id}
                        displayName={name}
                        scheduleDayYmd={workDate}
                        segments={segments}
                        secondaryBands={secondary}
                        nameColumnIndent
                        railTrimWindow={dayRailTrimWindow}
                        travelGapChips={travelUi.chips}
                        sharedDotWarnings={travelUi.warnings}
                        boundaryDots={dots}
                        onBoundaryDotDrag={
                          dots ? (dot, targetMin) => handleDotDrag(id, dot, targetMin) : undefined
                        }
                        onBoundaryDotDragEnd={dots ? () => handleDotDragEnd(id) : undefined}
                        onSharedDotSeparate={
                          dots ? (dot) => handleSharedDotSeparate(id, dot) : undefined
                        }
                        onScheduleAddClick={
                          canEditSchedule
                            ? () => {
                                setCellAddContext({ assigneeUserId: id, workDate })
                                setAssignJobPickerSearch('')
                                setAssignJobPickerOpen(true)
                              }
                            : undefined
                        }
                        onOpenMyTimeForSessionStrip={
                          showStripSubjectMyTimeEditor ? openMyTimeForSessionStrip : undefined
                        }
                        onOpenPersonMyTime={
                          showStripSubjectMyTimeEditor ? openMyTimeForSessionStrip : undefined
                        }
                        onOccupiedBandClick={openOccupiedBandOnScheduleDispatch}
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <ScheduleDispatchAssignJobPickerModal
        open={assignJobPickerOpen}
        onClose={closeQuickfillJobPicker}
        subtitle={quickfillAssignJobPickerSubtitle}
        jobRows={quickfillAssignJobPickerRows}
        searchValue={assignJobPickerSearch}
        onSearchChange={setAssignJobPickerSearch}
        onPickJob={(jobId) => {
          if (!cellAddContext) return
          openQuickfillAddBlock({
            assigneeUserId: cellAddContext.assigneeUserId,
            workDate: cellAddContext.workDate,
            jobId,
          })
        }}
      />
      <ScheduleDispatchAddBlockModal
        open={blockModalState != null}
        mode="add"
        jobTitle={blockModalJobTitle}
        personLabel={blockModalPersonLabel}
        workDate={blockModalState?.workDate ?? ''}
        timeStart={addTimeStart}
        timeEnd={addTimeEnd}
        note={addNote}
        saving={addSaving}
        error={addError}
        onClose={closeQuickfillAddBlock}
        onChangeStart={setAddTimeStart}
        onChangeEnd={setAddTimeEnd}
        onChangeNote={setAddNote}
        onSave={() => void saveQuickfillBlockModal()}
        addTimeline={addBlockModalTimeline}
      />
      {daySettingsOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1003,
          }}
          role="presentation"
          onClick={() => setDaySettingsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-view-settings-title"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              width: 'min(94vw, 380px)',
              padding: '1rem 1.1rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="day-view-settings-title" style={{ margin: '0 0 0.5rem 0', color: 'var(--text-strong)' }}>
              Day view visible hours
            </h3>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              The timeline stretches this window across the page (schedule blocks live between 4:00 AM
              and 8:00 PM). Saved on this device only; jobs outside the window pin to its edge.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'grid', gap: 4 }}>
                Start
                <select
                  value={daySettingsDraftStart}
                  onChange={(e) => {
                    const s = Number(e.target.value)
                    setDaySettingsDraftStart(s)
                    if (daySettingsDraftEnd - s < 60) setDaySettingsDraftEnd(Math.min(s + 60, MAX_MIN))
                  }}
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                >
                  {dayWindowChoices
                    .filter((m) => m <= MAX_MIN - 60)
                    .map((m) => (
                      <option key={m} value={m}>
                        {formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(m))}
                      </option>
                    ))}
                </select>
              </label>
              <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'grid', gap: 4 }}>
                End
                <select
                  value={daySettingsDraftEnd}
                  onChange={(e) => setDaySettingsDraftEnd(Number(e.target.value))}
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                >
                  {dayWindowChoices
                    .filter((m) => m >= daySettingsDraftStart + 60)
                    .map((m) => (
                      <option key={m} value={m}>
                        {formatDispatchQuickTimeLabel(dispatchMinutesToHHmm(m))}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setDaySettingsDraftStart(MIN_MIN)
                  setDaySettingsDraftEnd(MAX_MIN)
                }}
                style={{
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.8125rem',
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-link)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Reset to full day (4 AM–8 PM)
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setDaySettingsOpen(false)}
                  style={{
                    padding: '0.35rem 0.7rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    color: 'var(--text-700)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDaySettings}
                  style={{
                    padding: '0.35rem 0.7rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: '#2563eb',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {scheduleMyTimeEditor ? (
        <DashboardMyTimeDayEditorModal
          dateStr={workDate}
          sessions={[]}
          subjectUserId={scheduleMyTimeEditor.subjectUserId}
          subjectDisplayName={scheduleMyTimeEditor.subjectDisplayName}
          jobLabels={jobLabelsRecord}
          bidLabels={bidLabelsRecord}
          allowNcnsFromMyTime={showClockStripScopeToggle}
          showMarkNotComingIn={showStripSubjectMyTimeEditor}
          onMarkNotComingIn={
            showStripSubjectMyTimeEditor ? () => void handleScheduleMarkNotComingIn() : undefined
          }
          onClose={() => setScheduleMyTimeEditor(null)}
          onSaved={() => {
            void loadData({ quiet: true })
            setScheduleMyTimeEditor(null)
          }}
          onLinkedSessionsUpdated={() => void loadData({ quiet: true })}
        />
      ) : null}
    </div>
  )
}

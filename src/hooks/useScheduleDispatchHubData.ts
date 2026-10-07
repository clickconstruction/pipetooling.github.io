import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildBlockCoverageByKey, type CoveragePerson } from '../lib/schedule/blockGroupCoverage'
import { buildSubBadgesByCell, buildSubLanes, dayKeysBetween, type SubDispatchOrder } from '../lib/subs/subDispatch'
import { fetchSubOffDaysForRange, fetchSubOrdersForRange, fetchTeamMembersByJobId } from '../lib/subs/subDispatchFetch'
import type { UserRole } from './useAuth'
import { recordNavClick } from '../lib/navClickTelemetry'
import { blocksToBidWeekMatrixRows, collectScheduledBidIds } from '../lib/scheduleBlockTitle'
import type { useToastContext } from '../contexts/ToastContext'
import {
  fetchJobScheduleBlocksForHubDateRange,
  scheduleBlockAnchorId,
  type JobScheduleBlockRow,
} from '../lib/jobScheduleBlocks'
import { buildLinkedGroupAccentMap } from '../lib/scheduleDispatchLinkedGroupPalette'
import { fetchDispatchSwimLanes, type DispatchSwimLanesData } from '../lib/dispatchSwimLanes'
import { fetchSalariedUserIdSetFromUserIds } from '../lib/salaryPayConfigGate'
import {
  blocksToJobWeekSummaries,
  buildHubAllPeopleRows,
  buildHubJobAddressById,
  buildHubJobTitleById,
  buildHubMergedRows,
  buildPersonDayBlockMap,
  fetchArchivedUserIdSetForIds,
  fetchBidTitlesForScheduleBlocks,
  fetchBidsForScheduleDispatchHub,
  fetchJobsLedgerForScheduleDispatchHub,
  fetchTeamMemberUserIdsForJobIds,
  fetchUserNamesForIds,
  fetchUsersTabRosterForScheduleDispatchHub,
  formatScheduleDispatchHubJobTitle,
  type ScheduleDispatchHubBidRow,
  type ScheduleDispatchHubJobRow,
} from '../lib/scheduleDispatchHub'
import { buildHourlyWageByUserId, hubWageLookupNames, type HubPayConfigWageRow } from '../lib/scheduleDispatch/hubWages'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { todayYmdInAppTz, ymdAddDays } from '../utils/dateUtils'
import {
  buildScheduleHiddenByCell,
  fetchScheduleHiddenBlockCounts,
  scheduleHiddenBlocksTotal,
  scheduleHiddenUserIds,
  type ScheduleHiddenBlockCount,
} from '../lib/scheduleHiddenBlocks'
import { clampOfficeEnsureRange, ensureOfficeScheduleBlocks } from '../lib/dispatchOfficeRoster'
import {
  buildUserTimeOffByCell,
  fetchUserTimeOffForUsersInRange,
  type UserTimeOffCellInfo,
} from '../lib/userTimeOffByCell'
import { computeLatenessByCell, fetchClockInsForUsersInRange, type PersonDayLateness } from '../lib/scheduleLateness'

export type ScheduleDispatchHubDataInput = {
  /** Always `''` on the hub page — the vestigial job-week mode (SCHEDULE_DISPATCH map, quirk "`jobId = ''` vestigial dual-mode"); its dead branches stay verbatim until the map's cleanup step. */
  jobId: string
  weekStart: string
  weekEnd: string
  role: UserRole | null
  authUserId: string | undefined
  /** The page's edit gate — the standing office schedule fills only for editors. */
  canEdit: boolean
  showToast: ReturnType<typeof useToastContext>['showToast']
}

/**
 * The Schedule Dispatch hub's week data engine (moved out of ScheduleDispatchHubPage,
 * punch list #46 row 7, the SCHEDULE_DISPATCH map's step 3): `loadHub` and the 22 atoms
 * it and its satellites write, the 18 memos the People and Jobs tabs project from them,
 * the lateness and time-off refreshes, the standing office schedule and the swim lanes.
 * The page destructures the result, so every mutation still ends with
 * `loadHub({ quiet: true })` and a quiet load never touches `hubLoading` (quirk
 * "Quiet vs loud loads"). A verbatim move: no behaviour changed.
 */
export function useScheduleDispatchHubData({
  jobId,
  weekStart,
  weekEnd,
  role,
  authUserId,
  canEdit,
  showToast,
}: ScheduleDispatchHubDataInput) {
  const [hubLoading, setHubLoading] = useState(false)
  /** Monotonic id so only the latest non-quiet `loadHub` run clears `hubLoading` (overlapping week/job navigations). Quiet refreshes do not bump this. */
  const hubLoadSeqRef = useRef(0)
  const [hubJobsError, setHubJobsError] = useState<string | null>(null)
  const [hubSummariesError, setHubSummariesError] = useState<string | null>(null)
  const [hubJobs, setHubJobs] = useState<ScheduleDispatchHubJobRow[]>([])
  /** Schedulable bids (v2.1613) — picker rows + `bid:<id>` title/address map entries. */
  const [hubBids, setHubBids] = useState<ScheduleDispatchHubBidRow[]>([])
  /**
   * Titles for bids that have a block this week but are no longer in `hubBids`
   * (marked lost / archived after being scheduled) — keyed by bid uuid. Without
   * this the block fell to the "— · Job" placeholder (Tier-2 #22, J18-F4).
   */
  const [hubScheduledBidTitleById, setHubScheduledBidTitleById] = useState<Map<string, string>>(() => new Map())
  const [hubWeekBlocks, setHubWeekBlocks] = useState<JobScheduleBlockRow[]>([])
  /** Blocks the viewer's RLS hides, per person/day (superintendent board only; `[]` for office roles). */
  const [hubHiddenBlockCounts, setHubHiddenBlockCounts] = useState<ScheduleHiddenBlockCount[]>([])
  const [hubTeamMemberUserIds, setHubTeamMemberUserIds] = useState<string[]>([])
  /** v2.2929: live sub work orders touching the week, and who is assigned to their jobs. */
  const [hubSubOrders, setHubSubOrders] = useState<SubDispatchOrder[]>([])
  const [hubTeamByJobId, setHubTeamByJobId] = useState<Map<string, string[]>>(() => new Map())
  const [hubSubOffDays, setHubSubOffDays] = useState<Map<string, string[]>>(() => new Map())
  const [hubRoleByUserId, setHubRoleByUserId] = useState<Map<string, string>>(() => new Map())
  /** v2.3612 Supervision: role + the switch per dispatch-roster user, for block coverage. */
  const [hubPersonById, setHubPersonById] = useState<Map<string, CoveragePerson>>(() => new Map())
  const [hubArchivedUserIds, setHubArchivedUserIds] = useState<ReadonlySet<string>>(() => new Set())
  const [hubPeopleNameById, setHubPeopleNameById] = useState<Map<string, string>>(() => new Map())
  const [hubHourlyWageByUserId, setHubHourlyWageByUserId] = useState<Map<string, number>>(() => new Map())
  const [hubPayApprovedMasterIds, setHubPayApprovedMasterIds] = useState<Set<string>>(() => new Set())
  const [hubSalariedUserIds, setHubSalariedUserIds] = useState<Set<string>>(() => new Set())
  /** A superintendent's `job_schedule_blocks` read is RLS-scoped to assigned projects; ask for what was hidden. */
  const wantsHiddenBlockCounts = role === 'superintendent'

  useEffect(() => {
    if (!authUserId) {
      setHubPayApprovedMasterIds(new Set())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.from('pay_approved_masters').select('master_id'),
          'scheduleDispatchPayApprovedMasters',
        )
        if (cancelled) return
        const rows = (data ?? []) as Array<{ master_id: string }>
        setHubPayApprovedMasterIds(new Set(rows.map((r) => r.master_id)))
      } catch {
        if (!cancelled) setHubPayApprovedMasterIds(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId])

  const canShowHubExpectedManpowerPayroll = useMemo(
    () =>
      role === 'dev' ||
      (role === 'master_technician' &&
        authUserId != null &&
        hubPayApprovedMasterIds.has(authUserId)),
    [role, authUserId, hubPayApprovedMasterIds],
  )

  const hubSummaryRows = useMemo(() => blocksToJobWeekSummaries(hubWeekBlocks), [hubWeekBlocks])

  const hubPersonDayBlocks = useMemo(() => buildPersonDayBlockMap(hubWeekBlocks), [hubWeekBlocks])

  const hubJobTitleById = useMemo(
    () => buildHubJobTitleById(hubJobs, hubBids, hubScheduledBidTitleById),
    [hubJobs, hubBids, hubScheduledBidTitleById],
  )

  const hubAllPeopleRows = useMemo(
    () => buildHubAllPeopleRows(hubTeamMemberUserIds, hubWeekBlocks, hubPeopleNameById, hubArchivedUserIds),
    [hubTeamMemberUserIds, hubWeekBlocks, hubPeopleNameById, hubArchivedUserIds],
  )

  const [hubUserTimeOffByCell, setHubUserTimeOffByCell] = useState<Map<string, UserTimeOffCellInfo>>(
    () => new Map(),
  )
  /**
   * Tracks the `(weekStart, weekEnd, rosterKey)` that `loadHub` last seeded `hubUserTimeOffByCell` for.
   * The standalone `refreshHubUserTimeOff` effect consults this to skip the immediate redundant
   * refetch after a fresh `loadHub` (it still fires for later roster changes — e.g., a quiet
   * refresh that introduces a new assignee).
   */
  const hubUserTimeOffPrimedRef = useRef<
    { weekStart: string; weekEnd: string; rosterKey: string } | null
  >(null)

  const hubVisibleUserIdsSerialized = useMemo(
    () => [...hubAllPeopleRows.map((r) => r.userId)].sort().join('|'),
    [hubAllPeopleRows],
  )

  /** Derived Late chips (v2.2550): clock-ins vs earliest block start, per cell. */
  const [hubLatenessByCell, setHubLatenessByCell] = useState<Map<string, PersonDayLateness>>(
    () => new Map(),
  )
  const refreshHubLateness = useCallback(async () => {
    const userIds = hubAllPeopleRows.map((r) => r.userId)
    if (userIds.length === 0 || !weekStart || !weekEnd || hubWeekBlocks.length === 0) {
      setHubLatenessByCell(new Map())
      return
    }
    const { data, error } = await fetchClockInsForUsersInRange(userIds, weekStart, weekEnd)
    if (error) return
    const blockRows = hubWeekBlocks.map((b) => ({
      assignee_user_id: b.assignee_user_id,
      work_date: b.work_date,
      time_start: b.time_start,
      job_label:
        (hubJobTitleById.get(scheduleBlockAnchorId(b)) ?? '').split('·')[0]?.trim() || null,
    }))
    setHubLatenessByCell(computeLatenessByCell(blockRows, data))
  }, [hubAllPeopleRows, weekStart, weekEnd, hubWeekBlocks, hubJobTitleById])

  useEffect(() => {
    void refreshHubLateness()
  }, [refreshHubLateness])

  const refreshHubUserTimeOff = useCallback(async () => {
    const userIds = hubAllPeopleRows.map((r) => r.userId)
    if (userIds.length === 0 || !weekStart || !weekEnd) {
      setHubUserTimeOffByCell(new Map())
      return
    }
    const { data, error } = await fetchUserTimeOffForUsersInRange(userIds, weekStart, weekEnd)
    if (error) return
    const dayKeys: string[] = []
    for (let i = 0; i < 7; i += 1) dayKeys.push(ymdAddDays(weekStart, i))
    setHubUserTimeOffByCell(buildUserTimeOffByCell(data, dayKeys))
  }, [hubAllPeopleRows, weekStart, weekEnd])

  useEffect(() => {
    const primed = hubUserTimeOffPrimedRef.current
    if (
      primed &&
      primed.weekStart === weekStart &&
      primed.weekEnd === weekEnd &&
      primed.rosterKey === hubVisibleUserIdsSerialized
    ) {
      // `loadHub` just seeded the cell map for this exact (week, roster); skip the refetch.
      return
    }
    void refreshHubUserTimeOff()
  }, [refreshHubUserTimeOff, hubVisibleUserIdsSerialized, weekStart, weekEnd])

  const hubUserIdsWithBlocksThisWeek = useMemo(
    () => new Set([...hubWeekBlocks.map((b) => b.assignee_user_id), ...scheduleHiddenUserIds(hubHiddenBlockCounts)]),
    [hubWeekBlocks, hubHiddenBlockCounts],
  )
  const hubHiddenByCell = useMemo(() => buildScheduleHiddenByCell(hubHiddenBlockCounts), [hubHiddenBlockCounts])
  const hubWeekDayKeys = useMemo(() => dayKeysBetween(weekStart, weekEnd), [weekStart, weekEnd])
  const hubSubLanes = useMemo(() => buildSubLanes(hubSubOrders, hubWeekDayKeys, hubSubOffDays), [hubSubOrders, hubWeekDayKeys, hubSubOffDays])
  const hubSubBadgeByCell = useMemo(() => buildSubBadgesByCell(hubSubOrders, hubTeamByJobId, hubWeekDayKeys), [hubSubOrders, hubTeamByJobId, hubWeekDayKeys])

  const hubBlockById = useMemo(() => {
    const m = new Map<string, JobScheduleBlockRow>()
    for (const b of hubWeekBlocks) m.set(b.id, b)
    return m
  }, [hubWeekBlocks])

  const hubGroupMemberCountByGroupId = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of hubWeekBlocks) {
      const g = b.shared_block_group_id
      if (!g) continue
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }, [hubWeekBlocks])

  /** v2.3612 Supervision: covered / unsupervised per linked group (or solo block) this week. */
  const hubBlockCoverageByKey = useMemo(() => buildBlockCoverageByKey(hubWeekBlocks, hubPersonById), [hubWeekBlocks, hubPersonById])

  const hubLinkedGroupAccentMap = useMemo(() => {
    const ids = new Set<string>()
    for (const b of hubWeekBlocks) {
      const g = b.shared_block_group_id
      if (g) ids.add(g)
    }
    return buildLinkedGroupAccentMap(ids)
  }, [hubWeekBlocks])

  const getHubJobDisplayTitle = useCallback(
    (id: string) => hubJobTitleById.get(id) ?? formatScheduleDispatchHubJobTitle(null, null),
    [hubJobTitleById],
  )

  /** Jobs-tab commitment matrix: one row per bid with a block this week (J18-F7). */
  const hubBidMatrixRows = useMemo(
    () => blocksToBidWeekMatrixRows(hubWeekBlocks, getHubJobDisplayTitle),
    [hubWeekBlocks, getHubJobDisplayTitle],
  )

  const hubJobAddressById = useMemo(() => buildHubJobAddressById(hubJobs, hubBids), [hubJobs, hubBids])

  const getHubJobAddress = useCallback((id: string) => hubJobAddressById.get(id) ?? '', [hubJobAddressById])

  const hubMergedRows = useMemo(() => buildHubMergedRows(hubJobs, hubSummaryRows), [hubJobs, hubSummaryRows])

  const loadHub = useCallback(async (options?: { quiet?: boolean }) => {
    if (jobId) return
    const quiet = options?.quiet === true
    const hubLoadSeq = quiet ? 0 : ++hubLoadSeqRef.current
    if (!quiet) setHubLoading(true)
    try {
      setHubJobsError(null)
      setHubSummariesError(null)
      setHubSalariedUserIds(new Set())

      // Phase A: jobs ledger + week blocks + users-tab roster + bids (+ RLS-hidden counts for a
      // superintendent) — fully independent, parallel.
      const [jr, br, usersTabRes, bidsRes, hiddenRes, subRes] = await Promise.all([
        fetchJobsLedgerForScheduleDispatchHub(),
        fetchJobScheduleBlocksForHubDateRange(weekStart, weekEnd),
        fetchUsersTabRosterForScheduleDispatchHub(role === 'dev'),
        fetchBidsForScheduleDispatchHub(),
        wantsHiddenBlockCounts
          ? fetchScheduleHiddenBlockCounts(weekStart, weekEnd)
          : Promise.resolve({ data: [] as ScheduleHiddenBlockCount[], error: null as string | null }),
        // v2.2929: sub work orders touching the week — their dates are the Subs lanes; no blocks are written.
        fetchSubOrdersForRange(weekStart, weekEnd),
      ])

      // Subs degrade to a warning — the crew board is untouched without them.
      if (subRes.error) {
        setHubSubOrders([])
        setHubTeamByJobId(new Map())
        showToast(`Subs on the board: ${subRes.error}`, 'warning')
      } else {
        setHubSubOrders(subRes.data)
        const [teamRes, offRes] = await Promise.all([fetchTeamMembersByJobId(subRes.data.map((o) => o.jobId).filter((id): id is string => !!id)), fetchSubOffDaysForRange(weekStart, weekEnd)])
        setHubTeamByJobId(teamRes.data)
        setHubSubOffDays(offRes.data)
      }

      // Busy-elsewhere placeholders degrade to a warning — the board is still usable without them.
      if (hiddenRes.error) {
        setHubHiddenBlockCounts([])
        showToast(`Busy-elsewhere counts: ${hiddenRes.error}`, 'warning')
      } else {
        setHubHiddenBlockCounts(hiddenRes.data)
        if (wantsHiddenBlockCounts && !quiet) {
          recordNavClick(
            authUserId,
            role,
            'schedule_hidden_blocks',
            `#${scheduleHiddenBlocksTotal(hiddenRes.data)}`,
          )
        }
      }

      let hubJobsData: ScheduleDispatchHubJobRow[] = []
      if (jr.error) {
        setHubJobsError(jr.error)
        setHubJobs([])
      } else {
        hubJobsData = jr.data
        setHubJobs(jr.data)
      }

      // Bids degrade to a warning — the board is still fully usable for jobs.
      if (bidsRes.error) {
        setHubBids([])
        showToast(`Bids list: ${bidsRes.error}`, 'warning')
      } else {
        setHubBids(bidsRes.data)
      }

      let blocksData: JobScheduleBlockRow[] = []
      if (br.error) {
        setHubSummariesError(br.error)
        setHubWeekBlocks([])
        showToast(`Schedule blocks: ${br.error}`, 'warning')
      } else {
        setHubSummariesError(null)
        blocksData = br.data
        setHubWeekBlocks(br.data)
      }

      const usersTabIds = usersTabRes.error ? [] : usersTabRes.data.map((r) => r.id)
      if (usersTabRes.error) showToast(`Dispatch people list: ${usersTabRes.error}`, 'warning')
      setHubRoleByUserId(new Map(usersTabRes.error ? [] : usersTabRes.data.map((r) => [r.id, r.role])))
      setHubPersonById(new Map(usersTabRes.error ? [] : usersTabRes.data.map((r) => [r.id, { role: r.role, needsSupervision: r.needs_supervision }])))

      // Phase B: team-members for the ledger job ids (needs jobIds from phase A).
      const jobIds = hubJobsData.map((j) => j.id)
      const teamRes = await fetchTeamMemberUserIdsForJobIds(jobIds)
      const teamIds = teamRes.error ? [] : teamRes.data
      if (teamRes.error) showToast(`Team roster: ${teamRes.error}`, 'warning')

      // People who only have hidden (busy-elsewhere) work still get a row on the board.
      const mergedHubBaseIds = [...new Set([...teamIds, ...usersTabIds, ...scheduleHiddenUserIds(hiddenRes.data)])]
      setHubTeamMemberUserIds(mergedHubBaseIds)

      const assigneeIds = [...new Set(blocksData.map((b) => b.assignee_user_id))]
      const rosterIds = [...new Set([...mergedHubBaseIds, ...assigneeIds])]

      // Bids scheduled this week that the schedulable-bids list no longer carries (lost /
      // archived after being scheduled) still need a title — otherwise the block reads "— · Job".
      const knownBidIds = new Set((bidsRes.error ? [] : bidsRes.data).map((b) => b.id))
      const scheduledOnlyBidIds = collectScheduledBidIds(blocksData).filter((id) => !knownBidIds.has(id))

      // Phase C: names + archived + time-off (+ stray bid titles) in parallel (all depend only on phase A).
      const [nameRes, archivedSet, timeOffRes, scheduledBidTitlesRes] = await Promise.all([
        fetchUserNamesForIds(rosterIds),
        fetchArchivedUserIdSetForIds(rosterIds),
        fetchUserTimeOffForUsersInRange(rosterIds, weekStart, weekEnd),
        fetchBidTitlesForScheduleBlocks(scheduledOnlyBidIds, null, 'scheduleDispatchHubScheduledBidTitles'),
      ])
      setHubScheduledBidTitleById(scheduledBidTitlesRes.data)
      if (scheduledBidTitlesRes.error) showToast(`Bid names: ${scheduledBidTitlesRes.error}`, 'warning')
      setHubPeopleNameById(nameRes.data)
      if (nameRes.error) showToast(`People names: ${nameRes.error}`, 'warning')
      setHubArchivedUserIds(archivedSet)

      const dayKeys: string[] = []
      for (let i = 0; i < 7; i += 1) dayKeys.push(ymdAddDays(weekStart, i))
      if (!timeOffRes.error) {
        setHubUserTimeOffByCell(buildUserTimeOffByCell(timeOffRes.data, dayKeys))
      }
      // Record what the time-off map was just primed for so the standalone refresh effect
      // can skip the immediate duplicate fetch (it still fires for later roster changes).
      // The key is the board's own (`hubVisibleUserIdsSerialized`: the roster without the
      // archived) — keyed on every roster id it never matched while anyone archived was on it.
      hubUserTimeOffPrimedRef.current = {
        weekStart,
        weekEnd,
        rosterKey: rosterIds.filter((id) => !archivedSet.has(id)).sort().join('|'),
      }

      // Phase D: salaried + wages in parallel — both keyed by the already-fetched name map,
      // so no extra `users` round-trip. `Promise.allSettled` keeps a wages failure from
      // dropping the salaried set and vice versa (mirrors the previous try/catch granularity).
      const nameMap = nameRes.data
      const wagesPromise: Promise<Map<string, number>> = (async () => {
        if (!canShowHubExpectedManpowerPayroll) return new Map()
        const nameList = hubWageLookupNames(rosterIds, nameMap)
        if (nameList.length === 0) return new Map()
        const payData = await withSupabaseRetry(
          async () =>
            supabase
              .from('people_pay_config')
              .select('person_name, hourly_wage')
              .in('person_name', nameList),
          'scheduleDispatchHubPeoplePayWages',
        )
        return buildHourlyWageByUserId((payData ?? []) as HubPayConfigWageRow[], rosterIds, nameMap)
      })()

      const [salariedResult, wagesResult] = await Promise.allSettled([
        fetchSalariedUserIdSetFromUserIds(rosterIds, { nameByUserId: nameMap }),
        wagesPromise,
      ])
      if (salariedResult.status === 'fulfilled') {
        setHubSalariedUserIds(salariedResult.value)
      } else {
        setHubSalariedUserIds(new Set())
        showToast(`Salary flags: ${formatErrorMessage(salariedResult.reason)}`, 'warning')
      }
      if (wagesResult.status === 'fulfilled') {
        setHubHourlyWageByUserId(wagesResult.value)
      } else {
        setHubHourlyWageByUserId(new Map())
        showToast(`Pay rates: ${formatErrorMessage(wagesResult.reason)}`, 'warning')
      }
    } catch (err) {
      showToast(formatErrorMessage(err), 'error')
    } finally {
      if (!quiet && hubLoadSeqRef.current === hubLoadSeq) {
        setHubLoading(false)
      }
    }
  }, [jobId, weekStart, weekEnd, role, showToast, canShowHubExpectedManpowerPayroll, wantsHiddenBlockCounts, authUserId])

  useEffect(() => {
    if (jobId) {
      setHubLoading(false)
      return
    }
    void loadHub()
  }, [jobId, loadHub])

  // Standing office schedule (v2.1812): idempotently fill the roster's weekday
  // Office blocks for the visible week whenever an editor views it, then
  // refresh so the new blocks render. Once per range per mount; the RPC's
  // tombstones make repeat calls cheap no-ops. Roster edits force a re-run.
  // Never into the past (v2.3808): a week already worked is not filled — the
  // window is clamped to today onward, and a wholly past week makes no call.
  const officeEnsureRanForRangeRef = useRef<string | null>(null)
  const runOfficeEnsure = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!canEdit || jobId) return
      const range = clampOfficeEnsureRange(weekStart, weekEnd, todayYmdInAppTz())
      if (!range) return
      const rangeKey = `${range.from}:${range.to}`
      if (!opts?.force && officeEnsureRanForRangeRef.current === rangeKey) return
      officeEnsureRanForRangeRef.current = rangeKey
      const { created, error } = await ensureOfficeScheduleBlocks(range.from, range.to)
      if (!error && created > 0) await loadHub({ quiet: true })
    },
    [canEdit, jobId, weekStart, weekEnd, loadHub],
  )
  useEffect(() => {
    void runOfficeEnsure()
  }, [runOfficeEnsure])

  /** Office-wide swim lanes (People grid 'lanes' grouping + Dispatch Settings manager). */
  const [swimLanes, setSwimLanes] = useState<DispatchSwimLanesData | null>(null)
  const refetchSwimLanes = useCallback(async () => {
    const { data, error } = await fetchDispatchSwimLanes()
    if (!error) setSwimLanes(data)
  }, [])

  useEffect(() => {
    if (!authUserId) return
    void refetchSwimLanes()
  }, [authUserId, refetchSwimLanes])

  return {
    hubLoading,
    hubJobsError,
    hubSummariesError,
    hubBids,
    hubWeekBlocks,
    hubHiddenBlockCounts,
    hubRoleByUserId,
    hubPersonById,
    hubPeopleNameById,
    hubHourlyWageByUserId,
    hubSalariedUserIds,
    hubUserTimeOffByCell,
    hubLatenessByCell,
    swimLanes,
    canShowHubExpectedManpowerPayroll,
    hubPersonDayBlocks,
    hubJobTitleById,
    hubAllPeopleRows,
    hubUserIdsWithBlocksThisWeek,
    hubHiddenByCell,
    hubSubLanes,
    hubSubBadgeByCell,
    hubBlockById,
    hubGroupMemberCountByGroupId,
    hubBlockCoverageByKey,
    hubLinkedGroupAccentMap,
    hubBidMatrixRows,
    hubMergedRows,
    getHubJobDisplayTitle,
    getHubJobAddress,
    refreshHubUserTimeOff,
    loadHub,
    runOfficeEnsure,
    refetchSwimLanes,
  }
}

export type ScheduleDispatchHubData = ReturnType<typeof useScheduleDispatchHubData>

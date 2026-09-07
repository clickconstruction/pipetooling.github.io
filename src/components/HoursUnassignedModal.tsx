import { useEffect, useMemo, useRef, useState } from 'react'
import type { PayConfigRow as PayConfigRowFull } from '../types/peoplePayConfig'
import { effectiveHoursForDisplay } from '../lib/salariedEffectiveHours'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import {
  type UnifiedAssignment,
  mergeToUnified,
  formatAssignmentLabel,
  type JobDetails,
  type BidDetails,
} from '../utils/crewAssignments'
import { getBidServiceTypeTag, type UnifiedSearchResult } from '../utils/unifiedJobBidSearch'
import { UnifiedSearchResultRow } from './search/UnifiedSearchResultRow'
import { useJobBidSearchEvidence } from '../hooks/useJobBidSearchEvidence'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerShortLine, formatJobLedgerShortLine } from '../lib/ledgerDisplayPrefixes'
import { phoneSafeMinWidth } from '../lib/stickyModalHeaderStyle'
import { ymdAddDays } from '../utils/dateUtils'
import { useToastContext } from '../contexts/ToastContext'
import { DashboardMyTimeDayEditorModal } from './DashboardMyTimeDayEditorModal'
import { classifyDayLinkSessions, crewLinkButtonLabel, dayLinkState, dayLinkSuccessMessage } from '../lib/crewAssignSessionLinkPlan'
import { linkClockSessionsToPick, partialLinkMessage } from '../lib/linkClockSessionsToPick'

type CrewRow = { unifiedAssignments: UnifiedAssignment[] }
/** What a quick pick or search row hands back. */
type CrewPick =
  | { type: 'job'; id: string; hcp_number: string; job_name: string; job_address: string; service_type_id?: string | null }
  | { type: 'bid'; id: string; bid_number: string; project_name: string; address: string; service_type_id?: string | null }
type HoursRow = { person_name: string; work_date: string; hours: number }
/** Narrow view of the canonical pay-config row (single source of truth for field types). */
type PayConfigRow = Pick<PayConfigRowFull, 'person_name' | 'is_salary' | 'record_hours_but_salary'>

type ClockSessionRow = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string | null
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
}

function clockSessionDurationSeconds(s: { clocked_in_at: string; clocked_out_at: string | null }, nowMs: number): number {
  const inMs = new Date(s.clocked_in_at).getTime()
  const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowMs
  return Math.max(0, Math.floor((outMs - inMs) / 1000))
}

function formatHmsTotal(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = Math.floor(seconds % 60)
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Inclusive YYYY-MM-DD range — string arithmetic, so a runtime whose 'en-CA' locale renders M/D/YYYY still yields DB-shaped keys. */
function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  for (let d = start, guard = 0; d <= end && guard < 400; d = ymdAddDays(d, 1), guard++) days.push(d)
  return days
}

const RECENT_QUICK_PICKS_MAX_UNIQUE = 14

/** Newest work_date first; dedupes job/bid ids across days; order within a day matches unifiedAssignments. */
function collectAssignmentQuickPickIds(
  crewMap: Record<string, CrewRow>,
  personName: string,
  hoursDateStart: string,
  hoursDateEnd: string
): Array<{ kind: 'job' | 'bid'; id: string }> {
  const suffix = `:${personName}`
  const workDates: string[] = []
  for (const k of Object.keys(crewMap)) {
    if (!k.endsWith(suffix)) continue
    const workDate = k.slice(0, k.length - suffix.length)
    if (workDate < hoursDateStart || workDate > hoursDateEnd) continue
    workDates.push(workDate)
  }
  workDates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))

  const seenJob = new Set<string>()
  const seenBid = new Set<string>()
  const out: Array<{ kind: 'job' | 'bid'; id: string }> = []
  for (const d of workDates) {
    const eff = crewMap[`${d}:${personName}`]?.unifiedAssignments ?? []
    for (const a of eff) {
      if (a.type === 'job') {
        if (!seenJob.has(a.id)) {
          seenJob.add(a.id)
          out.push({ kind: 'job', id: a.id })
        }
      } else if (!seenBid.has(a.id)) {
        seenBid.add(a.id)
        out.push({ kind: 'bid', id: a.id })
      }
    }
  }
  return out
}

type RecentQuickPick =
  | {
      type: 'job'
      id: string
      hcp_number: string
      job_name: string
      job_address: string
      service_type_id?: string | null
      click_number?: string | null
    }
  | {
      type: 'bid'
      id: string
      bid_number: string
      project_name: string
      address: string
      service_type_name?: string
      service_type_id?: string | null
    }

type Props = {
  personName: string
  hoursDateStart: string
  hoursDateEnd: string
  onClose: () => void
  onSaved: () => void
  canEditCrewJobs?: boolean
}

export function HoursUnassignedModal({
  personName,
  hoursDateStart,
  hoursDateEnd,
  onClose,
  onSaved,
  canEditCrewJobs = true,
}: Props) {
  const prefixMap = useLedgerPrefixMap()
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState('')
  /** v2.2966: the range's live (not rejected/revoked) sessions for this person — picks go on them. */
  const [rangeSessions, setRangeSessions] = useState<ClockSessionRow[]>([])
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [dayEditorOpen, setDayEditorOpen] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const { showToast } = useToastContext()
  const [jobSearchOpen, setJobSearchOpen] = useState(false)
  const [jobSearchText, setJobSearchText] = useState('')
  const [jobSearchResults, setJobSearchResults] = useState<UnifiedSearchResult[]>([])
  const [commonJobs, setCommonJobs] = useState<
    Array<{
      id: string
      job_id: string
      hcp_number: string
      job_name: string
      job_address: string
      service_type_id?: string | null
      click_number?: string | null
    }>
  >([])
  const [commonJobsError, setCommonJobsError] = useState<string | null>(null)
  const [commonJobsEditMode, setCommonJobsEditMode] = useState(false)
  const [commonJobsSearchOpen, setCommonJobsSearchOpen] = useState(false)
  const [commonJobsSearchText, setCommonJobsSearchText] = useState('')
  const [commonJobsSearchResults, setCommonJobsSearchResults] = useState<
    Array<{ id: string; hcp_number: string; job_name: string; job_address: string; service_type_id: string | null; service_type_name?: string | null; click_number: string | null }>
  >([])
  const commonJobsSearchUnified = useMemo<UnifiedSearchResult[]>(
    () => commonJobsSearchResults.map((j) => ({ source: 'job' as const, ...j })),
    [commonJobsSearchResults],
  )
  const evidenceRows = useMemo(
    () => [...jobSearchResults, ...commonJobsSearchUnified],
    [jobSearchResults, commonJobsSearchUnified],
  )
  const { jobEvidence, bidEvidence, evidenceMode } = useJobBidSearchEvidence(evidenceRows)
  const [crewJobDetailsMap, setCrewJobDetailsMap] = useState<Record<string, JobDetails>>({})
  const [crewBidDetailsMap, setCrewBidDetailsMap] = useState<Record<string, BidDetails>>({})
  const [crewJobsByDatePerson, setCrewJobsByDatePerson] = useState<Record<string, CrewRow>>({})
  const [hoursDaysCorrect, setHoursDaysCorrect] = useState<Set<string>>(new Set())
  const [peopleHours, setPeopleHours] = useState<HoursRow[]>([])
  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  /** C1-3c (identity): id-keyed flags + this person's crew-row person_id for id-first lookups. */
  const [payConfigById, setPayConfigById] = useState<Record<string, PayConfigRow>>({})
  const [crewPersonIdByName, setCrewPersonIdByName] = useState<Record<string, string>>({})
  const [sessionsFetchError, setSessionsFetchError] = useState<string | null>(null)
  const [sessionsUserMissing, setSessionsUserMissing] = useState(false)
  const [recentQuickPicks, setRecentQuickPicks] = useState<RecentQuickPick[]>([])
  const [recentQuickPicksLoading, setRecentQuickPicksLoading] = useState(false)
  const [recentQuickPicksError, setRecentQuickPicksError] = useState<string | null>(null)

  const recentQuickPicksFetchGenRef = useRef(0)
  const crewJobDetailsMapRef = useRef(crewJobDetailsMap)
  const crewBidDetailsMapRef = useRef(crewBidDetailsMap)
  crewJobDetailsMapRef.current = crewJobDetailsMap
  crewBidDetailsMapRef.current = crewBidDetailsMap

  const hoursDays = useMemo(() => getDaysInRange(hoursDateStart, hoursDateEnd), [hoursDateStart, hoursDateEnd])

  function getEffectiveHours(pName: string, workDate: string): number {
    const recorded = peopleHours.find((h) => h.person_name === pName && h.work_date === workDate)?.hours ?? 0
    // C1-3c: id-first (crew-row person_id), trimmed-name fallback.
    const id = crewPersonIdByName[pName]
    const cfg = (id ? payConfigById[id] : undefined) ?? payConfig[pName]
    return effectiveHoursForDisplay(cfg, workDate, recorded)
  }

  function hasAssignmentsForDate(pName: string, workDate: string): boolean {
    return (crewJobsByDatePerson[`${workDate}:${pName}`]?.unifiedAssignments?.length ?? 0) > 0
  }

  /** Days with hours on a Correct day and no split yet — before the clock-session test. */
  const candidateDays = useMemo(
    () =>
      hoursDays.filter((d) => {
        if (!hoursDaysCorrect.has(d)) return false
        if (getEffectiveHours(personName, d) <= 0) return false
        return !hasAssignmentsForDate(personName, d)
      }),
    [hoursDays, hoursDaysCorrect, personName, crewJobsByDatePerson, peopleHours, payConfig]
  )
  const closedSessionDays = useMemo(() => {
    const s = new Set<string>()
    for (const r of rangeSessions) if (r.clocked_out_at) s.add(r.work_date)
    return s
  }, [rangeSessions])
  /** v2.2966: only days that have a closed clock session can be assigned — there is no split without one. */
  const unassignedDays = useMemo(() => candidateDays.filter((d) => closedSessionDays.has(d)), [candidateDays, closedSessionDays])
  const skippedNoClockDays = useMemo(() => candidateDays.filter((d) => !closedSessionDays.has(d)), [candidateDays, closedSessionDays])

  const effectiveSelectedDay = (selectedDay && unassignedDays.includes(selectedDay) ? selectedDay : unassignedDays[0]) ?? ''
  const daySessions = useMemo(
    () => rangeSessions.filter((s) => s.work_date === effectiveSelectedDay),
    [rangeSessions, effectiveSelectedDay],
  )
  const dayClassification = useMemo(() => classifyDayLinkSessions(daySessions), [daySessions])
  const dayState = useMemo(() => dayLinkState(dayClassification), [dayClassification])
  const canLinkDay = canEditCrewJobs && !linking && dayState.kind === 'link'
  const dayEditorJobLabels = useMemo(
    () => Object.fromEntries(Object.entries(crewJobDetailsMap).map(([id, d]) => [id, formatAssignmentLabel('job', d, prefixMap)])),
    [crewJobDetailsMap, prefixMap],
  )
  const dayEditorBidLabels = useMemo(
    () => Object.fromEntries(Object.entries(crewBidDetailsMap).map(([id, d]) => [id, formatAssignmentLabel('bid', d, prefixMap)])),
    [crewBidDetailsMap, prefixMap],
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [correctRes, hoursRes, configRes, jobsRes, bidsRes] = await Promise.all([
        supabase.from('hours_days_correct').select('work_date').gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.from('people_hours').select('person_name, work_date, hours').eq('person_name', personName).gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.rpc('list_people_pay_flags'),
        supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
        supabase.from('people_crew_bids').select('work_date, person_name, person_id, bid_assignments').gte('work_date', hoursDateStart).lte('work_date', hoursDateEnd),
      ])
      const correctDays = new Set((correctRes.data ?? []).map((r: { work_date: string }) => r.work_date))
      setHoursDaysCorrect(correctDays)
      setPeopleHours((hoursRes.data ?? []) as HoursRow[])
      // C1-3c (identity): SEPARATE id-keyed map (name map stays names-only).
      const configRows = (configRes.data ?? []) as Array<PayConfigRow & { person_id?: string | null }>
      const configMap: Record<string, PayConfigRow> = {}
      const configById: Record<string, PayConfigRow> = {}
      for (const c of configRows) {
        configMap[c.person_name] = c
        if (c.person_id) configById[c.person_id] = c
      }
      setPayConfig(configMap)
      setPayConfigById(configById)
      const crewIdByName: Record<string, string> = {}
      for (const r of [...((jobsRes.data ?? []) as Array<{ person_name: string; person_id: string | null }>), ...((bidsRes.data ?? []) as Array<{ person_name: string; person_id: string | null }>)]) {
        if (r.person_id && !crewIdByName[r.person_name]) crewIdByName[r.person_name] = r.person_id
      }
      setCrewPersonIdByName(crewIdByName)
      const jobsRows = (jobsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        person_id: string | null
        job_assignments: Array<{ job_id: string; pct: number }>
      }>
      const bidsRows = (bidsRes.data ?? []) as Array<{
        work_date: string
        person_name: string
        person_id: string | null
        bid_assignments: Array<{ bid_id: string; pct: number }>
      }>
      const jobsByKey: Record<string, Array<{ job_id: string; pct: number }>> = {}
      for (const r of jobsRows) {
        jobsByKey[`${r.work_date}:${r.person_name}`] = Array.isArray(r.job_assignments) ? r.job_assignments : []
      }
      const bidsByKey: Record<string, Array<{ bid_id: string; pct: number }>> = {}
      for (const r of bidsRows) {
        bidsByKey[`${r.work_date}:${r.person_name}`] = Array.isArray(r.bid_assignments) ? r.bid_assignments : []
      }
      const allKeys = new Set([...Object.keys(jobsByKey), ...Object.keys(bidsByKey)])
      const crewMap: Record<string, CrewRow> = {}
      const jobIds = new Set<string>()
      const bidIds = new Set<string>()
      for (const k of allKeys) {
        const unified = mergeToUnified(jobsByKey[k] ?? [], bidsByKey[k] ?? [])
        crewMap[k] = { unifiedAssignments: unified }
        for (const a of unified) {
          if (a.type === 'job') jobIds.add(a.id)
          else bidIds.add(a.id)
        }
      }
      setCrewJobsByDatePerson(crewMap)
      // v2.2966: the range's clock sessions, once — picks go on them, and a day with
      // hours but no closed session is skipped (there is no split without a clock session).
      {
        const userRes = await supabase.from('users').select('id').eq('name', personName).maybeSingle()
        const userId = (userRes.data as { id: string } | null)?.id ?? null
        setResolvedUserId(userId)
        setSessionsUserMissing(!userId)
        if (userId) {
          const { data: sess, error: sessErr } = await supabase
            .from('clock_sessions')
            .select('id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, approved_at')
            .eq('user_id', userId)
            .gte('work_date', hoursDateStart)
            .lte('work_date', hoursDateEnd)
            .is('rejected_at', null)
            .is('revoked_at', null)
            .order('clocked_in_at', { ascending: true })
          setSessionsFetchError(sessErr?.message ?? null)
          const rows = (sess ?? []) as ClockSessionRow[]
          setRangeSessions(rows)
          for (const r of rows) {
            if (r.job_ledger_id) jobIds.add(r.job_ledger_id)
            if (r.bid_id) bidIds.add(r.bid_id)
          }
        } else {
          setRangeSessions([])
        }
      }
      if (jobIds.size > 0) {
        const { data: jobsData } = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [...jobIds] })
        const jobMap: Record<string, JobDetails> = {}
        for (const j of (jobsData ?? []) as Array<{
          id: string
          hcp_number: string
          job_name: string
          job_address: string
          service_type_id: string | null
          click_number: string
        }>) {
          jobMap[j.id] = {
            hcp_number: j.hcp_number ?? '',
            job_name: j.job_name ?? '',
            job_address: j.job_address ?? '',
            service_type_id: j.service_type_id,
            click_number: j.click_number,
          }
        }
        setCrewJobDetailsMap((prev) => ({ ...prev, ...jobMap }))
      }
      if (bidIds.size > 0) {
        const { data: bidsData } = await supabase.rpc('get_bids_by_ids', { p_bid_ids: [...bidIds] })
        const bidMap: Record<string, BidDetails> = {}
        for (const b of (bidsData ?? []) as Array<{
          id: string
          bid_number: string
          project_name: string
          address: string
          service_type_id: string | null
        }>) {
          bidMap[b.id] = {
            bid_number: b.bid_number ?? '',
            project_name: b.project_name ?? '',
            address: b.address ?? '',
            service_type_id: b.service_type_id,
          }
        }
        setCrewBidDetailsMap((prev) => ({ ...prev, ...bidMap }))
      }
      const commonRows = (await withSupabaseRetry(
        async () => {
          const r = await supabase.from('common_jobs').select('id, job_id, sequence_order').order('sequence_order')
          return r as { data: Array<{ id: string; job_id: string; sequence_order: number }> | null; error: { message: string } | null }
        },
        'fetch common jobs'
      )) ?? []
      if (commonRows.length > 0) {
        const ids = commonRows.map((r) => r.job_id)
        const jobsData = (await withSupabaseRetry(
          async () => {
            const r = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: ids })
            return r as {
              data: Array<{
                id: string
                hcp_number: string
                job_name: string
                job_address: string
                service_type_id: string | null
                click_number: string
              }> | null
              error: { message: string } | null
            }
          },
          'fetch common job details'
        )) ?? []
        const jobsMap = new Map(
          (jobsData ?? []).map(
            (j: {
              id: string
              hcp_number: string
              job_name: string
              job_address: string
              service_type_id: string | null
              click_number: string
            }) => [j.id, j],
          ),
        )
        const ordered = commonRows
          .filter((r) => jobsMap.has(r.job_id))
          .map((r) => {
            const j = jobsMap.get(r.job_id)!
            return {
              id: r.id,
              job_id: j.id,
              hcp_number: j.hcp_number ?? '',
              job_name: j.job_name ?? '',
              job_address: j.job_address ?? '',
              service_type_id: j.service_type_id,
              click_number: j.click_number ?? '',
            }
          })

        setCommonJobs(ordered)
      } else {
        setCommonJobs([])
      }
      setLoading(false)
    }
    load()
  }, [personName, hoursDateStart, hoursDateEnd, reloadTick])

  useEffect(() => {
    if (!effectiveSelectedDay) return
    setSelectedDay(effectiveSelectedDay)
  }, [effectiveSelectedDay])

  useEffect(() => {
    // Wait for load() so crewJobsByDatePerson is populated; avoid toggling loading while skipping.
    if (loading) return

    const gen = ++recentQuickPicksFetchGenRef.current
    setRecentQuickPicksLoading(true)
    setRecentQuickPicksError(null)

    void (async () => {
      type QuickOrd = { kind: 'job' | 'bid'; id: string }
      const clockOrdered: QuickOrd[] = []
      let clockFetchError: string | null = null

      try {
        const userRes = await supabase.from('users').select('id').eq('name', personName).maybeSingle()
        if (gen !== recentQuickPicksFetchGenRef.current) return
        const userId = (userRes.data as { id: string } | null)?.id ?? null

        if (userId) {
          try {
            const data = await withSupabaseRetry(
              async () =>
                supabase
                  .from('clock_sessions')
                  .select('id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id')
                  .eq('user_id', userId)
                  .or('job_ledger_id.not.is.null,bid_id.not.is.null')
                  .is('rejected_at', null)
                  .is('revoked_at', null)
                  .order('clocked_in_at', { ascending: false })
                  .limit(65),
              'HoursUnassignedModal recent clock_sessions'
            )
            if (gen !== recentQuickPicksFetchGenRef.current) return
            const rows = (data ?? []) as ClockSessionRow[]
            const cj = new Set<string>()
            const cb = new Set<string>()
            for (const r of rows) {
              if (r.job_ledger_id && !cj.has(r.job_ledger_id)) {
                cj.add(r.job_ledger_id)
                clockOrdered.push({ kind: 'job', id: r.job_ledger_id })
              }
              if (r.bid_id && !cb.has(r.bid_id)) {
                cb.add(r.bid_id)
                clockOrdered.push({ kind: 'bid', id: r.bid_id })
              }
            }
          } catch (e: unknown) {
            if (gen !== recentQuickPicksFetchGenRef.current) return
            clockFetchError = formatErrorMessage(e)
          }
        }

        const assignmentOrdered = collectAssignmentQuickPickIds(crewJobsByDatePerson, personName, hoursDateStart, hoursDateEnd)

        const mj = new Set<string>()
        const mb = new Set<string>()
        const finalOrdered: QuickOrd[] = []
        const pushIfNew = (o: QuickOrd) => {
          if (o.kind === 'job') {
            if (mj.has(o.id)) return
            mj.add(o.id)
          } else {
            if (mb.has(o.id)) return
            mb.add(o.id)
          }
          finalOrdered.push(o)
        }
        for (const o of clockOrdered) pushIfNew(o)
        for (const o of assignmentOrdered) pushIfNew(o)
        const ordered = finalOrdered.slice(0, RECENT_QUICK_PICKS_MAX_UNIQUE)

        if (ordered.length === 0 && clockFetchError) {
          if (gen !== recentQuickPicksFetchGenRef.current) return
          setRecentQuickPicksError(clockFetchError)
          setRecentQuickPicks([])
          setRecentQuickPicksLoading(false)
          return
        }

        const jobIds = ordered.filter((o) => o.kind === 'job').map((o) => o.id)
        const bidIds = ordered.filter((o) => o.kind === 'bid').map((o) => o.id)

        const jobMap = new Map<
          string,
          { id: string; hcp_number: string; job_name: string; job_address: string; service_type_id: string | null; click_number: string }
        >()
        const bidMap = new Map<
          string,
          { id: string; bid_number: string; project_name: string; address: string; service_type_id: string | null }
        >()

        if (jobIds.length > 0) {
          try {
            const list = await withSupabaseRetry(
              async () => {
                const r = await supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds })
                return r as {
                  data: Array<{
                    id: string
                    hcp_number: string
                    job_name: string
                    job_address: string
                    service_type_id: string | null
                    click_number: string
                  }> | null
                  error: { message: string } | null
                }
              },
              'HoursUnassignedModal recent jobs hydrate'
            )
            if (gen !== recentQuickPicksFetchGenRef.current) return
            for (const j of list ?? []) {
              jobMap.set(j.id, j)
            }
          } catch {
            if (gen !== recentQuickPicksFetchGenRef.current) return
          }
        }

        if (bidIds.length > 0) {
          try {
            const list = await withSupabaseRetry(
              async () => {
                const r = await supabase.rpc('get_bids_by_ids', { p_bid_ids: bidIds })
                return r as {
                  data: Array<{
                    id: string
                    bid_number: string
                    project_name: string
                    address: string
                    service_type_id: string | null
                  }> | null
                  error: { message: string } | null
                }
              },
              'HoursUnassignedModal recent bids hydrate'
            )
            if (gen !== recentQuickPicksFetchGenRef.current) return
            for (const b of list ?? []) {
              bidMap.set(b.id, b)
            }
          } catch {
            if (gen !== recentQuickPicksFetchGenRef.current) return
          }
        }

        const picks: RecentQuickPick[] = []
        for (const o of ordered) {
          if (o.kind === 'job') {
            const j = jobMap.get(o.id)
            if (j) {
              picks.push({
                type: 'job',
                id: j.id,
                hcp_number: j.hcp_number ?? '',
                job_name: j.job_name ?? '',
                job_address: j.job_address ?? '',
                service_type_id: j.service_type_id,
                click_number: j.click_number ?? '',
              })
            }
          } else {
            const b = bidMap.get(o.id)
            if (b) {
              picks.push({
                type: 'bid',
                id: b.id,
                bid_number: b.bid_number ?? '',
                project_name: b.project_name ?? '',
                address: b.address ?? '',
                service_type_id: b.service_type_id,
              })
            }
          }
        }

        if (gen !== recentQuickPicksFetchGenRef.current) return
        setRecentQuickPicksError(null)
        setRecentQuickPicks(picks)
        setRecentQuickPicksLoading(false)
      } catch (e: unknown) {
        if (gen !== recentQuickPicksFetchGenRef.current) return
        setRecentQuickPicksError(formatErrorMessage(e))
        setRecentQuickPicks([])
        setRecentQuickPicksLoading(false)
      }
    })()
  }, [personName, crewJobsByDatePerson, loading, hoursDateStart, hoursDateEnd])

  useEffect(() => {
    const t = setTimeout(() => {
      if (jobSearchOpen && jobSearchText !== undefined) {
        const q = jobSearchText.trim()
        Promise.all([
          supabase.rpc('search_jobs_ledger', { search_text: q }),
          supabase.rpc('search_bids_for_clock', { p_search_text: q }),
        ]).then(([jobsRes, bidsRes]) => {
          const jobs = (jobsRes.data ?? []) as Array<{
            id: string
            hcp_number: string
            job_name: string
            job_address: string
            service_type_id: string | null
            service_type_name?: string | null
            click_number: string
          }>
          const bidsRaw = (bidsRes.data ?? []) as Array<{
            id: string
            bid_number?: string
            project_name: string
            address: string
            customer_name?: string
            service_type_name?: string
            service_type_id: string | null
          }>
          const merged: UnifiedSearchResult[] = [
            ...jobs.map((j) => ({ source: 'job' as const, ...j })),
            ...bidsRaw.map((b) => ({ source: 'bid' as const, ...b, bid_number: b.bid_number ?? '', customer_name: b.customer_name ?? '' })),
          ]
          setJobSearchResults(merged)
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [jobSearchOpen, jobSearchText])

  useEffect(() => {
    const t = setTimeout(() => {
      if (commonJobsSearchOpen && commonJobsSearchText !== undefined) {
        supabase.rpc('search_jobs_ledger', { search_text: commonJobsSearchText }).then(({ data }) => {
          setCommonJobsSearchResults(
            (data ?? []) as Array<{
              id: string
              hcp_number: string
              job_name: string
              job_address: string
              service_type_id: string | null
              service_type_name?: string | null
              click_number: string | null
            }>,
          )
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [commonJobsSearchOpen, commonJobsSearchText])

  function pickLabel(item: CrewPick): string {
    return item.type === 'job'
      ? formatAssignmentLabel('job', { hcp_number: item.hcp_number, job_name: item.job_name, job_address: item.job_address, service_type_id: item.service_type_id ?? null }, prefixMap)
      : formatAssignmentLabel('bid', { bid_number: item.bid_number, project_name: item.project_name, address: item.address, service_type_id: item.service_type_id ?? null }, prefixMap)
  }

  /**
   * v2.2966: a quick pick or search row puts the job on the day's clock sessions —
   * every closed session with no job or bid yet. Approved ones fire the sync
   * trigger and the day's split appears (so the day leaves this list on reload);
   * pending ones carry the link into approval. The crew tables are never written
   * by hand here: no session, no split.
   */
  async function linkDay(item: CrewPick) {
    if (!canEditCrewJobs || linking || !effectiveSelectedDay) return
    const cls = dayClassification
    const state = dayState
    if (state.kind !== 'link') {
      showToast(
        state.kind === 'no-clock'
          ? 'No clock session on this day — there is no split without a clock session.'
          : 'Every session this day already has a job or bid — use Split day… to move hours.',
        'warning',
      )
      return
    }
    if (item.type === 'job') {
      setCrewJobDetailsMap((prev) => ({
        ...prev,
        [item.id]: { hcp_number: item.hcp_number, job_name: item.job_name, job_address: item.job_address, service_type_id: item.service_type_id ?? null },
      }))
    } else {
      setCrewBidDetailsMap((prev) => ({
        ...prev,
        [item.id]: { bid_number: item.bid_number, project_name: item.project_name, address: item.address, service_type_id: item.service_type_id ?? null },
      }))
    }
    setJobSearchOpen(false)
    setJobSearchText('')
    setJobSearchResults([])
    setLinking(true)
    const { updated, error } = await linkClockSessionsToPick(state.unlinkedIds, item)
    setLinking(false)
    if (error) {
      showToast(`Could not link ${personName}'s sessions: ${error}`, 'error')
      return
    }
    if (updated < state.unlinkedIds.length) {
      showToast(partialLinkMessage(personName, updated, state.unlinkedIds.length), 'warning', 8000)
      if (updated === 0) return
    } else {
      showToast(dayLinkSuccessMessage(cls, updated, pickLabel(item)), 'success')
    }
    onSaved()
    setReloadTick((n) => n + 1)
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
        <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: phoneSafeMinWidth(400), boxSizing: 'border-box' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: phoneSafeMinWidth(400), boxSizing: 'border-box', maxWidth: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Assign {personName} to jobs or bids</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: skippedNoClockDays.length > 0 ? '0.5rem' : '1rem' }}>
          {personName} has hours on Correct days but no assignments. Pick the job or bid for each day — it goes on that day's clock sessions and the split follows.
        </p>
        {skippedNoClockDays.length > 0 ? (
          <p
            title="These days have payroll hours but no closed clock session, so there is nothing to put a job on. Approve or add a session for the day first (the day audit's Add session), then come back."
            style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem', cursor: 'help' }}
          >
            Skipped — no clock session: {skippedNoClockDays.map((d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })).join(', ')}. There is no split without a clock session.
          </p>
        ) : null}
        {unassignedDays.length === 0 ? (
          <p style={{ color: '#22c55e' }}>All days are now assigned.</p>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem' }}>Day to assign</label>
              <select
                value={effectiveSelectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', minWidth: 180, border: '1px solid var(--border-strong)', borderRadius: 4 }}
              >
                {unassignedDays.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
            {effectiveSelectedDay ? (
              <div
                style={{
                  marginBottom: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.75rem',
                  background: 'var(--bg-subtle)',
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-strong)' }}>
                  Clock sessions this day
                </div>
                {sessionsUserMissing && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                    No login account linked to this name in Users — clock sessions cannot be shown.
                  </p>
                )}
                {sessionsFetchError && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)', margin: 0 }}>{sessionsFetchError}</p>
                )}
                {!sessionsUserMissing &&
                  !sessionsFetchError &&
                  daySessions.length === 0 && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No clock sessions for this day.</p>
                  )}
                {daySessions.length > 0 && (
                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    {daySessions.map((s) => {
                      const tIn = new Date(s.clocked_in_at)
                      const tOut = s.clocked_out_at ? new Date(s.clocked_out_at) : null
                      const nowMs = Date.now()
                      const durSec = clockSessionDurationSeconds(s, nowMs)
                      const notesRaw = (s.notes ?? '').trim()
                      const notesDisplay = notesRaw.length > 80 ? `${notesRaw.slice(0, 77)}…` : notesRaw
                      const job = s.job_ledger_id ? crewJobDetailsMap[s.job_ledger_id] : undefined
                      const bid = s.bid_id ? crewBidDetailsMap[s.bid_id] : undefined
                      let linkLabel: string | null = null
                      if (s.job_ledger_id) {
                        linkLabel = job
                          ? formatJobLedgerShortLine(prefixMap, job.service_type_id ?? null, job.hcp_number, job.job_name, job.click_number)
                          : 'Job'
                      } else if (s.bid_id) {
                        linkLabel = bid
                          ? formatBidLedgerShortLine(prefixMap, bid.service_type_id ?? null, bid.bid_number, bid.project_name)
                          : 'Bid'
                      }
                      return (
                        <div
                          key={s.id}
                          style={{
                            fontSize: '0.8125rem',
                            padding: '0.45rem 0.5rem',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'baseline', marginBottom: notesRaw ? '0.25rem' : 0 }}>
                            <span style={{ color: 'var(--text-700)' }}>
                              {tIn.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                              {' → '}
                              {tOut
                                ? tOut.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                                : 'Open'}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>({formatHmsTotal(durSec)})</span>
                            {linkLabel && (
                              <span style={{ color: 'var(--text-blue-700)', fontWeight: 500 }} title={linkLabel}>
                                {linkLabel}
                              </span>
                            )}
                          </div>
                          {notesRaw ? (
                            <div style={{ color: 'var(--text-600)' }} title={notesRaw}>
                              {notesDisplay || '—'}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}
            {effectiveSelectedDay && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.875rem' }}>Common Jobs</label>
                        {canEditCrewJobs && !commonJobsEditMode && (
                          <button type="button" onClick={() => setCommonJobsEditMode(true)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Edit</button>
                        )}
                        {canEditCrewJobs && commonJobsEditMode && (
                          <button type="button" onClick={() => setCommonJobsEditMode(false)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Done</button>
                        )}
                      </div>
                      {!commonJobsEditMode ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {commonJobs.length === 0 ? (
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No common jobs</span>
                          ) : (
                            commonJobs.map((j) => {
                              const disabled = !canLinkDay
                              return (
                                <button
                                  key={j.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() =>
                                    void linkDay({
                                      type: 'job',
                                      id: j.job_id,
                                      hcp_number: j.hcp_number,
                                      job_name: j.job_name,
                                      job_address: j.job_address,
                                      service_type_id: j.service_type_id ?? null,
                                    })
                                  }
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: disabled ? 'var(--bg-subtle)' : 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
                                >
                                  {formatJobLedgerShortLine(prefixMap, j.service_type_id ?? null, j.hcp_number, j.job_name, j.click_number)}
                                </button>
                              )
                            })
                          )}
                        </div>
                      ) : (
                        <div style={{ marginBottom: '0.5rem' }}>
                          {commonJobs.length === 0 ? (
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Add jobs to get started</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                              {commonJobs.map((j) => (
                                <span key={j.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', background: 'var(--bg-muted)', borderRadius: 4, fontSize: '0.8125rem' }}>
                                  <span>{formatJobLedgerShortLine(prefixMap, j.service_type_id ?? null, j.hcp_number, j.job_name, j.click_number)}</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await withSupabaseRetry(
                                        async () => {
                                          const r = await supabase.from('common_jobs').delete().eq('id', j.id)
                                          return r as { data: null; error: { message: string } | null }
                                        },
                                        'remove job from common jobs'
                                      )
                                      setCommonJobs((prev) => prev.filter((x) => x.id !== j.id))
                                    }}
                                    style={{ padding: '0.1rem 0.25rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1 }}
                                    title="Remove from common jobs"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          {commonJobsError && (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)', marginBottom: '0.5rem' }}>{commonJobsError}</div>
                          )}
                          {!commonJobsSearchOpen ? (
                            <button
                              type="button"
                              onClick={() => { setCommonJobsSearchOpen(true); setCommonJobsSearchText(''); setCommonJobsSearchResults([]); setCommonJobsError(null) }}
                              style={{ padding: '0.2rem 0.5rem', border: '1px dashed var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.875rem' }}
                            >
                              Add job
                            </button>
                          ) : (
                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                              <input
                                type="search"
                                placeholder="Search HCP, job name, address…"
                                value={commonJobsSearchText}
                                onChange={(e) => setCommonJobsSearchText(e.target.value)}
                                autoFocus
                                style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                              />
                              <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: '0.5rem' }}>
                                {commonJobsSearchUnified.map((u) => {
                                  if (u.source !== 'job') return null
                                  const j = u
                                  return (
                                  <button
                                    key={j.id}
                                    type="button"
                                    onClick={async () => {
                                      const nextOrder = commonJobs.length
                                      let inserted: { id: string } | null = null
                                      try {
                                        inserted = await withSupabaseRetry(
                                          async () => {
                                            const r = await supabase.from('common_jobs').insert({ job_id: j.id, sequence_order: nextOrder }).select('id').single()
                                            return r as { data: { id: string } | null; error: { message: string } | null }
                                          },
                                          'add job to common jobs'
                                        )
                                      } catch (insertErr) {
                                        setCommonJobsError(formatErrorMessage(insertErr, 'Failed to add job to Common Jobs'))
                                        return
                                      }
                                      if (inserted) {
                                        setCommonJobs((prev) => [
                                          ...prev,
                                          {
                                            id: inserted.id,
                                            job_id: j.id,
                                            hcp_number: j.hcp_number ?? '',
                                            job_name: j.job_name ?? '',
                                            job_address: j.job_address ?? '',
                                            service_type_id: j.service_type_id ?? null,
                                            click_number: j.click_number ?? '',
                                          },
                                        ])
                                        setCommonJobsError(null)
                                      }
                                      setCommonJobsSearchOpen(false)
                                      setCommonJobsSearchText('')
                                      setCommonJobsSearchResults([])
                                    }}
                                    style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                                  >
                                    <UnifiedSearchResultRow
                                      result={u}
                                      prefixMap={prefixMap}
                                      jobEvidence={jobEvidence.get(u.id)}
                                      evidenceMode={evidenceMode}
                                    />
                                  </button>
                                  )
                                })}
                              </div>
                              <button type="button" onClick={() => { setCommonJobsSearchOpen(false); setCommonJobsSearchText(''); setCommonJobsSearchResults([]) }} style={{ marginTop: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}>
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.35rem' }}>Recent jobs & bids</label>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.35rem 0' }}>From past clock sessions and crew assignments for this person (dates in this Hours range).</p>
                      {recentQuickPicksLoading ? (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</span>
                      ) : recentQuickPicksError ? (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{recentQuickPicksError}</span>
                      ) : recentQuickPicks.length === 0 ? (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No recent linked jobs or bids</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {recentQuickPicks.map((item) => {
                            const disabled = !canLinkDay
                            const serviceTag = item.type === 'bid' ? getBidServiceTypeTag(item.service_type_name) : null
                            return (
                              <button
                                key={`${item.type}:${item.id}`}
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  void linkDay(
                                    item.type === 'job'
                                      ? {
                                          type: 'job',
                                          id: item.id,
                                          hcp_number: item.hcp_number,
                                          job_name: item.job_name,
                                          job_address: item.job_address,
                                          service_type_id: item.service_type_id ?? null,
                                        }
                                      : {
                                          type: 'bid',
                                          id: item.id,
                                          bid_number: item.bid_number,
                                          project_name: item.project_name,
                                          address: item.address,
                                          service_type_id: item.service_type_id ?? null,
                                        },
                                  )
                                }
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: disabled ? 'var(--bg-subtle)' : 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
                              >
                                {serviceTag ? (
                                  <span style={{ padding: '0.1rem 0.35rem', fontSize: '0.6875rem', fontWeight: 500, background: serviceTag.color, color: '#fff', borderRadius: 4 }}>
                                    [{serviceTag.tag}]
                                  </span>
                                ) : null}
                                <span>
                                  {item.type === 'job'
                                    ? formatJobLedgerShortLine(
                                        prefixMap,
                                        item.service_type_id ?? null,
                                        item.hcp_number,
                                        item.job_name,
                                        item.click_number,
                                      )
                                    : formatBidLedgerShortLine(
                                        prefixMap,
                                        item.service_type_id ?? null,
                                        item.bid_number,
                                        item.project_name,
                                      )}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem' }}>Assignments</label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>from clock sessions — there is no split without one</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                        {dayState.kind === 'link' ? (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                            {crewLinkButtonLabel(dayState).replace(/^Link /, '')} with no job or bid — tap a pick above, or
                          </span>
                        ) : dayState.kind === 'locked' ? (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            Every session this day already has a job or bid — the split is theirs. Use Split day… to move hours between jobs.
                          </span>
                        ) : (
                          <span
                            title="No closed clock session on this day, so there is nothing to put a job on. Add or approve a session first."
                            style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', cursor: 'help' }}
                          >
                            No clock session — there is no split without one.
                          </span>
                        )}
                        {dayState.kind === 'link' && !jobSearchOpen ? (
                          <button
                            type="button"
                            disabled={!canLinkDay}
                            onClick={() => { setJobSearchOpen(true); setJobSearchText(''); setJobSearchResults([]) }}
                            title="Search jobs and bids — the pick goes on every unlinked session this day."
                            style={{ padding: '0.2rem 0.5rem', border: '1px dashed var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: canLinkDay ? 'pointer' : 'not-allowed', fontSize: '0.875rem' }}
                          >
                            + Search jobs & bids
                          </button>
                        ) : null}
                        {dayState.kind !== 'no-clock' && resolvedUserId && canEditCrewJobs ? (
                          <button
                            type="button"
                            disabled={linking}
                            onClick={() => setDayEditorOpen(true)}
                            title="Open the day editor to split a session between two jobs, or change which job a session carries"
                            style={{ padding: '0.2rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', cursor: linking ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
                          >
                            Split day…
                          </button>
                        ) : null}
                        {dayState.kind === 'link' && jobSearchOpen ? (
                          <div style={{ width: '100%', marginTop: '0.5rem' }}>
                            <input
                              type="search"
                              placeholder="Search HCP, bid #, job name, project, address…"
                              value={jobSearchText}
                              onChange={(e) => setJobSearchText(e.target.value)}
                              autoFocus
                              style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                            />
                            <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: '0.5rem' }}>
                              {jobSearchResults.map((item) => (
                                <button
                                  key={`${item.source}:${item.id}`}
                                  type="button"
                                  onClick={() => {
                                    if (item.source !== 'job' && item.source !== 'bid') return
                                    void linkDay(
                                      item.source === 'job'
                                        ? {
                                            type: 'job',
                                            id: item.id,
                                            hcp_number: item.hcp_number,
                                            job_name: item.job_name,
                                            job_address: item.job_address,
                                            service_type_id: item.service_type_id ?? null,
                                          }
                                        : {
                                            type: 'bid',
                                            id: item.id,
                                            bid_number: item.bid_number,
                                            project_name: item.project_name,
                                            address: item.address,
                                            service_type_id: item.service_type_id ?? null,
                                          },
                                    )
                                    setJobSearchOpen(false)
                                    setJobSearchText('')
                                    setJobSearchResults([])
                                  }}
                                  style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                                >
                                  <UnifiedSearchResultRow
                                    result={item}
                                    prefixMap={prefixMap}
                                    jobEvidence={item.source === 'job' ? jobEvidence.get(item.id) : null}
                                    bidEvidence={item.source === 'bid' ? bidEvidence.get(item.id) : null}
                                    evidenceMode={evidenceMode}
                                  />
                                </button>
                              ))}
                            </div>
                            <button type="button" onClick={() => { setJobSearchOpen(false); setJobSearchText(''); setJobSearchResults([]) }} style={{ fontSize: '0.8125rem' }}>
                              Cancel search
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
              </>
            )}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => {
              setJobSearchOpen(false)
              setJobSearchText('')
              setJobSearchResults([])
              setCommonJobsEditMode(false)
              setCommonJobsSearchOpen(false)
              setCommonJobsSearchText('')
              setCommonJobsSearchResults([])
              onClose()
            }}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Close
          </button>
        </div>
      </div>
      {dayEditorOpen && resolvedUserId && effectiveSelectedDay ? (
        <DashboardMyTimeDayEditorModal
          dateStr={effectiveSelectedDay}
          sessions={[]}
          subjectUserId={resolvedUserId}
          subjectDisplayName={personName}
          jobLabels={dayEditorJobLabels}
          bidLabels={dayEditorBidLabels}
          onClose={() => setDayEditorOpen(false)}
          onSaved={() => {
            setDayEditorOpen(false)
            onSaved()
            setReloadTick((n) => n + 1)
          }}
          onLinkedSessionsUpdated={() => {
            onSaved()
            setReloadTick((n) => n + 1)
          }}
        />
      ) : null}
    </div>
  )
}

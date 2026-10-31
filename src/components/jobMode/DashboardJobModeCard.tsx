import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import { useUpdateFocusOpenerBridge } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import {
  effectiveJobLedgerNumber,
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { companyWeekStartSundayContaining, denverCalendarDayKey, getDefaultWeekRange } from '../../utils/dateUtils'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { useMySubPortalAddress } from '../../hooks/useMySubPortalAddress'
import { JobCalendarModal } from '../jobs/JobCalendarModal'
import type { JobCalendarJobIdentity } from '../../lib/jobCalendarModal'
import {
  pickCurrentAndNextScheduleBlock,
  type JobModeScheduleBlock,
} from '../../lib/jobModePickCurrentNext'
import { buildJobModeDayRail, type JobModeDayRailRow } from '../../lib/jobModeDayRail'
import { OnMyWaySheet, type OnMyWayDestination } from './OnMyWaySheet'
import { ImHereSheet } from './ImHereSheet'
import { legOf, legWords, type TravelFacts } from '../../lib/jobMode/onMyWay'
import { supabaseOnMyWayIo } from '../../lib/jobModeOnMyWayIo'
import { outbox } from '../../lib/offline/outboxState'
import { pendingClockIn } from '../../hooks/useOutbox'
import { isPressSessionId, pressSessionId } from '../../lib/offline/pendingSession'
import JobModeDetailsSection from './JobModeDetailsSection'
import { useToastContext } from '../../contexts/ToastContext'
import { useQuickEstimateDoor } from '../../hooks/useQuickEstimateDoor'
import { canHandThePhone, goToSigningPage, handPhoneDoorText, handPhoneState, openInPersonSigning, type HandPhoneState } from '../../lib/jobs/jobContractInPerson'
import { QuickEstimateWizard } from '../estimates/QuickEstimateWizard'
import { WriteUpChangeGlyph } from '../dashboard/dashboardJobRowShared'
import { scheduleDispatchWeekUrl } from '../../lib/scheduleDispatchDayLink'
import { jobModeMessagesOffered } from '../../lib/messages/jobBox'
import { MessageCustomerDoor } from './MessageCustomerDoor'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import FieldPctUpdateModal from '../dashboard/FieldPctUpdateModal'
import {
  buildJobModePressBar,
  clockOutOffered,
  DAY_PRESS_COLORS,
  DAY_PRESS_TEXT,
  JOB_MODE_PRESS_WORDS,
  LEAVE_REPORT_BLUE,
  pickJobModeDayPress,
  type PressBarButtonId,
} from '../../lib/jobMode/pressBar'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { JobModePressBar } from './JobModePressBar'
import { useKeptRead } from '../../hooks/useKeptRead'
import { PHONE_DAY_KEPT_LEAD, READING_AGAIN_WORDS } from '../../lib/keptRead'
import { KeptReadStamp } from '../KeptReadStamp'
import {
  JOB_MODE_KEPT_SCOPES,
  buildJobModeKeptRows,
  jobModeKeptKey,
  jobModeKeptRowIsValid,
  unpackJobModeKeptRows,
  type JobModeKeptRow,
} from '../../lib/jobMode/keptDay'

type LeaveReportJobPick = {
  id: string
  hcpNumber: string
  jobName: string
  jobAddress: string
}

type Props = {
  userId: string
  /** Mounts AdditionalReportModal in Dashboard. */
  onLeaveReport: (job: LeaveReportJobPick) => void
  /** Mounts TurnawayModal in Dashboard (client not home / site not ready). */
  onTurnaway: (job: LeaveReportJobPick) => void
  /** False for salaried users — their sessions auto-materialize, no manual clock-out. */
  canClockOut: boolean
}

type OpenSessionState = {
  id: string
  jobLedgerId: string | null
  bidId: string | null
} | null

type CurrentClockJobInfo = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  service_type_id: string | null
}

type CurrentClockBidInfo = {
  id: string
  bid_number: string | null
  project_name: string | null
  service_type_id: string | null
}

const cardWrap: CSSProperties = {
  width: '100%',
  margin: '0 auto 0.75rem',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 12,
  padding: '1rem',
  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
}

const headerWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.25rem',
  textAlign: 'center',
}

const headerNum: CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 800,
  color: 'var(--text-gray-800)',
  lineHeight: 1.1,
}

const headerNumNameSep: CSSProperties = {
  margin: '0 0.45rem',
  fontWeight: 400,
  color: 'var(--text-faint)',
}

const headerName: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
  color: 'var(--text-gray-800)',
  lineHeight: 1.2,
}

const headerAddr: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-600)',
  lineHeight: 1.2,
}

const headerStatusLine: CSSProperties = {
  fontSize: '0.8125rem',
  color: 'var(--text-muted)',
  marginTop: '0.15rem',
}

/** The leg's line under the header (v2.5573): on the way in the clock's green, on site in the ink. */
const onTheWayLine: CSSProperties = { ...headerStatusLine, color: 'var(--text-green-700)', fontWeight: 700 }
const onSiteLine: CSSProperties = { ...headerStatusLine, color: 'var(--text-strong)', fontWeight: 600 }

const buttonRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.6rem',
}

const bigButtonBase: CSSProperties = {
  width: '100%',
  minHeight: 92,
  padding: '0.85rem',
  borderRadius: 12,
  border: 'none',
  fontSize: '1.05rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1.15,
  textAlign: 'center',
  whiteSpace: 'pre-line',
}

const leaveReportBtn: CSSProperties = {
  ...bigButtonBase,
  background: LEAVE_REPORT_BLUE,
  color: 'white',
}

const nextJobBtn: CSSProperties = {
  ...bigButtonBase,
  background: DAY_PRESS_COLORS.green,
  color: 'white',
}

/** I'm here, the big button while on the way (v2.5573), in the blue of a thing to press once. */
const imHereBtn: CSSProperties = {
  ...bigButtonBase,
  background: DAY_PRESS_COLORS.blue,
  color: 'white',
}

/** The manual Clock In (no schedule, nothing running) wears the app's clock-in orange, like the visible clock button (v2.3193). */
const manualClockInBtn: CSSProperties = {
  ...bigButtonBase,
  background: DAY_PRESS_COLORS.orange,
  color: DAY_PRESS_TEXT.orange,
}

const turnawayBtn: CSSProperties = {
  ...bigButtonBase,
  gridColumn: '1 / -1',
  minHeight: 56,
  fontSize: '0.95rem',
  background: '#d97706',
  color: 'white',
}

const wrapUpBtn: CSSProperties = {
  ...bigButtonBase,
  background: DAY_PRESS_COLORS.red,
  color: 'white',
}

const disabledBtnOverlay: CSSProperties = {
  background: DEAD_PRESS_FILL,
  color: DEAD_PRESS_TEXT,
  cursor: 'not-allowed',
}

/** A quiet link under the card's buttons, as a 44 px press on a phone (punch list #189, PR 2; the height's one source since PR 3). */
const quietLinkPhone: CSSProperties = {
  minHeight: PHONE_PRESS_MIN_HEIGHT,
}

const quietClockOutBtn: CSSProperties = {
  alignSelf: 'center',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  padding: '0.1rem 0.4rem',
}

const railWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const railTitle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  marginBottom: '0.15rem',
}

const railRowBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  textAlign: 'left',
  padding: '0.4rem 0.45rem',
  borderRadius: 8,
  border: 'none',
  background: 'none',
  color: 'var(--text-gray-800)',
  fontSize: '0.86rem',
}

const railDotBase: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: '50%',
  flexShrink: 0,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1,
}

const railTimeStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.78rem',
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
  width: 58,
}

const railFlagStyle: CSSProperties = {
  fontSize: '0.66rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  flexShrink: 0,
}

const errorRow: CSSProperties = {
  fontSize: '0.8125rem',
  textAlign: 'center',
}

function safeTrim(s: string | null | undefined): string {
  return (s ?? '').trim()
}

export default function DashboardJobModeCard({ userId, onLeaveReport, onTurnaway, canClockOut }: Props) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const navigate = useNavigate()
  const { role, profileName } = useAuth()
  const { showToast } = useToastContext()
  /** A phone (punch list #189, PR 2): the day's press leaves the card for the bar pinned above the tab bar. */
  const phone = useNarrowViewport640()
  // SP-2 (v2.3067): a sub or helper with a login reaches their own statement from here.
  const myStatement = useMySubPortalAddress(role === 'subcontractor' || role === 'helpers')
  // Same planner pool as Stages' canOpenJobScheduleModal — gates the calendar's week-dispatch link.
  const canOpenWeekDispatch =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'superintendent'
  const [jobCalendarOpen, setJobCalendarOpen] = useState(false)
  // Service-type names by id, for the trade-tag job label ("PLUM 902") in the header.
  const [serviceTypeNames, setServiceTypeNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.from('service_types').select('id, name')
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const r of (data ?? []) as Array<{ id: string; name: string | null }>) {
          if (r.name?.trim()) map[r.id] = r.name.trim()
        }
        setServiceTypeNames(map)
      } catch {
        // fall back to the ledger-prefix label
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  const { requestOpenUpdateFocus, applyUpdateFocusDirect, requestClockOut, registerOnMyWayOpener, subscribeSessionChanges } = useUpdateFocusOpenerBridge()

  const [workDateYmd, setWorkDateYmd] = useState<string>(() => denverCalendarDayKey(Date.now()))
  const [loading, setLoading] = useState(true)
  /** The day's failed read with its class: a lost signal offers Retry and reads again when it comes back (v2.5962). */
  const [error, setError] = useState<OfflineRecoveryLastError | null>(null)
  const [scheduleBlocks, setScheduleBlocks] = useState<JobModeScheduleBlock[]>([])
  const [openSession, setOpenSession] = useState<OpenSessionState>(null)
  const [currentJobInfo, setCurrentJobInfo] = useState<CurrentClockJobInfo | null>(null)
  const [currentBidInfo, setCurrentBidInfo] = useState<CurrentClockBidInfo | null>(null)
  /** Jobs with a closed clock session today — drives the rail's ✓s and the unvisited-aware picker. */
  const [visitedJobIds, setVisitedJobIds] = useState<ReadonlySet<string>>(new Set())

  /** On my way (v2.5573): the sheet, with the job it opens on; I'm here: the arrival's sheet on the open session. */
  const [onMyWay, setOnMyWay] = useState<{ initialJobId: string | null } | null>(null)
  const [imHere, setImHere] = useState(false)
  /** The open session's two stamps (null before the push, or on a row with none) and the minute the header reads them at. */
  const [travelFacts, setTravelFacts] = useState<TravelFacts | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const onMyWayIo = useMemo(() => supabaseOnMyWayIo(), [])

  const reloadGenRef = useRef(0)

  const reload = useCallback(async () => {
    if (!userId) return
    const gen = ++reloadGenRef.current
    setLoading(true)
    setError(null)
    try {
      const today = denverCalendarDayKey(Date.now())
      setWorkDateYmd(today)

      const [blocksRaw, openRaw, visitedRaw] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase
              .from('job_schedule_blocks')
              .select(
                'id, job_id, time_start, time_end, jobs_ledger(hcp_number, click_number, job_name, job_address, service_type_id)',
              )
              .eq('assignee_user_id', userId)
              .eq('work_date', today)
              .order('time_start', { ascending: true }),
          'load schedule',
        ),
        withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select('id, job_ledger_id, bid_id')
              .eq('user_id', userId)
              .is('clocked_out_at', null)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .order('clocked_in_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          'load clock session',
        ),
        withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select('job_ledger_id')
              .eq('user_id', userId)
              .eq('work_date', today)
              .not('clocked_out_at', 'is', null)
              .not('job_ledger_id', 'is', null)
              .is('rejected_at', null)
              .is('revoked_at', null),
          'load clock history',
        ),
      ])
      if (gen !== reloadGenRef.current) return

      const blocksList: JobModeScheduleBlock[] = []
      for (const r of (blocksRaw ?? []) as Array<{
        id: string
        job_id: string
        time_start: string
        time_end: string
        jobs_ledger: {
          hcp_number: string | null
          click_number: string | null
          job_name: string | null
          job_address: string | null
          service_type_id: string | null
        } | null
      }>) {
        if (!r?.id || !r?.job_id) continue
        const jl = r.jobs_ledger
        blocksList.push({
          id: r.id,
          job_id: r.job_id,
          time_start: r.time_start,
          time_end: r.time_end,
          hcp_number: jl?.hcp_number ?? null,
          click_number: jl?.click_number ?? null,
          job_name: jl?.job_name ?? null,
          job_address: jl?.job_address ?? null,
          service_type_id: jl?.service_type_id ?? null,
        })
      }
      setScheduleBlocks(blocksList)

      const visitedSet = new Set<string>()
      for (const r of (visitedRaw ?? []) as Array<{ job_ledger_id: string | null }>) {
        if (r?.job_ledger_id) visitedSet.add(r.job_ledger_id)
      }
      setVisitedJobIds(visitedSet)

      const openRow = (openRaw ?? null) as
        | { id: string; job_ledger_id: string | null; bid_id: string | null }
        | null
      // A clock-in still on the phone (punch list #163 PR 2): the card is clocked in on it until it lands,
      // its leg from the press, so On site since 7:58 reads right with no signal.
      const pending = openRow ? null : pendingClockIn(outbox.presses())
      const open = openRow ?? (pending ? { id: pressSessionId(pending.id), job_ledger_id: pending.payload.jobLedgerId, bid_id: pending.payload.bidId } : null)
      if (openRow) {
        setOpenSession({ id: openRow.id, jobLedgerId: openRow.job_ledger_id, bidId: openRow.bid_id })
        // The two stamps (v2.5573), read apart and fail-soft so a client ahead of the push still draws the card.
        const facts = await onMyWayIo.loadTravelFacts(openRow.id).catch(() => null)
        if (gen === reloadGenRef.current) setTravelFacts(facts)
      } else if (pending && open) {
        const at = new Date(pending.pressedAt).toISOString()
        setOpenSession({ id: open.id, jobLedgerId: open.job_ledger_id, bidId: open.bid_id })
        setTravelFacts({ travelStartedAt: pending.payload.travel === 'on-the-way' ? at : null, arrivedAt: pending.payload.travel === 'on-site' ? at : null })
      } else {
        setOpenSession(null)
        setTravelFacts(null)
      }

      const sessionJobId = open?.job_ledger_id ?? null
      const sessionBidId = open?.bid_id ?? null

      // Fetch the current focus's display fields if it isn't on today's schedule.
      if (sessionJobId) {
        const onSchedule = blocksList.find((b) => b.job_id === sessionJobId)
        if (onSchedule) {
          setCurrentJobInfo({
            id: sessionJobId,
            hcp_number: onSchedule.hcp_number,
            click_number: onSchedule.click_number,
            job_name: onSchedule.job_name,
            job_address: onSchedule.job_address,
            service_type_id: onSchedule.service_type_id,
          })
        } else {
          try {
            const jl = await withSupabaseRetry(
              async () =>
                supabase
                  .from('jobs_ledger')
                  .select('id, hcp_number, click_number, job_name, job_address, service_type_id')
                  .eq('id', sessionJobId)
                  .maybeSingle(),
              'job mode load off-schedule job info',
            )
            const j = (jl ?? null) as CurrentClockJobInfo | null
            if (gen === reloadGenRef.current) setCurrentJobInfo(j)
          } catch {
            if (gen === reloadGenRef.current) setCurrentJobInfo(null)
          }
        }
      } else {
        setCurrentJobInfo(null)
      }

      if (sessionBidId) {
        try {
          const br = await withSupabaseRetry(
            async () =>
              supabase
                .from('bids')
                .select('id, bid_number, project_name, service_type_id')
                .eq('id', sessionBidId)
                .maybeSingle(),
            'job mode load bid info',
          )
          const b = (br ?? null) as CurrentClockBidInfo | null
          if (gen === reloadGenRef.current) setCurrentBidInfo(b)
        } catch {
          if (gen === reloadGenRef.current) setCurrentBidInfo(null)
        }
      } else {
        setCurrentBidInfo(null)
      }
    } catch (e) {
      if (gen !== reloadGenRef.current) return
      setError(recoveryFailureFromError(e, "Couldn't load today's jobs"))
    } finally {
      if (gen === reloadGenRef.current) setLoading(false)
    }
  }, [userId, onMyWayIo])

  useEffect(() => {
    void reload()
  }, [reload])

  // A queued clock press landed, was refused or was dropped (punch list #163 PR 2): read the day again.
  // A try that failed changes nothing here, so a lost signal never has the card re-reading every 30 s.
  const outboxSignatureRef = useRef('')
  useEffect(() => {
    if (!userId) return
    const signature = () =>
      outbox
        .presses()
        .filter((p) => p.kind === 'clock-in' || p.kind === 'clock-out')
        .map((p) => `${p.id}:${p.state === 'waiting' || p.state === 'sending' ? 'w' : p.state}`)
        .join('|')
    outboxSignatureRef.current = signature()
    return outbox.subscribe(() => {
      const next = signature()
      if (next === outboxSignatureRef.current) return
      outboxSignatureRef.current = next
      void reload()
    })
  }, [userId, reload])

  // The card's own press (punch list #189, PR 8): a clock-in, a job change or a clock-out through the clock button
  // reloads the card at once. The live run of 2026-10-27 found it keeping the clocked-in state after Wrap Up Day
  // until a reload, the realtime signal notwithstanding.
  useEffect(() => subscribeSessionChanges(() => void reload()), [subscribeSessionChanges, reload])

  // Realtime: refresh when this user's clock_sessions or job_schedule_blocks
  // change. Realtime only supports a single column filter per subscription, so
  // we scope schedule-block events to this user's assignee_user_id and accept
  // that other-day rows still trigger a refetch (which is fine — reload() reads
  // the current day's rows). clock_sessions is filtered to the user.
  const jobModeFilters = useMemo(
    () =>
      userId
        ? [
            { event: '*' as const, schema: 'public', table: 'clock_sessions', filter: `user_id=eq.${userId}` },
            { event: '*' as const, schema: 'public', table: 'job_schedule_blocks', filter: `assignee_user_id=eq.${userId}` },
          ]
        : [],
    [userId],
  )
  useRealtimeChannel(
    !!userId,
    `dashboard-job-mode-${userId ?? 'none'}`,
    jobModeFilters,
    () => {
      void reload()
    },
    { debounceMs: 400 },
  )

  // Roll the work date over at midnight without a page reload.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
      const today = denverCalendarDayKey(Date.now())
      if (today !== workDateYmd) void reload()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [workDateYmd, reload])

  /**
   * The kept day (punch list #183 PR 3): the rail's facts kept on the device through `useKeptRead`,
   * keyed by the user and the day (`lib/jobMode/keptDay.ts`). While the day's first read runs the
   * hook hands back what this device last saw, so the card draws the header and the rail as read
   * at 7:52 AM under the stamp instead of *Loading Job Mode…*, with every press that acts on the
   * day held (`keptPress`, the bar's `held`). `loading` turns false only when every read of the
   * day landed, so a half day is never kept. A failed live read leaves the kept day up with the
   * stamp's Retry; the open session itself is never kept, the clock reads live.
   */
  const rowsToKeep = useMemo(
    () => buildJobModeKeptRows({ blocks: scheduleBlocks, currentJobId: openSession?.jobLedgerId ?? null, visitedJobIds }),
    [scheduleBlocks, openSession?.jobLedgerId, visitedJobIds],
  )
  const kept = useKeptRead<JobModeKeptRow>(userId ? jobModeKeptKey(userId, workDateYmd) : null, rowsToKeep, {
    loading,
    scopes: JOB_MODE_KEPT_SCOPES,
    failed: error != null,
    rowIsValid: jobModeKeptRowIsValid,
  })
  const keptDay = useMemo(() => (kept.readAt != null && kept.rows ? unpackJobModeKeptRows(kept.rows) : null), [kept.readAt, kept.rows])
  /** The day on screen is the kept one: every press on it waits for the live read. */
  const held = keptDay != null
  /** The header and the rail draw: the live read landed, or the kept day stands in for it. */
  const dayOnScreen = !loading || held
  const dayBlocks = keptDay ? keptDay.blocks : scheduleBlocks
  const dayVisited = keptDay ? keptDay.visitedJobIds : visitedJobIds
  const daySession = useMemo(
    () =>
      keptDay
        ? keptDay.currentJobId
          ? { jobLedgerId: keptDay.currentJobId, bidId: null }
          : null
        : openSession
          ? { jobLedgerId: openSession.jobLedgerId, bidId: openSession.bidId }
          : null,
    [keptDay, openSession],
  )

  const picked = useMemo(
    () =>
      pickCurrentAndNextScheduleBlock({
        blocks: dayBlocks,
        openSession: daySession,
        visitedJobIds: dayVisited,
      }),
    [dayBlocks, daySession, dayVisited],
  )

  const dayRail = useMemo(
    () =>
      buildJobModeDayRail({
        blocks: dayBlocks,
        currentJobId: daySession?.jobLedgerId ?? null,
        visitedJobIds: dayVisited,
      }),
    [dayBlocks, daySession?.jobLedgerId, dayVisited],
  )

  function jobNumberLabel(serviceTypeId: string | null, hcp: string | null, click: string | null): string {
    // Trade-tag label ("PLUM 902" / "ELEC 31" / "HVAC 12") matching other job
    // cards; ledger-prefix label ("JP902") when the service type is unknown.
    const stName = serviceTypeId ? serviceTypeNames[serviceTypeId] : undefined
    const tag = getBidServiceTypeTag(stName)?.tag ?? (stName ? stName.slice(0, 4) : null)
    if (tag) return `${tag.toUpperCase()} ${effectiveJobLedgerNumber(hcp, click) || '—'}`
    return formatJobLedgerNumberLabel(resolveJobLedgerPrefix(serviceTypeId, prefixMap), hcp, click)
  }

  /** Where the open session is (v2.5573): on the way, on site, or unmarked; its line under the header. */
  const leg = openSession?.jobLedgerId ? legOf(travelFacts) : 'unmarked'
  /** The clock-in is still on the phone (punch list #163 PR 2): the header says so beside the leg. */
  const sessionPending = openSession != null && isPressSessionId(openSession.id)
  const legTextLive = openSession?.jobLedgerId ? legWords(travelFacts, nowMs) : null
  const legText = sessionPending ? `${legTextLive ?? 'Clocked in'} · kept on the phone` : legTextLive
  const legLine = legText ? (
    <div style={leg === 'on-the-way' ? onTheWayLine : onSiteLine} data-testid="job-mode-leg">
      {legText}
    </div>
  ) : null

  // Header content depends on state.
  function renderHeader() {
    // Clocked into a job that matches today's schedule.
    if (picked.currentBlock) {
      const cb = picked.currentBlock
      const num = jobNumberLabel(cb.service_type_id, cb.hcp_number, cb.click_number)
      return (
        <div style={headerWrap}>
          <div style={headerNum}>
            {num}
            <span style={headerNumNameSep}>|</span>
            <span style={headerName}>{safeTrim(cb.job_name) || '—'}</span>
          </div>
          <div style={headerAddr}>{safeTrim(cb.job_address) || '—'}</div>
          {legLine}
        </div>
      )
    }
    // Clocked on a job NOT on today's schedule.
    if (picked.state === 'on-off-schedule-job' && currentJobInfo) {
      const num = jobNumberLabel(currentJobInfo.service_type_id, currentJobInfo.hcp_number, currentJobInfo.click_number)
      return (
        <div style={headerWrap}>
          <div style={headerNum}>
            {num}
            <span style={headerNumNameSep}>|</span>
            <span style={headerName}>{safeTrim(currentJobInfo.job_name) || '—'}</span>
          </div>
          <div style={headerAddr}>{safeTrim(currentJobInfo.job_address) || '—'}</div>
          {legLine}
          <div style={headerStatusLine}>Not on today&rsquo;s schedule</div>
        </div>
      )
    }
    // Clocked in but with no association at all.
    if (picked.state === 'on-off-schedule-job' && openSession && !currentJobInfo) {
      return (
        <div style={headerWrap}>
          <div style={headerName}>Clocked in</div>
          <div style={headerAddr}>No job or bid linked yet</div>
        </div>
      )
    }
    // Clocked on a bid.
    if (picked.state === 'on-bid') {
      if (currentBidInfo) {
        const num = `${(currentBidInfo.bid_number ?? '').trim() || '—'}`
        const proj = safeTrim(currentBidInfo.project_name) || 'Bid'
        return (
          <div style={headerWrap}>
            <div style={headerNum}>{`Bid ${num}`}</div>
            <div style={headerName}>{proj}</div>
            <div style={headerStatusLine}>Clocked into a bid</div>
          </div>
        )
      }
      return (
        <div style={headerWrap}>
          <div style={headerName}>Clocked into a bid</div>
        </div>
      )
    }
    // Not clocked in but has schedule.
    if (picked.state === 'not-clocked-in-with-schedule' && picked.nextBlock) {
      const nb = picked.nextBlock
      const num = jobNumberLabel(nb.service_type_id, nb.hcp_number, nb.click_number)
      return (
        <div style={headerWrap}>
          <div style={headerStatusLine}>Ready to start</div>
          <div style={headerNum}>
            {num}
            <span style={headerNumNameSep}>|</span>
            <span style={headerName}>{safeTrim(nb.job_name) || '—'}</span>
          </div>
          <div style={headerAddr}>{safeTrim(nb.job_address) || '—'}</div>
        </div>
      )
    }
    // No clock, no schedule.
    return (
      <div style={headerWrap}>
        <div style={headerName}>No schedule for today</div>
        <div style={headerStatusLine}>Use Clock In to choose a job manually.</div>
      </div>
    )
  }

  // Decide whether Leave Report has a target job and what that target is. Its number is the job's hcp_number or, on a
  // job numbered in click_number, that (#197): Leave report, Turnaway and % done read it in their headings and titles.
  const leaveReportTarget: LeaveReportJobPick | null = (() => {
    if (picked.currentBlock) {
      const cb = picked.currentBlock
      return {
        id: cb.job_id,
        hcpNumber: effectiveJobLedgerNumber(cb.hcp_number, cb.click_number) || '—',
        jobName: safeTrim(cb.job_name) || '—',
        jobAddress: safeTrim(cb.job_address) || '—',
      }
    }
    if (picked.state === 'on-off-schedule-job' && currentJobInfo) {
      return {
        id: currentJobInfo.id,
        hcpNumber: effectiveJobLedgerNumber(currentJobInfo.hcp_number, currentJobInfo.click_number) || '—',
        jobName: safeTrim(currentJobInfo.job_name) || '—',
        jobAddress: safeTrim(currentJobInfo.job_address) || '—',
      }
    }
    return null
  })()

  /** The job (or bid) the tech leaves on an advance, as the card names it, or null before the first clock-in (v2.5573). */
  const leavingLabel: string | null = (() => {
    if (!openSession) return null
    if (picked.currentBlock) {
      const cb = picked.currentBlock
      return `${jobNumberLabel(cb.service_type_id, cb.hcp_number, cb.click_number)} · ${safeTrim(cb.job_name) || '—'}`
    }
    if (currentJobInfo) return `${jobNumberLabel(currentJobInfo.service_type_id, currentJobInfo.hcp_number, currentJobInfo.click_number)} · ${safeTrim(currentJobInfo.job_name) || '—'}`
    if (currentBidInfo) return `Bid ${(currentBidInfo.bid_number ?? '').trim() || '—'}`
    return 'your open session'
  })()

  // Job the "Job calendar" link opens: the header's job (current block →
  // off-schedule clock job → next block), matching what the tech is looking at.
  const jobCalendarTarget: JobCalendarJobIdentity | null = (() => {
    const identity = (
      id: string,
      hcp: string | null,
      click: string | null,
      name: string | null,
      addr: string | null,
      stid: string | null,
    ): JobCalendarJobIdentity => ({
      id,
      hcp_number: hcp,
      click_number: click,
      job_name: name,
      job_address: addr,
      serviceType: stid && serviceTypeNames[stid] ? { name: serviceTypeNames[stid]! } : null,
    })
    if (picked.currentBlock) {
      const cb = picked.currentBlock
      return identity(cb.job_id, cb.hcp_number, cb.click_number, cb.job_name, cb.job_address, cb.service_type_id)
    }
    if (picked.state === 'on-off-schedule-job' && currentJobInfo) {
      const cj = currentJobInfo
      return identity(cj.id, cj.hcp_number, cj.click_number, cj.job_name, cj.job_address, cj.service_type_id)
    }
    if (picked.state === 'not-clocked-in-with-schedule' && picked.nextBlock) {
      const nb = picked.nextBlock
      return identity(nb.job_id, nb.hcp_number, nb.click_number, nb.job_name, nb.job_address, nb.service_type_id)
    }
    return null
  })()

  // The day's press (the right button): its six states are the kernel's (`pickJobModeDayPress`),
  // read once here for the desktop grid and the phone's press bar alike.
  const rightButton = pickJobModeDayPress({
    leg,
    state: picked.state,
    hasNextBlock: picked.nextBlock != null,
    canClockOut,
  })

  /** On my way (v2.5573): every advance to a scheduled job opens the sheet, on the suggested job or the one tapped. */
  function openAdvanceModal(_intent: 'start-first' | 'next-job', initialJobId: string | null) {
    setOnMyWay({ initialJobId })
  }

  async function handleRightButton() {
    if (rightButton.kind === 'manual-clock-in') {
      // Defer to existing clock-in flow.
      requestOpenUpdateFocus()
      return
    }
    if (rightButton.kind === 'open-update-focus') {
      requestOpenUpdateFocus()
      return
    }
    if (rightButton.kind === 'wrap-up') {
      // Same guarded flow as the visible clock-out button (tally gate + review).
      requestClockOut()
      return
    }
    if (rightButton.kind === 'last-job') {
      // No-op; the button is informational.
      return
    }
    if (rightButton.kind === 'im-here') {
      if (sessionPending) {
        showToast('Your clock in is still waiting to send. I’m here goes once it lands.', 'warning')
        return
      }
      setImHere(true)
      return
    }
    openAdvanceModal(rightButton.intent ?? 'next-job', picked.nextBlock?.job_id ?? null)
  }

  // The job window's Leaving (punch list #189, the Leaving PR): the sheet for the day's next job, through the bridge,
  // while this card is mounted; false with no next job, so the window opens Update Focus as before.
  const nextBlockJobId = picked.nextBlock?.job_id ?? null
  useEffect(() => {
    registerOnMyWayOpener(() => {
      if (!nextBlockJobId) return false
      setOnMyWay({ initialJobId: nextBlockJobId })
      return true
    })
    return () => registerOnMyWayOpener(null)
  }, [registerOnMyWayOpener, nextBlockJobId])

  /** Rail rows a tech can jump to: unvisited, not the current focus. */
  function handleRailRowTap(row: JobModeDayRailRow) {
    if (row.status === 'current' || row.status === 'done') return
    openAdvanceModal(openSession ? 'next-job' : 'start-first', row.block.job_id)
  }

  function formatBlockTime(t: string): string {
    const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
    if (!m?.[1] || !m[2]) return t
    const h = Number(m[1])
    const hh = h % 12 === 0 ? 12 : h % 12
    return `${hh}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
  }

  // Where the advance modal can send the tech: today's still-open jobs.
  const advanceDestinations: OnMyWayDestination[] = dayRail.rows
    .filter((r) => r.status === 'still-open' || r.status === 'upcoming')
    .map((r) => ({
      jobId: r.block.job_id,
      label: `${jobNumberLabel(r.block.service_type_id, r.block.hcp_number, r.block.click_number)} · ${safeTrim(r.block.job_name) || '—'}`,
      sublabel: `${formatBlockTime(r.block.time_start)} · ${safeTrim(r.block.job_address) || '—'}`,
      suggested: picked.nextBlock?.job_id === r.block.job_id,
      jobName: safeTrim(r.block.job_name) || null,
      jobAddress: safeTrim(r.block.job_address) || null,
      timeEnd: r.block.time_end || null,
    }))

  function leaveReportDisabledReason(): string | null {
    if (!leaveReportTarget) {
      if (picked.state === 'on-bid') return 'Clocked into a bid — no job to report on.'
      if (picked.state === 'not-clocked-in-with-schedule') return 'Start a job first.'
      if (picked.state === 'no-clock-no-schedule') return 'Start a job first.'
      return 'No current job to report on.'
    }
    return null
  }

  const leaveDisabledReason = leaveReportDisabledReason()
  const leaveDisabled = leaveDisabledReason !== null

  /** Write up a change (v2.4057): a quiet link under the action row, on the clocked-in job or the one ready to start. */
  const writeUpChangeDoor = useQuickEstimateDoor(userId, role)
  const [writeUpChangeOpen, setWriteUpChangeOpen] = useState(false)
  /** Counts what Message the customer sent, so Job updates reads the note or the text without a reload. */
  const [jobUpdatesRev, setJobUpdatesRev] = useState(0)
  /** Hand the phone to the customer (v2.4159): on the clocked-in job, for the roles that speak for the company on site, until the job is signed. */
  const handPhoneJobId = leaveReportTarget?.id ?? null
  const [handPhone, setHandPhone] = useState<HandPhoneState | null>(null)
  const [handPhoneBusy, setHandPhoneBusy] = useState(false)
  useEffect(() => {
    if (!handPhoneJobId || !canHandThePhone(role)) {
      setHandPhone(null)
      return
    }
    let cancelled = false
    void supabase
      .from('job_contracts')
      .select('status, voided_at')
      .eq('job_id', handPhoneJobId)
      .then(({ data }) => {
        if (!cancelled) setHandPhone(handPhoneState((data ?? []) as Array<{ status: string; voided_at: string | null }>))
      })
    return () => {
      cancelled = true
    }
  }, [handPhoneJobId, role])
  const handPhoneDoor = handPhoneJobId && handPhone ? handPhoneDoorText(handPhone) : null
  const handThePhone = async () => {
    if (!handPhoneJobId || handPhoneBusy) return
    setHandPhoneBusy(true)
    try {
      const res = await openInPersonSigning({ jobId: handPhoneJobId, authUserId: userId ?? null, origin: window.location.origin })
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      goToSigningPage(res.url)
    } finally {
      setHandPhoneBusy(false)
    }
  }
  const writeUpChangeJobId =
    leaveReportTarget?.id ??
    (picked.state === 'not-clocked-in-with-schedule' && picked.nextBlock ? picked.nextBlock.job_id : null)

  /** Clock out (lunch, a parts run, leaving early): the quiet link's rule, shared with the bar's button. */
  const clockOutShown = dayOnScreen && clockOutOffered({ sessionOpen: daySession != null, canClockOut, dayPressKind: rightButton.kind })

  /** % done (punch list #189, PR 2): the My Schedule stepper, opened from the bar on the clocked-in job. */
  const [pctJob, setPctJob] = useState<{ id: string; hcpNumber: string; jobName: string; label: string } | null>(null)

  /** The phone's press bar: the kernel's rows, and one handler that runs the card's own flows. */
  const pressBar = phone
    ? buildJobModePressBar({
        dayPress: rightButton,
        role,
        sessionOpen: daySession != null,
        canClockOut,
        hasCurrentJob: leaveReportTarget != null,
      })
    : null
  function handlePressBar(id: PressBarButtonId) {
    if (id === 'day-press') {
      void handleRightButton()
      return
    }
    if (id === 'clock-out') {
      requestClockOut()
      return
    }
    if (!leaveReportTarget) return
    if (id === 'leave-report') onLeaveReport(leaveReportTarget)
    else if (id === 'turnaway') onTurnaway(leaveReportTarget)
    else if (id === 'pct-done') {
      setPctJob({
        id: leaveReportTarget.id,
        hcpNumber: leaveReportTarget.hcpNumber,
        jobName: leaveReportTarget.jobName,
        label: leavingLabel ?? leaveReportTarget.jobName,
      })
    }
  }

  const quietLink: CSSProperties = phone ? { ...quietClockOutBtn, ...quietLinkPhone } : quietClockOutBtn

  return (
    <div style={cardWrap} data-kept-read={held ? '' : undefined} data-testid="job-mode-card">
      {held ? (
        <KeptReadStamp className="keptReadStampTight" lead={PHONE_DAY_KEPT_LEAD} readAt={kept.readAt ?? 0} failed={kept.failed} onRetry={() => void reload()} />
      ) : null}
      {loading && !held ? (
        <div style={{ ...headerStatusLine, textAlign: 'center' }}>Loading Job Mode…</div>
      ) : null}
      {dayOnScreen ? renderHeader() : null}
      {dayOnScreen && jobCalendarTarget ? (
        <button
          type="button"
          onClick={() => setJobCalendarOpen(true)}
          aria-label="Open the job calendar"
          title="See what days this job is on people's calendars"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            alignSelf: 'center',
            margin: '-0.35rem 0 0',
            padding: '0.15rem 0.5rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-link)',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={13} height={13} fill="currentColor" aria-hidden="true">
            <path d="M224 64C206.3 64 192 78.3 192 96L192 128L160 128C124.7 128 96 156.7 96 192L96 240L544 240L544 192C544 156.7 515.3 128 480 128L448 128L448 96C448 78.3 433.7 64 416 64C398.3 64 384 78.3 384 96L384 128L256 128L256 96C256 78.3 241.7 64 224 64zM96 288L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 288L96 288z" />
          </svg>
          Job calendar
        </button>
      ) : null}
      {jobCalendarOpen && jobCalendarTarget ? (
        <JobCalendarModal
          job={jobCalendarTarget}
          onClose={() => setJobCalendarOpen(false)}
          canOpenJobScheduleModal={false}
          canOpenWeekDispatch={canOpenWeekDispatch}
          onOpenSchedule={() => {}}
          onOpenWeekDispatch={(selectedYmd) => {
            const week = (selectedYmd ? companyWeekStartSundayContaining(selectedYmd) : null) ?? getDefaultWeekRange().start
            setJobCalendarOpen(false)
            navigate(scheduleDispatchWeekUrl(jobCalendarTarget.id, week))
          }}
        />
      ) : null}
      {error && !held ? (
        // A read is safe to repeat: when the signal returns the card reads the day again by itself.
        <OfflineRetryPanel failure={error} onRetry={reload} surface="job-mode-card" idempotent busy={loading} style={{ justifyContent: 'center' }} messageStyle={errorRow} />
      ) : null}
      {dayOnScreen && dayRail.rows.length > 0 ? (
        <div style={railWrap}>
          <div style={railTitle}>
            Today · {dayRail.doneCount} of {dayRail.totalCount} done
          </div>
          {dayRail.rows.map((row) => {
            const tappable = row.status === 'still-open' || row.status === 'upcoming'
            const dot =
              row.status === 'done' ? (
                <span style={{ ...railDotBase, background: '#16a34a', color: 'white' }} aria-hidden="true">✓</span>
              ) : row.status === 'current' ? (
                <span style={{ ...railDotBase, border: '5px solid #16a34a', background: 'var(--surface)' }} aria-hidden="true" />
              ) : row.status === 'still-open' ? (
                <span style={{ ...railDotBase, border: '2px solid #d97706', color: '#d97706' }} aria-hidden="true">!</span>
              ) : (
                <span style={{ ...railDotBase, border: '2px solid var(--text-faint)' }} aria-hidden="true" />
              )
            const num = jobNumberLabel(row.block.service_type_id, row.block.hcp_number, row.block.click_number)
            const name = safeTrim(row.block.job_name) || '—'
            return (
              <button
                key={row.block.job_id}
                type="button"
                disabled={!tappable || held}
                className={held && tappable ? 'keptPress' : undefined}
                title={held && tappable ? READING_AGAIN_WORDS : undefined}
                aria-label={
                  tappable
                    ? `Go to ${num} ${name}`
                    : `${num} ${name} — ${row.status === 'current' ? 'current job' : 'done'}`
                }
                style={{
                  ...railRowBase,
                  cursor: tappable ? 'pointer' : 'default',
                  ...(row.status === 'current'
                    ? { background: 'var(--bg-green-tint)', outline: '1.5px solid #16a34a' }
                    : null),
                  ...(row.status === 'done' ? { color: 'var(--text-muted)' } : null),
                }}
                onClick={() => handleRailRowTap(row)}
              >
                {dot}
                <span style={railTimeStyle}>{formatBlockTime(row.block.time_start)}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {num} · {name}
                </span>
                {row.status === 'current' ? (
                  <span style={{ ...railFlagStyle, color: '#16a34a' }}>NOW</span>
                ) : row.status === 'still-open' ? (
                  <span style={{ ...railFlagStyle, color: '#d97706' }}>STILL OPEN</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
      {myStatement.url ? (
        <div style={{ margin: '0 0 0.5rem', textAlign: 'center' }}>
          <a
            href={myStatement.url}
            target="_blank"
            rel="noopener"
            aria-label="My statement — opens your work and pay portal"
            style={{ display: 'inline-block', padding: '0.4rem 0.9rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}
          >
            My statement ↗
          </a>
        </div>
      ) : null}
      {/* On a phone these three presses live on the press bar at the foot of the screen (punch list #189, PR 2). */}
      {phone ? null : (
        <div style={buttonRow}>
          <button
            type="button"
            style={leaveDisabled ? { ...leaveReportBtn, ...disabledBtnOverlay } : leaveReportBtn}
            disabled={leaveDisabled || held}
            className={held ? 'keptPress' : undefined}
            title={held ? READING_AGAIN_WORDS : (leaveDisabledReason ?? undefined)}
            aria-label="Leave Report"
            onClick={() => {
              if (!leaveReportTarget) return
              onLeaveReport(leaveReportTarget)
            }}
          >
            {JOB_MODE_PRESS_WORDS.leaveReport}
          </button>
          <button
            type="button"
            style={
              rightButton.kind === 'last-job'
                ? { ...nextJobBtn, ...disabledBtnOverlay }
                : rightButton.kind === 'wrap-up'
                  ? wrapUpBtn
                  : rightButton.kind === 'manual-clock-in'
                    ? manualClockInBtn
                    : rightButton.kind === 'im-here'
                      ? imHereBtn
                      : nextJobBtn
            }
            disabled={rightButton.disabled || held}
            className={held ? 'keptPress' : undefined}
            title={held ? READING_AGAIN_WORDS : undefined}
            aria-label={rightButton.label.replace('\n', ' ')}
            onClick={() => void handleRightButton()}
          >
            {rightButton.label}
          </button>
          <button
            type="button"
            style={leaveDisabled ? { ...turnawayBtn, ...disabledBtnOverlay } : turnawayBtn}
            disabled={leaveDisabled || held}
            className={held ? 'keptPress' : undefined}
            title={held ? READING_AGAIN_WORDS : (leaveDisabledReason ?? undefined)}
            aria-label="Turnaway — client not home or site not ready"
            onClick={() => {
              if (!leaveReportTarget) return
              onTurnaway(leaveReportTarget)
            }}
          >
            {JOB_MODE_PRESS_WORDS.turnaway}
          </button>
        </div>
      )}
      {dayOnScreen && writeUpChangeDoor && writeUpChangeJobId ? (
        <button
          type="button"
          style={{ ...quietLink, color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          aria-label="Write up a change"
          title={held ? READING_AGAIN_WORDS : 'Write up a change on this job — extra work the customer asked for'}
          disabled={held}
          className={held ? 'keptPress' : undefined}
          onClick={() => setWriteUpChangeOpen(true)}
        >
          <WriteUpChangeGlyph size={16} />
          Write up a change
        </button>
      ) : null}
      {dayOnScreen && handPhoneDoor ? (
        <button
          type="button"
          style={{ ...quietLink, color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          aria-label="Hand the phone to the customer to sign"
          title={held ? READING_AGAIN_WORDS : handPhoneDoor.title}
          disabled={handPhoneBusy || held}
          className={held ? 'keptPress' : undefined}
          onClick={() => void handThePhone()}
          data-testid="job-mode-hand-phone"
        >
          <span aria-hidden>✍</span>
          {handPhoneBusy ? 'Opening the agreement…' : handPhoneDoor.label}
        </button>
      ) : null}
      {/* Materials on site (punch list #209): the one press to the tally's On site tab, on the clocked-in job or its picker. */}
      {dayOnScreen ? (
        <button
          type="button"
          style={{ ...quietLink, color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          aria-label="Materials on site"
          title="What is in the cages and boxes on this job, and what you used"
          onClick={() => navigate(`/tally?tab=on-site${leaveReportTarget ? `&job=${leaveReportTarget.id}` : ''}`)}
          data-testid="job-mode-materials-on-site"
        >
          <span aria-hidden>▦</span>
          Materials on site
        </button>
      ) : null}
      {!loading && leaveReportTarget && jobModeMessagesOffered(role) ? (
        <MessageCustomerDoor
          jobId={leaveReportTarget.id}
          jobName={leaveReportTarget.jobName === '—' ? null : leaveReportTarget.jobName}
          jobAddress={leaveReportTarget.jobAddress === '—' ? null : leaveReportTarget.jobAddress}
          userId={userId}
          me={profileName}
          style={{ ...quietLink, color: 'var(--text-link)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          onDone={() => setJobUpdatesRev((n) => n + 1)}
        />
      ) : null}
      {writeUpChangeOpen && writeUpChangeJobId ? (
        <QuickEstimateWizard open initialJobId={writeUpChangeJobId} onClose={() => setWriteUpChangeOpen(false)} />
      ) : null}
      {clockOutShown && !phone ? (
        <button
          type="button"
          style={quietClockOutBtn}
          aria-label="Clock out"
          title={held ? READING_AGAIN_WORDS : 'Clock out without switching jobs (lunch, leaving early)'}
          disabled={held}
          className={held ? 'keptPress' : undefined}
          onClick={() => requestClockOut()}
        >
          {JOB_MODE_PRESS_WORDS.clockOut}
        </button>
      ) : null}
      {pctJob ? (
        <FieldPctUpdateModal
          job={pctJob}
          onClose={() => setPctJob(null)}
          onSaved={() => setJobUpdatesRev((n) => n + 1)}
        />
      ) : null}
      {(() => {
        // Details for the clocked-in job, else the Ready-to-start next job.
        const detailsTarget =
          leaveReportTarget ??
          (picked.state === 'not-clocked-in-with-schedule' && picked.nextBlock
            ? {
                id: picked.nextBlock.job_id,
                jobAddress: safeTrim(picked.nextBlock.job_address),
              }
            : null)
        return detailsTarget ? (
          <JobModeDetailsSection
            key={detailsTarget.id}
            jobId={detailsTarget.id}
            jobAddress={detailsTarget.jobAddress === '—' ? '' : detailsTarget.jobAddress}
            updatesRev={jobUpdatesRev}
          />
        ) : null
      })()}
      {onMyWay ? (
        <OnMyWaySheet
          userId={userId}
          me={profileName}
          role={role}
          destinations={advanceDestinations}
          initialJobId={onMyWay.initialJobId ?? picked.nextBlock?.job_id ?? null}
          leaving={leavingLabel}
          canFinishDay={Boolean(openSession && canClockOut)}
          apply={applyUpdateFocusDirect}
          onFinishDay={() => {
            setOnMyWay(null)
            requestClockOut()
          }}
          io={onMyWayIo}
          onDone={() => setJobUpdatesRev((n) => n + 1)}
          onClose={() => setOnMyWay(null)}
        />
      ) : null}
      {imHere && openSession && leaveReportTarget ? (
        <ImHereSheet
          sessionId={openSession.id}
          jobId={leaveReportTarget.id}
          jobLabel={leavingLabel ?? leaveReportTarget.jobName}
          jobName={leaveReportTarget.jobName === '—' ? null : leaveReportTarget.jobName}
          jobAddress={leaveReportTarget.jobAddress === '—' ? null : leaveReportTarget.jobAddress}
          userId={userId}
          me={profileName}
          role={role}
          travelFacts={travelFacts}
          io={onMyWayIo}
          onDone={() => {
            setJobUpdatesRev((n) => n + 1)
            void reload()
          }}
          onClose={() => setImHere(false)}
        />
      ) : null}
      {pressBar ? (
        <JobModePressBar rows={pressBar} dayPressTone={rightButton.tone} noJobReason={leaveDisabledReason} onPress={handlePressBar} held={held} />
      ) : null}
    </div>
  )
}

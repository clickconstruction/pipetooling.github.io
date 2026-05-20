import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import { useUpdateFocusOpenerBridge } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import {
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import {
  pickCurrentAndNextScheduleBlock,
  type JobModeScheduleBlock,
} from '../../lib/jobModePickCurrentNext'
import JobModeAdvanceNotesModal from './JobModeAdvanceNotesModal'

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
}

type OpenSessionState = {
  id: string
  jobLedgerId: string | null
  bidId: string | null
} | null

type CurrentClockJobInfo = {
  id: string
  hcp_number: string | null
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
  background: 'white',
  border: '1px solid #d1d5db',
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
  color: '#1f2937',
  lineHeight: 1.1,
}

const headerName: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#1f2937',
  lineHeight: 1.2,
}

const headerAddr: CSSProperties = {
  fontSize: '0.875rem',
  color: '#4b5563',
  lineHeight: 1.2,
}

const headerStatusLine: CSSProperties = {
  fontSize: '0.8125rem',
  color: '#6b7280',
  marginTop: '0.15rem',
}

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
  background: '#2563eb',
  color: 'white',
}

const nextJobBtn: CSSProperties = {
  ...bigButtonBase,
  background: '#16a34a',
  color: 'white',
}

const disabledBtnOverlay: CSSProperties = {
  background: '#9ca3af',
  color: 'white',
  cursor: 'not-allowed',
}

const errorRow: CSSProperties = {
  fontSize: '0.8125rem',
  color: '#b91c1c',
  textAlign: 'center',
}

function safeTrim(s: string | null | undefined): string {
  return (s ?? '').trim()
}

export default function DashboardJobModeCard({ userId, onLeaveReport }: Props) {
  const { prefixMap } = useLedgerDisplayPrefixes()
  const { requestOpenUpdateFocus, applyUpdateFocusDirect } = useUpdateFocusOpenerBridge()

  const [workDateYmd, setWorkDateYmd] = useState<string>(() => denverCalendarDayKey(Date.now()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scheduleBlocks, setScheduleBlocks] = useState<JobModeScheduleBlock[]>([])
  const [openSession, setOpenSession] = useState<OpenSessionState>(null)
  const [currentJobInfo, setCurrentJobInfo] = useState<CurrentClockJobInfo | null>(null)
  const [currentBidInfo, setCurrentBidInfo] = useState<CurrentClockBidInfo | null>(null)

  const [advanceModalOpen, setAdvanceModalOpen] = useState(false)
  const [advanceSaving, setAdvanceSaving] = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)

  const reloadGenRef = useRef(0)

  const reload = useCallback(async () => {
    if (!userId) return
    const gen = ++reloadGenRef.current
    setLoading(true)
    setError(null)
    try {
      const today = denverCalendarDayKey(Date.now())
      setWorkDateYmd(today)

      const [blocksRaw, openRaw] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase
              .from('job_schedule_blocks')
              .select(
                'id, job_id, time_start, time_end, jobs_ledger(hcp_number, job_name, job_address, service_type_id)',
              )
              .eq('assignee_user_id', userId)
              .eq('work_date', today)
              .order('time_start', { ascending: true }),
          'job mode load schedule blocks',
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
          'job mode load open clock session',
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
          job_name: jl?.job_name ?? null,
          job_address: jl?.job_address ?? null,
          service_type_id: jl?.service_type_id ?? null,
        })
      }
      setScheduleBlocks(blocksList)

      const open = (openRaw ?? null) as
        | { id: string; job_ledger_id: string | null; bid_id: string | null }
        | null
      if (open) {
        setOpenSession({ id: open.id, jobLedgerId: open.job_ledger_id, bidId: open.bid_id })
      } else {
        setOpenSession(null)
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
                  .select('id, hcp_number, job_name, job_address, service_type_id')
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
      setError(formatErrorMessage(e, 'Could not load Job Mode data'))
    } finally {
      if (gen === reloadGenRef.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

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
      const today = denverCalendarDayKey(Date.now())
      if (today !== workDateYmd) void reload()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [workDateYmd, reload])

  const picked = useMemo(
    () =>
      pickCurrentAndNextScheduleBlock({
        blocks: scheduleBlocks,
        openSession: openSession
          ? { jobLedgerId: openSession.jobLedgerId, bidId: openSession.bidId }
          : null,
      }),
    [scheduleBlocks, openSession],
  )

  function jobNumberLabel(serviceTypeId: string | null, hcp: string | null): string {
    return formatJobLedgerNumberLabel(resolveJobLedgerPrefix(serviceTypeId, prefixMap), hcp)
  }

  function destinationLabelForNext(): string {
    const nb = picked.nextBlock
    if (!nb) return ''
    const num = jobNumberLabel(nb.service_type_id, nb.hcp_number)
    const name = safeTrim(nb.job_name) || '—'
    return `${num} · ${name}`
  }

  // Header content depends on state.
  function renderHeader() {
    // Clocked into a job that matches today's schedule.
    if (picked.currentBlock) {
      const cb = picked.currentBlock
      const num = jobNumberLabel(cb.service_type_id, cb.hcp_number)
      return (
        <div style={headerWrap}>
          <div style={headerNum}>{num}</div>
          <div style={headerName}>{safeTrim(cb.job_name) || '—'}</div>
          <div style={headerAddr}>{safeTrim(cb.job_address) || '—'}</div>
        </div>
      )
    }
    // Clocked on a job NOT on today's schedule.
    if (picked.state === 'on-off-schedule-job' && currentJobInfo) {
      const num = jobNumberLabel(currentJobInfo.service_type_id, currentJobInfo.hcp_number)
      return (
        <div style={headerWrap}>
          <div style={headerNum}>{num}</div>
          <div style={headerName}>{safeTrim(currentJobInfo.job_name) || '—'}</div>
          <div style={headerAddr}>{safeTrim(currentJobInfo.job_address) || '—'}</div>
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
      const num = jobNumberLabel(nb.service_type_id, nb.hcp_number)
      return (
        <div style={headerWrap}>
          <div style={headerStatusLine}>Ready to start</div>
          <div style={headerNum}>{num}</div>
          <div style={headerName}>{safeTrim(nb.job_name) || '—'}</div>
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

  // Decide whether Leave Report has a target job and what that target is.
  const leaveReportTarget: LeaveReportJobPick | null = (() => {
    if (picked.currentBlock) {
      const cb = picked.currentBlock
      return {
        id: cb.job_id,
        hcpNumber: safeTrim(cb.hcp_number) || '—',
        jobName: safeTrim(cb.job_name) || '—',
        jobAddress: safeTrim(cb.job_address) || '—',
      }
    }
    if (picked.state === 'on-off-schedule-job' && currentJobInfo) {
      return {
        id: currentJobInfo.id,
        hcpNumber: safeTrim(currentJobInfo.hcp_number) || '—',
        jobName: safeTrim(currentJobInfo.job_name) || '—',
        jobAddress: safeTrim(currentJobInfo.job_address) || '—',
      }
    }
    return null
  })()

  // Right button intent depends on state.
  type RightButton =
    | { kind: 'next'; intent: 'start-first' | 'next-job'; label: string }
    | { kind: 'open-update-focus'; label: string }
    | { kind: 'manual-clock-in'; label: string }
    | { kind: 'last-job'; label: string }

  const rightButton: RightButton = (() => {
    if (picked.state === 'no-clock-no-schedule') {
      return { kind: 'manual-clock-in', label: 'Clock In' }
    }
    if (picked.state === 'not-clocked-in-with-schedule' && picked.nextBlock) {
      return { kind: 'next', intent: 'start-first', label: 'Start First\nJob' }
    }
    if (picked.state === 'on-scheduled-job-not-last' && picked.nextBlock) {
      return { kind: 'next', intent: 'next-job', label: 'Next\nJob' }
    }
    if (picked.state === 'on-scheduled-job-last') {
      return { kind: 'last-job', label: 'Last job\nof the day' }
    }
    if (picked.state === 'on-off-schedule-job' && picked.nextBlock) {
      return { kind: 'next', intent: 'next-job', label: 'Switch to\nScheduled Job' }
    }
    if (picked.state === 'on-bid' && picked.nextBlock) {
      return { kind: 'next', intent: 'next-job', label: 'Start First\nScheduled Job' }
    }
    // No next block — let user open the regular Update Focus modal so they can search for a job.
    return { kind: 'open-update-focus', label: 'Choose Next\nJob' }
  })()

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
    if (rightButton.kind === 'last-job') {
      // No-op; the button is informational.
      return
    }
    setAdvanceError(null)
    setAdvanceModalOpen(true)
  }

  async function handleConfirmAdvance(notes: string) {
    if (rightButton.kind !== 'next' || !picked.nextBlock) return
    setAdvanceSaving(true)
    setAdvanceError(null)
    try {
      const res = await applyUpdateFocusDirect({
        jobLedgerId: picked.nextBlock.job_id,
        bidId: null,
        notes,
      })
      if (!res.ok) {
        setAdvanceError(res.error ?? 'Failed to switch focus')
      } else {
        setAdvanceModalOpen(false)
      }
    } finally {
      setAdvanceSaving(false)
    }
  }

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

  return (
    <div style={cardWrap}>
      {loading ? (
        <div style={{ ...headerStatusLine, textAlign: 'center' }}>Loading Job Mode…</div>
      ) : null}
      {!loading ? renderHeader() : null}
      {error ? <div style={errorRow}>{error}</div> : null}
      <div style={buttonRow}>
        <button
          type="button"
          style={leaveDisabled ? { ...leaveReportBtn, ...disabledBtnOverlay } : leaveReportBtn}
          disabled={leaveDisabled}
          title={leaveDisabledReason ?? undefined}
          aria-label="Leave Report"
          onClick={() => {
            if (!leaveReportTarget) return
            onLeaveReport(leaveReportTarget)
          }}
        >
          Leave{'\n'}Report
        </button>
        <button
          type="button"
          style={
            rightButton.kind === 'last-job'
              ? { ...nextJobBtn, ...disabledBtnOverlay }
              : nextJobBtn
          }
          disabled={rightButton.kind === 'last-job'}
          aria-label={rightButton.label.replace('\n', ' ')}
          onClick={() => void handleRightButton()}
        >
          {rightButton.label}
        </button>
      </div>
      <JobModeAdvanceNotesModal
        open={advanceModalOpen}
        destinationLabel={destinationLabelForNext()}
        intent={rightButton.kind === 'next' ? rightButton.intent : 'next-job'}
        saving={advanceSaving}
        errorMessage={advanceError}
        onConfirm={(notes) => void handleConfirmAdvance(notes)}
        onCancel={() => {
          if (advanceSaving) return
          setAdvanceModalOpen(false)
          setAdvanceError(null)
        }}
      />
    </div>
  )
}

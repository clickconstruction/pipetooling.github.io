/**
 * "It did not clock me in" — a person reports a day the clock missed (v2.4257). The day, when
 * they started and stopped, the job, what happened. It is written as their own clock session;
 * the typed-hours ledger stamps it as typed by them, and it waits for the office to approve.
 * The rules are in lib/clock/missedClockIn.ts; this draws them.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatJobLedgerShortLine } from '../../lib/ledgerDisplayPrefixes'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  calendarYmdInAppTzFromIso,
  formatDenverTimeOnly,
  formatWorkDateYmdWeekdayShortFriendly,
  getThisAndLastWeekRange,
  todayYmdInAppTz,
  ymdDaysBetween,
} from '../../utils/dateUtils'
import {
  missedClockInNotes,
  missedClockInProblem,
  missedDayOptions,
  missedSpan,
  missedSpanHours,
  type ExistingInterval,
} from '../../lib/clock/missedClockIn'
import { TYPED_PENCIL } from './TypedHoursStamp'

type OwnSession = {
  id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  job_ledger_id: string | null
  rejected_at: string | null
}
type JobChoice = { id: string; label: string; scheduled: boolean }

type Props = {
  userId: string
  onClose: () => void
  /** A report was sent: the host refreshes whatever shows this person's time. */
  onSaved?: () => void
}

const FIELD: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '0.5rem 0.6rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  fontSize: '1rem',
  boxSizing: 'border-box',
}
const LABEL: CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.25rem' }

export function MissedClockInModal({ userId, onClose, onSaved }: Props) {
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  const range = useMemo(() => getThisAndLastWeekRange(), [])
  const todayYmd = useMemo(() => todayYmdInAppTz(), [])
  const days = useMemo(() => missedDayOptions(range.start, todayYmd), [range.start, todayYmd])

  // Today to start: a forgotten day picker then fails loudly ("has not happened yet") instead of landing hours on the wrong day.
  const [workDate, setWorkDate] = useState(days[0]?.ymd ?? todayYmd)
  const [inTime, setInTime] = useState('')
  const [outTime, setOutTime] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [showProblem, setShowProblem] = useState(false)

  const [sessions, setSessions] = useState<OwnSession[] | null>(null)
  const [scheduledJobIdsByDay, setScheduledJobIdsByDay] = useState<Map<string, string[]>>(new Map())
  const [jobLabels, setJobLabels] = useState<Map<string, string>>(new Map())

  // The person's own clock time and schedule for the two weeks the form covers — what is already
  // on each day, and the jobs worth offering.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [own, blocks] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .select('id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, rejected_at')
                .eq('user_id', userId)
                .gte('work_date', range.start)
                .lte('work_date', range.end)
                .order('clocked_in_at', { ascending: true }),
            'load own clock sessions',
          ),
          withSupabaseRetry(
            async () =>
              supabase
                .from('job_schedule_blocks')
                .select('job_id, work_date')
                .eq('assignee_user_id', userId)
                .gte('work_date', range.start)
                .lte('work_date', range.end)
                .not('job_id', 'is', null),
            'load own schedule',
          ),
        ])
        if (cancelled) return
        const ownRows = ((own ?? []) as OwnSession[]).filter((s) => !s.rejected_at)
        const byDay = new Map<string, string[]>()
        for (const b of (blocks ?? []) as Array<{ job_id: string | null; work_date: string }>) {
          if (!b.job_id) continue
          const list = byDay.get(b.work_date) ?? []
          if (!list.includes(b.job_id)) list.push(b.job_id)
          byDay.set(b.work_date, list)
        }
        setSessions(ownRows)
        setScheduledJobIdsByDay(byDay)
        const ids = Array.from(new Set([...ownRows.map((s) => s.job_ledger_id), ...Array.from(byDay.values()).flat()].filter((x): x is string => !!x)))
        if (ids.length === 0) return
        const jobs = await withSupabaseRetry(
          async () => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, service_type_id').in('id', ids),
          'load job names',
        )
        if (cancelled) return
        const labels = new Map<string, string>()
        for (const j of (jobs ?? []) as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; service_type_id: string | null }>) {
          labels.set(j.id, formatJobLedgerShortLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.click_number))
        }
        setJobLabels(labels)
      } catch {
        // The form still works without them: no "already on this day" list and no job chips.
        if (!cancelled) setSessions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, range.start, range.end, prefixMap])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const daySessions = useMemo(() => (sessions ?? []).filter((s) => s.work_date === workDate), [sessions, workDate])
  // Overlap is checked against every session in the two weeks: a shift past midnight can run into the next day's punch.
  const existing: ExistingInterval[] = useMemo(
    () => (sessions ?? []).map((s) => ({ startMs: new Date(s.clocked_in_at).getTime(), endMs: s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : null })),
    [sessions],
  )
  const jobChoices: JobChoice[] = useMemo(() => {
    const scheduled = scheduledJobIdsByDay.get(workDate) ?? []
    const recent = Array.from(new Set((sessions ?? []).map((s) => s.job_ledger_id).filter((x): x is string => !!x))).filter((id) => !scheduled.includes(id))
    return [
      ...scheduled.map((id) => ({ id, label: jobLabels.get(id) ?? 'Scheduled job', scheduled: true })),
      ...recent.slice(-4).reverse().map((id) => ({ id, label: jobLabels.get(id) ?? 'A job you clocked on', scheduled: false })),
    ]
  }, [scheduledJobIdsByDay, workDate, sessions, jobLabels])

  // A job picked for one day is not carried to a day it was never offered on.
  useEffect(() => {
    if (jobId && !jobChoices.some((j) => j.id === jobId)) setJobId(null)
  }, [jobChoices, jobId])

  const span = useMemo(() => missedSpan(workDate, inTime, outTime), [workDate, inTime, outTime])
  const problem = missedClockInProblem({ span, reason, nowMs: Date.now(), existing })
  const hours = span ? missedSpanHours(span) : 0
  const lateDays = Math.max(0, ymdDaysBetween(workDate, calendarYmdInAppTzFromIso(new Date().toISOString())) ?? 0)

  async function send() {
    if (saving) return
    if (problem || !span) {
      setShowProblem(true)
      return
    }
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('clock_sessions').insert({
            user_id: userId,
            work_date: workDate,
            clocked_in_at: new Date(span.inMs).toISOString(),
            clocked_out_at: new Date(span.outMs).toISOString(),
            notes: missedClockInNotes(reason),
            job_ledger_id: jobId,
          }),
        'report a missed clock-in',
      )
      showToast(`Sent to the office — ${hours.toFixed(1)}h on ${formatWorkDateYmdWeekdayShortFriendly(workDate)}. It counts once someone approves it.`, 'success')
      onSaved?.()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not send it. Try again, or call the office.'), 'error')
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="It did not clock me in"
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          maxHeight: 'calc(100vh - 1.5rem - var(--app-bottom-chrome, 0px))',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 12,
          padding: '1rem',
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.125rem', lineHeight: 1.25 }}>It did not clock me in</h2>
        <p style={{ margin: '0.25rem 0 0.9rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Tell the office the hours the clock missed. They count once someone approves them.
        </p>

        <label style={LABEL} htmlFor="missed-clock-day">Which day</label>
        <select id="missed-clock-day" style={{ ...FIELD, marginBottom: '0.75rem' }} value={workDate} onChange={(e) => setWorkDate(e.target.value)}>
          {days.map((d) => (
            <option key={d.ymd} value={d.ymd}>
              {d.label}
            </option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <div>
            <label style={LABEL} htmlFor="missed-clock-in">Started</label>
            <input id="missed-clock-in" type="time" style={FIELD} value={inTime} onChange={(e) => setInTime(e.target.value)} />
          </div>
          <div>
            <label style={LABEL} htmlFor="missed-clock-out">Stopped</label>
            <input id="missed-clock-out" type="time" style={FIELD} value={outTime} onChange={(e) => setOutTime(e.target.value)} />
          </div>
        </div>

        <div data-testid="missed-clock-on-the-day" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
          {sessions == null ? (
            'Checking what the clock has for this day…'
          ) : daySessions.length === 0 ? (
            'The clock has nothing for this day.'
          ) : (
            <>
              The clock already has:{' '}
              {daySessions
                .map((s) => `${formatDenverTimeOnly(new Date(s.clocked_in_at).getTime())} – ${s.clocked_out_at ? formatDenverTimeOnly(new Date(s.clocked_out_at).getTime()) : 'still running'}`)
                .join(', ')}
              . Report only what it missed.
            </>
          )}
        </div>

        <div style={LABEL}>Which job</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {jobChoices.map((j) => (
            <button
              key={j.id}
              type="button"
              aria-pressed={jobId === j.id}
              onClick={() => setJobId(j.id)}
              title={j.scheduled ? 'On your schedule that day' : 'A job you clocked on lately'}
              style={{
                minHeight: 40,
                padding: '0.35rem 0.7rem',
                borderRadius: 999,
                border: `1px solid ${jobId === j.id ? 'var(--text-link)' : 'var(--border-strong)'}`,
                background: jobId === j.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: jobId === j.id ? 'var(--text-blue-800)' : 'var(--text-700)',
                fontSize: '0.875rem',
                fontWeight: jobId === j.id ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {j.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={jobId === null}
            onClick={() => setJobId(null)}
            style={{
              minHeight: 40,
              padding: '0.35rem 0.7rem',
              borderRadius: 999,
              border: `1px solid ${jobId === null ? 'var(--text-link)' : 'var(--border-strong)'}`,
              background: jobId === null ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: jobId === null ? 'var(--text-blue-800)' : 'var(--text-700)',
              fontSize: '0.875rem',
              fontWeight: jobId === null ? 600 : 500,
              cursor: 'pointer',
            }}
          >
            {jobChoices.length === 0 ? 'The office will set the job' : 'Another job — the office will set it'}
          </button>
        </div>

        <label style={LABEL} htmlFor="missed-clock-reason">What happened</label>
        <textarea
          id="missed-clock-reason"
          style={{ ...FIELD, minHeight: 72, resize: 'vertical', fontFamily: 'inherit', marginBottom: '0.6rem' }}
          placeholder="The app would not let me clock in"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {span ? (
          <div data-testid="missed-clock-summary" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem', fontSize: '0.9375rem' }}>
            <strong>{hours.toFixed(1)}h</strong>
            {span.endsNextDay ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>ends the next day</span> : null}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0 0.45rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 600,
                lineHeight: 1.6,
                background: 'var(--bg-blue-tint)',
                color: 'var(--text-blue-800)',
                border: '1px solid var(--border-blue)',
              }}
            >
              <span aria-hidden="true">{TYPED_PENCIL}</span>
              typed by you{lateDays > 0 ? `, ${lateDays} ${lateDays === 1 ? 'day' : 'days'} late` : ''} · no location
            </span>
          </div>
        ) : null}

        {showProblem && problem ? (
          <p role="alert" style={{ margin: '0 0 0.6rem', fontSize: '0.875rem', color: 'var(--text-red-600)' }}>
            {problem}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1, minHeight: 46, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.9375rem', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={saving}
            style={{ flex: 1.6, minHeight: 46, border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: '0.9375rem', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Sending…' : 'Send to the office'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  buildGcStatementRequestInsert,
  describePendingGcStatementSend,
  type PendingGcStatementSend,
} from '../../lib/gcStatementSchedule'
import {
  cancelGcStatementSend,
  listMyPendingGcStatementSends,
  scheduleGcStatementSend,
} from '../../lib/gcStatementEmailRequests'
import {
  formatWeekdays,
  groupStandingCopies,
  planStandingCopyEdit,
  chicagoYmdOf,
  type StandingCopyGroup,
} from '../../lib/gcStatementStandingCopies'
import { addDaysYmd, formatMinutes, parseHhMm } from '../../lib/emailSchedule/emailScheduleWeek'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { buildGcReviewRollup, type GcReviewGroup, type GcReviewGroupBy } from '../../lib/gcReviewRollup'
import {
  buildGcReviewShareAllEmailHtml,
  buildGcReviewShareAllEmailText,
  buildGcStatementEmailHtml,
  buildGcStatementEmailText,
  gcReviewShareAllEmailSubject,
  gcStatementEmailSubject,
} from '../../lib/jobsDocuments/gcStatementEmail'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'

/** Tomorrow's civil date in the company calendar zone, YYYY-MM-DD. */
function chicagoTomorrowYmd(): string {
  return addDaysYmd(chicagoYmdOf(new Date()), 1)
}

/** "Send now | Schedule…" controls shared by the Email… and Share-all dialogs (v2.1427). */
function ScheduleWhenControls({
  when,
  setWhen,
  sendDate,
  setSendDate,
  sendTime,
  setSendTime,
  repeatWeekly,
  setRepeatWeekly,
  disabled,
}: {
  when: 'now' | 'schedule'
  setWhen: (w: 'now' | 'schedule') => void
  sendDate: string
  setSendDate: (v: string) => void
  sendTime: string
  setSendTime: (v: string) => void
  repeatWeekly: boolean
  setRepeatWeekly: (v: boolean) => void
  disabled: boolean
}) {
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    background: active ? 'var(--bg-blue-tint)' : 'transparent',
    color: active ? 'var(--text-link)' : 'var(--text-muted)',
  })
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>When</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          role="group"
          aria-label="Send timing"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: '0.15rem', border: '1px solid var(--border)', borderRadius: 999 }}
        >
          <button type="button" disabled={disabled} onClick={() => setWhen('now')} aria-pressed={when === 'now'} style={pill(when === 'now')}>
            Send now
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setWhen('schedule')
              // Default to tomorrow 7 AM Central so "Schedule send" works
              // immediately (v2.1429 — an empty date read as a dead button).
              if (!sendDate) setSendDate(chicagoTomorrowYmd())
            }}
            aria-pressed={when === 'schedule'}
            style={pill(when === 'schedule')}
          >
            Schedule…
          </button>
        </span>
        {when === 'schedule' ? (
          <>
            <input
              type="date"
              value={sendDate}
              onChange={(e) => setSendDate(e.target.value)}
              disabled={disabled}
              aria-label="Send date"
              style={{ padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
            />
            <input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              disabled={disabled}
              aria-label="Send time (Central)"
              style={{ padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Central</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={repeatWeekly}
                onChange={() => setRepeatWeekly(!repeatWeekly)}
                disabled={disabled}
                style={{ margin: 0 }}
              />
              Repeat weekly
            </label>
          </>
        ) : null}
      </div>
      {when === 'schedule' ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          Scheduled sends rebuild the statement fresh at send time — a GC with nothing outstanding is skipped, never
          emailed an empty statement.
        </p>
      ) : null}
    </div>
  )
}

const gcShareMenuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.45rem 0.75rem',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  color: 'var(--text-gray-800)',
  textAlign: 'left',
  borderRadius: 4,
  whiteSpace: 'nowrap',
}

export type SendGcStatementPayload = {
  gcCustomerId: string | null
  gcName: string
  /** 'all' = the whole GC Review report in one email ("Share all", v2.1420). */
  groupBy: GcReviewGroupBy | 'all'
  toEmail: string
  subject: string
  emailHtml: string
  emailText: string
  total: number
  jobCount: number
}

type JobsGcReviewModalProps = {
  open: boolean
  onClose: () => void
  billedActiveRows: StageRow[]
  collectionsRows: StageRow[]
  /** Shell glue: build the statement HTML and open the print window (toast on popup block). */
  onPrint: (groups: GcReviewGroup[], groupBy: GcReviewGroupBy) => void
  /** Shell glue: copy the GC-facing statement (rich HTML + plain text) for pasting into an email (v2.1414). */
  onCopyForEmail: (group: GcReviewGroup, groupBy: GcReviewGroupBy) => void
  /** Shell transport for the Email… dialog: invoke send-gc-statement-email (v2.1416). */
  onSendStatement: (payload: SendGcStatementPayload) => Promise<{ ok: boolean; error?: string }>
  /** Prefill for the Email… dialog's To field (customers.contact_info email; '' when unknown). */
  emailForGc: (gcCustomerId: string) => string
  /** "Last sent" hints per GC customer id (ISO timestamps), loaded by the shell when the modal opens. */
  lastSentByGcId: Record<string, string>
  /** Office user roster for the Standing copies picker (v2.1431). */
  users: Array<{ id: string; name: string; email: string | null; role: string }>
  /** Standing copies management is dev-only. */
  isDev: boolean
}

/**
 * GC Review (v2.1181): Billed Awaiting Payment grouped by the job's GC — each
 * General Contractor's outstanding total and their customers' bill-out dates.
 * A "Group by" pill toggle re-runs the same rollup by the job's DEVELOPMENT
 * instead (shown only when a row has one). Same overlay pattern as the "by
 * Job Name" modal in JobsStagesTab; rollup math lives in the pure
 * gcReviewRollup kernel so the grand total reconciles with the section header
 * by construction.
 */
export function JobsGcReviewModal({
  open,
  onClose,
  billedActiveRows,
  collectionsRows,
  onPrint,
  onCopyForEmail,
  onSendStatement,
  emailForGc,
  lastSentByGcId,
  users,
  isDev,
}: JobsGcReviewModalProps) {
  const [includeCollections, setIncludeCollections] = useState(false)
  const [groupBy, setGroupBy] = useState<GcReviewGroupBy>('gc')
  /** Email… dialog state — one group at a time; To/Subject editable before Send. */
  const [emailDialogGroup, setEmailDialogGroup] = useState<GcReviewGroup | null>(null)
  const [emailDialogTo, setEmailDialogTo] = useState('')
  const [emailDialogSubject, setEmailDialogSubject] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  /** "Share all" dialog (v2.1420): print or email the whole report. */
  const [shareAllOpen, setShareAllOpen] = useState(false)
  const [shareAllTo, setShareAllTo] = useState('')
  const [shareAllSubject, setShareAllSubject] = useState('')
  const [shareAllSending, setShareAllSending] = useState(false)
  const [shareAllError, setShareAllError] = useState<string | null>(null)
  /** Per-GC "Share" dropdown (v2.1423) — the open group's key, one at a time. */
  const [shareMenuGroupKey, setShareMenuGroupKey] = useState<string | null>(null)
  /** Scheduling (v2.1427, gc_statement stream Phase 3): Send now vs Schedule… per dialog. */
  const { user: authUser } = useAuth()
  const [emailWhen, setEmailWhen] = useState<'now' | 'schedule'>('now')
  const [emailSendDate, setEmailSendDate] = useState('')
  const [emailSendTime, setEmailSendTime] = useState('07:00')
  const [emailRepeatWeekly, setEmailRepeatWeekly] = useState(false)
  const [shareAllWhen, setShareAllWhen] = useState<'now' | 'schedule'>('now')
  const [shareAllSendDate, setShareAllSendDate] = useState('')
  const [shareAllSendTime, setShareAllSendTime] = useState('07:00')
  const [shareAllRepeatWeekly, setShareAllRepeatWeekly] = useState(false)
  const [pendingSends, setPendingSends] = useState<PendingGcStatementSend[]>([])
  /** Standing copies form (v2.1431, dev-only): teammates + weekdays for recurring whole-report emails. */
  const [standingUserId, setStandingUserId] = useState('')
  const [standingOutsideEmail, setStandingOutsideEmail] = useState('')
  const [standingWeekdays, setStandingWeekdays] = useState<number[]>([])
  const [standingTimeHm, setStandingTimeHm] = useState('07:00')
  const [standingEditingEmail, setStandingEditingEmail] = useState<string | null>(null)
  const [standingBusy, setStandingBusy] = useState(false)
  const [standingError, setStandingError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listMyPendingGcStatementSends().then(
      (rows) => {
        if (!cancelled) setPendingSends(rows)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [open])
  const refreshPendingSends = () => {
    void listMyPendingGcStatementSends().then(setPendingSends, () => {})
  }
  const standingGroups = groupStandingCopies(pendingSends)
  const standingRowIds = new Set(standingGroups.flatMap((g) => g.allRowIds))
  /** Office-capable roster for the picker (mirrors the billed report's recipient cohort). */
  const standingPickableUsers = users
    .filter((u) => ['dev', 'master_technician', 'assistant', 'controller', 'primary'].includes(u.role) && (u.email ?? '').includes('@'))
    .sort((a, b) => a.name.localeCompare(b.name))
  const standingUserByEmail = (email: string) =>
    users.find((u) => (u.email ?? '').trim().toLowerCase() === email) ?? null
  const resetStandingForm = () => {
    setStandingUserId('')
    setStandingOutsideEmail('')
    setStandingWeekdays([])
    setStandingTimeHm('07:00')
    setStandingEditingEmail(null)
    setStandingError(null)
  }
  const applyStandingPlan = async (inserts: Parameters<typeof scheduleGcStatementSend>[0][], cancelIds: string[]) => {
    for (const id of cancelIds) await cancelGcStatementSend(id)
    for (const row of inserts) await scheduleGcStatementSend(row)
  }
  const submitStanding = () => {
    const picked = standingPickableUsers.find((u) => u.id === standingUserId)
    const email = (standingEditingEmail ?? picked?.email ?? standingOutsideEmail).trim().toLowerCase()
    const current = standingGroups.find((g) => g.email === email) ?? null
    const plan = planStandingCopyEdit({
      requestedBy: authUser?.id ?? '',
      email,
      byDevelopment,
      includeCollections,
      desiredWeekdays: standingWeekdays,
      desiredTimeHm: standingTimeHm,
      current,
    })
    if (!plan.ok) {
      setStandingError(plan.error)
      return
    }
    setStandingBusy(true)
    setStandingError(null)
    void applyStandingPlan(plan.inserts, plan.cancelIds).then(
      () => {
        setStandingBusy(false)
        resetStandingForm()
        refreshPendingSends()
      },
      (e: unknown) => {
        setStandingBusy(false)
        setStandingError(e instanceof Error ? e.message : 'Could not save — try again.')
      },
    )
  }
  const editStanding = (g: StandingCopyGroup) => {
    const u = standingUserByEmail(g.email)
    setStandingUserId(u?.id ?? '')
    setStandingOutsideEmail(u ? '' : g.email)
    setStandingWeekdays(g.weekdays)
    setStandingTimeHm(g.timeHm)
    setStandingEditingEmail(g.email)
    setStandingError(null)
  }
  const removeStanding = (g: StandingCopyGroup) => {
    setStandingBusy(true)
    void applyStandingPlan([], g.allRowIds).then(
      () => {
        setStandingBusy(false)
        if (standingEditingEmail === g.email) resetStandingForm()
        refreshPendingSends()
      },
      () => {
        setStandingBusy(false)
        refreshPendingSends()
      },
    )
  }
  const anyDevelopment = useMemo(
    () => [...billedActiveRows, ...collectionsRows].some((r) => r.job.development?.id),
    [billedActiveRows, collectionsRows],
  )
  const effectiveGroupBy: GcReviewGroupBy = anyDevelopment ? groupBy : 'gc'
  const byDevelopment = effectiveGroupBy === 'development'
  const rollup = useMemo(
    () => buildGcReviewRollup(billedActiveRows, collectionsRows, { includeCollections, groupBy: effectiveGroupBy }),
    [billedActiveRows, collectionsRows, includeCollections, effectiveGroupBy],
  )
  if (!open) return null
  const EntityIcon = byDevelopment ? DevelopmentHouseIcon : GcHardHatIcon
  const groupByPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    background: active ? 'var(--bg-blue-tint)' : 'transparent',
    color: active ? 'var(--text-link)' : 'var(--text-muted)',
  })
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={byDevelopment ? 'GC Review — Billed Awaiting Payment by Development' : 'GC Review — Billed Awaiting Payment by General Contractor'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 720,
          width: 'calc(100vw - 2rem)',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <EntityIcon size={18} style={{ color: 'var(--text-muted)' }} />
            GC Review
          </h2>
          {anyDevelopment ? (
            <span
              role="group"
              aria-label="Group rows by"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.15rem',
                padding: '0.15rem',
                border: '1px solid var(--border)',
                borderRadius: 999,
                flexShrink: 0,
              }}
            >
              <button type="button" onClick={() => setGroupBy('gc')} aria-pressed={!byDevelopment} style={groupByPillStyle(!byDevelopment)}>
                By GC
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('development')}
                aria-pressed={byDevelopment}
                style={groupByPillStyle(byDevelopment)}
              >
                By Development
              </button>
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {byDevelopment ? (
            <>Billed Awaiting Payment grouped by each job&rsquo;s development, with bill-out dates.</>
          ) : (
            <>Billed Awaiting Payment grouped by each job&rsquo;s GC/Builder, with bill-out dates.</>
          )}
        </p>
        {rollup.groups.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={() => {
                setShareAllOpen(true)
                setShareAllTo('')
                setShareAllSubject(
                  gcReviewShareAllEmailSubject(
                    effectiveGroupBy,
                    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                  ),
                )
                setShareAllError(null)
                setShareAllWhen('now')
                setShareAllRepeatWeekly(false)
              }}
              title="Print the whole report or email it from the app"
              aria-label="Share the whole GC Review report"
              style={{
                padding: '0.25rem 0.7rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-700)',
              }}
            >
              <span aria-hidden>⇪</span> Share all
            </button>
            <button
              type="button"
              onClick={() => onPrint(rollup.groups, effectiveGroupBy)}
              title={byDevelopment ? 'Print every development section as one report' : 'Print every GC section as one report'}
              style={{
                padding: '0.25rem 0.7rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-700)',
              }}
            >
              <span aria-hidden>🖨</span> Print all
            </button>
          </div>
        ) : null}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeCollections}
              onChange={() => setIncludeCollections((p) => !p)}
              style={{ margin: 0 }}
            />
            Include Collections ({rollup.collectionsCount} · ${formatCurrency(rollup.collectionsTotal)})
          </label>
        </div>
        {pendingSends.length > 0 ? (
          <div style={{ margin: '0 auto 1rem', maxWidth: 480, border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
            <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
              Scheduled statement sends
            </p>
            {/* Standing whole-report copies render grouped (one line per recipient, v2.1431). */}
            {standingGroups.map((g) => (
              <div key={`standing-${g.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.15rem 0' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {byDevelopment ? 'All developments' : 'All GCs'} → {standingUserByEmail(g.email)?.name ?? g.email}
                </span>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatWeekdays(g.weekdays)} · {formatMinutes(parseHhMm(g.timeHm) ?? 0)} · weekly
                </span>
                <button
                  type="button"
                  onClick={() => removeStanding(g)}
                  disabled={standingBusy}
                  title="Cancel this standing copy (all its weekdays)"
                  style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                >
                  Cancel
                </button>
              </div>
            ))}
            {pendingSends.filter((s) => !standingRowIds.has(s.id)).map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.15rem 0' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {describePendingGcStatementSend(s)}
                </span>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(s.send_at).toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {s.repeat_weekly ? ' · weekly' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void cancelGcStatementSend(s.id).then(refreshPendingSends, refreshPendingSends)
                  }}
                  title="Cancel this scheduled send (ends a weekly chain)"
                  style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {rollup.groups.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No billed jobs awaiting payment.</p>
        ) : (
          rollup.groups.map((g) => (
            <div key={g.key} style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  padding: '0.4rem 0.5rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  marginBottom: '0.35rem',
                }}
              >
                {g.isNoGc ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{g.gcName}</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <EntityIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {g.gcName}
                  </span>
                )}
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {g.jobCount} job{g.jobCount === 1 ? '' : 's'} · ${formatCurrency(g.subtotal)} outstanding
                  {g.oldestAgeDays != null ? ` · oldest ${g.oldestAgeDays}d` : ''}
                </span>
                {!g.isNoGc && g.gcId && lastSentByGcId[g.gcId] ? (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    last sent {new Date(lastSentByGcId[g.gcId]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                ) : null}
                {!g.isNoGc ? (
                  /* Share dropdown (v2.1423): Email… / Copy / Print for this GC in one menu. */
                  <div style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setShareMenuGroupKey((k) => (k === g.key ? null : g.key))}
                      title={`Share the ${g.gcName} statement — email, copy, or print`}
                      aria-label={`Share statement for ${g.gcName}`}
                      aria-haspopup="menu"
                      aria-expanded={shareMenuGroupKey === g.key}
                      style={{
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: shareMenuGroupKey === g.key ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        cursor: 'pointer',
                        color: shareMenuGroupKey === g.key ? 'var(--text-link)' : 'var(--text-700)',
                      }}
                    >
                      Share <span aria-hidden style={{ fontSize: '0.625rem' }}>▾</span>
                    </button>
                    {shareMenuGroupKey === g.key ? (
                      <>
                        <div onClick={() => setShareMenuGroupKey(null)} style={{ position: 'fixed', inset: 0, zIndex: 62 }} />
                        <div
                          role="menu"
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 'calc(100% + 4px)',
                            zIndex: 63,
                            minWidth: 150,
                            padding: '0.3rem',
                            background: 'var(--surface)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShareMenuGroupKey(null)
                              setEmailDialogGroup(g)
                              setEmailDialogTo(!byDevelopment && g.gcId ? emailForGc(g.gcId) : '')
                              setEmailDialogSubject(
                                gcStatementEmailSubject(g, new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })),
                              )
                              setEmailError(null)
                              setEmailWhen('now')
                              setEmailRepeatWeekly(false)
                            }}
                            title={`Email the ${g.gcName} statement from the app`}
                            style={gcShareMenuItemStyle}
                          >
                            Email…
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShareMenuGroupKey(null)
                              onCopyForEmail(g, effectiveGroupBy)
                            }}
                            title={`Copy the ${g.gcName} statement to paste into an email`}
                            style={gcShareMenuItemStyle}
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShareMenuGroupKey(null)
                              onPrint([g], effectiveGroupBy)
                            }}
                            title={`Print the ${g.gcName} statement`}
                            style={gcShareMenuItemStyle}
                          >
                            Print
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPrint([g], effectiveGroupBy)}
                    title={`Print the ${g.gcName} statement`}
                    aria-label={`Print statement for ${g.gcName}`}
                    style={{
                      marginLeft: 'auto',
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      color: 'var(--text-700)',
                    }}
                  >
                    <span aria-hidden>🖨</span>
                  </button>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Customer</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Job</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Billed on</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Days</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        {r.customerName}
                        {r.inCollections ? (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: '0.05rem 0.35rem',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              borderRadius: 4,
                              background: 'var(--bg-red-tint)',
                              color: 'var(--text-red-700)',
                            }}
                          >
                            Collections
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', color: 'var(--text-muted)' }}>
                        {r.hcp}
                        {r.jobName ? ` · ${r.jobName}` : ''}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', whiteSpace: 'nowrap' }}>{r.referenceDateDisplay}</td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.ageDays != null ? `${r.ageDays}d` : '—'}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(r.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            borderTop: '2px solid var(--border-strong)',
            paddingTop: '0.6rem',
            fontWeight: 600,
          }}
        >
          <span>Total</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(rollup.grandTotal)}</span>
        </div>
      </div>
      {emailDialogGroup ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Email statement to ${emailDialogGroup.gcName}`}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 61,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !emailSending) setEmailDialogGroup(null)
          }}
        >
          <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, minWidth: 340, maxWidth: 520, width: 'calc(100vw - 3rem)', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>Email statement to {emailDialogGroup.gcName}</h3>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>To</label>
            <input
              type="email"
              value={emailDialogTo}
              onChange={(e) => setEmailDialogTo(e.target.value)}
              placeholder="accounting@example.com"
              disabled={emailSending}
              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem' }}
            />
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>
              Subject{emailWhen === 'schedule' ? ' (scheduled sends use the standard subject)' : ''}
            </label>
            <input
              type="text"
              value={emailDialogSubject}
              onChange={(e) => setEmailDialogSubject(e.target.value)}
              disabled={emailSending || emailWhen === 'schedule'}
              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem', opacity: emailWhen === 'schedule' ? 0.6 : 1 }}
            />
            <ScheduleWhenControls
              when={emailWhen}
              setWhen={setEmailWhen}
              sendDate={emailSendDate}
              setSendDate={setEmailSendDate}
              sendTime={emailSendTime}
              setSendTime={setEmailSendTime}
              repeatWeekly={emailRepeatWeekly}
              setRepeatWeekly={setEmailRepeatWeekly}
              disabled={emailSending}
            />
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '0.5rem 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Statement preview — {emailDialogGroup.jobCount} job{emailDialogGroup.jobCount === 1 ? '' : 's'}, ${formatCurrency(emailDialogGroup.subtotal)} · job addresses, bill-sent dates and amounts owed. Sent from
              team@noreply.pipetooling.com with your email as reply-to.
            </div>
            {emailError ? (
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{emailError}</p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={emailSending}
                onClick={() => setEmailDialogGroup(null)}
                style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emailSending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDialogTo.trim())}
                onClick={() => {
                  const g = emailDialogGroup
                  if (emailWhen === 'schedule') {
                    const built = buildGcStatementRequestInsert({
                      requestedBy: authUser?.id ?? '',
                      toEmail: emailDialogTo,
                      byDevelopment,
                      entityId: g.gcId,
                      entityName: g.gcName,
                      includeCollections,
                      sendDateYmd: emailSendDate,
                      sendTimeHm: emailSendTime,
                      repeatWeekly: emailRepeatWeekly,
                    })
                    if (!built.ok) {
                      setEmailError(built.error)
                      return
                    }
                    setEmailSending(true)
                    setEmailError(null)
                    void scheduleGcStatementSend(built.row).then(
                      () => {
                        setEmailSending(false)
                        setEmailDialogGroup(null)
                        refreshPendingSends()
                      },
                      (e: unknown) => {
                        setEmailSending(false)
                        setEmailError(e instanceof Error ? e.message : 'Could not schedule — try again.')
                      },
                    )
                    return
                  }
                  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  setEmailSending(true)
                  setEmailError(null)
                  void onSendStatement({
                    gcCustomerId: byDevelopment ? null : g.gcId,
                    gcName: g.gcName,
                    groupBy: effectiveGroupBy,
                    toEmail: emailDialogTo.trim(),
                    subject: emailDialogSubject.trim() || gcStatementEmailSubject(g, dateStr),
                    emailHtml: buildGcStatementEmailHtml(g, { dateStr, groupBy: effectiveGroupBy }),
                    emailText: buildGcStatementEmailText(g, { dateStr }),
                    total: g.subtotal,
                    jobCount: g.jobCount,
                  }).then((res) => {
                    setEmailSending(false)
                    if (res.ok) {
                      setEmailDialogGroup(null)
                    } else {
                      setEmailError(res.error || 'Send failed — try again.')
                    }
                  })
                }}
                style={{
                  padding: '0.4rem 0.9rem',
                  border: 'none',
                  borderRadius: 4,
                  background: '#3b82f6',
                  color: 'white',
                  cursor: emailSending ? 'wait' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {emailSending ? (emailWhen === 'schedule' ? 'Scheduling…' : 'Sending…') : emailWhen === 'schedule' ? 'Schedule send' : 'Send statement'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {shareAllOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share the whole GC Review report"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 61,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !shareAllSending) setShareAllOpen(false)
          }}
        >
          <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, minWidth: 340, maxWidth: 520, width: 'calc(100vw - 3rem)', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Share the whole report</h3>
            <p style={{ margin: '0 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {rollup.groups.length} {byDevelopment ? 'development' : 'GC'} section{rollup.groups.length === 1 ? '' : 's'} ·{' '}
              ${formatCurrency(rollup.grandTotal)} outstanding
              {includeCollections ? ' (Collections included)' : ''}
            </p>
            <button
              type="button"
              disabled={shareAllSending}
              onClick={() => onPrint(rollup.groups, effectiveGroupBy)}
              title="Opens the print window — choose Save as PDF there to download a copy"
              style={{
                width: '100%',
                padding: '0.5rem 0.8rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-700)',
                fontWeight: 500,
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            >
              🖨 Print / save as PDF
            </button>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 600 }}>Email once</p>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>To — anyone, inside or outside the company</label>
              <input
                type="email"
                value={shareAllTo}
                onChange={(e) => setShareAllTo(e.target.value)}
                placeholder="name@example.com"
                disabled={shareAllSending}
                style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem' }}
              />
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                Subject{shareAllWhen === 'schedule' ? ' (scheduled sends use the standard subject)' : ''}
              </label>
              <input
                type="text"
                value={shareAllSubject}
                onChange={(e) => setShareAllSubject(e.target.value)}
                disabled={shareAllSending || shareAllWhen === 'schedule'}
                style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem', opacity: shareAllWhen === 'schedule' ? 0.6 : 1 }}
              />
              <ScheduleWhenControls
                when={shareAllWhen}
                setWhen={setShareAllWhen}
                sendDate={shareAllSendDate}
                setSendDate={setShareAllSendDate}
                sendTime={shareAllSendTime}
                setSendTime={setShareAllSendTime}
                repeatWeekly={shareAllRepeatWeekly}
                setRepeatWeekly={setShareAllRepeatWeekly}
                disabled={shareAllSending}
              />
              <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '0.5rem 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Every section above as one email — job addresses, bill-sent dates, amounts owed, and the grand total. Sent
                from team@noreply.pipetooling.com with your email as reply-to.
              </div>
              {shareAllError ? (
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{shareAllError}</p>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={shareAllSending}
                  onClick={() => setShareAllOpen(false)}
                  style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={shareAllSending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareAllTo.trim())}
                  onClick={() => {
                    if (shareAllWhen === 'schedule') {
                      const built = buildGcStatementRequestInsert({
                        requestedBy: authUser?.id ?? '',
                        toEmail: shareAllTo,
                        byDevelopment,
                        entityId: null,
                        entityName: byDevelopment ? 'All developments' : 'All GCs',
                        includeCollections,
                        sendDateYmd: shareAllSendDate,
                        sendTimeHm: shareAllSendTime,
                        repeatWeekly: shareAllRepeatWeekly,
                      })
                      if (!built.ok) {
                        setShareAllError(built.error)
                        return
                      }
                      setShareAllSending(true)
                      setShareAllError(null)
                      void scheduleGcStatementSend(built.row).then(
                        () => {
                          setShareAllSending(false)
                          setShareAllOpen(false)
                          refreshPendingSends()
                        },
                        (e: unknown) => {
                          setShareAllSending(false)
                          setShareAllError(e instanceof Error ? e.message : 'Could not schedule — try again.')
                        },
                      )
                      return
                    }
                    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    const report = { groups: rollup.groups, grandTotal: rollup.grandTotal }
                    setShareAllSending(true)
                    setShareAllError(null)
                    void onSendStatement({
                      gcCustomerId: null,
                      gcName: byDevelopment ? 'All developments' : 'All GCs',
                      groupBy: 'all',
                      toEmail: shareAllTo.trim(),
                      subject: shareAllSubject.trim() || gcReviewShareAllEmailSubject(effectiveGroupBy, dateStr),
                      emailHtml: buildGcReviewShareAllEmailHtml(report, { dateStr, groupBy: effectiveGroupBy }),
                      emailText: buildGcReviewShareAllEmailText(report, { dateStr, groupBy: effectiveGroupBy }),
                      total: rollup.grandTotal,
                      jobCount: rollup.groups.reduce((s, g) => s + g.jobCount, 0),
                    }).then((res) => {
                      setShareAllSending(false)
                      if (res.ok) {
                        setShareAllOpen(false)
                      } else {
                        setShareAllError(res.error || 'Send failed — try again.')
                      }
                    })
                  }}
                  style={{
                    padding: '0.4rem 0.9rem',
                    border: 'none',
                    borderRadius: 4,
                    background: '#3b82f6',
                    color: 'white',
                    cursor: shareAllSending ? 'wait' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {shareAllSending ? (shareAllWhen === 'schedule' ? 'Scheduling…' : 'Sending…') : shareAllWhen === 'schedule' ? 'Schedule send' : 'Send report'}
                </button>
              </div>
            </div>
            {isDev ? (
              /* Standing copies (v2.1431): teammates + weekdays for recurring
                 whole-report emails. One repeat_weekly chain per weekday under
                 the hood — grouped here by recipient. Dev-only. */
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', marginTop: '0.85rem' }}>
                <p style={{ margin: '0 0 0.15rem', fontSize: '0.8125rem', fontWeight: 600 }}>Standing copies</p>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Send this report to teammates on the weekdays you pick — rebuilt fresh each send.
                </p>
                {standingGroups.map((g) => {
                  const u = standingUserByEmail(g.email)
                  return (
                    <div
                      key={g.email}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', marginBottom: '0.4rem' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u?.name ?? g.email}
                          <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {u ? u.role.replace('_', ' ') : 'outside'}</span>
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {formatWeekdays(g.weekdays)} — {formatMinutes(parseHhMm(g.timeHm) ?? 0)} Central
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => editStanding(g)}
                        disabled={standingBusy}
                        style={{ padding: '0.15rem 0.55rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStanding(g)}
                        disabled={standingBusy}
                        aria-label={`Remove standing copy for ${u?.name ?? g.email}`}
                        style={{ padding: '0.15rem 0.55rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-red-700)' }}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
                <div style={{ background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.6rem 0.7rem' }}>
                  {standingEditingEmail ? (
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Editing {standingUserByEmail(standingEditingEmail)?.name ?? standingEditingEmail}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select
                        value={standingUserId}
                        onChange={(e) => {
                          setStandingUserId(e.target.value)
                          if (e.target.value) setStandingOutsideEmail('')
                        }}
                        disabled={standingBusy}
                        aria-label="Add a person"
                        style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                      >
                        <option value="">Add a person…</option>
                        {standingPickableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} — {u.role.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <input
                        type="email"
                        value={standingOutsideEmail}
                        onChange={(e) => {
                          setStandingOutsideEmail(e.target.value)
                          if (e.target.value) setStandingUserId('')
                        }}
                        placeholder="or outside email"
                        disabled={standingBusy}
                        style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 2 }}>Days</span>
                    {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                      const active = standingWeekdays.includes(dow)
                      return (
                        <button
                          key={dow}
                          type="button"
                          disabled={standingBusy}
                          aria-pressed={active}
                          onClick={() =>
                            setStandingWeekdays((prev) => (prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]))}
                          style={{
                            width: 38,
                            padding: '0.2rem 0',
                            fontSize: '0.75rem',
                            fontWeight: active ? 600 : 400,
                            border: active ? '1px solid transparent' : '1px solid var(--border)',
                            borderRadius: 999,
                            background: active ? 'var(--bg-blue-tint)' : 'transparent',
                            color: active ? 'var(--text-link)' : 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]}
                        </button>
                      )
                    })}
                    <input
                      type="time"
                      value={standingTimeHm}
                      onChange={(e) => setStandingTimeHm(e.target.value)}
                      disabled={standingBusy}
                      aria-label="Send time (Central)"
                      style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                    />
                    <button
                      type="button"
                      onClick={submitStanding}
                      disabled={standingBusy || (!standingEditingEmail && !standingUserId && !standingOutsideEmail.trim())}
                      style={{ marginLeft: 'auto', padding: '0.25rem 0.7rem', fontSize: '0.8125rem', fontWeight: 500, border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: standingBusy ? 'wait' : 'pointer' }}
                    >
                      {standingBusy ? 'Saving…' : standingEditingEmail ? 'Save' : 'Add'}
                    </button>
                    {standingEditingEmail ? (
                      <button
                        type="button"
                        onClick={resetStandingForm}
                        disabled={standingBusy}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                  {standingError ? (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{standingError}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

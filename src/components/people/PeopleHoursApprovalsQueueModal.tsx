import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AssignSessionJobPopover } from '../clock-sessions'
import { approveClockSessions } from '../../lib/approveClockSessions'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { shortJobOrBidLabelFromEmbeds } from '../../types/clockSessions'
import type { ClockSessionRow } from '../../types/clockSessions'
import { denverCalendarDayKey, formatDenverTimeOnly } from '../../utils/dateUtils'
import { formatHoursShort } from '../../lib/myTeamApprovals'
import { fetchAllPendingClockSessions, PENDING_APPROVALS_FETCH_CAP } from '../../lib/people/fetchAllPendingClockSessions'
import {
  buildApprovalsQueue,
  describeApproveOutcome,
  formatFlagCounts,
  withoutSessionIds,
  type ApprovalsQueueFlagCounts,
  type ApprovalsQueuePerson,
  type ApprovalsQueueSession,
  type ApprovalsQueueWeek,
} from '../../lib/people/approvalsQueue'

type Props = {
  onClose: () => void
  /** Sessions changed (approve / reject / job) — the parent reloads its week-scoped lists. */
  onChanged: () => void
  /** Opens the parent's full clock-session editor (times / split). */
  onEditSession: (session: ClockSessionRow) => void
  authUserId: string | undefined
  /** Bump to refetch (e.g. after the parent's edit modal saves). */
  reloadKey: number
}

const BTN: CSSProperties = {
  padding: '0.2rem 0.55rem',
  fontSize: '0.78125rem',
  fontWeight: 600,
  borderRadius: 4,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const BTN_APPROVE: CSSProperties = { ...BTN, border: '1px solid #22c55e', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }
const BTN_REJECT: CSSProperties = { ...BTN, border: '1px solid #dc2626', background: 'var(--bg-red-tint)', color: 'var(--text-red-600)' }
const BTN_QUIET: CSSProperties = { ...BTN, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 500 }
const FLAG_CHIP: CSSProperties = {
  fontSize: '0.71875rem',
  fontWeight: 700,
  color: 'var(--text-amber-800)',
  background: 'var(--bg-amber-tint)',
  border: '1px solid #f59e0b',
  borderRadius: 999,
  padding: '0 0.4rem',
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
}

function dayLabel(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '')
}

function FlagSummary({ counts, prefix }: { counts: ApprovalsQueueFlagCounts; prefix?: string }) {
  const text = formatFlagCounts(counts)
  if (!text) return null
  return (
    <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
      {prefix ? `${prefix} ` : ''}⚠ {text}
    </span>
  )
}

export function PeopleHoursApprovalsQueueModal({ onClose, onChanged, onEditSession, authUserId, reloadKey }: Props) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const prefixMap = useLedgerPrefixMap()
  const [rows, setRows] = useState<ClockSessionRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [collapsedPeople, setCollapsedPeople] = useState<Set<string>>(() => new Set())
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    try {
      setLoadError(null)
      const data = await fetchAllPendingClockSessions()
      setRows(data)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load pending sessions')
      setRows((prev) => prev ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const todayYmd = denverCalendarDayKey(Date.now())
  const fullQueue = useMemo(() => buildApprovalsQueue(rows ?? [], { todayYmd }), [rows, todayYmd])
  const queue = useMemo(() => {
    if (!flaggedOnly) return fullQueue
    const flaggedIds = new Set<string>()
    for (const p of fullQueue.people) for (const w of p.weeks) for (const s of w.sessions) if (s.flagged) flaggedIds.add(s.id)
    return buildApprovalsQueue((rows ?? []).filter((r) => flaggedIds.has(r.id)), { todayYmd })
  }, [flaggedOnly, fullQueue, rows, todayYmd])

  const removeLocally = useCallback((ids: string[]) => {
    setRows((prev) => (prev ? withoutSessionIds(prev, ids) : prev))
  }, [])

  async function approve(ids: string[], what: string, hours: number, confirmBulk: boolean): Promise<void> {
    if (busy || ids.length === 0) return
    if (confirmBulk) {
      const ok = await confirmDialog({
        message: `Approve ${ids.length} session${ids.length === 1 ? '' : 's'} · ${formatHoursShort(hours)} for ${what}? This adds the hours to payroll.`,
        confirmLabel: `Approve ${ids.length}`,
      })
      if (!ok) return
    }
    setBusy(true)
    const { data, error } = await approveClockSessions(ids)
    setBusy(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    const row = ((data ?? []) as Array<{ approved_count: number; error_message: string | null }>)[0]
    if (row?.error_message) {
      showToast(row.error_message, 'error')
      return
    }
    const approved = row?.approved_count ?? ids.length
    const outcome = describeApproveOutcome(ids.length, approved)
    showToast(outcome.message, outcome.variant)
    if (approved >= ids.length) removeLocally(ids)
    else await load()
    onChanged()
  }

  async function reject(s: ClockSessionRow): Promise<void> {
    if (busy) return
    const ok = await confirmDialog({
      message: `Reject ${s.users?.name?.trim() || 'this'} · ${dayLabel(s.work_date)} · ${formatHoursShort(hoursOf(s))}? Rejected time never reaches payroll.`,
      confirmLabel: 'Reject',
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase
      .from('clock_sessions')
      .update({ rejected_at: new Date().toISOString(), rejected_by: authUserId ?? null })
      .eq('id', s.id)
    setBusy(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Session rejected', 'success')
    removeLocally([s.id])
    onChanged()
  }

  function hoursOf(s: ClockSessionRow): number {
    if (!s.clocked_out_at) return 0
    return (new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 3_600_000
  }

  function togglePerson(userId: string) {
    setCollapsedPeople((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function toggleWeek(key: string) {
    setOpenWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const loading = rows == null
  const capped = (rows?.length ?? 0) >= PENDING_APPROVALS_FETCH_CAP

  function renderSession(s: ApprovalsQueueSession<ClockSessionRow>) {
    const r = s.row
    const inMs = new Date(r.clocked_in_at).getTime()
    const outMs = r.clocked_out_at ? new Date(r.clocked_out_at).getTime() : inMs
    const jobLabel = shortJobOrBidLabelFromEmbeds(r, prefixMap)
    const note = (r.notes ?? '').trim()
    return (
      <div
        key={s.id}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '0.35rem 0.75rem',
          alignItems: 'center',
          padding: '0.4rem 0.6rem 0.4rem 1.6rem',
          borderTop: '1px solid var(--border)',
          background: s.flagged ? 'var(--bg-amber-tint)' : 'transparent',
          fontSize: '0.8125rem',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{dayLabel(s.workDate)}</span>
          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {formatDenverTimeOnly(inMs)} – {formatDenverTimeOnly(outMs)}
          </span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatHoursShort(s.hours)}</span>
          {s.flags.long ? (
            <span style={FLAG_CHIP} title="Longer than 12 hours — a forgotten clock-out looks exactly like this. Check before approving.">
              ⚠ long day
            </span>
          ) : null}
          {s.flags.tiny ? (
            <span style={FLAG_CHIP} title="Under a minute — almost always a double-tap. Reject it, or Edit the times if it was real.">
              ⚠ near-zero
            </span>
          ) : null}
          {s.flags.noJob ? (
            <span style={FLAG_CHIP} title="No job or bid — the hours get paid but no job carries the labor. Assign one first.">
              ⚠ no job
            </span>
          ) : null}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
            <span style={{ color: jobLabel ? 'var(--text-700)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '18rem' }} title={jobLabel ?? undefined}>
              {jobLabel ?? 'No job/bid'}
            </span>
            <AssignSessionJobPopover
              session={r}
              onSaved={() => {
                showToast('Job assigned', 'success')
                void load()
                onChanged()
              }}
              onError={(msg) => showToast(msg, 'error')}
              popoverZIndex={1250}
              compactTrigger
              dispatchScheduleAssigneeUserId={r.user_id}
              dispatchScheduleWorkDateYmd={r.work_date}
            />
          </span>
          {note ? (
            <span
              style={{ color: 'var(--text-muted)', fontStyle: 'italic', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
              title={note}
            >
              “{note}”
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'nowrap' }}>
          <button type="button" style={BTN_APPROVE} disabled={busy} onClick={() => void approve([s.id], s.row.users?.name?.trim() || 'this person', s.hours, false)}>
            Approve
          </button>
          <button type="button" style={BTN_REJECT} disabled={busy} onClick={() => void reject(r)}>
            Reject
          </button>
          <button type="button" style={BTN_QUIET} disabled={busy} onClick={() => onEditSession(r)}>
            Edit
          </button>
        </div>
      </div>
    )
  }

  function renderWeek(p: ApprovalsQueuePerson<ClockSessionRow>, w: ApprovalsQueueWeek<ClockSessionRow>) {
    const key = `${p.userId}|${w.weekStart}`
    const open = openWeeks.has(key)
    const flagText = formatFlagCounts(w.flagCounts)
    return (
      <div key={key} style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => toggleWeek(key)}
            aria-expanded={open}
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--text-strong)',
              fontSize: '0.8125rem',
            }}
          >
            <span aria-hidden style={{ color: 'var(--text-muted)', width: '0.8rem', display: 'inline-block' }}>{open ? '▾' : '▸'}</span>
            <span style={{ fontWeight: 600 }}>Week of {w.label}</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {w.count} session{w.count === 1 ? '' : 's'} · {formatHoursShort(w.hours)}
            </span>
            {flagText ? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>⚠ {flagText}</span> : null}
          </button>
          <button
            type="button"
            style={BTN_APPROVE}
            disabled={busy || w.count === 0}
            onClick={() => void approve(w.sessionIds, `${p.name} · week of ${w.label}`, w.hours, true)}
          >
            Approve week · {w.count}
          </button>
        </div>
        {open ? w.sessions.map(renderSession) : null}
      </div>
    )
  }

  function renderPerson(p: ApprovalsQueuePerson<ClockSessionRow>) {
    const collapsed = collapsedPeople.has(p.userId)
    return (
      <section key={p.userId} style={{ flexShrink: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', padding: '0.5rem 0.6rem', background: 'var(--bg-subtle)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => togglePerson(p.userId)}
            aria-expanded={!collapsed}
            style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '0.5rem', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}
          >
            <span aria-hidden style={{ color: 'var(--text-muted)', width: '0.8rem', display: 'inline-block', alignSelf: 'center' }}>{collapsed ? '▸' : '▾'}</span>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>{p.name}</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {p.count} session{p.count === 1 ? '' : 's'} · {formatHoursShort(p.hours)} · {p.weeks.length} week{p.weeks.length === 1 ? '' : 's'} · oldest {dayLabel(p.oldestWorkDate)}
              {p.oldestAgeDays >= 7 ? ` (${p.oldestAgeDays}d)` : ''}
            </span>
            <FlagSummary counts={p.flagCounts} />
          </button>
          <button type="button" style={BTN_APPROVE} disabled={busy || p.count === 0} onClick={() => void approve(p.sessionIds, p.name, p.hours, true)}>
            Approve all {p.count} · {formatHoursShort(p.hours)}
          </button>
        </div>
        {collapsed ? null : p.weeks.map((w) => renderWeek(p, w))}
      </section>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hours approvals, every week"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '0.9rem 1rem',
          width: 'min(960px, 96vw)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem', lineHeight: 1.2 }}>Hours approvals · every week</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {loading ? (
                'Loading every pending session…'
              ) : fullQueue.count === 0 ? (
                'Nothing waiting — every closed session is approved or rejected.'
              ) : (
                <>
                  <strong style={{ color: 'var(--text-strong)' }}>{fullQueue.count}</strong> session{fullQueue.count === 1 ? '' : 's'} ·{' '}
                  <strong style={{ color: 'var(--text-strong)' }}>{fullQueue.peopleCount}</strong> {fullQueue.peopleCount === 1 ? 'person' : 'people'} ·{' '}
                  <strong style={{ color: 'var(--text-strong)' }}>{formatHoursShort(fullQueue.hours)}</strong> not yet in payroll · oldest{' '}
                  {fullQueue.oldestAgeDays === 0 ? 'today' : `${fullQueue.oldestAgeDays} day${fullQueue.oldestAgeDays === 1 ? '' : 's'} ago`}
                  {formatFlagCounts(fullQueue.flagCounts) ? (
                    <>
                      {' '}
                      · <FlagSummary counts={fullQueue.flagCounts} />
                    </>
                  ) : null}
                  {capped ? ` · showing the first ${PENDING_APPROVALS_FETCH_CAP}` : ''}
                </>
              )}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: 'var(--text-muted)', padding: '0 0.15rem' }}>
            ×
          </button>
        </div>

        {loadError ? (
          <p role="alert" style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
            {loadError}
          </p>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-700)', cursor: 'pointer' }}>
            <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
            Flagged only
          </label>
          <span style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>People lead with the oldest stall. Open a week to see its sessions.</span>
          <button
            type="button"
            disabled={busy || loading || queue.count === 0}
            onClick={() => void approve(queue.sessionIds, flaggedOnly ? 'every flagged session' : 'everyone', queue.hours, true)}
            style={{
              marginLeft: 'auto',
              padding: '0.4rem 0.9rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid #15803d',
              background: busy || loading || queue.count === 0 ? '#86efac' : '#22c55e',
              color: 'white',
              borderRadius: 4,
              cursor: busy || loading || queue.count === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Approving…' : `Approve ${flaggedOnly ? 'flagged' : 'everything'} · ${queue.count} · ${formatHoursShort(queue.hours)}`}
          </button>
        </div>

        <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.1rem' }}>
          {!loading && queue.count === 0 && fullQueue.count > 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No flagged sessions — everything left looks ordinary.</p>
          ) : null}
          {queue.people.map(renderPerson)}
        </div>
      </div>
    </div>
  )
}

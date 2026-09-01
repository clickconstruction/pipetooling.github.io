import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { denverWorkDateToday } from '../../lib/salaryScheduleSync'
import { salaryZonedWallClockToUtcMs } from '../../lib/salaryZonedWallClock'
import {
  cancelCrewDaySend,
  fetchCrewDayPreview,
  isCrewDayEmailRecipientRole,
  listMyPendingCrewDaySends,
  openHtmlInNewTab,
  scheduleCrewDaySend,
  sendCrewDayNow,
  sendCrewDayTest,
  type ScheduledCrewDaySend,
} from '../../lib/crewDayEmailClient'

/**
 * ✉ on the Dashboard Crew Day card (v2.2603): email the day's crew rollup —
 * now or at a scheduled time, optionally weekly (a 6:00 PM weekday chain is
 * five rows). A verbatim sibling of MoneyWaitingShareModal; the same
 * five-piece Report Subscriptions stream shape (docs/REPORT_SUBSCRIPTIONS.md).
 *
 * Each email is rebuilt for the RECIPIENT's own scope at send time —
 * superintendents get their assigned projects' crews, office roles the whole
 * company. Hours only, never wages.
 */

type RecipientUser = { id: string; name: string; role: string | null; email: string | null }

export default function CrewDayEmailModal({ onClose }: { onClose: () => void }) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<RecipientUser[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [when, setWhen] = useState<'now' | 'schedule'>('now')
  const [sendDate, setSendDate] = useState('')
  const [sendTime, setSendTime] = useState('18:00')
  const [repeatWeekly, setRepeatWeekly] = useState(false)

  const [busy, setBusy] = useState<'send' | 'preview' | 'test' | null>(null)
  const [pending, setPending] = useState<ScheduledCrewDaySend[]>([])

  const loadPending = useCallback(async () => {
    try {
      setPending(await listMyPendingCrewDaySends())
    } catch {
      // Fail-soft: the list is informational; sends still work without it
      // (e.g. before the migration is pushed).
      setPending([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          () =>
            supabase
              .from('users')
              .select('id, name, role, email, archived_at')
              .is('archived_at', null)
              .order('name'),
          'crew day recipients',
        )
        if (cancelled) return
        setUsers(
          ((rows ?? []) as Array<RecipientUser & { archived_at: string | null }>)
            .filter((u) => isCrewDayEmailRecipientRole(u.role))
            .map((u) => ({ id: u.id, name: (u.name ?? '').trim() || 'Unknown', role: u.role, email: u.email })),
        )
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Could not load people'), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    void loadPending()
    // Default schedule date: today (it's an end-of-day email), Central calendar.
    setSendDate(denverWorkDateToday())
    return () => {
      cancelled = true
    }
  }, [showToast, loadPending])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
  }, [users, search])

  const selected = users.find((u) => u.id === selectedId) ?? null
  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])

  /** The schedule inputs as a UTC instant (Chicago wall clock). Null = invalid. */
  function scheduledInstantIso(): string | null {
    const hm = /^(\d{1,2}):(\d{2})$/.exec(sendTime.trim())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sendDate) || !hm) return null
    const ms = salaryZonedWallClockToUtcMs(sendDate, Number(hm[1]), Number(hm[2]), 0, APP_CALENDAR_TZ)
    if (ms == null || !Number.isFinite(ms)) return null
    if (ms <= Date.now()) return null
    return new Date(ms).toISOString()
  }

  async function handleSend() {
    if (!selected || busy) return
    setBusy('send')
    try {
      if (when === 'now') {
        await sendCrewDayNow(selected.id)
        showToast(`Crew Day emailed to ${selected.name}.`, 'success')
      } else {
        const iso = scheduledInstantIso()
        if (!iso) {
          showToast('Pick a future date and time (Central).', 'error')
          return
        }
        if (!authUser?.id) return
        await scheduleCrewDaySend({ requestedBy: authUser.id, recipientUserId: selected.id, sendAtIso: iso, repeatWeekly })
        showToast(
          repeatWeekly
            ? `Scheduled for ${formatSendAt(iso)}, repeating weekly — cancel the pending send to stop the chain.`
            : `Scheduled for ${formatSendAt(iso)} — sent within ~5 minutes of that time.`,
          'success',
        )
        await loadPending()
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Send failed'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handlePreview() {
    if (busy) return
    setBusy('preview')
    try {
      openHtmlInNewTab(await fetchCrewDayPreview())
    } catch (e) {
      showToast(formatErrorMessage(e, 'Preview failed'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleTest() {
    if (busy) return
    setBusy('test')
    try {
      await sendCrewDayTest()
      showToast('Test email sent to your address.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Test send failed'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleCancelPending(id: string) {
    try {
      await cancelCrewDaySend(id)
      await loadPending()
      showToast('Scheduled send cancelled.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not cancel'), 'error')
    }
  }

  function formatSendAt(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: APP_CALENDAR_TZ,
    })
  }

  const actionBtn = (disabled: boolean): CSSProperties => ({
    height: 32,
    padding: '0 0.75rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    background: disabled ? 'var(--bg-muted)' : 'var(--surface)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'var(--text-700)',
    fontSize: '0.8125rem',
    fontWeight: 500,
  })

  const sendDisabled = busy !== null || !selected || (when === 'schedule' && scheduledInstantIso() == null)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Email Crew Day"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(560px, calc(100vw - 2rem))', maxHeight: '85vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Email Crew Day</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Emails the day's crew rollup, grouped by job — hours, report excerpts, and flags. Built fresh at send time
          for what the recipient is allowed to see; an evening send with Repeat weekly makes it a standing digest.
        </p>

        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Send to</h3>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people…"
          aria-label="Search people to send Crew Day to"
          style={{ width: '100%', boxSizing: 'border-box', height: 36, padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', fontSize: '0.875rem', marginBottom: '0.5rem' }}
        />
        {loading ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }} role="status">Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: '0.75rem', maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '0.35rem' }}>
            {filtered.map((u) => {
              const sel = u.id === selectedId
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedId(sel ? null : u.id)}
                  aria-pressed={sel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    padding: '5px 8px',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: sel ? 'var(--bg-blue-tint)' : 'transparent',
                    color: 'inherit',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sel ? '✓ ' : ''}
                    {u.name}
                    {u.email ? <span style={{ color: 'var(--text-muted)' }}> · {u.email}</span> : null}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 9999, background: 'var(--bg-muted)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {u.role === 'master_technician' ? 'Master' : (u.role ?? '—').charAt(0).toUpperCase() + (u.role ?? '—').slice(1)}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '4px 8px' }}>No matching people.</p>
            )}
          </div>
        )}

        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>When</h3>
        <div style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
          {(['now', 'schedule'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWhen(w)}
              aria-pressed={when === w}
              style={{
                border: 'none',
                padding: '7px 14px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: when === w ? '#2563eb' : 'var(--surface)',
                color: when === w ? '#fff' : 'var(--text-muted)',
                fontWeight: when === w ? 600 : 400,
              }}
            >
              {w === 'now' ? 'Send now' : 'Schedule…'}
            </button>
          ))}
        </div>
        {when === 'schedule' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={sendDate}
              onChange={(e) => setSendDate(e.target.value)}
              aria-label="Send date"
              style={{ height: 32, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'inherit' }}
            />
            <input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              aria-label="Send time (Central)"
              style={{ height: 32, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'inherit' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Central time · sent within ~5 min · the email covers the send's day</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)} />
              Repeat weekly
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sendDisabled}
            style={{
              height: 34,
              padding: '0 1rem',
              border: 'none',
              borderRadius: 4,
              background: sendDisabled ? 'var(--bg-muted)' : '#2563eb',
              color: sendDisabled ? 'var(--text-muted)' : '#fff',
              cursor: sendDisabled ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {busy === 'send' ? 'Sending…' : when === 'now' ? 'Send email' : 'Schedule send'}
          </button>
          <button type="button" onClick={() => void handlePreview()} disabled={busy !== null} style={actionBtn(busy !== null)}>
            {busy === 'preview' ? 'Building…' : 'Preview'}
          </button>
          <button type="button" onClick={() => void handleTest()} disabled={busy !== null} style={actionBtn(busy !== null)}>
            {busy === 'test' ? 'Sending…' : 'Email me a test'}
          </button>
        </div>

        {pending.length > 0 && (
          <>
            <h3 style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.9375rem' }}>Scheduled sends</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pending.map((r) => (
                <div
                  key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: '0.8125rem' }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    → <strong>{userNameById.get(r.recipient_user_id) ?? 'Teammate'}</strong> · {formatSendAt(r.send_at)}
                    {r.repeat_weekly ? <span style={{ color: 'var(--text-blue-800)', fontWeight: 600 }}> · weekly</span> : null}
                    {r.error ? <span style={{ color: 'var(--text-red-600)' }}> · retrying ({r.error.slice(0, 60)})</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCancelPending(r.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-red-600)', fontSize: '0.75rem', fontWeight: 600, padding: 2 }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

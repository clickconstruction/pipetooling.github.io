import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS,
  APP_SETTINGS_KEY_PAYMENT_MADE_EMAIL_RECIPIENTS,
  APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS,
} from '../../lib/appSettingsKeys'
import { parsePaidJobEmailRecipients, serializePaidJobEmailRecipients } from '../../lib/paidJobEmail'
import { cancelBilledReportSend } from '../../lib/billedReportEmailClient'
import { cancelGcStatementSend } from '../../lib/gcStatementEmailRequests'
import { cancelWeeklyMovementSend } from '../../lib/weeklyMovementEmailRequests'
import { cancelWeeklyMoneySend } from '../../lib/weeklyMoneyEmailRequests'
import { formatMinutes, parseHhMm } from '../../lib/emailSchedule/emailScheduleWeek'
import { emailStreamCardId, type EmailStreamKey } from '../../lib/emailLogStreamLink'

/**
 * Settings → Email & notifications (v2.1321, dev-only): every recurring and
 * scheduled email stream in one panel — cadence, recipients, pending one-off
 * sends. Editing philosophy: REMOVE and PAUSE here (each chip's × runs the
 * same one-line write that stream's own manager does); CREATE lives on each
 * stream's home surface, linked per card — this panel must never become a
 * second implementation of five features.
 *
 * schedule-day rows render without × — no dev UPDATE/DELETE policy exists on
 * schedule_day_email_requests (recipient-own updates only).
 */

type GlobalEmailSchedule = {
  report_schedules: Array<{
    id: string
    name: string
    enabled: boolean
    time_local: string
    days_of_week: number[]
    timezone: string
    recipients: Array<{ row_id: string; user_id: string; name: string; include_costs: boolean }>
  }>
  paid_recipients: Array<{ user_id: string; name: string }>
  payment_recipients: Array<{ user_id: string; name: string }>
  /** Ready to Bill stream (v2.1836) — optional so either deploy order of client vs migration degrades gracefully. */
  ready_to_bill_recipients?: Array<{ user_id: string; name: string }>
  billed_requests: Array<{ id: string; recipient_name: string; requested_by_name: string | null; send_at: string; repeat_weekly?: boolean }>
  schedule_day_requests: Array<{ id: string; recipient_name: string; send_at: string; work_date: string }>
  // The RPC has returned these three since their streams shipped (v2.1428/38/49);
  // the panel just never rendered them until v2.1755.
  gc_statement_requests?: Array<{ id: string; entity_name: string | null; sent_to: string; requested_by_name: string | null; send_at: string; repeat_weekly?: boolean }>
  weekly_movement_requests?: Array<{ id: string; recipient_name: string; requested_by_name: string | null; send_at: string; repeat_weekly?: boolean }>
  weekly_money_requests?: Array<{ id: string; recipient_name: string; requested_by_name: string | null; send_at: string; repeat_weekly?: boolean }>
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function cadenceLabel(days: number[], timeLocal: string): string {
  const sorted = [...days].sort((a, b) => a - b)
  const isWeekdays = sorted.join(',') === '1,2,3,4,5'
  const dayPart = isWeekdays
    ? 'Mon–Fri'
    : sorted.length === 7
      ? 'Every day'
      : sorted.map((d) => DAY_SHORT[d] ?? '?').join(', ')
  const minutes = parseHhMm(timeLocal)
  return `${dayPart} · ${minutes == null ? timeLocal : formatMinutes(minutes)}`
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

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 24,
  padding: '0 4px 0 10px',
  borderRadius: 9999,
  background: 'var(--bg-muted)',
  color: 'var(--text-700)',
  fontSize: '0.75rem',
  fontWeight: 600,
}

function RecipientChip({ label, extra, onRemove, removeLabel }: { label: string; extra?: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span style={chipStyle}>
      {label}
      {extra}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${label}`}
          style={{ width: 16, height: 16, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
        >
          ×
        </button>
      ) : (
        <span style={{ width: 6 }} />
      )}
    </span>
  )
}

function StreamCard({ title, cadence, right, children, manage, id, flash, count, noun, open, onToggle }: {
  title: string
  cadence: string
  right?: ReactNode
  children: ReactNode
  manage: string
  id?: string
  flash?: boolean
  /** Entries behind the disclosure; 0 renders `children` (the empty-state text) directly, no pill. */
  count: number
  /** Singular noun for the pill — "subscriber" for standing lists, "scheduled send" for one-off queues. */
  noun: string
  open: boolean
  onToggle: () => void
}) {
  const empty = count === 0
  return (
    <div
      id={id}
      style={{
        border: `1px solid ${flash ? 'var(--border-amber-soft)' : 'var(--border)'}`,
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
        background: flash ? 'var(--bg-amber-tint)' : undefined,
        transition: 'background 400ms, border-color 400ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-subtle)', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-strong)' }}>{title}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cadence}</span>
        <span style={{ marginLeft: 'auto' }}>{right}</span>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {empty ? (
            children
          ) : (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={`${open ? 'Hide' : 'Show'} the ${count} ${noun}${count === 1 ? '' : 's'} for ${title}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 26,
                padding: '0 10px',
                borderRadius: 9999,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text-700)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {count} {noun}
              {count === 1 ? '' : 's'} {open ? '▴' : '▾'}
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{manage}</span>
        </div>
        {!empty && open ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</div> : null}
      </div>
    </div>
  )
}

export default function SettingsEmailStreamsSection({ focus }: {
  /** A clicked email-log row's stream — scroll its card into view and flash it (v2.1754). */
  focus?: { key: EmailStreamKey; nonce: number } | null
}) {
  const { showToast } = useToastContext()
  const [data, setData] = useState<GlobalEmailSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState<EmailStreamKey | null>(null)
  // Which cards' subscriber lists are expanded (v2.1755) — keyed by card id.
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({})
  const toggleCard = (key: string) => setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }))

  // Runs after the async RPC data renders the cards; re-fires per click (nonce).
  useEffect(() => {
    if (!focus || !data) return
    const el = document.getElementById(emailStreamCardId(focus.key))
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlashKey(focus.key)
    // Landing from a log row also opens the card's list — the whole point is
    // seeing who got the email.
    setOpenCards((prev) => ({ ...prev, [focus.key]: true }))
    const t = window.setTimeout(() => setFlashKey(null), 2600)
    return () => window.clearTimeout(t)
  }, [focus, data])

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc('get_global_email_schedule')
    if (e) setError(e.message)
    else if (d == null) setError('Dev role required.')
    else {
      setData(d as unknown as GlobalEmailSchedule)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleSchedule(id: string, enabled: boolean) {
    const { error: e } = await supabase.from('recurring_job_report_schedules').update({ enabled }).eq('id', id)
    if (e) showToast(formatErrorMessage(e, 'Could not update schedule'), 'error')
    else {
      showToast(enabled ? 'Schedule resumed.' : 'Schedule paused.', 'success')
      await load()
    }
  }

  async function removeScheduleRecipient(rowId: string, name: string) {
    const { error: e } = await supabase.from('recurring_job_report_schedule_recipients').delete().eq('id', rowId)
    if (e) showToast(formatErrorMessage(e, 'Could not remove recipient'), 'error')
    else {
      showToast(`${name} removed from the digest.`, 'success')
      await load()
    }
  }

  async function removeSettingRecipient(key: string, userId: string, name: string) {
    // Read-modify-write of the same JSON list the stream's gear modal manages.
    const { data: row, error: readErr } = await supabase.from('app_settings').select('value_text').eq('key', key).maybeSingle()
    if (readErr) {
      showToast(formatErrorMessage(readErr, 'Could not load recipients'), 'error')
      return
    }
    const ids = parsePaidJobEmailRecipients((row as { value_text: string | null } | null)?.value_text).filter((id) => id !== userId)
    const { error: e } = await supabase
      .from('app_settings')
      .upsert({ key, value_text: serializePaidJobEmailRecipients(ids) }, { onConflict: 'key' })
    if (e) showToast(formatErrorMessage(e, 'Could not remove recipient'), 'error')
    else {
      showToast(`${name} removed.`, 'success')
      await load()
    }
  }

  async function cancelBilled(id: string, name: string) {
    await cancelRequest(() => cancelBilledReportSend(id), name)
  }

  /** Shared cancel flow for the one-off request streams (dev DELETE policy on each table). */
  async function cancelRequest(run: () => Promise<void>, name: string) {
    try {
      await run()
      showToast(`Scheduled send to ${name} cancelled.`, 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not cancel'), 'error')
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }} role="status">Loading…</p>
  if (error) return <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem' }}>{error}</p>
  if (!data) return null

  const toggle = (enabled: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 34,
        height: 19,
        borderRadius: 9999,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        background: enabled ? '#16a34a' : 'var(--bg-200)',
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{ position: 'absolute', top: 2, left: enabled ? 17 : 2, width: 15, height: 15, borderRadius: 9999, background: 'var(--surface)', transition: 'left 120ms' }}
      />
    </button>
  )

  const none = <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>No recipients — nothing sends.</span>

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 12px' }}>
        Every recurring and scheduled email stream. Tap a count to see who's subscribed; each name's × removes them
        (the same write each stream's own manager does); pausing a digest keeps its setup. Creating and editing
        schedules stays on each stream's home surface.
      </p>

      {data.report_schedules.map((s, i) => (
        <StreamCard
          key={s.id}
          id={i === 0 ? emailStreamCardId('digest') : undefined}
          flash={flashKey === 'digest' && i === 0}
          count={s.recipients.length}
          noun="subscriber"
          open={!!openCards[i === 0 ? 'digest' : `digest:${s.id}`]}
          onToggle={() => toggleCard(i === 0 ? 'digest' : `digest:${s.id}`)}
          title={`Job report digest — "${s.name}"`}
          cadence={cadenceLabel(s.days_of_week, s.time_local)}
          right={toggle(s.enabled, () => void toggleSchedule(s.id, !s.enabled), `${s.enabled ? 'Pause' : 'Resume'} ${s.name}`)}
          manage="edit schedule & filters → Jobs → Reports"
        >
          {s.recipients.length === 0
            ? none
            : s.recipients.map((r) => (
                <RecipientChip
                  key={r.row_id}
                  label={r.name}
                  extra={r.include_costs ? (
                    <span style={{ fontSize: '0.62rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 9999, padding: '0 5px' }}>costs</span>
                  ) : undefined}
                  onRemove={() => void removeScheduleRecipient(r.row_id, r.name)}
                  removeLabel={`Remove ${r.name} from ${s.name}`}
                />
              ))}
        </StreamCard>
      ))}

      <StreamCard
        id={emailStreamCardId('paid')}
        flash={flashKey === 'paid'}
        count={data.paid_recipients.length}
        noun="subscriber"
        open={!!openCards['paid']}
        onToggle={() => toggleCard('paid')}
        title="Paid in Full notifications"
        cadence="event — job reaches Paid in Full"
        manage="full manager → Jobs → Pipeline ⚙ Paid In Full notifications"
      >
        {data.paid_recipients.length === 0
          ? none
          : data.paid_recipients.map((r) => (
              <RecipientChip key={r.user_id} label={r.name} onRemove={() => void removeSettingRecipient(APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS, r.user_id, r.name)} />
            ))}
      </StreamCard>

      <StreamCard
        id={emailStreamCardId('payment')}
        flash={flashKey === 'payment'}
        count={data.payment_recipients.length}
        noun="subscriber"
        open={!!openCards['payment']}
        onToggle={() => toggleCard('payment')}
        title="Payment received notifications"
        cadence="event — any payment on any job"
        manage="full manager → Jobs → Pipeline ⚙ Paid notifications"
      >
        {data.payment_recipients.length === 0
          ? none
          : data.payment_recipients.map((r) => (
              <RecipientChip key={r.user_id} label={r.name} onRemove={() => void removeSettingRecipient(APP_SETTINGS_KEY_PAYMENT_MADE_EMAIL_RECIPIENTS, r.user_id, r.name)} />
            ))}
      </StreamCard>

      <StreamCard
        id={emailStreamCardId('ready_to_bill')}
        flash={flashKey === 'ready_to_bill'}
        count={(data.ready_to_bill_recipients ?? []).length}
        noun="subscriber"
        open={!!openCards['ready_to_bill']}
        onToggle={() => toggleCard('ready_to_bill')}
        title="Ready to Bill notifications"
        cadence="event — job moves to Ready to Bill (email + push)"
        manage="full manager → Jobs → Pipeline ⚙ Ready to Bill notifications"
      >
        {(data.ready_to_bill_recipients ?? []).length === 0
          ? none
          : (data.ready_to_bill_recipients ?? []).map((r) => (
              <RecipientChip key={r.user_id} label={r.name} onRemove={() => void removeSettingRecipient(APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS, r.user_id, r.name)} />
            ))}
      </StreamCard>

      <StreamCard
        id={emailStreamCardId('billed')}
        flash={flashKey === 'billed'}
        count={data.billed_requests.length}
        noun="scheduled send"
        open={!!openCards['billed']}
        onToggle={() => toggleCard('billed')}
        title="Billed Awaiting Payment report"
        cadence="one-off scheduled sends"
        manage="schedule more → Jobs → Pipeline ⇪ Share / Print"
      >
        {data.billed_requests.length === 0
          ? <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Nothing scheduled.</span>
          : data.billed_requests.map((r) => (
              <RecipientChip
                key={r.id}
                label={`→ ${r.recipient_name} · ${formatSendAt(r.send_at)}${r.repeat_weekly ? ' · weekly' : ''}`}
                onRemove={() => void cancelBilled(r.id, r.recipient_name)}
                removeLabel={`Cancel the scheduled send to ${r.recipient_name}`}
              />
            ))}
      </StreamCard>

      <StreamCard
        id={emailStreamCardId('weekly_movement')}
        flash={flashKey === 'weekly_movement'}
        count={(data.weekly_movement_requests ?? []).length}
        noun="scheduled send"
        open={!!openCards['weekly_movement']}
        onToggle={() => toggleCard('weekly_movement')}
        title="Weekly movement report"
        cadence="one-off scheduled sends"
        manage="schedule more → Jobs → Reports → Weekly movement"
      >
        {(data.weekly_movement_requests ?? []).length === 0
          ? <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Nothing scheduled.</span>
          : (data.weekly_movement_requests ?? []).map((r) => (
              <RecipientChip
                key={r.id}
                label={`→ ${r.recipient_name} · ${formatSendAt(r.send_at)}${r.repeat_weekly ? ' · weekly' : ''}`}
                onRemove={() => void cancelRequest(() => cancelWeeklyMovementSend(r.id), r.recipient_name)}
                removeLabel={`Cancel the scheduled weekly movement send to ${r.recipient_name}`}
              />
            ))}
      </StreamCard>

      <StreamCard
        id={emailStreamCardId('weekly_money')}
        flash={flashKey === 'weekly_money'}
        count={(data.weekly_money_requests ?? []).length}
        noun="scheduled send"
        open={!!openCards['weekly_money']}
        onToggle={() => toggleCard('weekly_money')}
        title="Weekly money movement report"
        cadence="one-off scheduled sends — dev/controller only"
        manage="schedule more → Jobs → Reports → Weekly money"
      >
        {(data.weekly_money_requests ?? []).length === 0
          ? <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Nothing scheduled.</span>
          : (data.weekly_money_requests ?? []).map((r) => (
              <RecipientChip
                key={r.id}
                label={`→ ${r.recipient_name} · ${formatSendAt(r.send_at)}${r.repeat_weekly ? ' · weekly' : ''}`}
                onRemove={() => void cancelRequest(() => cancelWeeklyMoneySend(r.id), r.recipient_name)}
                removeLabel={`Cancel the scheduled weekly money send to ${r.recipient_name}`}
              />
            ))}
      </StreamCard>

      <StreamCard
        id={emailStreamCardId('gc_statement')}
        flash={flashKey === 'gc_statement'}
        count={(data.gc_statement_requests ?? []).length}
        noun="scheduled send"
        open={!!openCards['gc_statement']}
        onToggle={() => toggleCard('gc_statement')}
        title="GC statements (open balances)"
        cadence="one-off scheduled sends — can go to outside inboxes"
        manage="schedule more → Jobs → Reports → GC review"
      >
        {(data.gc_statement_requests ?? []).length === 0
          ? <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Nothing scheduled.</span>
          : (data.gc_statement_requests ?? []).map((r) => (
              <RecipientChip
                key={r.id}
                label={`${(r.entity_name ?? '').trim() || 'Statement'} → ${r.sent_to} · ${formatSendAt(r.send_at)}${r.repeat_weekly ? ' · weekly' : ''}`}
                onRemove={() => void cancelRequest(() => cancelGcStatementSend(r.id), r.sent_to)}
                removeLabel={`Cancel the scheduled statement to ${r.sent_to}`}
              />
            ))}
      </StreamCard>

      <StreamCard
        id={emailStreamCardId('schedule_day')}
        flash={flashKey === 'schedule_day'}
        count={data.schedule_day_requests.length}
        noun="scheduled send"
        open={!!openCards['schedule_day']}
        onToggle={() => toggleCard('schedule_day')}
        title="Dispatch-day schedule emails"
        cadence="one-off queued per person"
        manage="queue more → Dashboard → Clock strip → Email schedule"
      >
        {data.schedule_day_requests.length === 0
          ? <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>Nothing queued.</span>
          : data.schedule_day_requests.map((r) => (
              <RecipientChip key={r.id} label={`→ ${r.recipient_name} · ${formatSendAt(r.send_at)}`} />
            ))}
      </StreamCard>
    </div>
  )
}

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { denverWorkDateToday } from '../../lib/salaryScheduleSync'
import {
  buildMyEmailWeekGrid,
  normalizeMyEmailSubscriptions,
  type MyEmailSchedulePayload,
  type PlacedOneOff,
  type WeekGridEntry,
} from '../../lib/emailSchedule/emailScheduleWeek'

/**
 * Settings → Your account → "My email schedule" (v2.1321): everything the app
 * is configured to email YOU — weekly report digests on their weekday/time
 * slots, pending one-off sends addressed to you, and the event-driven streams
 * you're on. Read-only; each stream links to where it's managed. Data comes
 * from the self-scoped get_my_email_schedule() RPC (the recipient can't read
 * some sources directly — e.g. billed-report requests are sender-readable).
 */

const ENTRY_TONES: Record<WeekGridEntry['stream'], { background: string; color: string }> = {
  report_digest: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' },
  billed_report: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  schedule_day: { background: 'var(--bg-violet-100)', color: 'var(--text-violet-800)' },
  gc_statement: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  weekly_movement: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' },
  weekly_money: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  payment_forecast: { background: 'var(--bg-sky-tint)', color: 'var(--text-sky-800)' },
  money_waiting: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
}

/** Chicago {ymd, minutes} for a send_at instant (Intl — kept out of the pure kernel). */
function chicagoPlacement(sendAtIso: string): { ymd: string; minutes: number } | null {
  const d = new Date(sendAtIso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const ymd = `${get('year')}-${get('month')}-${get('day')}`
  const hour = Number(get('hour')) % 24
  return { ymd, minutes: hour * 60 + Number(get('minute')) }
}

export default function SettingsMyEmailScheduleSection() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<MyEmailSchedulePayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || payload || error) return
    let cancelled = false
    void (async () => {
      const { data, error: rpcErr } = await supabase.rpc('get_my_email_schedule')
      if (cancelled) return
      if (rpcErr) setError(rpcErr.message)
      else setPayload(data as unknown as MyEmailSchedulePayload)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, payload, error])

  const todayYmd = denverWorkDateToday()
  const grid = useMemo(() => {
    if (!payload) return null
    const placed: PlacedOneOff[] = []
    for (const o of payload.one_offs) {
      const p = chicagoPlacement(o.send_at)
      if (p) placed.push({ stream: o.stream, detail: o.detail, ymd: p.ymd, minutes: p.minutes, sent: o.sent_at != null, weekly: o.repeat_weekly === true })
    }
    return buildMyEmailWeekGrid(payload, placed, todayYmd)
  }, [payload, todayYmd])

  const dayCell: CSSProperties = {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    minHeight: 96,
    padding: 8,
    minWidth: 0,
  }

  return (
    <section style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          margin: 0,
          padding: '1rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text-strong)',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.75rem' }} aria-hidden>
          {open ? '▼' : '▶'}
        </span>
        My email schedule
      </button>
      {open && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0.75rem 0' }}>
            Emails ClickTooling sends <strong>you</strong>, week by week. Central time.
          </p>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }} role="status">
              Loading…
            </p>
          ) : error ? (
            <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem' }}>{error}</p>
          ) : grid && payload ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))',
                  gap: 8,
                }}
              >
                {grid.map((day) => (
                  <div key={day.ymd} style={{ ...dayCell, borderColor: day.isToday ? '#2563eb' : 'var(--border)' }}>
                    <h4
                      style={{
                        margin: '0 0 6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: day.isToday ? 'var(--text-blue-800)' : 'var(--text-faint)',
                      }}
                    >
                      {day.label}
                      {day.isToday ? ' · today' : ''}
                    </h4>
                    {day.entries.map((e, i) => (
                      <div
                        key={`${e.stream}-${i}`}
                        style={{
                          ...ENTRY_TONES[e.stream],
                          borderRadius: 5,
                          padding: '5px 7px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          marginBottom: 5,
                          lineHeight: 1.3,
                          opacity: e.muted ? 0.5 : 1,
                        }}
                      >
                        <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, opacity: 0.85 }}>
                          {e.sent ? '✓ ' : ''}
                          {e.timeLabel}
                          {e.sent ? ' · sent' : ''}
                          {!e.sent && e.weekly && e.stream !== 'report_digest' ? ' · weekly' : ''}
                        </span>
                        {e.label}
                        {e.detail ? (
                          <span style={{ display: 'block', fontWeight: 400, opacity: 0.8 }}>{e.detail}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <h3 style={{ margin: '16px 0 4px', fontSize: '0.9rem', color: 'var(--text-700)' }}>
                My email subscriptions
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 6px' }}>
                Every event-driven email stream in the app, and whether you're on it.
              </p>
              {(() => {
                const subs = normalizeMyEmailSubscriptions(payload)
                return (
                  <>
                    <SubscriptionRow
                      dot="#16a34a"
                      subscribed={subs.paidInFull}
                      name="Paid in Full"
                      trigger="when any job reaches Paid in Full"
                      managedFrom="Jobs → Pipeline"
                    />
                    <SubscriptionRow
                      dot="#d97706"
                      subscribed={subs.paymentReceived}
                      name="Payment received"
                      trigger="whenever a payment lands on any job"
                      managedFrom="Jobs → Pipeline"
                    />
                    <SubscriptionRow
                      dot="#2563eb"
                      subscribed={subs.readyToBill}
                      name="Ready to Bill"
                      trigger="when a job moves to Ready to Bill (email + push)"
                      managedFrom="Jobs → Pipeline"
                    />
                    <SubscriptionRow
                      dot="#7c3aed"
                      subscribed={subs.estimateAcceptedAlways}
                      name="Estimate accepted"
                      trigger="every customer acceptance"
                      managedFrom="Estimates → ⚙ notify settings"
                    />
                    {subs.estimateSpecificTotal > 0 && (
                      <SubscriptionRow
                        dot="#7c3aed"
                        subscribed
                        name={`Estimate accepted — ${subs.estimateSpecificTotal} specific estimate${subs.estimateSpecificTotal === 1 ? '' : 's'}`}
                        trigger={
                          subs.estimateSpecificTitles.join(', ') +
                          (subs.estimateSpecificTotal > subs.estimateSpecificTitles.length
                            ? ` and ${subs.estimateSpecificTotal - subs.estimateSpecificTitles.length} more`
                            : '')
                        }
                        managedFrom="each estimate's Notify list"
                      />
                    )}
                  </>
                )
              })()}
              <p style={{ color: 'var(--text-faint)', fontSize: '0.72rem', margin: '12px 0 0' }}>
                One-off sends addressed to you appear on the week above. Ad-hoc emails someone sends on the spot can't
                be predicted — this shows everything that's configured. Recipient lists are managed by devs and
                masters on each email's own surface.
              </p>
            </>
          ) : null}
        </div>
      )}
    </section>
  )
}

/**
 * One standing email stream: colored dot + name + trigger when subscribed,
 * grayed hollow dot + "Not subscribed" otherwise, with a managed-from hint.
 */
function SubscriptionRow({
  dot,
  subscribed,
  name,
  trigger,
  managedFrom,
}: {
  dot: string
  subscribed: boolean
  name: string
  trigger: string
  managedFrom: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 0', fontSize: '0.85rem' }}>
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: 9999,
          flexShrink: 0,
          alignSelf: 'center',
          background: subscribed ? dot : 'transparent',
          border: subscribed ? 'none' : '1.5px solid var(--border-strong)',
          boxSizing: 'border-box',
        }}
      />
      <span style={{ minWidth: 0, color: subscribed ? undefined : 'var(--text-muted)' }}>
        <strong style={{ fontWeight: 600 }}>{name}</strong>
        {subscribed ? ` — ${trigger}` : ' — not subscribed'}
        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
          Managed from {managedFrom}
        </span>
      </span>
    </div>
  )
}

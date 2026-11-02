import type { CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import type { JobChargeEvent, JobValueEvent } from '../../lib/jobChargesTimeline'
import { EmptyState } from '../EmptyState'

/**
 * One day on a job (punch list #242, PR 1): hover a day's slice on the
 * pace strip and the day comes off the cursor — who clocked and for how long,
 * what the subs charged, what was bought, and the report's percent if one was
 * filed. On a phone, where nothing hovers, a tap opens the same day as a
 * window. The same events the Costs tab's timeline draws, read for one date.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }
const head: CSSProperties = { fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.35rem' }
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0.22rem 0', borderTop: '1px solid var(--border)', fontSize: '0.84rem' }
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

function dayWords(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function dayOf(ymd: string, events: readonly JobChargeEvent[], valueEvents: readonly JobValueEvent[]) {
  const day = events.filter((e) => e.dateKey === ymd)
  return {
    team: day.filter((e) => e.source === 'team_labor'),
    subs: day.filter((e) => e.source === 'sub_labor'),
    bought: day.filter((e) => e.source !== 'team_labor' && e.source !== 'sub_labor'),
    reports: valueEvents.filter((v) => v.dateKey === ymd),
    teamHours: day.filter((e) => e.source === 'team_labor').reduce((s, e) => s + (e.hours ?? 0), 0),
    total: day.reduce((s, e) => s + e.amount, 0),
  }
}

/** The day's rows, shared by the hover card and the window. */
export function DayDetailsBody({ ymd, events, valueEvents }: { ymd: string; events: readonly JobChargeEvent[]; valueEvents: readonly JobValueEvent[] }) {
  const d = dayOf(ymd, events, valueEvents)
  return (
    <div style={{ display: 'grid', gap: '0.1rem' }} data-testid="day-details">
      {/* The day's size first: the hours and the money, before who and what. */}
      <div style={{ fontSize: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: '0.15rem' }}>{Math.round(d.teamHours * 10) / 10} h · {usd(d.total)}</div>
      <div style={head}>Who was on it</div>
      {d.team.length === 0 ? <EmptyState compact main="Nobody clocked on this job that day." /> : null}
      {d.team.map((e, i) => (
        <div key={i} style={row}>
          <span>{e.who ?? e.label}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{e.hours != null ? `${Math.round(e.hours * 10) / 10} h` : ''} <span style={muted}>· {usd(e.amount)}</span></span>
        </div>
      ))}
      {d.subs.length ? <div style={head}>Subs</div> : null}
      {d.subs.map((e, i) => (
        <div key={i} style={row}>
          <span>{e.who ?? e.label}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(e.amount)}</span>
        </div>
      ))}
      <div style={head}>Bought that day</div>
      {d.bought.length === 0 ? <EmptyState compact main="Nothing bought or charged that day." /> : null}
      {d.bought.map((e, i) => (
        <div key={i} style={row}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{usd(e.amount)}</span>
        </div>
      ))}
      <div style={head}>The report</div>
      {d.reports.length === 0 ? <EmptyState compact main="No field report that day." /> : null}
      {d.reports.map((v, i) => (
        <div key={i} style={row}>
          <span>{v.kind === 'manual' ? 'Percent set by the office' : 'Field report'}{v.label ? <span style={muted}> · {v.label}</span> : null}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.percent != null ? `${Math.round(v.percent)}% done` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

/** The day off the cursor: a card pinned near the pointer, never under it, that takes no clicks. */
export function DayHoverCard({ jobLabel, ymd, x, y, events, valueEvents }: { jobLabel: string; ymd: string; x: number; y: number; events: readonly JobChargeEvent[]; valueEvents: readonly JobValueEvent[] }) {
  const width = 300
  const left = Math.max(8, Math.min(x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - width - 8))
  const flip = typeof window !== 'undefined' && y > window.innerHeight * 0.6
  return (
    <div data-testid="day-hover" style={{ position: 'fixed', left, top: flip ? undefined : y + 16, bottom: flip ? window.innerHeight - y + 12 : undefined, width, zIndex: 1200, pointerEvents: 'none', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.28)', padding: '0.55rem 0.7rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{dayWords(ymd)} <span style={{ ...muted, fontWeight: 400 }}>· {jobLabel}</span></div>
      <DayDetailsBody ymd={ymd} events={events} valueEvents={valueEvents} />
    </div>
  )
}

export function DayDetailsModal({ jobLabel, ymd, events, valueEvents, onClose }: { jobLabel: string; ymd: string; events: readonly JobChargeEvent[]; valueEvents: readonly JobValueEvent[]; onClose: () => void }) {
  const foot = (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" onClick={onClose} style={{ minHeight: 40, padding: '0 1rem', borderRadius: 10, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Close</button>
    </div>
  )
  return (
    <ResponsiveModalShell title={`${dayWords(ymd)} · ${jobLabel}`} onRequestClose={onClose} footer={foot} maxWidthDesktop={480} zIndex={1160}>
      <DayDetailsBody ymd={ymd} events={events} valueEvents={valueEvents} />
    </ResponsiveModalShell>
  )
}

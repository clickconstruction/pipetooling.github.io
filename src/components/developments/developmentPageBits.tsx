/**
 * Small shared pieces of the Development page (punch list #208, design spike): the card shell, the
 * caps, the chips, money and day words. Kept together so every card on the page reads the same.
 */
import type { CSSProperties, ReactNode } from 'react'
import { denverCalendarDaysBetweenInstantAndNow, formatDenverCalendarDayShort, startOfYmdInAppTzMs } from '../../utils/dateUtils'

export const capStyle: CSSProperties = {
  fontSize: '0.66rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
}

export const money = (n: number): string => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

/** *Oct 26* from an ISO stamp or a YYYY-MM-DD. */
export function shortDay(stampOrYmd: string | null | undefined): string {
  if (!stampOrYmd) return '—'
  const ms = stampOrYmd.length === 10 ? startOfYmdInAppTzMs(stampOrYmd) : Date.parse(stampOrYmd)
  if (!Number.isFinite(ms)) return '—'
  return formatDenverCalendarDayShort(ms)
}

/** *2 days*, *today*, *1 day*. */
export function ageWords(stampOrYmd: string | null | undefined): string {
  if (!stampOrYmd) return ''
  const ms = stampOrYmd.length === 10 ? startOfYmdInAppTzMs(stampOrYmd) : Date.parse(stampOrYmd)
  if (!Number.isFinite(ms)) return ''
  const d = denverCalendarDaysBetweenInstantAndNow(ms)
  if (d === 0) return 'today'
  return `${d} ${d === 1 ? 'day' : 'days'}`
}

export function Card({ id, title, meta, right, children, tone }: { id?: string; title: ReactNode; meta?: ReactNode; right?: ReactNode; children: ReactNode; tone?: 'amber' }) {
  return (
    <section
      id={id}
      className="developmentCard"
      style={{
        border: `1px solid ${tone === 'amber' ? 'var(--bg-amber-200)' : 'var(--border)'}`,
        borderRadius: 8,
        background: tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--surface)',
        scrollMarginTop: 'var(--development-jump-offset, 72px)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-strong)' }}>{title}</h2>
        {meta ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{meta}</span> : null}
        {right ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: '0.78rem' }}>{right}</span> : null}
      </header>
      <div style={{ padding: '10px 14px' }}>{children}</div>
    </section>
  )
}

export function Chip({ label, color, soft }: { label: string; color: string; soft?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 7px',
        borderRadius: 9999,
        fontSize: '0.7rem',
        fontWeight: 700,
        color: soft ? color : '#fff',
        background: soft ? 'transparent' : color,
        border: soft ? `1px solid ${color}` : '1px solid transparent',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

export function LinkButton({ onClick, children, title, strong }: { onClick: () => void; children: ReactNode; title?: string; strong?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        border: 'none',
        background: 'none',
        padding: 0,
        margin: 0,
        font: 'inherit',
        color: 'var(--text-link)',
        fontWeight: strong ? 600 : 500,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  )
}

export function SmallButton({ onClick, children, title, primary, disabled }: { onClick: () => void; children: ReactNode; title?: string; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        height: 30,
        padding: '0 0.8rem',
        border: primary ? '1px solid var(--text-link)' : '1px solid var(--border-strong)',
        borderRadius: 5,
        background: primary ? 'var(--text-link)' : 'var(--surface)',
        color: primary ? '#fff' : 'var(--text-700)',
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

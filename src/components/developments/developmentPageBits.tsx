/**
 * Small shared pieces of the Development page (punch list #208, design spike): the card shell, the
 * caps, the chips, money and day words. Kept together so every card on the page reads the same.
 */
import type { CSSProperties, ReactNode } from 'react'
import { denverCalendarDaysBetweenInstantAndNow, formatDenverCalendarDayShort, formatDenverTimeOnly, startOfYmdInAppTzMs } from '../../utils/dateUtils'

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

/** *3:17 PM* from an ISO stamp, in the company's calendar; empty for a day-only value. */
export function timeOfDay(stamp: string | null | undefined): string {
  if (!stamp || stamp.length === 10) return ''
  const ms = Date.parse(stamp)
  if (!Number.isFinite(ms)) return ''
  return formatDenverTimeOnly(ms)
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

/**
 * A look folds to one line (the owner, 2026-10-28: *sort or minimise sections*): `fold` puts the
 * chevron on the head, and while folded the head shows `fold.line` (what the look's strip chip says)
 * and the body is gone. The device remembers which looks are folded (`devicePrefs.ts`).
 */
export type CardFold = { open: boolean; onToggle: () => void; line: ReactNode }

export function Card({ id, title, meta, right, children, tone, fold }: { id?: string; title: ReactNode; meta?: ReactNode; right?: ReactNode; children: ReactNode; tone?: 'amber'; fold?: CardFold }) {
  const folded = fold ? !fold.open : false
  const bodyless = folded || children === null || children === false
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
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderBottom: bodyless ? 'none' : '1px solid var(--border)' }}>
        {fold ? (
          <button type="button" className="developmentChevron" aria-expanded={fold.open} aria-label={fold.open ? 'Fold this look to one line' : 'Open this look'} title={fold.open ? 'Fold this look to one line' : 'Open this look'} onClick={fold.onToggle} data-testid="look-fold">
            <span aria-hidden>{fold.open ? '▾' : '▸'}</span>
          </button>
        ) : null}
        <h2 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-strong)' }}>{title}</h2>
        {folded ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="look-folded-line">{fold?.line}</span> : meta ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{meta}</span> : null}
        {right && !folded ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: '0.78rem' }}>{right}</span> : null}
      </header>
      {bodyless ? null : <div style={{ padding: '10px 14px' }}>{children}</div>}
    </section>
  )
}

/** The fold button (the owner, 2026-10-28: *a button that if clicked visually expands and looks reactive*): the chevron turns, the press shows. */
export function FoldButton({ open, label, onClick, testId }: { open: boolean; label: string; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className="developmentFoldButton" aria-expanded={open} onClick={onClick} data-testid={testId}>
      <span className="chev" aria-hidden>
        ▸
      </span>
      {label}
    </button>
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

/** A chip that acts (the owner, 2026-10-28): a dashed edge, a dotted underline and a title say it is a press; a confirm window follows. */
export function PressChip({ label, color, title, onClick, disabled, testId }: { label: string; color: string; title: string; onClick: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      title={title}
      data-testid={testId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 7px',
        borderRadius: 9999,
        fontSize: '0.7rem',
        fontWeight: 700,
        color,
        background: 'transparent',
        border: `1px dashed ${color}`,
        textDecoration: 'underline dotted',
        textUnderlineOffset: 2,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        font: 'inherit',
        lineHeight: 1.6,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}

export function LinkButton({ onClick, children, title, strong, nowrap }: { onClick: () => void; children: ReactNode; title?: string; strong?: boolean; nowrap?: boolean }) {
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
        whiteSpace: nowrap ? 'nowrap' : undefined,
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

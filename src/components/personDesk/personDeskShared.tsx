import type { CSSProperties, ReactNode } from 'react'

/** Shared chrome for Person Desk sections (v2.2701): one row grammar so every section reads the same. */

export const DESK_Z = 60
/** Editors opened from the Desk sit one rung above the drawer; confirms (1300) and popovers (1250) keep their rungs. */
export const DESK_EDITOR_Z = 1100

export const BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.2rem 0.55rem',
  fontSize: '0.78125rem',
  fontWeight: 600,
  borderRadius: 4,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontFamily: 'inherit',
}
export const BTN_BLUE: CSSProperties = { ...BTN, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }
export const BTN_GREEN: CSSProperties = { ...BTN, border: '1px solid #22c55e', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }
export const BTN_AMBER: CSSProperties = { ...BTN, border: '1px solid #f59e0b', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
export const BTN_RED: CSSProperties = { ...BTN, border: '1px solid #dc2626', background: 'var(--bg-red-tint)', color: 'var(--text-red-600)' }
export const BTN_QUIET: CSSProperties = { ...BTN, border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500 }

export function deskBtn(style: CSSProperties, disabled?: boolean): CSSProperties {
  return disabled ? { ...style, opacity: 0.55, cursor: 'not-allowed' } : style
}

const CHIP_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  borderRadius: 999,
  padding: '0 0.5rem',
  fontSize: '0.71875rem',
  fontWeight: 700,
  lineHeight: 1.6,
  whiteSpace: 'nowrap',
  border: '1px solid transparent',
}
const CHIP_STYLES: Record<'amber' | 'green' | 'red' | 'gray' | 'blue' | 'purple', CSSProperties> = {
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderColor: '#f59e0b' },
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', borderColor: '#22c55e' },
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-600)', borderColor: '#dc2626' },
  gray: { background: 'var(--bg-muted)', color: 'var(--text-700)', borderColor: 'var(--border)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', borderColor: '#93c5fd' },
  purple: { background: '#f5f3ff', color: 'var(--text-violet-800)', borderColor: 'var(--border-violet)' },
}

export function Chip({ tone, children, title }: { tone: keyof typeof CHIP_STYLES; children: ReactNode; title?: string }) {
  return (
    <span style={{ ...CHIP_BASE, ...CHIP_STYLES[tone] }} title={title}>
      {children}
    </span>
  )
}

/** "dev only" / "pay roles" tag on a row the viewer cannot edit — visible so a controller sees the state and knows who to ask. */
export function LockTag({ label = 'dev only', title }: { label?: string; title?: string }) {
  return (
    <span
      title={title ?? `Only a ${label.replace(' only', '')} can change this. The value is shown so you know where it stands.`}
      style={{
        fontSize: '0.65625rem',
        fontWeight: 700,
        color: 'var(--text-muted)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 3,
        padding: '0 0.35rem',
        whiteSpace: 'nowrap',
        lineHeight: 1.6,
      }}
    >
      {label}
    </span>
  )
}

export function DeskSection({
  title,
  who,
  whoTone = 'muted',
  children,
  wide,
}: {
  title: string
  who?: string
  whoTone?: 'muted' | 'dev'
  children: ReactNode
  wide?: boolean
}) {
  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        gridColumn: wide ? '1 / -1' : undefined,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.7rem',
          borderBottom: '1px solid var(--border)',
          fontWeight: 700,
          color: 'var(--text-strong)',
          fontSize: '0.8125rem',
        }}
      >
        {title}
        {who ? (
          <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: '0.6875rem', color: whoTone === 'dev' ? 'var(--text-red-600)' : 'var(--text-muted)' }}>{who}</span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function DeskRow({
  label,
  children,
  actions,
  tone,
}: {
  label: ReactNode
  children: ReactNode
  actions?: ReactNode
  tone?: 'gap' | 'locked'
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(96px, 128px) minmax(0, 1fr) auto',
        gap: '0.4rem 0.7rem',
        alignItems: 'center',
        padding: '0.4rem 0.7rem',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.8125rem',
        background: tone === 'gap' ? 'var(--bg-amber-tint)' : 'transparent',
      }}
      className="person-desk-row"
    >
      <span style={{ color: tone === 'gap' ? 'var(--text-amber-800)' : 'var(--text-muted)', fontWeight: tone === 'gap' ? 600 : 400 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', minWidth: 0, color: tone === 'locked' ? 'var(--text-muted)' : 'var(--text-base)' }}>{children}</span>
      <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</span>
    </div>
  )
}

export function DeskEmpty({ children }: { children: ReactNode }) {
  return <div style={{ padding: '0.5rem 0.7rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{children}</div>
}

export function fmtDay(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '')
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : parts[0]?.[1] ?? ''
  return (a + b).toUpperCase()
}

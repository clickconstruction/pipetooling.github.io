import type { CSSProperties, ReactNode } from 'react'

/** GC mode design spike: the few shared pieces every pane draws with. */

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'grey' | 'violet'

const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: 'var(--bg-green-100)', fg: 'var(--text-green-800)' },
  amber: { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' },
  red: { bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)' },
  blue: { bg: 'var(--bg-blue-200)', fg: 'var(--text-blue-800)' },
  grey: { bg: 'var(--bg-muted)', fg: 'var(--text-600)' },
  violet: { bg: 'var(--bg-violet-100)', fg: 'var(--text-violet-800)' },
}

/** A small one sits under a name in the chart's 168px name column on a phone (the phone pass, round five). */
export function Chip({ tone, children, title, small }: { tone: Tone; children: ReactNode; title?: string; small?: boolean }) {
  const t = TONES[tone]
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        padding: '0.1rem 0.5rem',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...(small ? { fontSize: '0.65rem', padding: '0 0.4rem', lineHeight: 1.15 } : {}),
      }}
    >
      {children}
    </span>
  )
}

export function Card({ children, style, dataTour }: { children: ReactNode; style?: CSSProperties; dataTour?: string }) {
  return (
    <div
      data-tour={dataTour}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.9rem 1rem',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Btn({
  children,
  onClick,
  kind = 'plain',
  disabled,
  title,
  wrap,
  dataTour,
}: {
  children: ReactNode
  onClick: () => void
  kind?: 'primary' | 'plain' | 'quiet'
  disabled?: boolean
  title?: string
  /** A long label (a Spanish one, say) may wrap instead of widening a phone page. Off by default. */
  wrap?: boolean
  /** A walkthrough's `data-tour` anchor (New here?, v2.4838). */
  dataTour?: string
}) {
  const base: CSSProperties = {
    padding: '0.35rem 0.75rem',
    borderRadius: 6,
    fontSize: '0.85rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    whiteSpace: wrap ? 'normal' : 'nowrap',
    textAlign: wrap ? 'left' : undefined,
    maxWidth: wrap ? '100%' : undefined,
  }
  const kinds: Record<string, CSSProperties> = {
    primary: { background: '#2563eb', color: 'white', border: '1px solid #2563eb', fontWeight: 600 },
    plain: { background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)' },
    quiet: { background: 'transparent', color: 'var(--text-link)', border: '1px solid transparent', padding: '0.35rem 0.25rem' },
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} data-tour={dataTour} style={{ ...base, ...kinds[kind] }}>
      {children}
    </button>
  )
}

/**
 * " + ?" after a total that counts some work at $0 because no cost is set for it yet. The words
 * name the work ("1 line has no cost yet: roof curbs."); hovering shows them, and a screen reader
 * reads them instead of the question mark. Nothing renders when nothing is missing.
 */
export function PlusUnknown({ words }: { words: string }) {
  if (!words) return null
  return (
    <span
      title={`${words} This number counts it as $0 until you set a cost in Compare quotes.`}
      // position: relative holds the hidden screen-reader words inside the marker; without it they sat at
      // their static spot in a wide table and widened the page on a phone.
      style={{ position: 'relative', color: 'var(--text-amber-800)', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'help' }}
    >
      <span aria-hidden> + ?</span>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {` plus work with no cost yet. ${words}`}
      </span>
    </span>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'red' | 'green' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '1.15rem',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: tone === 'red' ? 'var(--text-red-700)' : tone === 'green' ? 'var(--text-green-700)' : 'var(--text-strong)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

export function Why({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '62rem' }}>{children}</p>
}

export const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.45rem 0.6rem',
  fontSize: '0.72rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

export const td: CSSProperties = {
  padding: '0.5rem 0.6rem',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
  fontSize: '0.9rem',
}

export const num: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

export const input: CSSProperties = {
  padding: '0.3rem 0.45rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  fontSize: '0.875rem',
}

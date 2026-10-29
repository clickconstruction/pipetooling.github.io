/**
 * Materials on site (punch list #209): the flow row. One row at the pills' height that shows the process
 * instead of telling it — pills joined by arrows, each figure in its colour (blue came in, green on site,
 * grey used, amber missing), a badge where a hand is needed, and no sentence anywhere. The office page
 * draws four as its tabs; the phone draws three as filters. The figures come from `src/lib/materials/flowRow.ts`.
 */
import type { CSSProperties, ReactNode } from 'react'

export type FlowTone = 'in' | 'here' | 'out' | 'gap'

export type FlowPill = {
  key: string
  /** The small word: "came in", "on site", "used", "missing"; on the phone the names Unsorted, Used, Count. */
  word: string
  /** The figure, already formatted. */
  figure: string
  tone: FlowTone
  /** A hand is needed: a count in amber, money in red, or a dot when the figure itself is the count. */
  badge?: { text: string; red?: boolean } | 'dot' | null
  on?: boolean
  /** Nothing to open: drawn faint, the press does nothing. */
  off?: boolean
  /** The whole sentence, for the tooltip and the screen reader. */
  title: string
  onPress?: () => void
}

/** The figure's colour: the theme's own word tokens, which flip in dark. */
const TONE: Record<FlowTone, string> = { in: 'var(--text-blue-700)', here: 'var(--text-green-700)', out: 'var(--text-muted)', gap: 'var(--text-amber-700)' }
const AMBER = '#d97706'
const RED = '#dc2626'

export function FlowRow({ pills, trailing, role, label, size = 'desk', wordFirst = false }: {
  pills: FlowPill[]
  /** Drawn at the row's end: the office's List and Map views of the green pill. */
  trailing?: ReactNode
  /** Tabs switch a section; filters narrow a list. */
  role: 'tabs' | 'filters'
  label: string
  size?: 'desk' | 'phone'
  /** The phone reads word first, count after, as the app's own pills do: Unsorted 2, Used 6, Count 25. */
  wordFirst?: boolean
}) {
  const phone = size === 'phone'
  const pill: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: phone ? 4 : 5, minHeight: phone ? 40 : 32, padding: phone ? '0 0.55rem' : '0 0.65rem', borderRadius: 999,
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-strong)',
    fontSize: phone ? '0.9rem' : '0.95rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, whiteSpace: 'nowrap', cursor: 'pointer', font: 'inherit',
  }
  return (
    <div role={role === 'tabs' ? 'tablist' : 'group'} aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: phone ? 3 : 4, flexWrap: 'wrap', minWidth: 0 }}>
      {pills.map((p, i) => {
        const tone = TONE[p.tone]
        const button = (
          <button
            key={p.key}
            type="button"
            role={role === 'tabs' ? 'tab' : undefined}
            aria-selected={role === 'tabs' ? Boolean(p.on) : undefined}
            aria-pressed={role === 'filters' ? Boolean(p.on) : undefined}
            aria-disabled={p.off || undefined}
            aria-label={p.title}
            title={p.title}
            onClick={p.off ? undefined : p.onPress}
            style={{ ...pill, ...(p.on ? { boxShadow: `inset 0 0 0 2px ${tone}`, borderColor: tone } : {}), ...(p.off ? { opacity: 0.5, cursor: 'default' } : {}) }}
          >
            {p.badge === 'dot' ? <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: AMBER, flex: '0 0 auto' }} /> : null}
            {wordFirst ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-strong)' }}>{p.word}</span> : null}
            <b style={{ color: tone, fontWeight: 800 }}>{p.figure}</b>
            {!wordFirst ? <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>{p.word}</span> : null}
            {p.badge && p.badge !== 'dot' ? <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#fff', background: p.badge.red ? RED : AMBER, borderRadius: 999, padding: '2px 6px', minWidth: 18, textAlign: 'center', lineHeight: 1.1 }}>{p.badge.text}</span> : null}
          </button>
        )
        if (i === 0) return button
        // The arrow travels with the pill it points at, so a wrapped row never ends on a dangling arrow.
        return (
          <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: phone ? 3 : 4 }}>
            <svg aria-hidden viewBox="0 0 20 14" width={phone ? 16 : 20} height={phone ? 12 : 14} fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: '0 0 auto' }}><path d="M2 7h14M11 3l5 4-5 4" /></svg>
            {button}
          </span>
        )
      })}
      {trailing ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>{trailing}</span> : null}
    </div>
  )
}

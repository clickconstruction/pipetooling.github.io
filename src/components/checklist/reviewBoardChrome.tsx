/**
 * Checklist → Review, what frames the board: a tile of the row of three and a fold's header. Each is markup over
 * what it is handed. They were render helpers inside `ChecklistOutstandingTab` until v2.7766 (CHECKLIST_TABS map).
 */
import type { ReactNode } from 'react'

/** One of the three tiles over the board: a press that says its count and its caption. */
export const reviewTile = (
  label: string,
  count: number | null,
  tone: 'zero' | 'blue' | 'red' | 'amber',
  caption: { text: string; ok: boolean },
  active: boolean,
  onClick: () => void,
) => (
  <button
    key={label}
    type="button"
    onClick={onClick}
    aria-label={`${label} — ${count ?? '…'}. ${caption.text}`}
    style={{
      flex: '1 1 0',
      minWidth: 0,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 2,
      minHeight: 104,
      padding: '0.65rem 0.5rem 0.6rem',
      background: 'var(--surface)',
      border: `1px solid ${active ? '#3b82f6' : 'var(--border)'}`,
      boxShadow: active ? '0 0 0 1px #3b82f6 inset' : undefined,
      borderRadius: 12,
      cursor: 'pointer',
      font: 'inherit',
      color: 'var(--text-strong)',
    }}
  >
    <span aria-hidden style={{ position: 'absolute', top: 6, right: 9, color: 'var(--text-faint)', fontSize: '0.8rem' }}>›</span>
    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', lineHeight: 1.25, padding: '0 0.9rem' }}>{label}</span>
    <span style={{ fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: tone === 'blue' ? 'var(--text-link)' : tone === 'red' ? 'var(--text-red-700)' : tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
      {count == null ? '—' : count}
    </span>
    <span style={{ fontSize: '0.68rem', lineHeight: 1.3, color: caption.ok ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{caption.text}</span>
  </button>
)

/** The header of a fold: its label, a count badge when there is one, and the mark that says open or shut. */
export const reviewFoldHeader = (
  label: ReactNode,
  badge: string | null,
  badgeTone: 'blue' | 'red' | 'muted',
  open: boolean,
  onToggle: () => void,
) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.5rem',
      width: '100%',
      minHeight: 44,
      padding: '0.55rem 0.75rem',
      background: 'var(--surface)',
      border: 'none',
      cursor: 'pointer',
      fontSize: '0.9375rem',
      fontWeight: 600,
      color: 'var(--text-strong)',
      textAlign: 'left',
    }}
  >
    <span>{label}</span>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      {badge != null ? (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.1rem 0.55rem',
            borderRadius: 999,
            background:
              badgeTone === 'blue' ? 'var(--bg-blue-tint)' : badgeTone === 'red' ? 'var(--bg-red-100)' : 'var(--bg-muted)',
            color:
              badgeTone === 'blue' ? 'var(--text-link)' : badgeTone === 'red' ? 'var(--text-red-700)' : 'var(--text-muted)',
          }}
        >
          {badge}
        </span>
      ) : null}
      <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{open ? '▾' : '▸'}</span>
    </span>
  </button>
)

import { useEffect } from 'react'
import type { CSSProperties } from 'react'

/**
 * Bottom action sheet for the Stages mobile cards (v2.1402): the labeled home
 * for every row action the desktop tables carry that doesn't fit the card's
 * quick-icon row. Opened by the card footer's ⋯ button; replaces the old
 * hidden "toolbelt" that only appeared after tapping the card body (no
 * affordance, so nobody found it). Rows run their action and close the sheet.
 */

export type StagesCardMoreAction = {
  key: string
  label: string
  onClick: () => void
  /** 'muted' for send-back style de-emphasis; 'warn' for the collections flag. */
  tone?: 'default' | 'muted' | 'warn'
  /** Small right-aligned annotation (e.g. thread note count, "live" hazmat marker). */
  badge?: string
}

const sheetRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  width: '100%',
  padding: '0.7rem 1rem',
  border: 'none',
  borderTop: '1px solid var(--border)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.9375rem',
  textAlign: 'left',
  color: 'var(--text-strong)',
}

export function StagesCardMoreActionsSheet({
  open,
  title,
  actions,
  onClose,
}: {
  open: boolean
  title: string
  actions: StagesCardMoreAction[]
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1200,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={`More actions for ${title}`}
        style={{
          background: 'var(--surface)',
          borderRadius: '14px 14px 0 0',
          width: '100%',
          maxWidth: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0.5rem auto 0.4rem' }} />
        <p style={{ margin: '0 1rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </p>
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => {
              onClose()
              a.onClick()
            }}
            style={{
              ...sheetRowStyle,
              color: a.tone === 'warn' ? 'var(--text-amber-800)' : a.tone === 'muted' ? 'var(--text-muted)' : 'var(--text-strong)',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>{a.label}</span>
            {a.badge ? (
              <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.badge}</span>
            ) : null}
          </button>
        ))}
        <div style={{ padding: '0.6rem 1rem 0.2rem', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.55rem',
              fontSize: '0.9375rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              background: 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

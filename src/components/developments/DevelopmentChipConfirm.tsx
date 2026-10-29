/**
 * The chips' confirm window, shown not told (the owner, 2026-10-28: *how can we offer something more
 * show less tell?*): the record as it is and as it will be, one row per fact, the one that changes
 * highlighted with its before and after, the ones that stay greyed and marked *same*, and under them
 * the line as it will read where it lands. The button carries the verb, as the house rule asks.
 */
import { useEffect, type ReactNode } from 'react'
import { SmallButton } from './developmentPageBits'

export type ChipConfirmRow = { label: string; before: ReactNode; after: ReactNode; changes: boolean }

export function DevelopmentChipConfirm({
  title,
  rows,
  preview,
  previewCaption,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string
  rows: ChipConfirmRow[]
  /** The line as it will read where it lands: the Pipeline row's house line, the Bid Board's column. */
  preview?: ReactNode
  previewCaption?: string
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} data-testid="chip-confirm" style={{ position: 'fixed', inset: 0, zIndex: 760, background: 'rgba(17, 24, 39, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ width: 'min(520px, 100%)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.14)' }}>
        <div style={{ padding: '12px 16px 6px' }}>
          <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 600, color: 'var(--text-strong)' }}>{title}</h2>
        </div>
        <div style={{ padding: '4px 16px 12px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 22px 1fr', gap: '4px 8px', alignItems: 'center', fontSize: '0.84rem' }} data-testid="chip-confirm-rows">
            <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }} />
            <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Now</span>
            <span />
            <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>After</span>
            {rows.map((r) => (
              <RowCells key={r.label} row={r} />
            ))}
          </div>
          {preview ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-subtle)' }}>
              {previewCaption ? <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>{previewCaption}</div> : null}
              {preview}
            </div>
          ) : null}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <SmallButton onClick={onCancel} disabled={busy}>
            Cancel
          </SmallButton>
          <SmallButton onClick={onConfirm} disabled={busy} primary>
            {confirmLabel}
          </SmallButton>
        </div>
      </div>
    </div>
  )
}

function RowCells({ row }: { row: ChipConfirmRow }) {
  const changed = row.changes
  const cell: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: 5,
    background: changed ? 'var(--bg-amber-tint)' : 'transparent',
    color: changed ? 'var(--text-strong)' : 'var(--text-muted)',
    fontWeight: changed ? 600 : 400,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  return (
    <>
      <span style={{ color: changed ? 'var(--text-strong)' : 'var(--text-faint)', fontWeight: changed ? 700 : 500 }}>{row.label}</span>
      <span style={cell}>{row.before}</span>
      <span aria-hidden style={{ textAlign: 'center', color: changed ? 'var(--text-amber-800)' : 'var(--text-faint)' }}>
        {changed ? '→' : '·'}
      </span>
      <span style={cell}>{changed ? row.after : <span style={{ color: 'var(--text-faint)' }}>same</span>}</span>
    </>
  )
}

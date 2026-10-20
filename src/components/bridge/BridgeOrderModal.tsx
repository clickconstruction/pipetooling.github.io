import { useEffect, type CSSProperties } from 'react'
import { ORDER_RULE, type Order } from '../../lib/bridge/order'

/**
 * What to deal with first (link PR 6): the order as tiers, opened from any
 * badge. The rule in one line, then the rows with the reading that put each
 * there and its first move; the pressed badge's row is highlighted.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const cap: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export function BridgeOrderModal({ order, note, onClose }: { order: Order; note: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(24px + var(--app-top-chrome, 0px)) 24px 24px' }} data-testid="bridge-order-modal">
      <div role="dialog" aria-modal="true" aria-label="What to deal with first" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: 'min(880px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.8rem' }}>
          <span style={label}>What to deal with first</span>
          <span style={det}>{note}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '1rem', lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ fontSize: '0.85rem', padding: '0.5rem 0.7rem', background: 'var(--bg-blue-tint, transparent)', border: '1px solid var(--border)', borderRadius: 8 }}>{ORDER_RULE}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(120px, 1fr) minmax(160px, 1.3fr) minmax(180px, 1.6fr)', gap: '0 0.8rem', fontSize: '0.85rem', alignItems: 'baseline' }}>
          {order.rows.map((r) => (
            <span key={r.id} style={{ display: 'contents' }}>
              {r.tierHead && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.6rem 0 0.25rem', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <span style={{ ...label, color: 'var(--text)' }}>{r.tier}</span>
                  <span style={det}>{r.tierWhy}</span>
                </div>
              )}
              <div style={{ padding: '0.35rem 0.25rem', borderRadius: 6, fontWeight: 700, color: 'var(--text-muted)', background: r.pressed ? 'var(--bg-amber-tint, transparent)' : undefined }}>{r.rank}</div>
              <div style={{ padding: '0.35rem 0.25rem', borderRadius: 6, background: r.pressed ? 'var(--bg-amber-tint, transparent)' : undefined }} data-testid={`bridge-order-row-${r.id}`}>
                <b>{r.name}</b>
                <span style={{ display: 'block', ...det }}>{r.badge}</span>
              </div>
              <div style={{ padding: '0.35rem 0.25rem', borderRadius: 6, background: r.pressed ? 'var(--bg-amber-tint, transparent)' : undefined }}>{r.reading}</div>
              <div style={{ padding: '0.35rem 0.25rem', borderRadius: 6, color: 'var(--text-muted)', background: r.pressed ? 'var(--bg-amber-tint, transparent)' : undefined }}>
                <span style={cap}>first move</span>
                <span style={{ display: 'block' }}>{r.firstMove}</span>
              </div>
            </span>
          ))}
        </div>
        {order.pressedLine && <div style={{ fontSize: '0.85rem', padding: '0.5rem 0.7rem', background: 'var(--bg-amber-tint, transparent)', border: '1px solid var(--text-amber-800)', borderRadius: 8, color: 'var(--text-amber-800)' }}>{order.pressedLine}</div>}
      </div>
    </div>
  )
}

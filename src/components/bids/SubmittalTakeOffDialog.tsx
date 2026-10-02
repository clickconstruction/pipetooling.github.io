/**
 * The × on a draft row (2026-10-02): the GC will not see the fixture, and the office says whether
 * it is still bought. Order only keeps the row on the revision and on the procurement log; Left
 * out takes it off both. A fixture the log already holds an order for cannot be left out: its
 * order would leave the log with it.
 */
import type { CSSProperties } from 'react'

const Z = 10060

const choice: CSSProperties = { textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '0.15rem' }
const choiceWords: CSSProperties = { fontWeight: 400, fontSize: '0.78rem' }

export function SubmittalTakeOffDialog({ tag, bought, busy = false, onOrderOnly, onLeaveOut, onClose }: {
  /** The row's tag, as its title reads. */
  tag: string
  /** "Ordered 09/23, on site 09/29" when the log holds an order for it; '' when nothing is bought. */
  bought: string
  busy?: boolean
  onOrderOnly: () => void
  onLeaveOut: () => void
  onClose: () => void
}) {
  const name = tag.trim() || 'this row'
  const locked = bought !== ''
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={`Take ${name} off the submittal`} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 440, width: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', padding: '1.1rem 1.25rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Take {name} off the submittal</h3>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8125rem', color: 'var(--text-base)' }}>The GC will not see it. Do you still buy it?</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button type="button" disabled={busy} onClick={onOrderOnly} style={{ ...choice, background: 'var(--bg-amber-tint)', border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-700)' }} data-testid="take-off-order-only">
            Order only
            <span style={{ ...choiceWords, color: 'var(--text-base)' }}>It stays on the procurement log.</span>
          </button>
          <button type="button" disabled={busy || locked} onClick={onLeaveOut} style={{ ...choice, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: locked ? 'var(--text-faint)' : 'var(--text-strong)', cursor: locked ? 'not-allowed' : 'pointer' }} data-testid="take-off-leave-out">
            Left out
            <span style={{ ...choiceWords, color: 'var(--text-muted)' }}>{locked ? `${bought}. It cannot be left out.` : 'Off the submittal and off the log.'}</span>
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

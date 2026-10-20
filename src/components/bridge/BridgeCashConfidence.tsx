import type { CSSProperties } from 'react'
import type { ReceiptsConfidence } from '../../lib/bridge/cashConfidence'

/**
 * How sure the forecast's receipts are (v2.5219): a band of promised / by
 * pace / late-and-assumed dollars, and the sentence on the day that carries
 * the window when one does.
 */

const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const shortK = (n: number): string => `$${Math.abs(n) >= 100_000 ? `${(Math.abs(n) / 1000).toFixed(0)}k` : Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : `${Math.round(Math.abs(n))}`}`
const PROMISED = '#1e7f4f'
const PACE = '#60a5fa'
const LATE = 'repeating-linear-gradient(135deg, #fcd34d 0 4px, var(--surface) 4px 8px)'

export function BridgeCashConfidence({ confidence, carry }: { confidence: ReceiptsConfidence; carry: string | null }) {
  const c = confidence
  const seg = (share: number, background: string, title: string): CSSProperties => ({ width: `${Math.max(0, Math.min(100, share * 100))}%`, background, minWidth: share > 0 ? 3 : 0, ...({ title } as object) })
  return (
    <div style={{ marginTop: '0.4rem' }} data-testid="bridge-cash-confidence">
      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={det}>How sure the receipts are</span>
        <div style={{ flex: '1 1 220px', display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }} role="img" aria-label={`Promised ${shortK(c.promisedUsd)}, by pace ${shortK(c.paceUsd)}, late and assumed ${shortK(c.lateUsd)}`}>
          <div style={seg(c.shares.promised, PROMISED, 'promised')} />
          <div style={seg(c.shares.pace, PACE, 'by pace')} />
          <div style={seg(c.shares.late, LATE, 'late, assumed')} />
        </div>
        <span style={det}>
          <i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, background: PROMISED, borderRadius: 2, marginRight: 4, verticalAlign: -1 }} />
          promised <b style={{ color: 'var(--text)' }}>{shortK(c.promisedUsd)}</b>
        </span>
        <span style={det}>
          <i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, background: PACE, borderRadius: 2, marginRight: 4, verticalAlign: -1 }} />
          by this customer's or the company's pace <b style={{ color: 'var(--text)' }}>{shortK(c.paceUsd)}</b>
        </span>
        <span style={det}>
          <i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, background: LATE, border: '1px solid #d4a017', borderRadius: 2, marginRight: 4, verticalAlign: -1 }} />
          late, assumed within their pace <b style={{ color: 'var(--text)' }}>{shortK(c.lateUsd)}</b>
          {c.lateCount > 0 ? ` (${c.lateCount})` : ''}
        </span>
      </div>
      {carry && (
        <div style={{ marginTop: '0.4rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-900)', borderRadius: 7, padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} data-testid="bridge-cash-carry">
          <b>The day that carries the window:</b> {carry}
        </div>
      )}
    </div>
  )
}

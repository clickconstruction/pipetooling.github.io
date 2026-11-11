import type { CSSProperties } from 'react'
import { contactParts } from '../../../supabase/functions/_shared/permitLookup'
import { shortDay } from '../../lib/research/permitResearch'
import { tiePressWords, type LookAlike } from '../../lib/research/nameLikeness'
import { EmptyState } from '../EmptyState'
import { PermitChip } from '../bids/PermitChip'
import { MarkedName } from '../bids/FindNamesSheet'

/**
 * Looks like a customer (punch list #307, PR 10): the worklist on Builders. Every name on the
 * city's permits that may be one of our customers, the strongest reason first, each answered in
 * one press: the same company (or works for them), or not them. The app suggests; a person ties.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }
const primary: CSSProperties = { background: '#2563eb', color: '#fff', border: '1px solid #2563eb', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }
const ghost: CSSProperties = { background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }

export function PermitLookAlikes({ pairs, busy, error, onAnswer }: { pairs: readonly LookAlike[]; busy: boolean; error: string | null; onAnswer: (pair: LookAlike, tie: boolean) => void }) {
  if (pairs.length === 0) return <EmptyState main="Nothing waiting on a look. No name on these permits resembles a customer you have not answered." compact />
  return (
    <div style={{ display: 'grid', gap: 8 }} data-testid="permit-look-alikes">
      <div style={muted}>A name on permits that resembles one of our customers, the strongest reason first. Answer each once. Nothing is tied until you press.</div>
      {error && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{error}</div>}
      {pairs.map((pair) => {
        const s = pair.suggestion
        return (
          <div key={`${pair.customerId}|${s.key}`} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 4 }}>
              <div>
                <MarkedName name={s.name} marked={s.marked} /> <span style={muted}>may be</span> <strong style={{ fontSize: '0.9375rem' }}>{pair.customerName}</strong>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.reasons.map((r) => (
                  <PermitChip key={r.words} chip={r} />
                ))}
              </div>
              <div style={muted}>
                {s.permits} permit{s.permits === 1 ? '' : 's'}
                {s.lastOn ? ` · last ${shortDay(s.lastOn)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={busy} onClick={() => onAnswer(pair, true)} style={primary}>
                {tiePressWords(contactParts(s.name).company != null)}
              </button>
              <button type="button" disabled={busy} onClick={() => onAnswer(pair, false)} style={ghost}>
                Not them
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

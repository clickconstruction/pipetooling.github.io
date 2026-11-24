/**
 * The boxes of a sending placed by hand (punch list #347's residue, card #350's call 2): one row per open sheet of
 * the sub's, with what it has open, what this payment puts on it and what stays open, then the credit box and the
 * line that says how much is placed. Words and sums from `subSendingByHand.ts`.
 */
import type { CSSProperties } from 'react'
import { HAND_CREDIT_BOX, type HandPlan } from '../../lib/subWorkOrders/subSendingByHand'
import { MoneyText } from '../Money'

const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const head: CSSProperties = { fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const box: CSSProperties = { width: '6.2rem', padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 5, font: 'inherit', fontSize: '0.8125rem', textAlign: 'right', boxSizing: 'border-box' }

export function SendingByHandGrid({ hand, boxes, onBox, canCredit, disabled }: { hand: HandPlan; boxes: Readonly<Record<string, string>>; onBox: (id: string, value: string) => void; canCredit: boolean; disabled?: boolean }) {
  const done = hand.plan.ok
  return (
    <div data-sub-sending-by-hand style={{ margin: '0 0 0.75rem', padding: '0.55rem 0.7rem', fontSize: '0.8125rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: '5px 10px', alignItems: 'center' }}>
        <span style={head}>Sheet</span>
        <span style={{ ...head, ...num }}>Open</span>
        <span style={{ ...head, ...num }}>This payment</span>
        <span style={{ ...head, ...num }}>Stays open</span>
        {hand.rows.map((r, i) => (
          <div key={r.id} style={{ display: 'contents' }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {r.label}
              {i === 0 ? <span style={{ color: 'var(--text-muted)' }}> · this sheet</span> : null}
            </span>
            <span style={num}><MoneyText text={usd(r.open)} /></span>
            <input aria-label={`This payment on ${r.label}`} inputMode="decimal" value={boxes[r.id] ?? ''} placeholder="0.00" disabled={disabled} onChange={(e) => onBox(r.id, e.target.value)} style={{ ...box, borderColor: r.error ? 'var(--text-red-700)' : 'var(--border-strong)' }} />
            <span style={{ ...num, color: r.staysOpen <= 0 ? 'var(--text-green-700)' : undefined }}><MoneyText text={usd(r.staysOpen)} /></span>
          </div>
        ))}
        {canCredit ? (
          <div style={{ display: 'contents' }}>
            <span>Keep as their credit</span>
            <span />
            <input aria-label="Keep as their credit" inputMode="decimal" value={boxes[HAND_CREDIT_BOX] ?? ''} placeholder="0.00" disabled={disabled} onChange={(e) => onBox(HAND_CREDIT_BOX, e.target.value)} style={box} />
            <span />
          </div>
        ) : null}
      </div>
      {hand.placedWords ? (
        <div data-sub-sending-placed style={{ marginTop: 6, fontWeight: 600, color: done ? 'var(--text-green-700)' : 'var(--text-700)' }}>
          {hand.placedWords}
          {done ? ' ✓' : ''}
          {hand.effectWords ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {hand.effectWords}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

export default SendingByHandGrid

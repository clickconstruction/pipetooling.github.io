import type { CSSProperties } from 'react'
import { MUTED } from './legalDeskShared'
import { formatLegalMoney } from '../../../lib/legal/legalPacket'
import type { MoneyBar, MoneyBarSegment, MoneyBars } from '../../../lib/legal/moneyBars'

/**
 * The Legal desk's money, drawn (v2.6105, punch list #214, PR 2): the bars `moneyBars` returns,
 * under the four questions. Reads the kernel's fractions only; every word on it is the kernel's.
 * The blues are the bills (a step darker per bill), the hatch is what is asked past the claim on
 * record, green is what we keep, the reds the firm's cut and the filing cost. The saturated fills
 * are literal, as the app keeps its action colours; the neutrals are tokens.
 */

const BILL_BLUES = ['#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6']
const HATCH_NEUTRAL = 'repeating-linear-gradient(135deg, var(--bg-200) 0 5px, var(--bg-muted) 5px 10px)'
const HATCH_RED = 'repeating-linear-gradient(135deg, #fecaca 0 5px, #fee2e2 5px 10px)'

function fill(s: MoneyBarSegment, i: number): CSSProperties {
  switch (s.kind) {
    case 'bill': {
      const bg = BILL_BLUES[i % BILL_BLUES.length]!
      return { background: bg, color: i % BILL_BLUES.length >= 2 ? '#fff' : 'var(--text-on-bright-solid)' }
    }
    case 'bills':
      return { background: '#2563eb', color: '#fff' }
    case 'retainage':
      return { background: '#bfdbfe', color: 'var(--text-on-bright-solid)' }
    case 'beyond':
      return { background: HATCH_NEUTRAL, color: 'var(--text-700)' }
    case 'keep':
      return { background: 'var(--bg-green-200)', color: 'var(--text-green-800)' }
    case 'fee':
      return { background: HATCH_RED, color: '#b42318' }
    case 'filing':
      return { background: '#fca5a5', color: '#b42318' }
    case 'short':
      return { background: 'var(--bg-red-200)', color: '#b42318' }
  }
}

const MARK_INK: Record<'theirs' | 'ours' | 'line', string> = { theirs: '#1d4ed8', ours: 'var(--text-strong)', line: '#1f7a3a' }

function Bar({ bar }: { bar: MoneyBar }) {
  const thin = bar.key !== 'bills'
  const hasMarks = bar.marks.length > 0
  const hasBrackets = bar.brackets.length > 0
  return (
    <div data-legal-money-bar={bar.key} style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', fontSize: '0.72rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{bar.caption}</span>
        <span style={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>{formatLegalMoney(bar.total)}</span>
      </div>
      <div style={{ display: 'flex', height: thin ? 20 : 26, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
        {bar.segments.map((s, i) => (
          <span
            key={s.key}
            data-legal-money-segment={s.kind}
            title={s.title}
            style={{ ...fill(s, i), flex: `${Math.max(s.fraction, 0.001)} 1 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', borderRight: '1px solid var(--surface)', minWidth: 0 }}
          >
            {s.fraction >= 0.09 ? s.label : ''}
          </span>
        ))}
      </div>
      {hasBrackets ? (
        <div style={{ position: 'relative', height: 16 }}>
          {bar.brackets.map((b) => (
            <span key={b.key} data-legal-money-bracket title={b.label} style={{ position: 'absolute', left: `${b.fromFraction * 100}%`, width: `${Math.max(0.5, (b.toFraction - b.fromFraction) * 100)}%`, top: 0, height: 6, borderLeft: '1px solid var(--text-muted)', borderRight: '1px solid var(--text-muted)', borderBottom: '1px solid var(--text-muted)', boxSizing: 'border-box' }}>
              <span style={{ position: 'absolute', top: 6, left: 0, fontSize: '0.64rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{b.label}</span>
            </span>
          ))}
        </div>
      ) : null}
      {hasMarks ? (
        <div style={{ position: 'relative', height: bar.marks.some((m) => m.row === 1) ? 54 : 30 }}>
          {bar.marks.map((m) => (
            <span key={m.key} data-legal-money-mark={m.kind} style={{ position: 'absolute', left: `${m.fraction * 100}%`, top: m.row === 1 ? 24 : 0, transform: m.fraction > 0.9 ? 'translateX(-100%)' : m.fraction < 0.08 ? 'none' : 'translateX(-50%)', textAlign: m.fraction > 0.9 ? 'right' : m.fraction < 0.08 ? 'left' : 'center', fontSize: '0.66rem', lineHeight: 1.2, whiteSpace: 'nowrap', color: MARK_INK[m.kind] }}>
              <span aria-hidden style={{ display: 'block', width: 2, height: m.row === 1 ? 30 : 8, margin: m.fraction > 0.9 ? '0 0 2px auto' : m.fraction < 0.08 ? '0 auto 2px 0' : '0 auto 2px', marginTop: m.row === 1 ? -24 : 0, background: MARK_INK[m.kind] }} />
              <b>{m.label}</b>
              <br />
              {formatLegalMoney(m.amount)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function LegalMoneyBars({ bars }: { bars: MoneyBars }) {
  if (bars.bars.length === 0) return null
  return (
    <div data-legal-money-bars style={{ margin: '8px 0 0', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', display: 'grid', gap: 10 }}>
      {bars.bars.map((b) => <Bar key={b.key} bar={b} />)}
      <div style={{ ...MUTED, fontSize: '0.72rem' }}>{bars.words}</div>
    </div>
  )
}

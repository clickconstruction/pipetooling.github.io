import type { CSSProperties } from 'react'
import type { MoneyBar } from '../../lib/portal/moneyBar'
import type { StatementRow } from '../../lib/portal/moneyLines'
import { HAIR, INK, MUTED, PAPER_GREEN } from '../../lib/portal/portalTheme'

/**
 * The GC customer's Money tab as one bar (punch list #217, outside-2, a prototype): the revised sum as a length, paid in
 * green, billed and open in amber (with the architect pale, certified and due full), the next pay application hatched
 * as our guess, and to finish in the hairline grey; under it the paid share and the on-time count, the open figure, our
 * guess named as one, and the six-line statement as the legend. The geometry is the Legal desk's bars' (`LegalMoneyBars`):
 * fractions of a width, a hatch for a figure not on record. Customer paper, so the colours are the portal's own light ones.
 */
const AMBER = '#b7791f'
const AMBER_PALE = '#e9c46a'
const HATCH = `repeating-linear-gradient(135deg, #f1e3c2 0 5px, #faf3e0 5px 10px)`

function fill(part: MoneyBar['segments'][number]['part']): CSSProperties {
  switch (part) {
    case 'paid':
      return { background: PAPER_GREEN }
    case 'architect':
      return { background: AMBER_PALE }
    case 'due':
      return { background: AMBER }
    case 'next':
      return { background: HATCH }
    case 'rest':
      return { background: HAIR }
  }
}

const dot = (part: MoneyBar['segments'][number]['part']): CSSProperties => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 6, verticalAlign: '-1px', border: `1px solid ${HAIR}`, ...fill(part) })

export function PortalMoneyBar({ bar, legend }: { bar: MoneyBar; legend: StatementRow[] }) {
  return (
    <div data-testid="portal-gc-money-bar" style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: INK }}>{bar.big}</span>
        <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{bar.caption}</span>
      </div>
      <div style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', border: `1px solid ${INK}` }}>
        {bar.segments.map((s) => (
          <span key={s.part} data-money-part={s.part} title={s.label} style={{ ...fill(s.part), flex: `${Math.max(s.fraction, 0.001)} 1 0`, borderRight: `1px solid #fff`, minWidth: 0 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: INK }}>
        {bar.segments.map((s) => (
          <span key={s.part}>
            <span aria-hidden style={dot(s.part)} />
            {s.label}
          </span>
        ))}
      </div>
      {bar.onTime || bar.guess ? (
        <div style={{ color: MUTED, fontSize: 12 }}>{[bar.onTime, bar.guess].filter(Boolean).join(' · ')}</div>
      ) : null}
      <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 6, display: 'grid', gap: 2, fontSize: 12 }}>
        {legend.map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: r.sum ? 700 : 400, borderTop: r.sum ? `1px solid ${HAIR}` : 'none', paddingTop: r.sum ? 2 : 0 }}>
            <span>{r.count !== undefined ? `${r.label} · ${r.count}` : r.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.amount}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

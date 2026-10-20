import { buildPricingComposition, type CompositionBucketKind, type CompositionRowInput } from '../../lib/bids/pricingComposition'
import { formatCurrency } from '../../lib/format'
import { BreakdownCardShell, type BreakdownSlice } from './BreakdownCardShell'

type Props = {
  /** The Workbench's effective rows with their kinds. */
  rows: ReadonlyArray<CompositionRowInput>
  marginColor: (m: number | null) => string
}

const COLORS: Record<CompositionBucketKind, string> = {
  fixture: '#3b82f6',
  pipe: '#0d9488',
  fitting: '#f59e0b',
  equipment: '#d97706',
  allowance: '#a78bfa',
  other: '#94a3b8',
}

const money = (n: number | null) => (n == null ? '—' : `$${formatCurrency(n)}`)
const pct = (m: number | null) => (m == null ? '—' : `${Math.round(m * 1000) / 10}%`)

/**
 * Kind breakdown (punch list #128): the rows by kind — fixtures, pipe, fittings, equipment,
 * allowances — each with its cost, price, profit and margin in the breakdown cards' shape. The
 * kind is the row's chip (the app's guess until set). This is the composition bar's
 * arithmetic (`buildPricingComposition`) drawn as the other two cards are.
 */
export function KindBreakdownCard({ rows, marginColor }: Props) {
  const comp = buildPricingComposition(rows)
  if (comp.buckets.length === 0 || comp.totalRevenue <= 0) return null
  const cell = (s: React.CSSProperties = {}): React.CSSProperties => ({ padding: '0.4rem 0.3rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', ...s })
  const num = (s: React.CSSProperties = {}): React.CSSProperties => cell({ textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...s })
  const totalTd = (s: React.CSSProperties = {}): React.CSSProperties => ({ borderBottom: 'none', borderTop: '2px solid var(--text-strong)', fontWeight: 700, ...s })
  const totalProfit = comp.totalRevenue - comp.totalCost
  const slices: BreakdownSlice[] = comp.buckets.map((b) => ({ key: b.kind, name: b.name, color: COLORS[b.kind], share: b.revenueShare }))
  return (
    <BreakdownCardShell storageKey="pt.pricing.card.kind" title="Kind breakdown" sub={`${comp.buckets.length} kind${comp.buckets.length === 1 ? '' : 's'}`} slices={slices} totals={{ cost: comp.totalCost, price: comp.totalRevenue, profit: totalProfit, margin: comp.totalCost > 0 ? totalProfit / comp.totalRevenue : null }} marginColor={marginColor}>
      <div style={{ overflowX: 'auto', marginTop: '0.4rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 420 }}>
          <thead>
            <tr>
              <th style={cell({ textAlign: 'left' })} />
              {['Cost', 'Price', 'Profit', 'Margin'].map((h) => (
                <th key={h} style={num({ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600, fontFamily: 'inherit' })}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comp.buckets.map((b) => (
              <tr key={b.kind}>
                <td style={cell()}>
                  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 6, background: COLORS[b.kind], verticalAlign: 0 }} />
                  <span style={{ fontWeight: 600 }}>{b.name}</span>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    {b.rows} row{b.rows === 1 ? '' : 's'} · {Math.round(b.count).toLocaleString('en-US')} {b.unit} · {pct(b.revenueShare)} of the price
                  </span>
                </td>
                <td style={num(b.cost > 0 ? {} : { color: 'var(--text-faint)' })}>{b.cost > 0 ? money(b.cost) : 'no cost'}</td>
                <td style={num()}>{money(b.revenue)}</td>
                <td style={num(b.margin == null ? { color: 'var(--text-faint)' } : b.profit < 0 ? { color: 'var(--text-red-700)' } : {})}>{b.margin == null ? '—' : money(b.profit)}</td>
                <td style={num({ fontFamily: 'inherit', fontWeight: 700, color: b.margin == null ? 'var(--text-faint)' : marginColor(b.margin) })}>{pct(b.margin)}</td>
              </tr>
            ))}
            <tr>
              <td style={cell(totalTd())}>The bid</td>
              <td style={num(totalTd())}>{money(comp.totalCost)}</td>
              <td style={num(totalTd())}>{money(comp.totalRevenue)}</td>
              <td style={num(totalTd())}>{money(totalProfit)}</td>
              <td style={num(totalTd({ fontFamily: 'inherit', color: comp.totalCost > 0 ? marginColor(totalProfit / comp.totalRevenue) : 'var(--text-faint)' }))}>{comp.totalCost > 0 ? pct(totalProfit / comp.totalRevenue) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>A row's kind is the chip under its name: the app's guess until someone sets it. A kind's cost is its rows' material, tax and labor.</p>
    </BreakdownCardShell>
  )
}

import { NO_TAG, buildTagComposition, type CompositionRowInput } from '../../lib/bids/pricingComposition'
import { formatCurrency } from '../../lib/format'
import { BreakdownCardShell, type BreakdownSlice } from './BreakdownCardShell'

type Props = {
  /** The Workbench's effective rows with their tags. */
  rows: ReadonlyArray<CompositionRowInput>
  marginColor: (m: number | null) => string
}

const TAG_COLORS = ['#2563eb', '#0d9488', '#9333ea', '#c2410c', '#0369a1', '#4d7c0f', '#be185d', '#b45309']
const NO_TAG_COLOR = '#94a3b8'

const money = (n: number | null) => (n == null ? '—' : `$${formatCurrency(n)}`)
const pct = (m: number | null) => (m == null ? '—' : `${Math.round(m * 1000) / 10}%`)

/**
 * What the price is made of, by tag (punch list #128): the estimator's own words on the rows,
 * each with its cost, price, profit and margin in the price card's shape, then No tag, then the
 * bid. A row with two tags counts in both and the note says so rather than pretending the lines
 * add. Tags are never on paper.
 */
export function TagBreakdownCard({ rows, marginColor }: Props) {
  const comp = buildTagComposition(rows)
  if (comp.totalRevenue <= 0) return null
  const tagged = comp.buckets.filter((b) => b.tag !== NO_TAG)
  const colorOf = (tag: string): string => (tag === NO_TAG ? NO_TAG_COLOR : (TAG_COLORS[Math.max(tagged.findIndex((b) => b.tag === tag), 0) % TAG_COLORS.length] ?? NO_TAG_COLOR))
  const sum = comp.buckets.reduce((s, b) => s + b.revenue, 0)
  const sumCost = comp.buckets.reduce((s, b) => s + b.cost, 0)
  const cell = (s: React.CSSProperties = {}): React.CSSProperties => ({ padding: '0.4rem 0.3rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', ...s })
  const num = (s: React.CSSProperties = {}): React.CSSProperties => cell({ textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...s })
  const totalTd = (s: React.CSSProperties = {}): React.CSSProperties => ({ borderBottom: 'none', borderTop: '2px solid var(--text-strong)', fontWeight: 700, ...s })
  const slices: BreakdownSlice[] = comp.buckets.map((b) => ({ key: b.tag, name: b.tag, color: colorOf(b.tag), share: b.revenueShare }))
  return (
    <BreakdownCardShell
      storageKey="pt.pricing.card.tag"
      title="Tag breakdown"
      sub={tagged.length === 0 ? 'no tags yet — type a word under a row’s name' : `${tagged.length} tag${tagged.length === 1 ? '' : 's'}`}
      slices={tagged.length > 0 ? slices : []}
      totals={{ cost: sumCost, price: sum, profit: sum - sumCost, margin: sum > 0 && sumCost > 0 ? (sum - sumCost) / sum : null }}
      marginColor={marginColor}
    >
      {tagged.length > 0 ? (
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
                <tr key={b.tag}>
                  <td style={cell()}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 6, background: colorOf(b.tag), verticalAlign: 0 }} />
                    <span style={{ fontWeight: 600, color: b.tag === NO_TAG ? 'var(--text-muted)' : 'var(--text-strong)' }}>{b.tag}</span>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                      {b.rows} row{b.rows === 1 ? '' : 's'} · {pct(b.revenueShare)} of the price
                      {b.markup != null ? (
                        <>
                          {' '}· material sold at <b style={{ color: 'var(--text-strong)' }}>+{Math.round(b.markup * 1000) / 10}%</b>
                        </>
                      ) : null}
                    </span>
                  </td>
                  <td style={num(b.cost > 0 ? {} : { color: 'var(--text-faint)' })}>{b.cost > 0 ? money(b.cost) : 'no cost'}</td>
                  <td style={num()}>{money(b.revenue)}</td>
                  <td style={num(b.margin == null ? { color: 'var(--text-faint)' } : b.profit < 0 ? { color: 'var(--text-red-700)' } : {})}>{b.margin == null ? '—' : money(b.profit)}</td>
                  <td style={num({ fontFamily: 'inherit', fontWeight: 700, color: b.margin == null ? 'var(--text-faint)' : marginColor(b.margin) })}>{pct(b.margin)}</td>
                </tr>
              ))}
              <tr>
                <td style={cell(totalTd())}>
                  {comp.rowsWithManyTags > 0 ? 'The lines' : 'The bid'}
                  {(() => {
                    const mc = comp.buckets.reduce((s, b) => s + b.materialCost, 0)
                    const mp = comp.buckets.reduce((s, b) => s + b.materialPrice, 0)
                    return mc > 0 ? <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>material sold at +{Math.round((mp / mc - 1) * 1000) / 10}% across the rows</span> : null
                  })()}
                </td>
                <td style={num(totalTd())}>{money(sumCost)}</td>
                <td style={num(totalTd())}>{money(sum)}</td>
                <td style={num(totalTd())}>{money(sum - sumCost)}</td>
                <td style={num(totalTd({ fontFamily: 'inherit', color: sum > 0 && sumCost > 0 ? marginColor((sum - sumCost) / sum) : 'var(--text-faint)' }))}>{sum > 0 && sumCost > 0 ? pct((sum - sumCost) / sum) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {tagged.length > 0 ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {comp.rowsWithManyTags > 0
            ? `${comp.rowsWithManyTags} row${comp.rowsWithManyTags === 1 ? ' carries' : 's carry'} two tags, so the lines add to ${money(sum)}, more than the price (${money(comp.totalRevenue)}).`
            : `Every row counts once; the lines add to the price, ${money(comp.totalRevenue)}. A tag's cost is its rows' material, tax and labor.`}
        </p>
      ) : null}
    </BreakdownCardShell>
  )
}

import { useState } from 'react'
import { buildPriceBreakdown, priceBreakdownNote, type PriceBreakdown, type PriceBreakdownInput, type PriceLine } from '../../lib/bids/priceBreakdown'
import { formatCurrency } from '../../lib/format'
import { BreakdownCardShell, type BreakdownSlice } from './BreakdownCardShell'

type Props = {
  input: PriceBreakdownInput
  /** The company markup (0.40), so the chip can say when the bid's own differs. */
  companyMarkup: number
  /** The chip's text as it is typed (the screen follows): null = the company number. */
  onMarkupChange: (markup: number | null) => void
  /** The chip is left: write the bid's own markup (null = back to the company number). */
  onMarkupCommit?: (markup: number | null) => void
  /** The Open Labor door. */
  onOpenLabor?: () => void
  marginColor: (m: number | null) => string
}

const COLORS: Record<PriceLine['key'], string> = {
  material: '#64748b',
  tax: '#8b5cf6',
  equipment: '#f59e0b',
  labor: '#0ea5e9',
  small: '#cbd5e1',
}
const AMBER = '#f59e0b'

const money = (n: number | null) => (n == null ? '—' : `$${formatCurrency(n)}`)
const pct = (m: number | null) => (m == null ? '—' : `${Math.round(m * 1000) / 10}%`)

/**
 * What the price is made of (punch list #128): material · sales tax · equipment ·
 * labor · the small costs, in three columns — Cost · Price · Profit — that add to the strip's
 * cost and revenue. Labor's price is what is left of the price (Wendi's rule); its cost is the
 * hours × the rate, and with no hours the line reads "Labor and margin" on amber and offers Labor.
 */
export function PriceBreakdownCard({ input, companyMarkup, onMarkupChange, onMarkupCommit, onOpenLabor, marginColor }: Props) {
  const b: PriceBreakdown = buildPriceBreakdown(input)
  const [draft, setDraft] = useState<string | null>(null)
  if (!(b.price > 0)) return null
  const note = priceBreakdownNote(b, { laborRate: input.laborRate })
  const ownMarkup = Math.abs(input.markup - companyMarkup) > 1e-9
  const cell = (s: React.CSSProperties = {}): React.CSSProperties => ({ padding: '0.4rem 0.3rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', ...s })
  const num = (s: React.CSSProperties = {}): React.CSSProperties => cell({ textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...s })
  const commitMarkup = () => {
    if (draft == null) return
    const text = draft.replace(/[%\s]/g, '')
    setDraft(null)
    if (text === '') {
      onMarkupCommit?.(null)
      return
    }
    const v = parseFloat(text)
    if (!Number.isFinite(v) || v < 0) return
    const m = v / 100
    ;(onMarkupCommit ?? onMarkupChange)(Math.abs(m - companyMarkup) < 1e-9 ? null : m)
  }
  const slices: BreakdownSlice[] = b.lines.filter((l) => l.price != null && l.price > 0).map((l) => ({ key: l.key, name: l.name, color: l.key === 'labor' && !b.laborCosted ? AMBER : COLORS[l.key], share: (l.price as number) / b.price }))
  return (
    <BreakdownCardShell storageKey="pt.pricing.card.traditional" title="Traditional breakdown" sub="material, tax, equipment, labor" slices={slices} totals={{ cost: b.cost, price: b.price, profit: b.profit, margin: b.margin }} marginColor={marginColor}>
      <div style={{ overflowX: 'auto', marginTop: '0.4rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 420 }}>
          <thead>
            <tr>
              <th style={cell({ textAlign: 'left', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 })}></th>
              {['Cost', 'Price', 'Profit', 'Margin'].map((h) => (
                <th key={h} style={num({ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600, fontFamily: 'inherit' })}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.lines.map((l) => {
              const amber = l.key === 'labor' && !b.laborCosted
              const rowBg = amber ? 'rgba(245, 158, 11, 0.14)' : undefined
              return (
                <tr key={l.key} style={{ background: rowBg }}>
                  <td style={cell()}>
                    <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, marginRight: 6, background: amber ? AMBER : COLORS[l.key], verticalAlign: 0 }} />
                    <span style={{ fontWeight: 600 }}>{l.name}</span>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                      {l.key === 'material' ? (
                        <>
                          the takeoff
                          {b.weightedMarkup != null ? (
                            <>
                              {' '}· sold at <b style={{ color: 'var(--text-strong)' }}>+{Math.round(b.weightedMarkup * 1000) / 10}%</b>
                            </>
                          ) : null}{' '}
                          · the bid's{' '}
                          <span style={{ display: 'inline-flex', alignItems: 'center', border: `1px ${ownMarkup ? 'solid' : 'dashed'} var(--border-strong)`, borderRadius: 999, padding: '0 0.4rem', background: 'var(--surface)' }}>
                            +
                            <input
                              id="price-breakdown-markup"
                              type="text"
                              inputMode="decimal"
                              aria-label="This bid's material markup, percent"
                              title={ownMarkup ? `This bid's own number; the company's is ${Math.round(companyMarkup * 1000) / 10}%. Clear it to go back.` : 'The company number. Type one for this bid alone.'}
                              value={draft ?? String(Math.round(input.markup * 1000) / 10)}
                              onChange={(e) => {
                                setDraft(e.target.value)
                                const v = parseFloat(e.target.value.replace(/[%\s]/g, ''))
                                if (e.target.value.trim() === '') onMarkupChange(null)
                                else if (Number.isFinite(v) && v >= 0) onMarkupChange(Math.abs(v / 100 - companyMarkup) < 1e-9 ? null : v / 100)
                              }}
                              onBlur={commitMarkup}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur()
                                if (e.key === 'Escape') setDraft(null)
                              }}
                              style={{ width: '3.2em', border: 'none', background: 'transparent', font: 'inherit', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', textAlign: 'right', color: 'var(--text-strong)', padding: 0 }}
                            />
                            %
                          </span>{' '}
                          {ownMarkup ? '(this bid)' : '(the company)'}
                        </>
                      ) : (
                        l.rule
                      )}
                    </span>
                  </td>
                  <td style={num(l.cost == null ? { color: 'var(--text-amber-700)', fontFamily: 'inherit' } : {})}>{l.cost == null ? (b.hours > 0 ? 'no rate' : 'no hours') : money(l.cost)}</td>
                  <td style={num(l.price == null ? { color: 'var(--text-faint)' } : {})}>{l.price == null ? '—' : money(l.price)}</td>
                  <td style={num(l.key === 'small' ? { color: 'var(--text-faint)', fontFamily: 'inherit' } : l.profit == null ? { color: 'var(--text-faint)' } : l.profit < 0 ? { color: 'var(--text-red-700)' } : {})}>
                    {l.key === 'small' ? 'in labor' : l.profit == null ? '—' : money(l.profit)}
                  </td>
                  <td style={num({ fontFamily: 'inherit', fontWeight: 700, color: l.margin == null ? 'var(--text-faint)' : marginColor(l.margin) })}>{l.margin == null ? (l.key === 'tax' || l.key === 'small' ? '' : '—') : pct(l.margin)}</td>
                </tr>
              )
            })}
            <tr>
              <td style={cell({ borderBottom: 'none', borderTop: '2px solid var(--text-strong)', fontWeight: 700 })}>The bid</td>
              <td style={num({ borderBottom: 'none', borderTop: '2px solid var(--text-strong)', fontWeight: 700 })}>{money(b.cost)}</td>
              <td style={num({ borderBottom: 'none', borderTop: '2px solid var(--text-strong)', fontWeight: 700 })}>{money(b.price)}</td>
              <td style={num({ borderBottom: 'none', borderTop: '2px solid var(--text-strong)', fontWeight: 700 })}>{money(b.profit)}</td>
              <td style={num({ borderBottom: 'none', borderTop: '2px solid var(--text-strong)', fontWeight: 700, fontFamily: 'inherit', color: b.margin == null ? 'var(--text-faint)' : marginColor(b.margin) })}>{pct(b.margin)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.76rem', padding: '0.4rem 0.6rem', borderRadius: 8, background: note.tone === 'warn' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(22, 163, 74, 0.12)', color: note.tone === 'warn' ? 'var(--text-amber-700)' : '#15803d', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{note.words}</span>
        {!b.laborCosted && b.hours === 0 && onOpenLabor ? (
          <button type="button" onClick={onOpenLabor} style={{ font: 'inherit', fontSize: '0.74rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid #b45309', background: 'var(--surface)', color: 'var(--text-amber-700)', cursor: 'pointer' }}>
            Open Labor
          </button>
        ) : null}
      </div>
    </BreakdownCardShell>
  )
}

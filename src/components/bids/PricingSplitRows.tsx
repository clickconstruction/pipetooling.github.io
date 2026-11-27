/**
 * The split under a Workbench row (punch list #128, moved out of `BidsPricingTab` in v2.8754, punch list #46 row 1):
 * the row's price as child rows in the parent's own columns, Cost/unit · Sale price/unit · Revenue · Profit · Margin
 * per part, so a part reads like a row. A fixture splits three ways, Material · Sales tax · Labor. An equipment row
 * is one line of its own. A row with no price says there is nothing to split.
 *
 * Moved as it stood: the same lines, the same words, the same presses. The tab hands it the row, the row's split
 * (`rowPriceSplit`), and the pieces it read from the tab's closure: the tax percent, the bid's markup, the markup
 * box's draft with its setter, the two writes, the quiet cell's look and the margin's colour.
 */
import type { CSSProperties, ReactElement } from 'react'
import { formatCurrency } from '../../lib/format'
import { parseSplitDollars, type RowSplit } from '../../lib/bids/rowPriceSplit'
import type { PricingRowMarks } from '../../hooks/usePricingRowMarks'
import { MoneyText } from '../Money'

export type PricingSplitRowsProps = {
  /** The row as the grid draws it: its count, what it is worth on screen now, its material and its labor. */
  r: { countRow: { id: string; fixture?: string | null }; count: number; effRevenue: number; materialsBeforeTax: number; laborCost: number }
  /** The row's split: `splitOf(r)` in the tab. */
  s: RowSplit
  /** `derived.taxPercent`. */
  taxPct: number
  /** The bid's material markup, for the markup box's title. */
  materialMarkup: number
  wbMarkupDraft: PricingRowMarks['wbMarkupDraft']
  setWbMarkupDraft: PricingRowMarks['setWbMarkupDraft']
  commitRowMarkupText: PricingRowMarks['commitRowMarkupText']
  updateRowMarks: PricingRowMarks['updateRowMarks']
  /** The grid's quiet cell look at the price column's width: `wbCellStyle('6rem')` in the tab. */
  priceCellStyle: CSSProperties
  /** The colour a margin reads in: `mColor` in the tab. */
  mColor: (m: number | null) => string
}

export function PricingSplitRows({ r, s, taxPct, materialMarkup, wbMarkupDraft, setWbMarkupDraft, commitRowMarkupText, updateRowMarks, priceCellStyle, mColor }: PricingSplitRowsProps): ReactElement {
  const n = r.count > 0 ? r.count : 1
  const priced = r.effRevenue > 0
  const matCostEa = r.materialsBeforeTax / n
  // Equipment is an item of its own (a row whose kind is Equipment), never a part of a
  // fixture's price — the owner's call; so a fixture splits three ways, an equipment
  // row not at all.
  const isEquipmentRow = s.equipmentSource === 'kind'
  const parts: Array<{
    key: 'material' | 'tax' | 'equipment' | 'labor'
    name: string
    note: string
    costEa: number | null
    priceEa: number
    typed: boolean
    editable: boolean
    toggle?: () => void
  }> = isEquipmentRow
    ? [{ key: 'equipment', name: 'Equipment', note: 'an item of its own; its cost is on the Labor tab\'s rentals', costEa: null, priceEa: s.equipment / n, typed: false, editable: false }]
    : [
        { key: 'material', name: 'Material', note: s.materialSource === 'typed' ? 'typed' : s.materialSource === 'takeoff' ? `the takeoff +${Math.round(s.markup * 1000) / 10}%` : 'none', costEa: matCostEa, priceEa: s.material / n, typed: s.materialSource === 'typed', editable: true },
        { key: 'tax', name: 'Sales tax', note: s.taxable ? `${taxPct}% on material` : 'tax-free', costEa: matCostEa * (taxPct / 100), priceEa: s.tax / n, typed: !s.taxable, editable: false, toggle: () => updateRowMarks(r.countRow.id, (m) => ({ ...m, split: { ...(m.split ?? {}), taxable: !s.taxable } })) },
        { key: 'labor', name: 'Labor', note: 'what is left', costEa: r.laborCost > 0 ? r.laborCost / n : null, priceEa: s.labor / n, typed: false, editable: false },
      ]
  const childTd = (extra?: CSSProperties): CSSProperties => ({ padding: '0.15rem 0.7rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', fontSize: '0.78rem', color: 'var(--text-700)', verticalAlign: 'middle', ...extra })
  const money = (v: number | null, sign = false) => (v == null ? '—' : `${sign && v < 0 ? '−' : ''}$${formatCurrency(Math.abs(v))}`)
  if (!priced)
    return (
      <tr key={`${r.countRow.id}-unpriced`} id={`wb-split-${r.countRow.id}`}>
        <td style={childTd({ borderBottom: '1px solid var(--border)' })} />
        <td colSpan={9} style={childTd({ borderBottom: '1px solid var(--border)', paddingLeft: '2.1rem', color: 'var(--text-faint)' })}>
          <span style={{ marginRight: '0.4rem' }}>└</span>No price on this row yet, so nothing to split.
        </td>
      </tr>
    )
  return (
    <>
      {parts.map((part, i) => {
        const last = i === parts.length - 1
        const revenue = part.priceEa * n
        const costRow = part.costEa == null ? null : part.costEa * n
        const profit = costRow == null ? null : revenue - costRow
        const margin = profit != null && revenue > 0 ? profit / revenue : null
        const under = part.key === 'labor' && s.labor < -0.005
        const td = (extra?: CSSProperties) => childTd({ ...(last ? { borderBottom: '1px solid var(--border)' } : {}), ...extra })
        return (
          <tr key={`${r.countRow.id}-${part.key}`} id={i === 0 ? `wb-split-${r.countRow.id}` : undefined}>
            <td style={td()} />
            <td style={td({ paddingLeft: '2.1rem' })}>
              <span style={{ color: 'var(--text-faint)', marginRight: '0.4rem' }}>{last ? '└' : '├'}</span>
              <span style={{ fontWeight: part.key === 'labor' ? 600 : 500, color: under ? 'var(--text-red-700)' : 'var(--text-strong)' }}>{part.name}</span>
              {part.toggle ? (
                <button type="button" onClick={part.toggle} aria-pressed={s.taxable} title={s.taxable ? 'Taxed — press to make this row tax-free' : 'Tax-free — press to tax its material'} style={{ marginLeft: '0.5rem', font: 'inherit', fontSize: '0.66rem', color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  {part.note}
                </button>
              ) : part.key === 'material' && s.materialSource === 'takeoff' ? (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.66rem', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  the takeoff +
                  <input
                    type="text"
                    inputMode="decimal"
                    value={wbMarkupDraft?.rowId === r.countRow.id ? wbMarkupDraft.text : String(Math.round(s.markup * 1000) / 10)}
                    aria-label={`The material markup, percent, on ${r.countRow.fixture ?? 'row'}`}
                    title={s.markupSource === 'row' ? `This row's own markup; the bid's is ${Math.round(materialMarkup * 1000) / 10}%. Clear it to go back.` : "The bid's markup. Type one for this row alone."}
                    onFocus={(e) => setWbMarkupDraft({ rowId: r.countRow.id, text: e.target.value })}
                    onChange={(e) => setWbMarkupDraft({ rowId: r.countRow.id, text: e.target.value })}
                    onBlur={(e) => {
                      setWbMarkupDraft(null)
                      commitRowMarkupText(r.countRow.id, e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.stopPropagation()
                      e.currentTarget.blur()
                    }}
                    style={{ width: '2.6em', font: 'inherit', fontSize: '0.66rem', textAlign: 'right', padding: '0 0.15rem', margin: '0 0.05rem', borderRadius: 3, border: `1px ${s.markupSource === 'row' ? 'solid' : 'dashed'} var(--border-strong)`, background: 'var(--surface)', color: s.markupSource === 'row' ? 'var(--text-strong)' : 'var(--text-700)' }}
                  />
                  %
                </span>
              ) : (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.66rem', color: 'var(--text-faint)' }}>{part.note}</span>
              )}
            </td>
            <td style={td({ textAlign: 'center', color: 'var(--text-faint)' })}>{priced ? r.count : ''}</td>
            <td style={td({ textAlign: 'right', fontVariantNumeric: 'tabular-nums' })}>{priced ? <MoneyText text={money(part.costEa)} /> : ''}</td>
            <td style={td()} />
            <td style={td({ textAlign: 'right' })}>
              {!priced ? (
                <span style={{ color: 'var(--text-faint)' }}>—</span>
              ) : part.editable ? (
                <input
                  type="text"
                  inputMode="decimal"
                  key={`${r.countRow.id}-${part.key}-${part.typed ? 't' : 'd'}-${Math.round(part.priceEa * 100)}`}
                  defaultValue={part.priceEa > 0 || part.typed ? formatCurrency(part.priceEa) : ''}
                  placeholder="—"
                  aria-label={`${part.name} per unit in the price of ${r.countRow.fixture ?? 'row'}`}
                  title={part.typed ? 'Typed for this row — clear it to go back to the rule' : `The rule: ${part.note}. Type over it for this row.`}
                  onBlur={(e) => {
                    const v = parseSplitDollars(e.target.value)
                    updateRowMarks(r.countRow.id, (m) => ({ ...m, split: { ...(m.split ?? {}), material: v == null ? null : Math.round(v * n * 100) / 100 } }))
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.stopPropagation()
                    e.currentTarget.blur()
                  }}
                  style={{ ...priceCellStyle, fontSize: '0.78rem', color: part.typed ? 'var(--text-strong)' : 'var(--text-700)', borderBottomStyle: part.typed ? 'solid' : 'dashed' }}
                />
              ) : (
                <span style={{ display: 'inline-block', width: '6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: under ? 'var(--text-red-700)' : part.key === 'labor' ? 'var(--text-strong)' : 'var(--text-700)', fontWeight: part.key === 'labor' ? 600 : 400, textDecoration: part.key === 'tax' && !s.taxable ? 'line-through' : 'none' }}>
                  <MoneyText text={money(part.priceEa, true)} />
                </span>
              )}
            </td>
            <td style={td({ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: under ? 'var(--text-red-700)' : undefined, fontWeight: part.key === 'labor' ? 600 : 400 })}>{priced ? <MoneyText text={money(revenue, true)} /> : ''}</td>
            <td style={td({ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: profit != null && profit < 0 ? 'var(--text-red-700)' : undefined })}>{priced ? <MoneyText text={money(profit, true)} /> : ''}</td>
            <td style={td({ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: margin == null ? 'var(--text-faint)' : mColor(margin) })}>{priced && margin != null ? `${Math.round(margin * 100)}%` : ''}</td>
            <td style={td()} />
          </tr>
        )
      })}
    </>
  )
}

import { useState } from 'react'
import { ToolFooter, ToolPopover } from './RowScopePicker'
import { useRowScope, type ScopedRow } from '../../hooks/useRowScope'

export type TaxToolRow = ScopedRow & {
  /** True while the row's material is taxed. */
  taxable: boolean
  /** False for an Equipment row or one with no material — nothing to tax. */
  hasMaterial: boolean
}

type Props = {
  rows: ReadonlyArray<TaxToolRow>
  taxPercent: number
  /** The bid's rate, typed in the tool; absent = the rate is read-only here. */
  onTaxPercentChange?: (pct: number) => void
  /** The rate cell is left: save the bid's rate. */
  onTaxPercentCommit?: (text: string) => void
  onApply: (rowIds: string[], taxable: boolean) => void
  undoCount: number
  onUndo: () => void
  onClose: () => void
}

/**
 * The tax tool (punch list #128): the markup tool's twin — Tax-free or Taxed, over a scope of
 * rows, one button that says how many it sets, one Undo. It writes each row's own taxable flag.
 */
export function TaxToolPopover({ rows, taxPercent, onTaxPercentChange, onTaxPercentCommit, onApply, undoCount, onUndo, onClose }: Props) {
  const [makeTaxable, setMakeTaxable] = useState(false)
  const [rateText, setRateText] = useState<string | null>(null)
  const withMaterial = rows.filter((r) => r.hasMaterial)
  const { candidates, picker } = useRowScope(
    withMaterial,
    [
      { key: 'all', words: 'Every row with material', keep: () => true },
      { key: 'taxed', words: 'The taxed rows', keep: (r) => r.taxable },
      { key: 'free', words: 'The tax-free rows', keep: (r) => !r.taxable },
    ],
    { type: 'preset', key: makeTaxable ? 'free' : 'taxed' },
  )
  const changing = candidates.filter((r) => r.taxable !== makeTaxable)
  const pill = (on: boolean, words: string, pick: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={pick}
      style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: on ? 700 : 500, padding: '0.15rem 0.7rem', border: 'none', background: on ? 'var(--text-strong)' : 'transparent', color: on ? 'var(--surface)' : 'var(--text-700)', cursor: 'pointer' }}
    >
      {words}
    </button>
  )
  return (
    <ToolPopover label="Sales tax tool" onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Sales tax</span>
        <span role="group" aria-label="Make the rows" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
          {pill(!makeTaxable, 'Tax-free', () => setMakeTaxable(false))}
          {pill(makeTaxable, onTaxPercentChange ? 'Taxed at' : `Taxed at ${taxPercent}%`, () => setMakeTaxable(true))}
          {onTaxPercentChange ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 0.5rem 0 0', background: makeTaxable ? 'var(--text-strong)' : 'transparent', color: makeTaxable ? 'var(--surface)' : 'var(--text-700)', fontSize: '0.78rem' }}>
              <input
                type="text"
                inputMode="decimal"
                value={rateText ?? String(taxPercent)}
                aria-label="The bid's sales tax rate, percent"
                title="The rate this bid taxes material at — it varies by city; every taxed row follows it"
                onFocus={(e) => {
                  setMakeTaxable(true)
                  setRateText(e.target.value)
                }}
                onChange={(e) => {
                  setRateText(e.target.value)
                  const v = Number(e.target.value.replace(/[%\s]/g, ''))
                  if (Number.isFinite(v) && v >= 0 && v <= 100) onTaxPercentChange(Math.round(v * 100) / 100)
                }}
                onBlur={(e) => {
                  setRateText(null)
                  onTaxPercentCommit?.(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                style={{ width: '3.4em', font: 'inherit', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center', border: 'none', borderBottom: '1px dashed currentColor', background: 'transparent', color: 'inherit', padding: '0 0.15rem', margin: '0 0.15rem 0 0.3rem', fontVariantNumeric: 'tabular-nums', borderRadius: 3 }}
              />
              %
            </span>
          ) : null}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {withMaterial.filter((r) => !r.taxable).length} of {withMaterial.length} rows are tax-free now
        </span>
      </div>
      {picker}
      <ToolFooter
        action={changing.length === 0 ? (candidates.length === 0 ? 'Nothing to set' : `Already ${makeTaxable ? 'taxed' : 'tax-free'}`) : `Make ${changing.length} row${changing.length === 1 ? '' : 's'} ${makeTaxable ? 'taxed' : 'tax-free'}`}
        disabled={changing.length === 0}
        onAction={() => onApply(changing.map((r) => r.id), makeTaxable)}
        undoCount={undoCount}
        onUndo={onUndo}
      />
    </ToolPopover>
  )
}

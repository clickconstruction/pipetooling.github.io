import { useEffect, useRef, useState } from 'react'
import { ToolFooter, ToolPopover } from './RowScopePicker'
import { useRowScope, type ScopedRow } from '../../hooks/useRowScope'

export type MarkupToolRow = ScopedRow & {
  /** True when the row carries a markup of its own (typed on its Material line or by this tool). */
  own: boolean
  /** The markup the row's material is sold at now, 0.60 for 60%. */
  markup: number
  /** False for an Equipment row or one with no material — the tool skips it. */
  hasMaterial: boolean
}

type Props = {
  rows: ReadonlyArray<MarkupToolRow>
  /** The bid's number, 0.50 for 50%. */
  bidMarkup: number
  /** Σ material sold ÷ Σ material cost − 1 across the rows; null with no material. */
  weightedMarkup: number | null
  onApply: (rowIds: string[], markup: number) => void
  undoCount: number
  onUndo: () => void
  onClose: () => void
}

const pct = (m: number) => `${Math.round(m * 1000) / 10}%`

/**
 * The markup tool (punch list #128): the margin brush's sibling — one number, a scope (every
 * row, only the rows still on the bid's number, a tag, a kind), a button that says how many rows
 * it will set, and one Undo. It writes each row's own markup, so the Material lines go solid.
 */
export function MarkupToolPopover({ rows, bidMarkup, weightedMarkup, onApply, undoCount, onUndo, onClose }: Props) {
  const [text, setText] = useState(String(Math.round(bidMarkup * 1000) / 10))
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  const withMaterial = rows.filter((r) => r.hasMaterial)
  const { candidates, picker } = useRowScope(
    withMaterial,
    [
      { key: 'all', words: 'Every row with material', keep: () => true },
      { key: 'untouched', words: "Only rows still on the bid's number", keep: (r) => !r.own },
    ],
    { type: 'preset', key: 'untouched' },
  )
  const v = Number(text.replace(/[%\s]/g, ''))
  const markup = Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 1000 : null
  const apply = () => markup != null && candidates.length > 0 && onApply(candidates.map((r) => r.id), markup)
  return (
    <ToolPopover label="Material markup tool" onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Material markup</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 0.4rem', background: 'var(--surface)' }}>
          +
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply()
            }}
            aria-label="The markup to set, percent"
            style={{ width: '3.4em', font: 'inherit', fontSize: '0.95rem', fontWeight: 700, textAlign: 'right', border: 'none', background: 'transparent', color: 'var(--text-strong)', padding: '0.15rem 0', fontVariantNumeric: 'tabular-nums' }}
          />
          %
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          the bid's number is +{pct(bidMarkup)}
          {weightedMarkup != null ? ` · the rows are at +${pct(weightedMarkup)}` : ''}
        </span>
      </div>
      {picker}
      <ToolFooter
        action={candidates.length === 0 ? 'Nothing to set' : `Set ${candidates.length} row${candidates.length === 1 ? '' : 's'} to +${markup == null ? '…' : pct(markup)}`}
        disabled={markup == null || candidates.length === 0}
        onAction={apply}
        undoCount={undoCount}
        onUndo={onUndo}
      />
    </ToolPopover>
  )
}

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { marginFromMarkup, markupBar, pairFromMarkup, pairTyped, type MarkupPairState, type MarkupSide } from '../../lib/charges/markupMargin'

/**
 * The markup pair (v2.6538): two boxes side by side, the markup over cost and the margin it makes on the sale. Type in
 * either and the other follows, so a person enters the number the way they think of it and sees both. Under the
 * boxes a bar shows the cost and the markup as parts of what the customer pays, from the job's own materials cost
 * where the door has it and from $1,000 of materials where it does not, so the control shows the number instead of
 * telling it. Every door that takes a markup on materials draws this one control: Settings → Jobs & billing, the
 * Charges window, and Edit Job → Charging the customer. What is stored is still the markup; the pair reads and writes
 * it through `markupMargin.ts`. A margin of 100% or more, or a markup below 0, is refused in words under the boxes.
 *
 * `onTyped` fires on every keystroke with the pair's state, for a door that saves with a press. `onCommit` fires when a
 * box is left or Enter is pressed, with the markup the pair stands for, for a door that saves as you pick; it never
 * fires while a box refuses.
 */

type Props = {
  /** The stored markup the pair draws, re-drawn when it changes. */
  markupPct: number | null
  /** On a job door: the company's markup, named in the placeholders and drawn on the bar when the job has none. Omit on the company's own door. */
  companyMarkupPct?: number | null
  /** Dollars of materials the bar starts from: the job's own cost where the door has it. $1,000 when omitted. */
  barCost?: number
  /** What the bar's cost is: `11 lines on this job`. `$1,000 of materials` when omitted. */
  barCostWords?: string
  disabled?: boolean
  /** Smaller boxes for a crowded row. */
  compact?: boolean
  /** The markup box's test id; the margin box is `<testId>-margin`, the refusal `<testId>-refusal`, the bar `<testId>-bar`. */
  testId: string
  onTyped?: (state: MarkupPairState) => void
  onCommit?: (markupPct: number | null) => void
}

const labelStyle: CSSProperties = { display: 'grid', gap: 3, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }

export function MaterialsMarkupPair({ markupPct, companyMarkupPct, barCost, barCostWords, disabled, compact, testId, onTyped, onCommit }: Props) {
  const [pair, setPair] = useState<MarkupPairState>(() => pairFromMarkup(markupPct))

  useEffect(() => {
    setPair(pairFromMarkup(markupPct))
  }, [markupPct])

  const field: CSSProperties = {
    width: compact ? 84 : 110,
    padding: compact ? '0.3rem 0.4rem' : '0.4rem 0.5rem',
    fontSize: compact ? '0.8125rem' : '0.875rem',
    textAlign: 'right',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    background: 'var(--surface)',
    color: 'var(--text-base)',
    font: 'inherit',
  }

  const placeholders =
    companyMarkupPct === undefined
      ? { markup: 'not set', margin: 'not set' }
      : companyMarkupPct == null
        ? { markup: 'at cost', margin: 'at cost' }
        : { markup: `Company: ${companyMarkupPct}`, margin: `Company: ${marginFromMarkup(companyMarkupPct) ?? 0}` }

  const type = (side: MarkupSide, raw: string) => {
    const next = pairTyped(side, raw)
    setPair(next)
    onTyped?.(next)
  }

  const commit = () => {
    if (pair.refusal) return
    onCommit?.(pair.markupPct)
  }

  const enterBlurs = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const box = (side: MarkupSide, words: string, text: string, placeholder: string, id: string, ariaLabel: string) => (
    <label style={labelStyle}>
      {words}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          min={0}
          step={0.01}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          data-testid={id}
          style={field}
          onChange={(e) => type(side, e.target.value)}
          onBlur={commit}
          onKeyDown={enterBlurs}
        />
        <span style={{ fontSize: compact ? '0.8125rem' : '0.875rem', color: 'var(--text-base)' }}>%</span>
      </span>
    </label>
  )

  // The bar draws the markup that stands: what is typed, else the company's on a job door, else none.
  const standing = pair.refusal ? null : (pair.markupPct ?? (companyMarkupPct === undefined ? null : companyMarkupPct))
  const bar = markupBar(barCost ?? 1000, standing)
  const barWidth = compact ? 'min(100%, 22rem)' : 'min(100%, 26rem)'
  const barWords: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

  return (
    <div style={{ display: 'grid', gap: 6 }} data-testid={`${testId}-pair`}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
        {box('markup', 'Markup, % over cost', pair.markupText, placeholders.markup, testId, 'Markup on materials, percent over cost')}
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', paddingBottom: compact ? '0.4rem' : '0.5rem' }}>
          =
        </span>
        {box('margin', 'Margin, % of the sale', pair.marginText, placeholders.margin, `${testId}-margin`, 'Margin on materials, percent of the sale')}
      </div>
      {pair.refusal ? (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-red-600)' }} data-testid={`${testId}-refusal`}>
          {pair.refusal}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 3, width: barWidth }} data-testid={`${testId}-bar`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...barWords }}>
            <span>{barCostWords ?? '$1,000 of materials'}</span>
            <span data-testid={`${testId}-bar-pays`} style={{ color: 'var(--text-base)', fontWeight: 600 }}>
              {bar.words.pays}
            </span>
          </div>
          <div
            role="img"
            aria-label={`${bar.words.costShare}, ${bar.words.marginShare}`}
            style={{ display: 'flex', height: compact ? 20 : 24, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}
          >
            <span style={{ width: `${bar.costShare}%`, minWidth: '14%', background: 'var(--bg-muted)', color: 'var(--text-base)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {bar.words.cost}
            </span>
            {standing != null && bar.markup > 0 ? (
              <span style={{ flex: 1, background: 'var(--bg-green-100)', color: 'var(--text-green-800)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {bar.words.markup}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...barWords }} data-testid={`${testId}-bar-words`}>
            <span>{bar.words.costShare}</span>
            <span>{bar.words.marginShare}</span>
          </div>
        </div>
      )}
    </div>
  )
}

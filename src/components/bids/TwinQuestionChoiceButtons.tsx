import type { CSSProperties } from 'react'
import type { OrderedChoice } from '../../lib/bids/twinQuestionChoices'

/**
 * One tap answers a robot's question (v2.3210). The robot's recommended pick
 * comes first and filled; the rest are outlined; "Something else…" swaps the
 * buttons for the free-text box the card always had. Shared by the Standing
 * rulings panel (Bids → Audits) and the operator's console (Settings →
 * Digital twins).
 */
type Props = {
  choices: OrderedChoice[]
  disabled?: boolean
  /** Copy after the tapped label when the answer fans out to several open copies: "· all 3". */
  fanOut?: number
  onPick: (choice: OrderedChoice) => void
  onSomethingElse: () => void
}

const BASE: CSSProperties = {
  padding: '0.4rem 0.8rem',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.85rem',
  font: 'inherit',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
}

export function TwinQuestionChoiceButtons({ choices, disabled, fanOut, onPick, onSomethingElse }: Props) {
  return (
    <span role="group" aria-label="Answer with one tap" style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
      {choices.map((c) => (
        <button
          key={c.label}
          type="button"
          disabled={disabled}
          title={c.recommended ? "The robot's own pick — one tap agrees" : 'Answer with this'}
          onClick={() => onPick(c)}
          style={
            c.recommended
              ? { ...BASE, background: '#3b82f6', color: 'white', border: '1px solid #3b82f6', fontWeight: 600 }
              : { ...BASE, background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)' }
          }
        >
          {c.recommended ? '★ ' : ''}
          {c.label}
          {fanOut && fanOut > 1 ? <span style={{ opacity: 0.75, fontWeight: 400 }}> · all {fanOut}</span> : null}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onSomethingElse}
        title="None of these — type your own answer"
        style={{ ...BASE, background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}
      >
        Something else…
      </button>
    </span>
  )
}

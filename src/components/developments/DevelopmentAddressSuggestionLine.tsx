import type { CSSProperties } from 'react'
import { developmentSuggestionWords, type DevelopmentAddressSuggestion } from '../../lib/developments/notInIt'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'

/**
 * The one line a form shows when a saved record with no development sits at an address other
 * members of one development share (punch list #208, v2.6019): *4 bids and 6 jobs at this
 * address are in Harlow Ranch.* and the press **Put it in Harlow Ranch**, which sets the form's
 * Development field; the form's own save (Edit Bid's autosave, Edit Job's identity slice) writes
 * it. Draws nothing when there is no suggestion. The words are `developmentSuggestionWords`.
 */
export function DevelopmentAddressSuggestionLine({
  suggestion,
  onPut,
  style,
}: {
  suggestion: DevelopmentAddressSuggestion | null
  onPut: (developmentId: string) => void
  style?: CSSProperties
}) {
  if (!suggestion) return null
  const words = developmentSuggestionWords(suggestion)
  return (
    <div
      role="status"
      data-testid="development-address-suggestion"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.35rem 0.6rem',
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
        ...style,
      }}
    >
      <DevelopmentHouseIcon size={12} style={{ flexShrink: 0 }} />
      <span style={{ minWidth: 0 }}>{words.line}</span>
      <button
        type="button"
        onClick={() => onPut(suggestion.developmentId)}
        style={{
          padding: '0.15rem 0.55rem',
          fontSize: '0.75rem',
          border: '1px dashed var(--border-sky)',
          borderRadius: 6,
          background: 'var(--surface)',
          color: 'var(--text-sky-700)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {words.button}
      </button>
    </div>
  )
}

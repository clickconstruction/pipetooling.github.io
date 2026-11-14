import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { RECEIPT_CHASE_WORDS as W } from '../../lib/needsYou/fillInReceipts'

/**
 * The receipt kind's answer on the Fill them in deck (punch list #299, the step after PR 2): **Got it** takes the row
 * off the office's list and moves on, so the card has no Save. **Copy the receipt link** makes the charge's link for
 * sending by hand and stays on the row. The line under them says what Got it does and does not do.
 */
export function ReceiptChasePresses({ disabled, copying, onGotIt, onCopyLink }: { disabled: boolean; copying: boolean; onGotIt: () => void; onCopyLink: () => void }) {
  const dead = disabled || copying
  return (
    <>
      <button
        type="button"
        data-testid="receipt-chase-got-it"
        disabled={dead}
        onClick={onGotIt}
        title={W.gotItHint}
        style={{
          borderRadius: 6,
          padding: '0.55rem 1.1rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: dead ? 'default' : 'pointer',
          border: dead ? '1px solid var(--border-strong)' : '1px solid #2563eb',
          background: dead ? DEAD_PRESS_FILL : '#2563eb',
          color: dead ? DEAD_PRESS_TEXT : '#fff',
        }}
      >
        {W.gotIt}
      </button>
      <button
        type="button"
        data-testid="receipt-chase-copy-link"
        disabled={dead}
        onClick={onCopyLink}
        style={{
          borderRadius: 6,
          padding: '0.55rem 1.1rem',
          fontSize: '0.875rem',
          cursor: dead ? 'default' : 'pointer',
          border: '1px solid var(--border-strong)',
          background: dead ? DEAD_PRESS_FILL : 'var(--surface)',
          color: dead ? DEAD_PRESS_TEXT : 'var(--text-700)',
        }}
      >
        {copying ? W.copying : W.copyLink}
      </button>
    </>
  )
}

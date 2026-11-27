import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { RECEIPT_CHASE_WORDS as W } from '../../lib/needsYou/fillInReceipts'

/**
 * The receipt kind's answer on the Fill them in deck (punch list #299, the step after PR 2): **Got it** takes the row
 * off the office's list and moves on, so the card has no Save. **Copy the receipt link** makes the charge's link for
 * sending by hand and stays on the row. The line under them says what Got it does and does not do. **Text again**
 * (v2.8697) is on a charge texted and reminded with no receipt: its label names the person, and the deck asks before
 * the text goes.
 */
export function ReceiptChasePresses({
  disabled,
  copying,
  onGotIt,
  onCopyLink,
  againLabel = null,
  texting = false,
  onTextAgain,
}: {
  disabled: boolean
  copying: boolean
  onGotIt: () => void
  onCopyLink: () => void
  /** The Text again press's words, or null on a row that has none. */
  againLabel?: string | null
  texting?: boolean
  onTextAgain?: () => void
}) {
  const dead = disabled || copying || texting
  const quiet: CSSProperties = {
    borderRadius: 6,
    padding: '0.55rem 1.1rem',
    minHeight: 44,
    fontSize: '0.875rem',
    cursor: dead ? 'default' : 'pointer',
    border: '1px solid var(--border-strong)',
    background: dead ? DEAD_PRESS_FILL : 'var(--surface)',
    color: dead ? DEAD_PRESS_TEXT : 'var(--text-700)',
  }
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
          minHeight: 44,
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
      {againLabel && onTextAgain ? (
        <button type="button" data-testid="receipt-chase-text-again" disabled={dead} onClick={onTextAgain} style={quiet}>
          {texting ? W.texting : againLabel}
        </button>
      ) : null}
      <button type="button" data-testid="receipt-chase-copy-link" disabled={dead} onClick={onCopyLink} style={quiet}>
        {copying ? W.copying : W.copyLink}
      </button>
    </>
  )
}

import type { CSSProperties } from 'react'
import type { ReceiptState, ReceiptStateTone } from '../../lib/tickets/receiptState'

/**
 * The receipt's state on a card charge, as a chip in a table cell (punch list #299, PR 3): green for a charge with its
 * paper, blue for one the app texted about, amber for one it could not text. The sentence behind it is its title. The
 * Banking ledger and Job Summary's cost drill-down draw it; a charge with nothing to say draws nothing.
 */
const TONE: Record<ReceiptStateTone, CSSProperties> = {
  has: { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' },
  waiting: { background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)' },
  held: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
}

export function ReceiptStateChip({ state, style }: { state: ReceiptState | null | undefined; style?: CSSProperties }) {
  if (!state) return null
  return (
    <span
      data-testid="receipt-state-chip"
      data-tone={state.tone}
      title={state.title}
      aria-label={`${state.chip}. ${state.title}`}
      style={{ display: 'inline-block', borderRadius: 999, padding: '0.05rem 0.5rem', fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap', ...TONE[state.tone], ...style }}
    >
      {state.chip}
    </span>
  )
}

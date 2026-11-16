/**
 * A closed job's chip on its bid's row (team scorecard, punch list #360, PR 5): *Closed +$2,300*, what the job made
 * against what the bid was priced to make, with the sentence behind it in its hover. Green over the estimate, amber
 * under it, quiet on it. Words only: the job's own costs are on the job.
 */
import type { CSSProperties } from 'react'
import type { CloseoutChip } from '../../lib/scorecard/myScore'

const BASE: CSSProperties = { display: 'inline-block', fontSize: '0.7rem', fontWeight: 600, padding: '0.08rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }
const TONE: Record<CloseoutChip['tone'], CSSProperties> = {
  up: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', border: '1px solid var(--border-green)' },
  down: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' },
  even: { background: 'var(--bg-subtle)', color: 'var(--text-700)', border: '1px solid var(--border)' },
}

export default function BidCloseoutChip({ chip }: { chip: CloseoutChip | null | undefined }) {
  if (!chip) return null
  return (
    <span data-testid="bid-closeout-chip" title={chip.title} style={{ ...BASE, ...TONE[chip.tone] }}>
      {chip.text}
    </span>
  )
}

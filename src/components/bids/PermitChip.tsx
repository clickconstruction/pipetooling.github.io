import type { CSSProperties } from 'react'
import type { Chip } from '../../lib/research/bidSitePanel'
import type { PermitNewsDoors } from '../../lib/research/bidPermitNews'

/** One chip of the bid's permit lines (punch list #307): a few words on a tint, in the app's tokens. */
const CHIP_TONES: Record<Chip['tone'], CSSProperties> = {
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
  grey: { background: 'var(--bg-200)', color: 'var(--text-700)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
}

// A long name is cut with an ellipsis, never wrapped: the chip is one line on a row.
const chipStyle: CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }

export function PermitChip({ chip }: { chip: Chip }) {
  return <span style={{ ...chipStyle, ...CHIP_TONES[chip.tone] }}>{chip.words}</span>
}

/**
 * The chip on a bid wherever the bid is chased (punch list #401): the board's row, a builder's
 * card in the Call queue, a Waiting to hear row. On a bid with a line in Followup's Permit news
 * the chip is a press that opens that line. On any other bid it is the label. Nothing is drawn
 * for a bid with no chip.
 */
export function PermitNewsChip({ bidId, news }: { bidId: string; news: PermitNewsDoors | undefined }) {
  const chip = news?.chips.get(bidId)
  if (!news || !chip) return null
  if (!news.lineBidIds.has(bidId)) return <PermitChip chip={chip} />
  return (
    <button
      type="button"
      data-testid="permit-news-chip"
      title="Open this bid's permit news on Followup"
      onClick={(e) => {
        // The row under the chip has its own press. This one goes to the news.
        e.stopPropagation()
        news.onOpen(bidId)
      }}
      style={{ ...chipStyle, ...CHIP_TONES[chip.tone], fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, border: '1px solid currentColor', cursor: 'pointer' }}
    >
      {chip.words} ›
    </button>
  )
}

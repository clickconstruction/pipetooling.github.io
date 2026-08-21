import { BID_LOSS_CATEGORIES, type BidLossCategoryKey } from '../../lib/bidLossCategories'

/**
 * The one loss-reason vocabulary, rendered identically everywhere a bid can be
 * marked lost (Edit Bid, the Why we lost lens, the Bid Board lost-summary
 * modal) — same six chips, same colors, same order (v2.2030).
 *
 * `suggestedKey` (from `suggestLossCategoryFromNote`) draws an amber ring on
 * one chip and a hint line under the row. Suggestions are never auto-applied:
 * confirming is always a human tap (or the caller's Enter handler).
 */
export function BidLossCategoryChips({
  value,
  onSelect,
  suggestedKey = null,
  suggestedHint,
  showKeyNumbers = false,
  size = 'md',
  disabled = false,
}: {
  value: string | null
  onSelect: (key: BidLossCategoryKey) => void
  suggestedKey?: BidLossCategoryKey | null
  /** Hint under the row while the suggestion is live, e.g. “suggested from your note — click to confirm”. */
  suggestedHint?: string
  /** Show the lens's 1–6 key numbers inside the chips. */
  showKeyNumbers?: boolean
  size?: 'md' | 'sm'
  disabled?: boolean
}) {
  const fontSize = size === 'sm' ? '0.72rem' : '0.8125rem'
  const padding = size === 'sm' ? '0.18rem 0.5rem' : '0.3rem 0.7rem'
  const suggesting = suggestedKey != null && value == null
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }} aria-label="Loss reasons">
        {BID_LOSS_CATEGORIES.map((c, i) => {
          const selected = value === c.key
          const suggested = suggesting && suggestedKey === c.key
          return (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(c.key)}
              aria-pressed={selected}
              style={{
                font: 'inherit',
                fontSize,
                padding,
                borderRadius: 999,
                cursor: disabled ? 'default' : 'pointer',
                background: c.chipBg,
                color: c.chipFg,
                border: `1.5px solid ${selected ? c.chipFg : suggested ? 'var(--text-amber-700)' : 'transparent'}`,
                boxShadow: suggested ? '0 0 0 1px var(--text-amber-700)' : undefined,
                fontWeight: selected ? 700 : 400,
              }}
            >
              {showKeyNumbers ? <span style={{ opacity: 0.65 }}>{i + 1} </span> : null}
              {c.label}
            </button>
          )
        })}
      </div>
      {suggesting && suggestedHint ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-amber-700)', marginTop: '0.3rem' }}>✦ {suggestedHint}</div>
      ) : null}
    </div>
  )
}

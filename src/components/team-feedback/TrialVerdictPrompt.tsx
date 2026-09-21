/**
 * Try-out loop, PR 2: the leader's own clock-out door. A sub (or a cleared helper) who led a
 * trial helper and clocks out is dealt the same cards as the Dashboard, before the crew deck.
 * The host fetches the feed right after the punch and opens this only when a card is pending.
 */
import type { CSSProperties } from 'react'
import TrialVerdictCards from './TrialVerdictCards'
import type { TrialVerdictCard } from '../../lib/hiring/trialVerdicts'

type Props = {
  open: boolean
  cards: readonly TrialVerdictCard[]
  userId: string
  /** A card was answered or skipped — the host drops it; the prompt closes when none are left. */
  onCardDone: (card: TrialVerdictCard) => void
  onClose: () => void
}

export default function TrialVerdictPrompt({ open, cards, userId, onCardDone, onClose }: Props) {
  if (!open || cards.length === 0) return null
  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="trial-verdict-prompt-title" onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <span id="trial-verdict-prompt-title" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Before you go · {cards.length === 1 ? 'one trial helper' : `${cards.length} trial helpers`}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" style={closeButtonStyle}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto' }}>
          <TrialVerdictCards cards={cards} userId={userId} onSaved={(card) => onCardDone(card)} />
          <p style={{ margin: '0.7rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>Closing this leaves the card on your Dashboard until tomorrow morning.</p>
        </div>
      </div>
    </div>
  )
}

// Matches the crew deck it is dealt before (RateMyCrewDeck / CrewReviewDeck), safe-area padding included.
const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' }
const dialogStyle: CSSProperties = { width: '100%', maxWidth: 520, maxHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', overflow: 'hidden' }
const closeButtonStyle: CSSProperties = { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', padding: '0 0.25rem' }

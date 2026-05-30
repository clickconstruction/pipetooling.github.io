import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'

/**
 * Shared chrome for the Bids modals: a full-screen dimmed overlay centering a white card.
 *
 * Extracted from the repeated inline `position:'fixed'` overlay blocks in `src/pages/Bids.tsx`.
 * `cardStyle` is used verbatim when provided (NOT merged with `DEFAULT_CARD`) so each call site
 * renders byte-identically to its previous inline markup.
 */

const OVERLAY: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export const DEFAULT_CARD: CSSProperties = {
  background: 'white',
  padding: '1.5rem',
  borderRadius: 8,
  maxWidth: 500,
  width: '90%',
  maxHeight: '90vh',
  overflow: 'auto',
}

export function ModalShell({
  zIndex = 1000,
  cardStyle = DEFAULT_CARD,
  onCardClick,
  children,
}: {
  zIndex?: number
  cardStyle?: CSSProperties
  onCardClick?: MouseEventHandler<HTMLDivElement>
  children: ReactNode
}) {
  return (
    <div style={{ ...OVERLAY, zIndex }}>
      <div style={cardStyle} onClick={onCardClick}>
        {children}
      </div>
    </div>
  )
}

/**
 * GC mode, Owner Billing's O8c: a sent pay application's bill and the card (O8b). The customer turns a certified bill
 * into a card bill in their portal, with a 3% card fee; the office never does. Here the office reads where it stands:
 * on card, with what Stripe asks and its card page; paid by card; taken back to a check bill; or, with the switch on,
 * that they can choose card. **Back to a check bill** is for a customer who calls to pay by check after all, while
 * Stripe shows no payment: `gc-card-bill`'s undo door takes the card page down and the fee off. The fee is a recovery
 * of Stripe's cost, so every figure in the window reads the bill at its base. The plan:
 * to-dos/gc-mode/mockups/owner-billing-o8.md → The office's side, on branch spike/gc-mode.
 */
import { useState } from 'react'
import { Btn, Chip } from './gcUi'
import { cardLineWords, cardMoney } from '../../lib/gc/ownerBillingCard'
import type { OwnerPayAppSent } from '../../lib/gc/types'

export interface CardWrites {
  /** Back to a check bill (O8c): void its Stripe invoice and take the fee off. */
  onCardUndo: (number: number) => void
}

export function GcBillCard({ app, offerOn, writes, busy }: { app: OwnerPayAppSent; offerOn: boolean; writes: CardWrites; busy?: string | null }) {
  const [asking, setAsking] = useState(false)
  const words = cardLineWords(app, offerOn)
  if (!words) return null
  const card = app.card?.state === 'onCard' ? app.card : null
  const working = busy === `card-${app.number}`
  return (
    <div data-testid={`gc-bill-card-${app.number}`} style={{ display: 'grid', gap: '0.3rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', color: card ? undefined : 'var(--text-muted)' }}>
        {card && <Chip tone="blue">on card</Chip>}
        <span>{words}</span>
        {card?.payUrl && !app.paidOn && (
          <a href={card.payUrl} target="_blank" rel="noopener noreferrer">
            Their card page
          </a>
        )}
        {card && !app.paidOn && !asking && (
          <Btn kind="quiet" disabled={working} onClick={() => setAsking(true)}>
            Back to a check bill
          </Btn>
        )}
      </div>
      {card && !app.paidOn && asking && (
        <div role="group" aria-label="Back to a check bill" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{`This takes the card page down and the ${cardMoney(card.fee)} fee off. The bill goes back to ${cardMoney(card.base)}.`}</span>
          <Btn
            kind="primary"
            disabled={working}
            onClick={() => {
              setAsking(false)
              writes.onCardUndo(app.number)
            }}
          >
            Back to a check bill
          </Btn>
          <Btn kind="quiet" onClick={() => setAsking(false)}>
            Keep it on card
          </Btn>
        </div>
      )}
    </div>
  )
}

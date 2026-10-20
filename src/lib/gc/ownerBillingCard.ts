/**
 * GC mode, Owner Billing's O8c: what Bill the customer says about a sent pay application's bill and the card (O8b).
 * On card, with what Stripe asks; paid by card; taken back to a check bill; or, with the switch on, that they can
 * choose card in their portal. Null: nothing to say. The words of `GcBillCard`, tested here.
 */
import { appCertified } from './ownerBilling'
import { shortDate } from './words'
import type { OwnerPayAppSent } from './types'

/**
 * A card amount to the cent ("$297,545.37"): what Stripe asks is exact, so the card's words never round it as `money`
 * does for the bill's own figures.
 */
export function cardMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** What the card line says about a sent one, or null when there is nothing to say. */
export function cardLineWords(app: OwnerPayAppSent, offerOn: boolean): string | null {
  const card = app.card
  if (card?.state === 'onCard') {
    return app.paidOn
      ? `Paid by card on ${shortDate(app.paidOn)}, with the ${cardMoney(card.fee)} card fee.`
      : `They chose card in their portal on ${shortDate(card.chosenOn)}. Stripe asks ${cardMoney(card.total)} with the ${cardMoney(card.fee)} card fee.`
  }
  if (card?.state === 'undone') return card.undoneOn ? `Back to a check bill on ${shortDate(card.undoneOn)}.` : 'Back to a check bill.'
  const certified = appCertified(app)
  if (offerOn && certified !== null && certified > 0 && app.paidOn === null && (app.payments ?? []).length === 0) return 'Not on card. They can choose card in their portal.'
  return null
}

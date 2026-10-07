/**
 * The words on the office's Firm's links dialog (punch list #85, item 22; v2.4750 several links).
 * Every email the firm was sent carries the firm's own link, so rotating it or turning it off
 * stops every one of those links too, not only the one the office copied. A person's link is
 * that person's alone: turning it off leaves the firm's other links working. The confirms say so.
 */

export function rotateLinkMessage(holder: string, firmOwn = true): string {
  const emails = firmOwn ? ' That includes the link in every email already sent to the firm.' : ''
  return `The link ${holder} has now stops working the moment you mint a new one.${emails} Send the new link to ${firmOwn ? 'the firm' : holder} after you mint it.`
}

export function turnOffLinkMessage(holder: string, firmOwn = true): string {
  if (firmOwn) return `${holder} will see "This link is no longer active" until you create a new one. That includes the link in every email already sent to the firm. Matters stay marked as they are.`
  return `${holder} will see "This link is no longer active" from now on. The firm’s other links keep working. Matters stay marked as they are.`
}

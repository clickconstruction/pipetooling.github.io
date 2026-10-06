/**
 * The words on the office's Firm's link dialog (punch list #85, item 22). Every
 * email the firm was sent carries the live link, so rotating it or turning it
 * off stops every one of those links too, not only the one the office copied.
 * The confirms say so.
 */

export function rotateLinkMessage(firmName: string): string {
  return `The link ${firmName} has now stops working the moment you mint a new one. That includes the link in every email already sent to the firm. Send the new link to the firm after you mint it.`
}

export function turnOffLinkMessage(firmName: string): string {
  return `${firmName} will see "This link is no longer active" until you create a new one. That includes the link in every email already sent to the firm. Matters stay marked as they are.`
}

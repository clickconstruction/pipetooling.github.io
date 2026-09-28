/**
 * "Your account, any time" — the card that points a bill's reader at their own statement: the
 * QR code beside the short address in words. One card for every email about a bill, so the
 * payer's bill email (`stripeBillEmail.ts`) and the copy list's (`stripeBillCopyEmail.ts`) draw
 * it the same way. Pure; tested from `src/lib/billing/portalAccountCard.test.ts`.
 */

/** The Content-ID the code rides under as an inline attachment; the HTML reads it as `cid:`. */
export const PORTAL_QR_CONTENT_ID = 'portal-qr'
export const PORTAL_QR_FILENAME = 'your-account-qr.png'
/** The code's side in the email, in CSS pixels; the file is drawn larger so it stays sharp. */
export const PORTAL_QR_DISPLAY_PX = 120
/** A statement address longer than this is not worth printing in words — the link says "Open your statement". */
export const PORTAL_ADDRESS_MAX_CHARS = 48

const INK = '#16283c'
const COPPER = '#b0662f'
const CREAM = '#f6f3ec'
const MUTED = '#5b6676'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The statement address in words ("my.clickplumbing.com/hartwell-homes-k7x2"), or null when it is too long to read. */
export function portalAddressInWords(portalUrl: string | null | undefined): string | null {
  const url = (portalUrl ?? '').trim()
  // A token address keeps its key in the query; in words without it, it would lead nowhere.
  if (!url || /[?#]/.test(url)) return null
  const words = url.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  return words && words.length <= PORTAL_ADDRESS_MAX_CHARS ? words : null
}

/**
 * The card's HTML, or '' without a statement. `qrImgSrc` is what the code's `<img>` loads —
 * `cid:portal-qr` in a real send, a data URL in a sample; null draws the card without a code,
 * and the address in words still carries it (a mail client may drop the image).
 */
export function portalAccountCardHtml(portalUrl: string | null | undefined, qrImgSrc: string | null | undefined): string {
  const portal = (portalUrl ?? '').trim()
  if (!portal) return ''
  const words = portalAddressInWords(portal)
  const qr = (qrImgSrc ?? '').trim()
  const accountText = [
    `<div style="font-weight: 600; color: ${INK};">Your account, any time</div>`,
    words
      ? `<div style="margin: 2px 0 0; word-break: break-all;"><a href="${esc(portal)}" style="color: ${COPPER}; font-weight: 600; text-decoration: none;">${esc(words)}</a></div>`
      : `<div style="margin: 2px 0 0;"><a href="${esc(portal)}" style="color: ${COPPER}; font-weight: 600;">Open your statement</a></div>`,
    `<div style="margin: 4px 0 0; color: ${MUTED}; font-size: 13px;">Every open bill and payment, with no login.${qr ? ' Scan the code with your phone camera.' : ''}</div>`,
  ].join('')
  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 20px; background: ${CREAM}; border-radius: 8px;"><tr>`,
    qr
      ? `<td width="${PORTAL_QR_DISPLAY_PX}" valign="middle" style="padding: 14px 0 14px 14px;"><a href="${esc(portal)}"><img src="${esc(qr)}" width="${PORTAL_QR_DISPLAY_PX}" height="${PORTAL_QR_DISPLAY_PX}" alt="QR code for ${esc(words ?? 'your statement')}" style="display: block; border: 0; border-radius: 4px;"></a></td>`
      : '',
    `<td valign="middle" style="padding: 14px 16px; font-size: 15px; line-height: 1.45; color: ${INK};">${accountText}</td>`,
    `</tr></table>`,
  ].join('')
}

/**
 * The review ask (v2.5896, punch list #185): the link the Review asked step texts, and the step's own line until the
 * office writes one in Settings → Flows. Pure. The link is minted by `customer_review_ask` (`reviewAskIo.ts`), which
 * hands the token back once; the row keeps its hash. The address is always the public site's, as the pay code's is,
 * since the link is read on a phone from a text.
 */
import { PAY_LINK_ORIGIN } from '../billing/payLink'

/** The step's own words, with the blanks the sheet and the morning run fill: their first name, the job, the link. */
export const REVIEW_ASK_LINE = {
  text: '{first}, thank you for paying for {job}. Would you tell us how we did? It takes two taps: {review}',
  textEs: '{first}, gracias por pagar {job}. ¿Nos diría cómo lo hicimos? Son dos toques: {review}',
} as const

/** The call script the receipt offers after the ask goes. */
export const REVIEW_ASK_SCRIPT = {
  text: 'Hi {first}, this is {me} with Click Plumbing. We sent you a link to tell us how we did on {job}. Two taps, if you have a moment.',
  textEs: 'Hola {first}, le habla {me} de Click Plumbing. Le enviamos un enlace para decirnos cómo lo hicimos con {job}. Son dos toques, si tiene un momento.',
} as const

export const reviewLinkPath = (token: string): string => `/r/${encodeURIComponent(token)}`

/** The full address the text carries; `origin` is only overridden by tests. */
export function reviewLinkUrl(token: string, origin: string = PAY_LINK_ORIGIN): string {
  return `${origin}${reviewLinkPath(token)}`
}

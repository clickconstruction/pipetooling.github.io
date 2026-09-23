/**
 * The `/pay/:id` page's state from the `pay-link` function's answer (punch list #35,
 * v2.3754) — pure, so the page file exports only the component. Tested from
 * `src/pages/PayLink.render.test.tsx`.
 */
import { parsePayLinkResponse, type PayLinkPayload } from './payLink'

/** Long enough to read the amount, short enough that nobody reaches for the button first. */
export const PAY_LINK_FORWARD_MS = 1200

export type PayLinkView =
  | { kind: 'loading' }
  | { kind: 'open'; payload: PayLinkPayload; url: string }
  | { kind: 'paid'; payload: PayLinkPayload }
  | { kind: 'void'; payload: PayLinkPayload }
  | { kind: 'not_found' }
  | { kind: 'no_link'; payload: PayLinkPayload }
  | { kind: 'error'; message: string }

/** The page's state from the function's answer. */
export function payLinkView(status: number, body: unknown): PayLinkView {
  if (status === 404) return { kind: 'not_found' }
  const payload = parsePayLinkResponse(body)
  if (!payload || status >= 400) {
    const msg = body != null && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? String((body as { error: string }).error) : ''
    return { kind: 'error', message: msg || 'We could not open that bill right now. Please try again, or call our office.' }
  }
  if (payload.state === 'paid') return { kind: 'paid', payload }
  if (payload.state === 'void') return { kind: 'void', payload }
  if (!payload.url) return { kind: 'no_link', payload }
  return { kind: 'open', payload, url: payload.url }
}


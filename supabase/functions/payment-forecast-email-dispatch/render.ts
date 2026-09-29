/**
 * The Payment forecast email, bound to this deployment: the renderer lives in
 * `_shared/paymentForecastEmail.ts` (v2.4164 — What the team sees renders it on
 * sample data); this module only supplies the app origin for the deep links.
 */
import { paymentForecastEmailText as text, renderPaymentForecastEmail as render, type ForecastEmailPayload } from '../_shared/paymentForecastEmail.ts'

export { paymentForecastEmailSubject, type ForecastEmailPayload, type PaymentForecast } from '../_shared/paymentForecastEmail.ts'

/** Prod app origin for deep links (billed-report-email precedent). */
export const APP_URL = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)

export function renderPaymentForecastEmail(p: ForecastEmailPayload, senderName?: string): string {
  return render(p, APP_URL, senderName)
}

export function paymentForecastEmailText(p: ForecastEmailPayload): string {
  return text(p, APP_URL)
}

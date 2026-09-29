/**
 * The Money waiting email, bound to this deployment: the renderer lives in
 * `_shared/moneyWaitingEmail.ts` (v2.4161 — What the team sees renders it on
 * sample data); this module only supplies the app origin for the deep links.
 */
import { renderMoneyWaitingEmail as render, type MoneyWaitingEmailPayload } from '../_shared/moneyWaitingEmail.ts'

export { moneyWaitingEmailSubject, moneyWaitingEmailText, type MoneyWaitingEmailPayload } from '../_shared/moneyWaitingEmail.ts'

/** Prod app origin for deep links (billed-report-email precedent). */
export const APP_URL = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)

export function renderMoneyWaitingEmail(p: MoneyWaitingEmailPayload, senderName?: string): string {
  return render(p, APP_URL, senderName)
}

/**
 * THE outbound sender — the single server-side flip point for the email
 * sending domain (v2.2496; runbook: docs/DOMAIN_CUTOVER.md → Resend
 * migration). Mirrors the APP_ORIGIN pattern: set the EMAIL_FROM function
 * secret (e.g. `ClickTooling <team@noreply.clicktooling.com>`, the live value
 * since 2026-09-01) and every sender flips on next cold start — no
 * per-function edits. The fallback mirrors the secret.
 *
 * Format must be a full RFC 5322 mailbox (`Name <addr>`); the domain must be
 * verified in Resend or sends fail with a 403.
 */
import { mailboxWithName } from './mailboxWithName.ts'
import { PORTAL_COMPANY } from './portalCompany.ts'

export const EMAIL_FROM: string = Deno.env.get('EMAIL_FROM')?.trim() || 'ClickTooling <team@noreply.clicktooling.com>'

/**
 * The customer-facing sender (punch list #53, v2.4127): the company's name on
 * `EMAIL_FROM`'s verified address — `Click Plumbing and Electrical <team@…>`.
 * Every email a customer, GC, supply house or law firm reads (`audience:
 * 'customer'` in `src/lib/emailCatalog.ts`) sends as this; staff and team
 * emails keep `EMAIL_FROM` so one inbox tells an app notice from a customer
 * thread. Only the display name differs — SPF/DKIM are the address's.
 */
export const COMPANY_EMAIL_FROM: string = mailboxWithName(PORTAL_COMPANY.name, EMAIL_FROM)

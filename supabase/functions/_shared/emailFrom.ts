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
export const EMAIL_FROM: string = Deno.env.get('EMAIL_FROM')?.trim() || 'ClickTooling <team@noreply.clicktooling.com>'

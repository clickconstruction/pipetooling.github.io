/**
 * THE outbound sender — the single server-side flip point for the email
 * sending domain (v2.2496; runbook: docs/DOMAIN_CUTOVER.md → Resend
 * migration). Mirrors the APP_ORIGIN pattern: set the EMAIL_FROM function
 * secret (e.g. `PipeTooling <team@noreply.clicktooling.com>`) and every
 * sender flips on next cold start — no per-function edits. The fallback keeps
 * the Resend-verified pipetooling sender until the flip.
 *
 * Format must be a full RFC 5322 mailbox (`Name <addr>`); the domain must be
 * verified in Resend or sends fail with a 403.
 */
export const EMAIL_FROM: string = Deno.env.get('EMAIL_FROM')?.trim() || 'PipeTooling <team@noreply.pipetooling.com>'

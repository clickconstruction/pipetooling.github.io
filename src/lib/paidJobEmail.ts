import type { UserRole } from '../hooks/useAuth'

/**
 * "Customer paid" email notifications (v2.965) — client-side kernel.
 *
 * Recipient ids live in app_settings under
 * APP_SETTINGS_KEY_PAID_JOB_EMAIL_RECIPIENTS (src/lib/appSettingsKeys.ts) as a
 * JSON array of users.id uuid strings in value_text. The paid-job-email edge
 * function parses the same shape server-side; keep the two in sync.
 */

export type PaidJobEmailVariant = 'detailed' | 'summary'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Parse the recipients setting: JSON array of uuid strings; anything invalid ⇒ []. */
export function parsePaidJobEmailRecipients(valueText: string | null | undefined): string[] {
  if (typeof valueText !== 'string' || valueText.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(valueText)
    if (!Array.isArray(parsed)) return []
    const out: string[] = []
    for (const x of parsed) {
      if (typeof x === 'string' && UUID_RE.test(x.trim()) && !out.includes(x.trim())) {
        out.push(x.trim())
      }
    }
    return out
  } catch {
    return []
  }
}

/** Serialize recipient user ids for app_settings.value_text. */
export function serializePaidJobEmailRecipients(ids: string[]): string {
  return JSON.stringify(ids)
}

/**
 * Which email a role receives: devs and masters get the DETAILED financial
 * review; everyone else gets the STERILIZED summary (no dollar amounts).
 * Mirrors the edge function's DETAILED_ROLES set.
 */
export function paidEmailVariantForRole(role: UserRole | string | null | undefined): PaidJobEmailVariant {
  return role === 'dev' || role === 'master_technician' ? 'detailed' : 'summary'
}

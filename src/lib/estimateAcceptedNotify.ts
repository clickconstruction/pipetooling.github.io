/**
 * "Estimate accepted" staff notifications — client-side kernel.
 *
 * Two recipient sources are unioned when a customer accepts an estimate:
 *
 * 1. **Org-wide always-notify list** — user ids in app_settings under
 *    APP_SETTINGS_KEY_ESTIMATE_ACCEPTED_NOTIFY_RECIPIENTS as a JSON array of
 *    `users.id` uuid strings in `value_text` (dev-write, all authenticated
 *    read). Set once via the ⚙ on Estimates; applies to every acceptance,
 *    including estimates already out with customers.
 * 2. **Per-estimate list** — `estimates.accept_notify_user_ids`, chosen on the
 *    estimate form ("Email when customer accepts"), for one-off extras.
 *
 * The `accept-estimate` edge function parses the same setting shape and applies
 * the same union server-side; keep the two in sync (same arrangement the
 * paid-job-email pair uses — see `src/lib/paidJobEmail.ts`). Whatever the union
 * produces is still filtered by the `estimate_accept_notify_filter_eligible_user_ids`
 * RPC (archived / no email / no relationship to the owning master are dropped),
 * so this kernel never has to police access itself.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Parse the org-wide recipients setting: JSON array of uuid strings; anything invalid ⇒ []. */
export function parseEstimateAcceptedNotifyRecipients(valueText: string | null | undefined): string[] {
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
export function serializeEstimateAcceptedNotifyRecipients(ids: string[]): string {
  return JSON.stringify(ids)
}

/**
 * Everyone emailed for one acceptance: the estimate's own list first (so the
 * person who set up that quote leads), then the org-wide always-notify list.
 * Deduped; non-uuid/blank entries dropped. Either side may be null/empty.
 */
export function mergeEstimateAcceptNotifyRecipients(
  perEstimateIds: readonly (string | null | undefined)[] | null | undefined,
  orgWideIds: readonly (string | null | undefined)[] | null | undefined,
): string[] {
  const out: string[] = []
  for (const source of [perEstimateIds ?? [], orgWideIds ?? []]) {
    for (const raw of source) {
      if (typeof raw !== 'string') continue
      const id = raw.trim()
      if (!UUID_RE.test(id) || out.includes(id)) continue
      out.push(id)
    }
  }
  return out
}

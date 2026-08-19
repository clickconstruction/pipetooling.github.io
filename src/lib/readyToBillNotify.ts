/**
 * "Ready to Bill" notifications — client-side kernel.
 *
 * v2 (v2.1844): recipients live in app_settings under
 * APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS_V2 as a JSON array of
 * `{ id, email, push }` objects — each person picks their own delivery
 * channels, and being a recipient means having at least one channel on.
 * The v1 pair (uuid list + org-wide channels) remains parseable so the edge
 * function and a not-yet-saved org degrade cleanly; `composeRecipientPrefsFromV1`
 * is the documented upgrade path. The paid-job-email edge function parses the
 * same shapes server-side; keep the two in sync.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ReadyToBillNotifyChannels = { email: boolean; push: boolean }

/** One person's delivery preferences (v2). Both-false entries are not recipients and never persist. */
export type ReadyToBillRecipientPref = { id: string; email: boolean; push: boolean }

/**
 * Parse the v2 recipients setting: JSON array of `{ id, email, push }`.
 * Invalid JSON / not-an-array ⇒ []. Entries with a bad uuid, a duplicate id,
 * or both channels off are dropped. Missing channel fields default to ON
 * (matching the v1 default of "notify").
 */
export function parseReadyToBillRecipientPrefs(
  valueText: string | null | undefined,
): ReadyToBillRecipientPref[] {
  if (typeof valueText !== 'string' || valueText.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(valueText)
    if (!Array.isArray(parsed)) return []
    const out: ReadyToBillRecipientPref[] = []
    const seen = new Set<string>()
    for (const x of parsed) {
      if (x === null || typeof x !== 'object' || Array.isArray(x)) continue
      const o = x as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id.trim() : ''
      if (!UUID_RE.test(id) || seen.has(id)) continue
      const email = o.email !== false
      const push = o.push !== false
      if (!email && !push) continue
      seen.add(id)
      out.push({ id, email, push })
    }
    return out
  } catch {
    return []
  }
}

/** Serialize v2 recipient prefs; both-false entries are dropped, not stored. */
export function serializeReadyToBillRecipientPrefs(prefs: ReadyToBillRecipientPref[]): string {
  return JSON.stringify(
    prefs
      .filter((p) => p.email || p.push)
      .map((p) => ({ id: p.id, email: p.email, push: p.push })),
  )
}

/** Upgrade path: v1 uuid list + org-wide channels → v2 prefs (empty when both channels were off). */
export function composeRecipientPrefsFromV1(
  v1Ids: string[],
  channels: ReadyToBillNotifyChannels,
): ReadyToBillRecipientPref[] {
  if (!channels.email && !channels.push) return []
  return v1Ids.map((id) => ({ id, email: channels.email, push: channels.push }))
}

export const DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS: ReadyToBillNotifyChannels = {
  email: true,
  push: true,
}

/**
 * Parse the channels setting: JSON `{ email, push }`. Missing key, blank text,
 * or garbage ⇒ both channels ON (the safe default is "notify"); only an
 * explicit `false` turns a channel off.
 */
export function parseReadyToBillNotifyChannels(
  valueText: string | null | undefined,
): ReadyToBillNotifyChannels {
  if (typeof valueText !== 'string' || valueText.trim() === '') {
    return { ...DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS }
  }
  try {
    const parsed: unknown = JSON.parse(valueText)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS }
    }
    const o = parsed as Record<string, unknown>
    return {
      email: o.email !== false,
      push: o.push !== false,
    }
  } catch {
    return { ...DEFAULT_READY_TO_BILL_NOTIFY_CHANNELS }
  }
}

/** Serialize the channels for app_settings.value_text. */
export function serializeReadyToBillNotifyChannels(channels: ReadyToBillNotifyChannels): string {
  return JSON.stringify({ email: channels.email, push: channels.push })
}

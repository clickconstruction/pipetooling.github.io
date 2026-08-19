/**
 * "Ready to Bill" notifications — client-side kernel.
 *
 * Recipient ids live in app_settings under
 * APP_SETTINGS_KEY_READY_TO_BILL_NOTIFY_RECIPIENTS (same JSON-array-of-uuid
 * shape as the paid streams — reuse parsePaidJobEmailRecipients). This module
 * owns the CHANNELS setting: which delivery rails the stream uses, org-wide
 * for all recipients. The paid-job-email edge function parses the same shape
 * server-side; keep the two in sync.
 */

export type ReadyToBillNotifyChannels = { email: boolean; push: boolean }

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

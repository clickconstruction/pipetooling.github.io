/**
 * The firm's "now" emails, per person (v2.4632, punch list #85 item 26) — the pure rules
 * `legal-notify-dispatch` runs each tick. No Deno API here: `src/lib/legal/legalNotifyLedger.test.ts`
 * runs it under vitest.
 *
 * Each queue event carries `sent_to` (jsonb): one entry per person who was to hear it, frozen on
 * the event's first tick so a person who confirms later is never sent an old event (the rule since
 * v2.3325: an event is heard by whoever is subscribed when it happens). A person is stamped `at`
 * only when their own send went through; a failed send is tried again on the next tick, up to
 * `LEGAL_NOTIFY_MAX_TRIES` times; a person who left the "now" list meanwhile is marked `skipped`.
 * The event is done (`sent_now_at`) once every entry is sent, given up or skipped.
 */

/** Five-minute ticks: twelve tries is an hour of trying per email. */
export const LEGAL_NOTIFY_MAX_TRIES = 12

export type LegalSentToEntry = {
  /** When this person's email went through. */
  at?: string | null
  tries?: number
  /** The mail service's last refusal, as it said it. */
  error?: string | null
  /** When the last failed try was. */
  last?: string | null
  gaveUp?: boolean
  /** Why this person was not sent it after all (they stopped, were removed, or moved to the digest). */
  skipped?: string | null
}
export type LegalSentTo = Record<string, LegalSentToEntry>

/** A jsonb value read back from the row: anything that is not an object of objects reads as empty. */
export function parseSentTo(raw: unknown): LegalSentTo {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: LegalSentTo = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...(v as LegalSentToEntry) }
  return out
}

const settled = (e: LegalSentToEntry): boolean => Boolean(e.at || e.gaveUp || e.skipped)

/**
 * This tick's plan for one event. `targets` are the people who would hear it now (confirmed,
 * unpaused, on "now", allowed to see the matter). On the first tick (`sentTo` empty) they are
 * frozen into the ledger; later ticks only retry the frozen people still on the list.
 */
export function legalNotifyDue(sentTo: LegalSentTo, targets: ReadonlyArray<string>): { sentTo: LegalSentTo; due: string[] } {
  const next: LegalSentTo = Object.keys(sentTo).length === 0 ? Object.fromEntries(targets.map((id) => [id, { tries: 0 }])) : parseSentTo(sentTo)
  const live = new Set(targets)
  const due: string[] = []
  for (const [id, e] of Object.entries(next)) {
    if (settled(e)) continue
    if (!live.has(id)) {
      next[id] = { ...e, skipped: 'no longer on the right-away list' }
      continue
    }
    due.push(id)
  }
  return { sentTo: next, due }
}

/** One person's try, written into the ledger. */
export function legalNotifyRecord(sentTo: LegalSentTo, id: string, result: { success: boolean; error?: string | null }, nowIso: string, maxTries = LEGAL_NOTIFY_MAX_TRIES): LegalSentTo {
  const prev = sentTo[id] ?? {}
  const tries = (prev.tries ?? 0) + 1
  const entry: LegalSentToEntry = result.success ? { at: nowIso, tries } : { tries, error: (result.error ?? 'send failed').slice(0, 300), last: nowIso, ...(tries >= maxTries ? { gaveUp: true } : {}) }
  return { ...sentTo, [id]: entry }
}

/** Every person is sent, given up on or skipped: stamp the event's `sent_now_at`. */
export function legalNotifyDone(sentTo: LegalSentTo): boolean {
  return Object.values(sentTo).every(settled)
}

/**
 * The person's standing after a send (`legal_firm_recipients.send_failed_since` / `send_error`): a
 * success clears it; a failure keeps the first failure's time, so the line reads *since* then.
 */
export function legalRecipientSendPatch(prevFailedSince: string | null | undefined, result: { success: boolean; error?: string | null }, nowIso: string): { send_failed_since: string | null; send_error: string | null } {
  if (result.success) return { send_failed_since: null, send_error: null }
  return { send_failed_since: prevFailedSince || nowIso, send_error: (result.error ?? 'send failed').slice(0, 300) }
}

/**
 * The line a failing person carries (v2.4632): on the desk's Firm's emails (`office`, with the mail
 * service's words) and against the person on the firm's Notifications page (`firm`). `sinceYmd` is
 * the company-zone day of `send_failed_since`.
 */
export function legalNotReachingLine(i: { email: string; sinceYmd: string; error?: string | null; confirmed?: boolean; mode?: 'now' | 'digest' | string }, audience: 'office' | 'firm'): string {
  // What is tried again depends on the person: a confirmation never is (someone presses Resend the
  // confirmation), a digest is tried each tick for the rest of its day, an event email for an hour.
  const retry = i.confirmed === false
    ? (audience === 'firm' ? 'Press Resend the confirmation next to their name.' : 'A confirmation is not sent again by itself: the firm presses Resend the confirmation.')
    : i.mode === 'digest'
      ? (audience === 'firm' ? 'We try the digest again every five minutes for the rest of its day.' : 'The queue tries the digest again every five minutes for the rest of its day.')
      : (audience === 'firm' ? 'We try each one again every five minutes for an hour.' : 'The queue tries each email again every five minutes, for an hour.')
  if (audience === 'firm') return `Our emails to ${i.email} have not gone through since ${i.sinceYmd}. ${retry} If the address is wrong, press Stop emails to this person and add the right one.`
  const said = (i.error ?? '').trim().replace(/\.+$/, '')
  return `Could not reach ${i.email} since ${i.sinceYmd}${said ? `: ${said}` : ''}. ${retry}`
}

/** Compare two secrets in time that does not depend on where they first differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

const hex = (buf: ArrayBuffer): string => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

/**
 * A person's "Stop these emails" token, minted once (v2.4632): an HMAC of the person's id and
 * their salt under a server key, so the same token rides every email and none is kept raw. The
 * row keeps only its SHA-256 (`unsubscribe_token_hash`, what the stop link is looked up by). A
 * new salt — set when the person turns emails back on — is the only rotation.
 */
/** The stop link's key: `LEGAL_UNSUBSCRIBE_SECRET` when set, else the service key; '' when both are empty (the caller sends no link). */
export function legalUnsubscribeSecret(own: string | null | undefined, serviceKey: string | null | undefined): string {
  return (own ?? '').trim() || (serviceKey ?? '').trim()
}

export async function legalUnsubscribeToken(serverKey: string, recipientId: string, salt: string | null | undefined): Promise<{ token: string; hash: string }> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(`legal-unsubscribe:${serverKey}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const token = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${recipientId}:${salt ?? ''}`)))
  const hash = hex(await crypto.subtle.digest('SHA-256', enc.encode(token)))
  return { token, hash }
}

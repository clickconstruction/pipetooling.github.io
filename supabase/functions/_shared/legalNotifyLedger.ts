/**
 * The firm's "now" emails, per person (v2.4662, punch list #85 item 26) — the pure rules
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
 * The line a failing person carries (v2.4662): on the desk's Firm's emails (`office`, with the mail
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
 * A person's "Stop these emails" token, minted once (v2.4662): an HMAC of the person's id and
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

/** A digest reads back at most this many days, so a person just moved onto the digest is not sent a season. */
export const LEGAL_DIGEST_MAX_DAYS = 8

/**
 * Since when this person's digest reads (v2.6283, punch list #233): their own last digest, else their
 * confirmation (an event is heard by whoever was subscribed when it happened, never replayed to whoever
 * joins later), and never more than `LEGAL_DIGEST_MAX_DAYS` back. Per person, so two people on different
 * weekdays each read their own week; before this the queue was stamped digested for the whole firm on the
 * first weekday's send, and the second person's digest held only the days since.
 */
export function legalDigestSince(r: { last_digest_at?: string | null; confirmed_at?: string | null }, nowIso: string): string {
  const floor = new Date(new Date(nowIso).getTime() - LEGAL_DIGEST_MAX_DAYS * 86_400_000)
  const own = [r.last_digest_at, r.confirmed_at].map((t) => (t ? new Date(t) : null)).find((d) => d && Number.isFinite(d.getTime())) ?? null
  const since = own && own.getTime() > floor.getTime() ? own : floor
  return since.toISOString()
}

/** The office's entries it can hold back from counsel under a `held_overrides` key `<kind>:<id>`, as the portal reads them (legal-portal). */
export const LEGAL_HOLDABLE_ENTRY_KINDS: readonly string[] = ['plan', 'event', 'offer', 'statement']

type DigestRow = { matter_id: string | null; payload: Record<string, unknown> }

/** The entries, papers and matters a digest's lines came from (v2.6283), read when the digest is built. */
export function legalDigestSourceIds(rows: ReadonlyArray<DigestRow>): { entryIds: string[]; documentIds: string[]; matterIds: string[] } {
  const entryIds = new Set<string>()
  const documentIds = new Set<string>()
  const matterIds = new Set<string>()
  for (const r of rows) {
    const e = r.payload.entryId
    const d = r.payload.documentId
    if (typeof e === 'string' && e) {
      entryIds.add(e)
      if (r.matter_id) matterIds.add(r.matter_id)
    }
    if (typeof d === 'string' && d) documentIds.add(d)
  }
  return { entryIds: [...entryIds], documentIds: [...documentIds], matterIds: [...matterIds] }
}

export type LegalDigestSources = {
  entries: ReadonlyMap<string, { kind: string; voided: boolean }>
  documents: ReadonlyMap<string, { held: boolean; voided: boolean }>
  /** Each matter's `held_overrides`. */
  held: ReadonlyMap<string, Record<string, unknown>>
}

/**
 * Whether a queued line still belongs in the digest (v2.6283, punch list #233). The office holds a planned
 * step, an event, an offer, a statement or a paper back from counsel with a press after it is saved, and can
 * undo an entry, often after the line was queued; the digest goes out days later. So each line's source is
 * read as it stands, the way the portal reads it: an undone or missing entry, a held one, and a voided or held
 * paper are left out. A line with no source id (a release, a pull-back, a fee seen, a row queued before
 * v2.6283) always shows.
 */
export function legalDigestShows(row: DigestRow, s: LegalDigestSources): boolean {
  const entryId = typeof row.payload.entryId === 'string' ? row.payload.entryId : ''
  if (entryId) {
    const e = s.entries.get(entryId)
    if (!e || e.voided) return false
    if (LEGAL_HOLDABLE_ENTRY_KINDS.includes(e.kind) && row.matter_id && s.held.get(row.matter_id)?.[`${e.kind}:${entryId}`] === true) return false
  }
  const documentId = typeof row.payload.documentId === 'string' ? row.payload.documentId : ''
  if (documentId) {
    const d = s.documents.get(documentId)
    if (!d || d.voided || d.held) return false
  }
  return true
}

/**
 * The Quo connection in Settings (v2.5718, the owner's ask of 2026-10-21: no terminal in setup): Settings → Phone and
 * texts → **Quo connection**, where the owner or a dev pastes Quo's API key, which `quo-config` keeps in Vault, and
 * where the two cards under it, Company phone seats and Inboxes, pick from Quo's own lists instead of typed ids. This
 * reads what `quo-config` answers (the key's status, never the key; Quo's `/users` and `/phone-numbers` as Quo gives
 * them), says what each card shows for each state, and holds the words. Pure.
 */
import { whenWords } from '../messages/thread'
import { phoneAsKept } from '../messages/boxesCard'

/** One of Quo's workspace members (`GET /users`): who a seat can be. */
export interface QuoMember {
  /** Quo's `US…` id. */
  id: string
  /** First and last name, else the email's name part. */
  name: string
  email: string
  role: string
}

/** One of Quo's numbers (`GET /phone-numbers`): what an inbox can be. */
export interface QuoNumber {
  /** Quo's `PN…` id. */
  id: string
  name: string
  /** The emoji Quo shows beside it; '' when none. */
  symbol: string
  /** As Quo keeps it, E.164: "+15125550144". */
  number: string
  /** As people read it and as the inbox keeps it: "(512) 555-0144". */
  phone: string
}

export interface QuoDirectory {
  members: QuoMember[]
  numbers: QuoNumber[]
}

/** What `quo-config` says of the key: whether one is held and where, its last four characters, when and by whom. */
export interface QuoKeyStatus {
  set: boolean
  source: 'vault' | 'env' | 'none'
  last4: string | null
  savedAt: string | null
  savedBy: string | null
}

export const NO_QUO_KEY: QuoKeyStatus = { set: false, source: 'none', last4: null, savedAt: null, savedBy: null }

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** The status as the function answers it. Words that are not its shape read as no key. */
export function parseQuoKeyStatus(json: unknown): QuoKeyStatus {
  if (!json || typeof json !== 'object') return NO_QUO_KEY
  const o = json as Record<string, unknown>
  const source = o.source === 'vault' || o.source === 'env' ? o.source : 'none'
  const set = o.set === true && source !== 'none'
  return {
    set,
    source: set ? source : 'none',
    last4: set && source === 'vault' ? text(o.last4) || null : null,
    savedAt: set && source === 'vault' ? text(o.saved_at) || null : null,
    savedBy: set && source === 'vault' ? text(o.saved_by) || null : null,
  }
}

/** A member's name: first and last, else the part of the email before @, else the id. */
function memberName(o: Record<string, unknown>, email: string, id: string): string {
  const name = [text(o.firstName), text(o.lastName)].filter(Boolean).join(' ')
  return name || email.split('@')[0] || id
}

/** Quo's members as the seats picker lists them, by name. One without a `US…` id is left out. */
export function parseQuoMembers(items: unknown): QuoMember[] {
  if (!Array.isArray(items)) return []
  const out: QuoMember[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = text(o.id)
    if (!/^US[A-Za-z0-9]+$/.test(id)) continue
    const email = text(o.email)
    out.push({ id, name: memberName(o, email, id), email, role: text(o.role) })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))
}

/** A number as people read it: Quo's own formatted form when it has one, else the ten digits as the inbox keeps them. */
function phoneOf(o: Record<string, unknown>, e164: string): string {
  const kept = phoneAsKept(e164)
  if (/^\(\d{3}\) \d{3}-\d{4}$/.test(kept)) return kept
  return text(o.formattedNumber) || e164
}

/** Quo's numbers as the inboxes picker lists them, by name. One without a `PN…` id is left out. */
export function parseQuoNumbers(items: unknown): QuoNumber[] {
  if (!Array.isArray(items)) return []
  const out: QuoNumber[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = text(o.id)
    if (!/^PN[A-Za-z0-9]+$/.test(id)) continue
    // The versioned API says phoneNumber; v1 said number.
    const number = text(o.phoneNumber) || text(o.number)
    out.push({ id, name: text(o.name) || number || id, symbol: text(o.symbol), number, phone: phoneOf(o, number) })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.number.localeCompare(b.number))
}

/** The directory as `quo-config` answers it. Null when the answer is not its shape. */
export function parseQuoDirectory(json: unknown): QuoDirectory | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (o.ok !== true || !Array.isArray(o.numbers) || !Array.isArray(o.members)) return null
  return { members: parseQuoMembers(o.members), numbers: parseQuoNumbers(o.numbers) }
}

/** A member on the picker: "Rosa Diaz, rosa@…". The id shows small beside the picker, never in the option. */
export function memberLabel(m: QuoMember): string {
  return m.email && !m.name.includes('@') ? `${m.name}, ${m.email}` : m.name
}

/** A number on the picker: "🏡 Team line, (512) 555-0144". */
export function numberLabel(n: QuoNumber): string {
  const who = n.symbol ? `${n.symbol} ${n.name}` : n.name
  return n.phone && n.phone !== n.name ? `${who}, ${n.phone}` : who
}

/** What stops a key from being saved, in the card's words; null when it can be sent. */
export function quoKeyProblem(key: string): string | null {
  const k = key.trim()
  if (!k) return 'Paste the key from Quo first.'
  if (/\s/.test(k)) return 'The key has a space in it. Paste it again.'
  if (k.length < 16) return 'That is too short to be a Quo key.'
  return null
}

/** The key's line: never the key, only its end and where it is held. */
export function maskedKeyWords(status: QuoKeyStatus): string {
  if (!status.set) return 'No key saved yet.'
  if (status.source === 'env') return 'A key is set on the server by a dev, not here. Paste it here so Settings holds it.'
  return status.last4 ? `A key is saved. It ends in ${status.last4}.` : 'A key is saved.'
}

/** When the key was saved and by whom: "Saved today at 8:44 AM by Robert." Empty when Vault holds none. */
export function savedWords(status: QuoKeyStatus, nowIso: string): string {
  if (!status.set || status.source !== 'vault' || !status.savedAt) return ''
  const when = whenWords(status.savedAt, nowIso)
  return status.savedBy ? `Saved ${when} by ${status.savedBy}.` : `Saved ${when}.`
}

/**
 * What the connection is in, for the three cards: no key yet; the key saved and Quo's lists read; the key saved but Quo
 * did not answer; or still reading.
 */
export type QuoConnectionState = 'loading' | 'no-key' | 'ready' | 'read-failed'

export function connectionState(status: QuoKeyStatus | null, directory: QuoDirectory | null, failed: boolean): QuoConnectionState {
  if (failed) return 'read-failed'
  if (!status) return 'loading'
  if (!status.set) return 'no-key'
  return directory ? 'ready' : 'loading'
}

/** What Quo answered: "Quo answered: 3 numbers and 5 people." */
export function directoryWords(d: QuoDirectory): string {
  const n = d.numbers.length
  const m = d.members.length
  return `Quo answered: ${n} number${n === 1 ? '' : 's'} and ${m} ${m === 1 ? 'person' : 'people'}.`
}

/** The picker's fallback value: the row is typed by hand. */
export const BY_HAND = '__by_hand__'

/** Whether a card's picker shows: the key is saved and Quo's list has what the picker lists. `off`: no connection on the page. */
export function pickerShows(state: QuoConnectionState | 'off', listed: number): boolean {
  return state === 'ready' && listed > 0
}

/** Whether a row's id is one the picker lists; a row holding some other id is typed by hand. */
export function idListed(id: string, listed: ReadonlyArray<{ id: string }>): boolean {
  return listed.some((l) => l.id === id.trim())
}

export const QUO_CONNECTION_TITLE = 'Quo connection'
export const QUO_CONNECTION_INTRO = 'Quo is the app the company numbers run on. Its key lets this app text, hear calls and list your seats and numbers.'
export const QUO_CONNECTION_WHERE = 'Get the key in Quo under Workspace settings, then API. Paste it here. It is kept in the vault and never shown again.'
export const QUO_KEY_SAVED_TOAST = 'Saved. The seats and the inboxes now pick from Quo’s lists.'
export const QUO_KEY_LABEL = 'Quo API key'
export const QUO_KEY_SAVE = 'Save the key'
export const QUO_READ_AGAIN = 'Ask Quo again'
export const QUO_TYPE_BY_HAND = 'Type it by hand'
export const QUO_PICK_MEMBER = 'Pick a Quo member'
export const QUO_PICK_NUMBER = 'Pick a Quo number'
export const QUO_NO_KEY_FOR_PICKERS = 'Paste the Quo key above and the seats and inboxes become pickers.'
export const QUO_READ_FAILED_FOR_PICKERS = 'Quo did not answer, so type the ids by hand for now.'

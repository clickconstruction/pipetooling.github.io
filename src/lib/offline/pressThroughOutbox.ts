import { newPress, nextSeq, type NewPressArgs, type OutboxKind, type OutboxPress } from './outbox'
import { landFieldPress } from './landFieldPress'
import { outbox, type OutboxStateStore } from './outboxState'
import { isImpersonationSessionActive } from '../impersonationSession'

/**
 * A press through the outbox (punch list #163 PR 2): the surface hands over what was pressed, and
 * this sends it at once when it can, or keeps it on the phone when it cannot.
 *
 *   - The browser says offline: the press is kept without a try, and the replay sends it when the
 *     signal returns.
 *   - The send lands: the surface gets the server's answer, as it does today. The press is not
 *     kept, so the bar stays gone.
 *   - The send fails at the fetch layer or times out: the press is kept with the moment it was
 *     pressed; the same id goes on every try, so a timeout whose request landed counts once.
 *   - The server refuses: the surface gets the refusal to show as it does today; nothing is kept.
 *
 * The id is minted here, once per press.
 */

export type PressOutcome =
  | { kind: 'landed'; result: unknown }
  | { kind: 'queued'; press: OutboxPress }
  | { kind: 'refused'; message: string; code: string | null }
  /** The queue is off for this session and the send failed: the surface shows the failure as it does today. */
  | { kind: 'failed'; error: unknown }

export type PressArgs<K extends OutboxKind> = Omit<NewPressArgs<K>, 'id' | 'seq'>

export function mintPressId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // an old WebView without randomUUID
  }
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`
}

function browserOnline(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine
}

export interface PressIo {
  store?: OutboxStateStore
  land?: typeof landFieldPress
  online?: () => boolean
  now?: () => number
  /** Keep the press without a try: a press behind one that is already waiting goes after it, never ahead. */
  forceQueue?: boolean
  /** The queue is off for this session (a twin, an impersonation): a failed send is handed back as it is today. */
  allowed?: boolean
}

export async function pressThroughOutbox<K extends OutboxKind>(args: PressArgs<K>, io: PressIo = {}): Promise<PressOutcome> {
  const store = io.store ?? outbox
  const land = io.land ?? landFieldPress
  const online = io.online ?? browserOnline
  const now = io.now ?? Date.now
  const allowed = io.allowed ?? !isImpersonationSessionActive()
  const press = newPress({ ...args, id: mintPressId(), seq: nextSeq(store.presses()) } as NewPressArgs<K>)
  if (allowed && (io.forceQueue || !online())) {
    store.put(press)
    return { kind: 'queued', press }
  }
  const tried = { ...press, state: 'sending' as const, attempts: 1, lastTriedAt: now() }
  const outcome = await land(tried)
  if (outcome.kind === 'landed') return { kind: 'landed', result: outcome.result }
  if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.refusal.message, code: outcome.refusal.code }
  if (!allowed) return { kind: 'failed', error: outcome.error }
  const kept: OutboxPress = { ...tried, state: 'waiting' }
  store.put(kept)
  return { kind: 'queued', press: kept }
}

/**
 * Materials on site: how a press leaves the phone (punch list #344, PR 1, v2.7173).
 *
 * A press is written to the phone's own store the moment it is made, then sent. With a signal and nothing ahead of
 * it, it goes at once and its kept copy is taken back when the office answers, so the bar on the strip never speaks
 * for an ordinary press. With no signal, or behind a press that still waits, it joins the outbox (#163) and the replay
 * sends it in the order it was pressed. A send whose answer is lost is sent again under the same ids, and an insert
 * that meets its own row counts once (`insertAlreadyLanded`).
 *
 * One press goes at a time, in order: a new box is at the office before the part put in it. A press made while
 * another is in flight waits its turn here, already kept on the phone, so closing the page loses nothing.
 */
import { newPress, nextSeq, type OutboxPress } from '../offline/outbox'
import type { LandOutcome } from '../offline/landFieldPress'
import { outbox, type OutboxStateStore } from '../offline/outboxState'
import { isImpersonationSessionActive } from '../impersonationSession'
import { mintPressId } from '../offline/pressThroughOutbox'
import { onSitePressAbout, type OnSiteWrite } from './onSiteWrites'

export type OnSitePressArgs = { jobId: string; what: string; writes: ReadonlyArray<OnSiteWrite>; pressedAt: number }

export type OnSiteSendOutcome =
  | { kind: 'landed' }
  /** Kept on the phone; the replay sends it. `first` is true when nothing on site was waiting before it. */
  | { kind: 'queued'; first: boolean }
  | { kind: 'refused'; message: string }
  /** The queue is off for this session (a twin, a view as someone, no sign-in) and the send failed. */
  | { kind: 'failed'; error: unknown }

export interface OnSiteSendIo {
  store: OutboxStateStore
  land: (press: OutboxPress) => Promise<LandOutcome>
  online: () => boolean
  /** False for a session whose presses never queue. */
  allowed: () => boolean
  /** Write the press to the phone's store without listing it, and take it back. Best effort. */
  keep: (press: OutboxPress) => Promise<void> | void
  unkeep: (id: string) => Promise<void> | void
}

/** A press of this kind that the outbox still has to send. */
export function isPendingOnSitePress(p: OutboxPress): p is OutboxPress<'on-site-press'> {
  return p.kind === 'on-site-press' && (p.state === 'waiting' || p.state === 'sending')
}

export interface OnSiteSender {
  send(args: OnSitePressArgs): Promise<OnSiteSendOutcome>
  /** The presses made here that have not reached the office or the outbox yet, oldest first. */
  inHand(): ReadonlyArray<OutboxPress<'on-site-press'>>
}

export function createOnSiteSender(io: OnSiteSendIo): OnSiteSender {
  const hand = new Map<string, OutboxPress<'on-site-press'>>()
  let lastSeq = 0
  let turn: Promise<unknown> = Promise.resolve()

  async function go(press: OutboxPress<'on-site-press'>, queueable: boolean): Promise<OnSiteSendOutcome> {
    const store = io.store
    try {
      if (queueable) {
        const waitingAhead = store.presses().some(isPendingOnSitePress)
        if (waitingAhead || !io.online()) {
          store.put(press)
          return { kind: 'queued', first: !waitingAhead }
        }
      }
      const outcome = await io.land({ ...press, state: 'sending', attempts: 1, lastTriedAt: press.pressedAt })
      if (outcome.kind === 'landed') {
        if (queueable) void io.unkeep(press.id)
        return { kind: 'landed' }
      }
      if (outcome.kind === 'refused') {
        if (queueable) void io.unkeep(press.id)
        return { kind: 'refused', message: outcome.refusal.message }
      }
      if (!queueable) return { kind: 'failed', error: outcome.error }
      const waitingAhead = store.presses().some(isPendingOnSitePress)
      store.put({ ...press, state: 'waiting', attempts: 1, lastTriedAt: Date.now() })
      return { kind: 'queued', first: !waitingAhead }
    } finally {
      hand.delete(press.id)
    }
  }

  return {
    send(args) {
      const store = io.store
      const userId = store.userId()
      const queueable = Boolean(userId) && io.allowed()
      lastSeq = Math.max(nextSeq(store.presses()), lastSeq + 1)
      const press = newPress({
        id: mintPressId(),
        seq: lastSeq,
        kind: 'on-site-press',
        userId: userId ?? 'none',
        pressedAt: args.pressedAt,
        payload: { jobId: args.jobId, what: args.what, writes: args.writes },
        about: onSitePressAbout(args.what),
        door: `/tally?tab=on-site&job=${args.jobId}`,
      })
      hand.set(press.id, press)
      // Kept before it is sent: a page closed while the send is out finds the press again on the next sign-in.
      if (queueable) void io.keep(press)
      const mine = turn.then(() => go(press, queueable))
      turn = mine.catch(() => undefined)
      return mine
    },
    inHand: () => [...hand.values()].sort((a, b) => a.seq - b.seq),
  }
}

/** Every on-site press still on its way for a job: in hand here, then waiting in the outbox, in the order pressed. */
export function pendingOnSitePresses(jobId: string, sender: Pick<OnSiteSender, 'inHand'>, store: Pick<OutboxStateStore, 'presses'>): OutboxPress<'on-site-press'>[] {
  const seen = new Set<string>()
  const out: OutboxPress<'on-site-press'>[] = []
  for (const p of [...store.presses().filter(isPendingOnSitePress), ...sender.inHand()]) {
    if (seen.has(p.id) || p.payload.jobId !== jobId) continue
    seen.add(p.id)
    out.push(p)
  }
  return out.sort((a, b) => a.seq - b.seq)
}

function browserOnline(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine
}

let appSender: OnSiteSender | null = null

/** The app's one sender, over the app's outbox. Made on first use, so a test or a worker that never presses loads none of it. */
export function onSiteSender(): OnSiteSender {
  if (appSender) return appSender
  appSender = createOnSiteSender({
    store: outbox,
    land: async (press) => (await import('../offline/landFieldPress')).landFieldPress(press),
    online: browserOnline,
    allowed: () => !isImpersonationSessionActive(),
    keep: async (press) => (await import('../offline/outboxStore')).writePress(press),
    unkeep: async (id) => (await import('../offline/outboxStore')).deletePress(id),
  })
  return appSender
}

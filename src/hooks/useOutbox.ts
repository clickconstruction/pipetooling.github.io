import { useEffect, useState } from 'react'
import { outbox, type OutboxStateStore } from '../lib/offline/outboxState'
import type { OutboxPress } from '../lib/offline/outbox'

/**
 * The outbox as a screen reads it (punch list #163 PR 2): the presses, re-read on every change.
 * The bar, the list, the clock and the Job Mode card read it; the replay hook writes it.
 */
export function useOutbox(store: OutboxStateStore = outbox): readonly OutboxPress[] {
  const [presses, setPresses] = useState<readonly OutboxPress[]>(() => store.presses())
  useEffect(() => {
    const refresh = () => setPresses(store.presses())
    refresh()
    return store.subscribe(refresh)
  }, [store])
  return presses
}

/** The newest press of a kind this person made today, waiting, sent or refused; null when there is none. */
export function newestPressOfKind(presses: readonly OutboxPress[], kind: OutboxPress['kind']): OutboxPress | null {
  let newest: OutboxPress | null = null
  for (const p of presses) {
    if (p.kind !== kind) continue
    if (!newest || p.seq > newest.seq) newest = p
  }
  return newest
}

/** The clock-in press still waiting (or in flight): the phone is clocked in on it until it lands. */
export function pendingClockIn(presses: readonly OutboxPress[]): OutboxPress<'clock-in'> | null {
  const p = newestPressOfKind(presses, 'clock-in')
  if (!p || (p.state !== 'waiting' && p.state !== 'sending')) return null
  // A clock-out already pressed on it: the phone is clocked out, both waiting.
  const out = presses.find((q) => q.kind === 'clock-out' && q.dependsOn === p.id && q.state !== 'refused')
  if (out) return null
  return p as OutboxPress<'clock-in'>
}

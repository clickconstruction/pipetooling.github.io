/**
 * GC mode — design spike: one copy of the made-up state for the whole app session (the owner,
 * 2026-10-04: "I would like for the follow-up on this page to be exposed on the Needs you list of
 * an assistant's dashboard"). The GC page and the dashboard read the same state, so a call logged
 * on Follow up changes the dashboard's count. A reload starts over, as the page always has.
 */
import type { GcAction, GcState } from './gcTypes'
import { gcReducer } from './gcReducer'
import { initialGcState } from './gcFixture'

let current: GcState | null = null
const listeners = new Set<() => void>()

export function gcStoreState(): GcState {
  if (!current) current = initialGcState()
  return current
}

export function gcStoreDispatch(action: GcAction): void {
  const next = gcReducer(gcStoreState(), action)
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

export function gcStoreSubscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Tests only: the next read starts from the fixture again. */
export function resetGcStore(): void {
  current = null
}

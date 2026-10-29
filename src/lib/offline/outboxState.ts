import { inOrder, prune, type OutboxPress } from './outbox'
import { clearOutbox, deletePress, readAllPresses, writePress } from './outboxStore'

/**
 * The outbox in memory (punch list #163 PR 2): the one store the bar, the list, the clock and the
 * replay hook read and write, the subscribe shape of `appHealth.ts`. Every change is written
 * through to IndexedDB (`outboxStore.ts`), best-effort, and `load` reads the device's presses back
 * on sign-in. Pure over its list; the singleton `outbox` is the app's, tests make their own.
 */

export interface OutboxStateStore {
  /** Whose presses are loaded; null before a sign-in. */
  userId(): string | null
  presses(): readonly OutboxPress[]
  /** Read the device's presses for this person, pruned; drops what another person left. */
  load(userId: string, now: number): Promise<void>
  /** Sign-out: nothing in memory, nothing on the device. */
  clear(): Promise<void>
  /** Add or replace one press. */
  put(press: OutboxPress): void
  /** Replace the whole list (a settle, a prune). */
  replace(presses: readonly OutboxPress[]): void
  remove(id: string): void
  subscribe(cb: () => void): () => void
  /** Bumps on every change; a reader keyed on it re-reads. */
  version(): number
}

export function createOutboxState(io: { readAll?: typeof readAllPresses; write?: typeof writePress; del?: typeof deletePress; clear?: typeof clearOutbox } = {}): OutboxStateStore {
  const readAll = io.readAll ?? readAllPresses
  const write = io.write ?? writePress
  const del = io.del ?? deletePress
  const clearAll = io.clear ?? clearOutbox
  let user: string | null = null
  let list: OutboxPress[] = []
  let version = 0
  const listeners = new Set<() => void>()
  const notify = () => {
    version += 1
    for (const cb of listeners) cb()
  }
  return {
    userId: () => user,
    presses: () => list,
    async load(userId, now) {
      user = userId
      const kept = await readAll()
      // A press made while the read was out stays; the device's come first by their order.
      const mine = prune(kept, now, userId)
      const ids = new Set(mine.map((p) => p.id))
      list = inOrder([...mine, ...list.filter((p) => p.userId === userId && !ids.has(p.id))])
      // What prune dropped (another person's, a stale sent press) leaves the device too.
      for (const p of kept) if (!ids.has(p.id)) void del(p.id)
      notify()
    },
    async clear() {
      user = null
      list = []
      notify()
      await clearAll()
    },
    put(press) {
      const idx = list.findIndex((p) => p.id === press.id)
      const next = [...list]
      if (idx < 0) next.push(press)
      else next[idx] = press
      list = inOrder(next)
      void write(press)
      notify()
    },
    replace(presses) {
      const before = new Map(list.map((p) => [p.id, p]))
      list = inOrder(presses)
      for (const p of list) if (before.get(p.id) !== p) void write(p)
      for (const id of before.keys()) if (!list.some((p) => p.id === id)) void del(id)
      notify()
    },
    remove(id) {
      if (!list.some((p) => p.id === id)) return
      list = list.filter((p) => p.id !== id)
      void del(id)
      notify()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    version: () => version,
  }
}

/** The app's one outbox. */
export const outbox: OutboxStateStore = createOutboxState()

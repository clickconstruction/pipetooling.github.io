/**
 * Tell the dev (punch list #380): how many answers a person has not read, held where every
 * wrench can see it. The root sets it; the floating wrench and the header's draw the dot.
 */
let unread = 0
const listeners = new Set<() => void>()

export function setUnreadDevAnswers(count: number): void {
  const next = Math.max(0, count)
  if (next === unread) return
  unread = next
  for (const listener of listeners) listener()
}

export function getUnreadDevAnswers(): number {
  return unread
}

export function subscribeUnreadDevAnswers(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

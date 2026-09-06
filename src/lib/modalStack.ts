/**
 * Modal stack registry (journey-map Tier-2 #42, J1-N1): which open modal is on
 * top. Every full-screen modal listens for Escape on `window`, so one keypress
 * used to close New Job AND the Edit Bid underneath it. A modal registers on
 * mount and asks `isTopmostModal(id)` before acting on Escape — only the most
 * recently opened one does. Pure module state; the React glue lives in
 * `src/hooks/useModalStackEntry.ts`.
 */

let seq = 0
const stack: number[] = []

/** Push a new entry; returns the handle the caller keeps for the other two calls. */
export function registerModal(): number {
  seq += 1
  stack.push(seq)
  return seq
}

/** Remove an entry wherever it sits (a lower modal can unmount before the one above it). */
export function unregisterModal(id: number): void {
  const idx = stack.lastIndexOf(id)
  if (idx >= 0) stack.splice(idx, 1)
}

/** True when `id` is the most recently registered entry still on the stack. */
export function isTopmostModal(id: number): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id
}

export function modalStackDepth(): number {
  return stack.length
}

/** Test seam — the registry is module state. */
export function resetModalStackForTests(): void {
  stack.length = 0
}

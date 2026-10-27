/**
 * The dot on a desk's ? until the person has pressed it once (punch list #187, PR 3): kept per
 * person, not per browser, through the dismissal store (`user_dismissals`, seeded into localStorage
 * at sign-in, every save mirrored to the server). The GC walk's per-browser key opened it 33 times
 * for two assistants; a person is one person on every device.
 */
import { pushDismissal } from '../dismissalStore'

/** The store's key prefix; the person's id follows it in localStorage. */
export function legendPressedPrefix(deskKey: string): string {
  return `helpLegendPressed:${deskKey}:`
}

export function readLegendPressed(userId: string | null | undefined, deskKey: string): boolean {
  if (!userId) return false
  try {
    return localStorage.getItem(legendPressedPrefix(deskKey) + userId) != null
  } catch {
    return false
  }
}

export function markLegendPressed(userId: string | null | undefined, deskKey: string): void {
  if (!userId) return
  const state = { pressed: true, at: new Date().toISOString() }
  try {
    localStorage.setItem(legendPressedPrefix(deskKey) + userId, JSON.stringify(state))
  } catch {
    /* private mode: the dot shows again next time, which is the lesser harm */
  }
  pushDismissal(legendPressedPrefix(deskKey), userId, state)
}

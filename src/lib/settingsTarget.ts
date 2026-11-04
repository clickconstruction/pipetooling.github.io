/**
 * The anchor a Settings link lands on, announced to the cards (punch list #261): the deep-link
 * effect and the search pick scroll to an anchor through `pollScrollToSettingsAnchor`, which
 * announces the id first, so a folded card that is the target (or holds it) opens before the
 * element is looked for. A card listens with `onSettingsTarget`; nothing else reads the event.
 */

export const SETTINGS_TARGET_EVENT = 'settings-target'

/** The id the page is being sent to, without its `#`; empty when the address names none. */
export function currentSettingsHashId(): string {
  if (typeof window === 'undefined') return ''
  return window.location.hash.replace(/^#/, '')
}

/** Say which anchor is the target. Never throws: a missing window is a test without a page. */
export function announceSettingsTarget(anchorId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<string>(SETTINGS_TARGET_EVENT, { detail: anchorId }))
}

/** Hear every target announced; returns the way to stop listening. */
export function onSettingsTarget(listen: (anchorId: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const id = (e as CustomEvent<string>).detail
    if (typeof id === 'string' && id) listen(id)
  }
  window.addEventListener(SETTINGS_TARGET_EVENT, handler)
  return () => window.removeEventListener(SETTINGS_TARGET_EVENT, handler)
}

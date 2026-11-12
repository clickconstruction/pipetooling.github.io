/**
 * First look on a thread (punch list #319 PR 1): how a press outside the reply box asks it for the ask. The look's card
 * sits above the lines and the box at the foot, under different parts of the window, so the card says who it is for
 * and the box for that person puts the line in. One event on the window, heard only while a box is mounted.
 */
const EVENT = 'first-look:ask'

/** Ask the reply box of this person's thread to put the ask for photos in. */
export function askForPhotos(contactId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: contactId }))
}

/** Hear an ask for this person. Returns the way to stop hearing. */
export function onAskForPhotos(contactId: string, heard: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listen = (e: Event) => {
    if ((e as CustomEvent<string>).detail === contactId) heard()
  }
  window.addEventListener(EVENT, listen)
  return () => window.removeEventListener(EVENT, listen)
}

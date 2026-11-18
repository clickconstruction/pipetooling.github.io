/**
 * Share this map, the browser's part (punch list #394). Not pure: it hands an address to the phone
 * and writes to the clipboard.
 *
 * A link is made on the press that sends it, so the phone is asked to open another app about a
 * second after the press. A phone's browser may refuse that. Nothing tells a page it was refused,
 * so this watches whether the page was left, and the sheet falls back to a second press that works
 * at once because the link is then already made.
 */

/** How long the page waits to see itself left for Messages before the sheet offers the press again. */
export const PAINTED_MAP_MESSAGES_WAIT_MS = 1500

/**
 * Hands the address to the phone. True when the page was left, hidden or blurred within the wait:
 * Messages opened, or the phone is asking whether to open it. False when nothing happened.
 */
export function openPhoneMessages(href: string, waitMs: number = PAINTED_MAP_MESSAGES_WAIT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    let left = false
    const gone = () => {
      left = true
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden') left = true
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', gone)
    window.addEventListener('blur', gone)
    try {
      window.location.href = href
    } catch {
      // Refused outright: the wait below says so.
    }
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', gone)
      window.removeEventListener('blur', gone)
      resolve(left)
    }, waitMs)
  })
}

/**
 * Copies an address that is still being made. Safari lets a page copy after a wait only when the
 * clipboard was handed a promise inside the press, so this must be called before anything is
 * awaited. Other browsers take the plain write once the address is known. True when it was copied.
 */
export async function copyWhenMade(made: Promise<string | null>): Promise<boolean> {
  let handed = false
  try {
    if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function') {
      const text = made.then((url) => {
        if (!url) throw new Error('no link')
        return new Blob([url], { type: 'text/plain' })
      })
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })])
      handed = true
    }
  } catch {
    handed = false
  }
  const url = await made
  if (!url) return false
  if (handed) return true
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}

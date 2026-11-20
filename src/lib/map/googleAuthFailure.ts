/**
 * Google's word that it refused the browser key, heard by every Google map on the page.
 *
 * A refused key does not fail the script. Google paints a grey map and calls one global,
 * `window.gm_authFailure`. A global holds one function, and each Google canvas used to put its own
 * there and put the old one back when it left. Two maps on the screen at once were then both told
 * only when they left in the order they came, and the one that came first was never told at all.
 * A painted map's window opens over a page that can have a map of its own (punch list #387), so the
 * global is set once, here, and every canvas asks to be told.
 *
 * Not React and not a map library: a canvas subscribes in an effect and the test reads it in jsdom.
 */
type AuthWindow = Window & { gm_authFailure?: () => void }

const listeners = new Set<() => void>()
/** A function someone else left on the global before this module took it. It is still told. */
let foreign: (() => void) | null = null
/** True while one refusal is being told, so a handler that calls back into this one is told once. */
let telling = false
/**
 * Google refused the key on this page. Kept until the page is loaded again: Google says so once, and
 * a map made after that is given a frame that never paints and no word of its own.
 */
let refused = false

function tellEveryone(): void {
  refused = true
  if (telling) return
  telling = true
  try {
    for (const hear of [...listeners]) hear()
    foreign?.()
  } finally {
    telling = false
  }
}

/** Puts this module's function on the global, keeping whatever was there to be told after its own listeners. */
function install(): void {
  if (typeof window === 'undefined') return
  const w = window as AuthWindow
  if (w.gm_authFailure === tellEveryone) return
  foreign = w.gm_authFailure ?? null
  w.gm_authFailure = tellEveryone
}

/**
 * Hear Google refuse the key on this page. Answers the way to stop hearing, for an effect to return.
 * Leaving in any order is safe: a canvas takes only its own listener away.
 *
 * A canvas that comes up after the refusal is told at once. Google refuses a key once for a page and
 * not once for each map, so a map made later would wait out the whole paint clock on an empty frame.
 */
export function onGoogleAuthFailure(listener: () => void): () => void {
  install()
  if (refused) {
    listener()
    return () => {}
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Google refused the browser key since this page loaded. A screen reads it to open on the other map at once. */
export function googleKeyRefusedOnPage(): boolean {
  return refused
}

/** A new page, for a test. */
export function forgetGoogleKeyRefusalForTests(): void {
  refused = false
}

/** How many canvases are listening now. For tests. */
export function googleAuthFailureListenerCount(): number {
  return listeners.size
}

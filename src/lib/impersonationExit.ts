/**
 * The way back from View as. One kernel for both doors (the header's Exit and Settings → Back to my
 * account), so neither can leave a dev signed in as the person with the flag off.
 *
 * Exit puts the dev's own stashed session back. When that swap is refused, the page is still signed
 * in as the person. Before this kernel, Exit took the flag off and moved on anyway: the banner was
 * gone, what is held while View as is on ran again, and every press saved under the person's name.
 * Now a swap that does not answer clean signs this browser out and lands on the sign-in page.
 *
 * The flag (the stash) comes off last on every path, only once the session is no longer the person's.
 */
import { supabase } from './supabase'
import { IMPERSONATION_ORIGINAL_STORAGE_KEY, impersonationReturnPath, readImpersonationStash } from './impersonationSession'

export const VIEW_AS_SIGN_IN_PATH = '/sign-in'

export type ViewAsExitOutcome =
  /** Nobody was being viewed as: there is no stash, so there is nothing to leave. */
  | { kind: 'not_viewing' }
  /** The dev's own session is back, and the page they left is next. */
  | { kind: 'back'; path: string }
  /** The dev's session could not be put back, so this browser is signed out. */
  | { kind: 'signed_out' }

export type ViewAsExitIo = {
  /** The stash as stored, or null when View as is not on. */
  raw: string | null
  origin: string
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{ error: unknown }>
  /** Sign this browser out and no other: the person's own devices stay signed in. */
  signOutHere: () => Promise<{ error: unknown }>
  /** Drop this browser's stored sign-in, whatever the server answered. */
  forgetSessionHere: () => void
  clearStash: () => void
  /** A full load, so every loader reads again as whoever is signed in now. */
  go: (path: string) => void
}

export async function leaveViewAs(io: ViewAsExitIo): Promise<ViewAsExitOutcome> {
  if (!io.raw) return { kind: 'not_viewing' }
  const stash = readImpersonationStash(io.raw)

  if (stash?.access_token && stash.refresh_token) {
    let swapped = false
    try {
      // A refusal comes back as `{ error }`, not as a throw, so the answer is read.
      const { error } = await io.setSession({ access_token: stash.access_token, refresh_token: stash.refresh_token })
      swapped = !error
    } catch {
      swapped = false
    }
    if (swapped) {
      const path = impersonationReturnPath(stash, io.origin)
      io.clearStash()
      io.go(path)
      return { kind: 'back', path }
    }
  }

  // The swap was refused, or the stash holds no session to put back: the page is still the person's.
  try {
    await io.signOutHere()
  } catch {
    /* the stored sign-in is dropped below either way */
  }
  io.forgetSessionHere()
  io.clearStash()
  io.go(VIEW_AS_SIGN_IN_PATH)
  return { kind: 'signed_out' }
}

/** The same kernel on this browser: the Supabase client, this device's storage and a full load. */
export function leaveViewAsHere(): Promise<ViewAsExitOutcome> {
  return leaveViewAs({
    raw: localStorage.getItem(IMPERSONATION_ORIGINAL_STORAGE_KEY),
    origin: window.location.origin,
    setSession: (tokens) => supabase.auth.setSession(tokens),
    signOutHere: () => supabase.auth.signOut({ scope: 'local' }),
    forgetSessionHere: () => {
      // As the app's Sign out does: the next full load must find no session.
      Object.keys(localStorage)
        .filter((key) => key.startsWith('sb-'))
        .forEach((key) => localStorage.removeItem(key))
    },
    clearStash: () => localStorage.removeItem(IMPERSONATION_ORIGINAL_STORAGE_KEY),
    go: (path) => window.location.assign(path),
  })
}

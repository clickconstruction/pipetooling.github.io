import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { stampLastActive } from './assistantDispatchLanding'
import { IMPERSONATION_ORIGINAL_STORAGE_KEY, type ImpersonationStash } from './impersonationSession'

export async function loginAsUser(
  user: { email: string | null; role?: string | null },
  redirectTo?: string
): Promise<void> {
  const email = user.email?.trim()
  if (!email) {
    throw new Error('User has no email')
  }
  // Land on the page the operator is looking at (v2.3606 View as — "does an assistant see this
  // button?" is one click). If that role cannot open it, Layout's route guard sends them where it
  // always sends them, which is itself the answer. v2.2882 landed on the role's home instead.
  const returnTo = window.location.href
  const targetRedirect = redirectTo ?? returnTo
  // Refresh session to ensure we have a valid token before invoking (avoids "Invalid or expired session")
  try {
    await supabase.auth.refreshSession()
  } catch {
    // Proceed anyway - invoke may still work if session is valid
  }
  const { data, error: eFn } = await supabase.functions.invoke('login-as-user', {
    body: { email, redirectTo: targetRedirect },
  })
  if (eFn) {
    let msg = eFn.message
    if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
      try {
        const b = (await eFn.context.json()) as { error?: string } | null
        if (b?.error) msg = b.error
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg)
  }
  const link = (data as { action_link?: string } | null)?.action_link
  if (!link) {
    throw new Error('Could not get login link')
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token && session?.refresh_token) {
    const stash: ImpersonationStash = { access_token: session.access_token, refresh_token: session.refresh_token, returnTo }
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify(stash))
  }
  // Verify the magic-link token on the CURRENT origin instead of following the
  // hosted link (v2.1569 — same fix as dev-login v2.1526): the redirect
  // allow-list only knows a couple of localhost ports, so parallel dev-server
  // ports got bounced to production mid-imitation.
  let tokenHash: string | null = null
  try {
    tokenHash = new URL(link).searchParams.get('token')
  } catch {
    /* fall through to the legacy redirect */
  }
  if (tokenHash) {
    const { error: eVerify } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (!eVerify) {
      // The imitated session is active right now. Without this stamp the
      // operator's browser has no activity on record, so an imitated assistant
      // read as "away" and the landing rule (assistantDispatchLanding.ts) jumped
      // them to the schedule instead of the landing above (J5-11).
      stampLastActive(Date.now())
      window.location.assign(targetRedirect)
      return
    }
  }
  stampLastActive(Date.now())
  window.location.href = link
}

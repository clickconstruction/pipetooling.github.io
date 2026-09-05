import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { roleHomePath } from './roleGate'
import { stampDispatchModeActivity } from './dispatchModeReturnFocus'

export async function loginAsUser(
  user: { email: string | null; role?: string | null },
  redirectTo?: string
): Promise<void> {
  const email = user.email?.trim()
  if (!email) {
    throw new Error('User has no email')
  }
  // Land on the imitated role's home (v2.2882, C25 J5-11): the same page
  // Layout's route guard sends that role to, so "Imitate" arrives where the
  // button says instead of wherever the operator's own browser state points.
  const targetRedirect = redirectTo ?? `${window.location.origin}${roleHomePath(user.role)}`
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
    localStorage.setItem(
      'impersonation_original',
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
    )
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
      // operator's browser has no Dispatch Mode activity on record, so an
      // imitated assistant read as "away 5+ minutes" and Layout jumped them to
      // /dispatch-mode/schedule instead of the landing above (J5-11).
      stampDispatchModeActivity(Date.now())
      window.location.assign(targetRedirect)
      return
    }
  }
  stampDispatchModeActivity(Date.now())
  window.location.href = link
}

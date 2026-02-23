import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export async function loginAsUser(
  user: { email: string | null },
  redirectTo?: string
): Promise<void> {
  const email = user.email?.trim()
  if (!email) {
    throw new Error('User has no email')
  }
  const targetRedirect = redirectTo ?? `${window.location.origin}/dashboard`
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
  window.location.href = link
}

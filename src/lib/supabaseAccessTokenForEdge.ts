import { supabase } from './supabase'

/**
 * JWT for Edge Functions that call `auth.getUser(token)` (e.g. get-stripe-invoice-details).
 * `getSession()` can return an expired access_token from storage; `getUser()` validates with
 * the server — on failure we refresh once so invoke() sends a usable Bearer token.
 */
export async function getAccessTokenForEdgeFunctions(): Promise<string | null> {
  const { data: sess1 } = await supabase.auth.getSession()
  if (!sess1.session?.access_token) return null

  const { error: userErr } = await supabase.auth.getUser()
  if (!userErr) return sess1.session.access_token

  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
  if (refreshErr || !refreshed.session?.access_token) return null
  return refreshed.session.access_token
}

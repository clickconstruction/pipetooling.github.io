/**
 * Headers for a public-function call that let the server tell a staff open from a customer's
 * (journey-map Tier-2 #37). The public pages run in the same origin as the office app, so when
 * an office user opens a customer link from the browser they work in, the browser already
 * holds their Supabase session. Sending its access token — instead of the anon key — lets the
 * edge function verify it and skip the view count (and, on the customer portal, answer with
 * the office-only "Opened N times" figures). No session → the anon key, exactly as before.
 *
 * Never changes what the page renders: the edge functions treat the token as a "who is
 * looking" hint only — the link stays the credential.
 */
import { supabase } from './supabase'

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export async function staffAwarePublicHeaders(): Promise<Record<string, string>> {
  let accessToken: string | null = null
  try {
    const { data } = await supabase.auth.getSession()
    accessToken = data.session?.access_token ?? null
  } catch {
    accessToken = null
  }
  return { apikey: anonKey, Authorization: `Bearer ${accessToken ?? anonKey}` }
}

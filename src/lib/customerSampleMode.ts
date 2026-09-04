/**
 * Sample mode on the public pages (What customers see, v2.2758). A public page normally calls
 * its edge function with the anon key and a customer token; for the sample token it sends the
 * signed-in staff user's JWT instead, and the function answers with the fixture laid over the
 * live Settings. Writes never happen in sample mode — the pages short-circuit them.
 */
import { supabase } from './supabase'
import { sampleStateFromToken, type SampleState } from './customerSample'

export type { SampleState }
export { sampleStateFromToken }

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** Headers for a public-function call: the anon key, or the user's JWT when viewing a sample. */
export async function publicFunctionHeaders(sample: SampleState | null): Promise<Record<string, string>> {
  if (!sample) return { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  return { apikey: anonKey, Authorization: `Bearer ${jwt ?? anonKey}` }
}

export const SAMPLE_BANNER_TEXT = 'Sample — this is what a customer sees. Nothing you do here is saved.'

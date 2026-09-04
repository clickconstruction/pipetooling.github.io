/**
 * Sample mode on the public pages (What customers see, v2.2758; sign-in requirement dropped in
 * v2.2763). A public page calls its edge function with the anon key and a customer token; the
 * sample tokens answer with a hard-coded sample customer laid over the live Settings, for anyone
 * with the link — the data is invented, so there is nothing to protect. Writes never happen in
 * sample mode — the pages short-circuit them.
 */
import { sampleStateFromToken, type SampleState } from './customerSample'

export type { SampleState }
export { sampleStateFromToken }

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** Headers for a public-function call. Sample or not, the anon key is the credential. */
export async function publicFunctionHeaders(_sample: SampleState | null): Promise<Record<string, string>> {
  return { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
}

export const SAMPLE_BANNER_TEXT = 'Sample — this is what a customer sees. Nothing you do here is saved.'

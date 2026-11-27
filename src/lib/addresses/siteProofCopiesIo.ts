/**
 * A signed paper's own PDF, for the proof's packet (punch list #439, piece 5, part 5b). It is the PDF **Open the PDF**
 * opens on the paper's record: `person-paper-pdf` answers a short-lived link, and the file is read from it.
 *
 * The function serves the four office roles, and an estimator on a paper with an outside company. A refusal comes back
 * in its own words (a form's PDF is its own, a paper with no words has none), and the caller holds that copy with them.
 */
import { supabase } from '../supabase'
import type { ProofCopyFetch } from './siteProofPdf'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const fetchSignedCopy: ProofCopyFetch = async (paperId) => {
  const { data: sess } = await supabase.auth.getSession()
  const jwt = sess.session?.access_token
  if (!jwt) throw new Error('Not signed in.')
  const res = await fetch(`${supabaseUrl}/functions/v1/person-paper-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: anonKey },
    body: JSON.stringify({ person_contract_document_id: paperId }),
  })
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string }
  if (!res.ok || !json.url) throw new Error(json.error || 'Its PDF could not be opened.')
  const file = await fetch(json.url)
  if (!file.ok) throw new Error('Its PDF could not be read just now.')
  return await file.blob()
}

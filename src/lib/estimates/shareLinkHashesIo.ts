/**
 * The share links an estimate has made (v2.6725, punch list #281): `estimate_share_links.token_hash`, the SHA-256 of
 * each code `share_estimate_link` minted for a text or a Messages line, which the office may read (the table grants
 * SELECT to a signed-in user over an estimate they can read). The tie (`acceptLinkTie.ts`) hashes a text's `/e/<code>`
 * link and asks whether it is one of these. Every link the estimate ever made, stopped or not: the text went either way.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'

export async function loadShareLinkHashes(estimateId: string | null, client: unknown = supabase): Promise<string[]> {
  if (!estimateId) return []
  const db = client as SupabaseClient
  const rows = await db.from('estimate_share_links').select('token_hash').eq('estimate_id', estimateId)
  checkSupabaseError(rows, 'read texted links')
  return ((rows.data ?? []) as Array<{ token_hash: string | null }>).map((r) => r.token_hash ?? '').filter((h) => h.length > 0)
}

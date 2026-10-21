/**
 * The text door's read (v2.5706, punch list #139 PR 14): the open thread's outbound texts that carry an accept link,
 * their tokens hashed as the edge minted them (`acceptLinkTie.ts`), and the estimates those hashes name — one read of
 * `estimates` by hash, which the office may read. The pure tie is `estimateDoor.ts` `textDoorsFrom`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { isChangeOrderDocKind } from '../estimateChangeOrder'
import { acceptTokensIn, sha256Hex } from '../estimates/acceptLinkTie'
import { textDoorsFrom, type EstimateDoor } from './estimateDoor'

export async function loadTextDoors(contactId: string, client: unknown = supabase): Promise<Map<string, EstimateDoor>> {
  const db = client as SupabaseClient
  const texts = await db.from('messages').select('id, body').eq('contact_id', contactId).eq('channel', 'text').eq('direction', 'out').ilike('body', '%/estimate/accept%').order('at', { ascending: false }).limit(100)
  checkSupabaseError(texts, 'read the texts with a link')
  const rows = (texts.data ?? []) as Array<{ id: string; body: string }>
  if (rows.length === 0) return new Map()
  const hashed = await Promise.all(
    rows.map(async (r) => ({ id: r.id, hashes: (await Promise.all(acceptTokensIn(r.body).map((t) => sha256Hex(t)))).filter((h): h is string => h !== null) })),
  )
  const hashes = [...new Set(hashed.flatMap((t) => t.hashes))]
  if (hashes.length === 0) return new Map()
  const ests = await db.from('estimates').select('estimate_number, public_token_hash, doc_kind').in('public_token_hash', hashes)
  checkSupabaseError(ests, 'read the estimates the links name')
  const estimates = ((ests.data ?? []) as Array<{ estimate_number: number | null; public_token_hash: string | null; doc_kind: string | null }>)
    .filter((e): e is { estimate_number: number; public_token_hash: string; doc_kind: string | null } => e.estimate_number != null && !!e.public_token_hash)
    .map((e) => ({ number: e.estimate_number, tokenHash: e.public_token_hash, changeOrder: isChangeOrderDocKind(e.doc_kind) }))
  return textDoorsFrom(hashed, estimates)
}

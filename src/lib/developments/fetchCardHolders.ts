/**
 * The read behind `cardHolders.ts` (v2.6457): for the card charges on a site's jobs, the card id and the kind out of
 * each bank record, a few bytes a row (PostgREST reads the one JSON field, never the whole record the
 * Gray Fox spike took off the page's read), then the cards' links to people and their nicknames, then
 * the linked people's names. Runs under the reader's own policies; the board's cost rows are the
 * finance seats' alone, as the Costs column is.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { readUserNames } from './fetchDevelopmentPage'
import { cardHolderOf, cardIdOf, type CardHolder } from './cardHolders'

type TxCardRow = { id: string; kind: string | null; card_a: string | null; card_b: string | null }
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function fetchCardHolders(supabase: SupabaseClient, txIds: ReadonlyArray<string>): Promise<Map<string, CardHolder>> {
  const ids = [...new Set(txIds.filter(Boolean))]
  const out = new Map<string, CardHolder>()
  if (ids.length === 0) return out
  const txRows = await fetchAllRowsChunkedIn<TxCardRow, string>(
    ids,
    (chunk, from, to) =>
      supabase.from('mercury_transactions').select('id, kind, card_a:raw->details->debitCardInfo->>id, card_b:raw->debitCardInfo->>id').in('id', chunk).range(from, to) as unknown as Page<TxCardRow>,
    'site card ids',
    { chunkSize: 150, parallel: 3 },
  )
  const cardByTx = new Map<string, string | null>()
  const kindByTx = new Map<string, string | null>()
  for (const r of txRows) {
    cardByTx.set(r.id, cardIdOf(r.card_a, r.card_b))
    kindByTx.set(r.id, r.kind)
  }
  const cardIds = [...new Set([...cardByTx.values()].filter((c): c is string => !!c))]
  const [links, nicks] = cardIds.length
    ? await Promise.all([
        supabase.from('mercury_debit_card_user_links').select('mercury_debit_card_id, user_id').in('mercury_debit_card_id', cardIds).limit(500),
        supabase.from('mercury_debit_card_nicknames').select('mercury_debit_card_id, nickname').in('mercury_debit_card_id', cardIds).limit(500),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  const userIdByCard = new Map<string, string>()
  for (const l of (links.error ? [] : (links.data ?? [])) as Array<{ mercury_debit_card_id: string; user_id: string | null }>) if (l.user_id) userIdByCard.set(l.mercury_debit_card_id.toLowerCase(), l.user_id)
  const nicknameByCard = new Map<string, string>()
  for (const n of (nicks.error ? [] : (nicks.data ?? [])) as Array<{ mercury_debit_card_id: string; nickname: string | null }>) if (n.nickname) nicknameByCard.set(n.mercury_debit_card_id.toLowerCase(), n.nickname)
  const names = await readUserNames([...new Set(userIdByCard.values())])
  for (const id of ids) out.set(id, cardHolderOf(cardByTx.get(id) ?? null, { userIdByCard, nicknameByCard, names }, kindByTx.get(id) ?? null))
  return out
}

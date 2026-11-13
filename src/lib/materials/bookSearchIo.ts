/**
 * The parts book searched by words (punch list #330, PR 4): the read behind **This is a
 * parts-book part** on a site's materials screen. Every word typed must be in the part's name,
 * in any order; the book writes `3X2 WYE DWV` where a crew types `3x2 wye`.
 */
import { supabase } from '../supabase'
import { bookSearchWords } from './siteWorth'

export type BookPartHit = { id: string; name: string; manufacturer: string | null }

export const BOOK_SEARCH_MAX = 20

export async function searchBookParts(term: string): Promise<BookPartHit[]> {
  const words = bookSearchWords(term)
  if (words.length === 0) return []
  let q = supabase.from('material_parts').select('id, name, manufacturer').order('name').limit(BOOK_SEARCH_MAX)
  for (const w of words) q = q.ilike('name', `%${w}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as BookPartHit[]
}

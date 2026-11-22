import { supabase } from '../supabase'
import { partSearchWords } from './addPart'

/** A part of the parts book, as the Add a part sheet lists it. */
export type PartsBookHit = { id: string; name: string; manufacturer: string | null }

/**
 * The Add a part sheet's search of the parts book: twenty parts whose name or maker holds the typed words, by name.
 * The Tally narrows it to its service type; the office's Materials desk (v2.8282) searches every part.
 */
export async function searchPartsBook(term: string, serviceTypeId?: string | null): Promise<PartsBookHit[]> {
  const q = partSearchWords(term)
  if (!q) return []
  let qb = supabase.from('material_parts').select('id, name, manufacturer').or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%`).limit(20).order('name')
  if (serviceTypeId) qb = qb.eq('service_type_id', serviceTypeId)
  const { data } = await qb
  return (data ?? []) as PartsBookHit[]
}

/**
 * The sub's portal URL for a notification (Work Orders tab, PR 2 — v2.2819):
 * their custom short link when one is set, else the newest live token link,
 * minting one when the person has none yet. Shared by the assembler and the
 * board's Nudge; the sheet box keeps its own copy until PR 3 turns it into a door.
 */
import { supabase } from '../supabase'
import { portalShortUrl } from '../portal/portalShortOrigin'

export async function resolveSubPortalUrl(personId: string): Promise<string | null> {
  const { data: slugRow } = await supabase.from('sub_portal_slugs').select('slug').eq('person_id', personId).maybeSingle()
  const slug = ((slugRow as { slug?: string | null } | null)?.slug ?? '').trim()
  if (slug) return portalShortUrl(slug)
  const { data: linkRow } = await supabase.from('sub_portal_links').select('token').eq('person_id', personId).is('revoked_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  let token = ((linkRow as { token?: string | null } | null)?.token ?? '').trim()
  if (!token) {
    const { data, error } = await supabase.rpc('mint_sub_portal_link' as never, { p_person_id: personId, p_rotate: false } as never)
    if (error) return null
    token = ((data as { token?: string | null } | null)?.token ?? '').trim()
  }
  return token ? `${window.location.origin}/sub?t=${token}` : null
}

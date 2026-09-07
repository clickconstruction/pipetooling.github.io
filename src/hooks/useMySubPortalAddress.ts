import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { portalShortUrl } from '../lib/portal/portalShortOrigin'

export type MySubPortalAddress = { slug: string | null; token: string | null }

/** Pure: the URL a sub opens for their own statement — the short address when one exists, else the direct token link, else null. */
export function mySubPortalUrl(addr: MySubPortalAddress | null, origin: string): string | null {
  if (!addr) return null
  if (addr.slug) return portalShortUrl(addr.slug)
  if (addr.token) return `${origin}/sub?t=${encodeURIComponent(addr.token)}`
  return null
}

/**
 * Journey map SP-2 (v2.3067): the signed-in sub / helper's own portal address, from
 * `my_sub_portal_address()` (SECURITY DEFINER, answers only for the caller's roster row).
 * Fails soft: any error or a missing RPC reads as "no door".
 */
export function useMySubPortalAddress(enabled: boolean): { url: string | null; loaded: boolean } {
  const [addr, setAddr] = useState<MySubPortalAddress | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!enabled) {
      setAddr(null)
      setLoaded(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('my_sub_portal_address' as never)
        if (cancelled) return
        if (error || !data || typeof data !== 'object') {
          setAddr(null)
        } else {
          const d = data as { slug?: string | null; token?: string | null }
          setAddr({ slug: d.slug ?? null, token: d.token ?? null })
        }
      } catch {
        if (!cancelled) setAddr(null)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  return { url: mySubPortalUrl(addr, typeof window !== 'undefined' ? window.location.origin : ''), loaded }
}

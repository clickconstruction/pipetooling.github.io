import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolveGcPortalLink, type GcPortalLink, type PortalLinkRow, type PortalSlugRow } from '../lib/portal/gcPortalLink'
import { APP_ORIGIN } from '../lib/appOrigin'

/**
 * Portal links for a set of GC customer ids (GC Review, v2.2151): one read of
 * `customer_portal_links` + `customer_portal_slugs`, resolved per customer by
 * `resolveGcPortalLink`. Returns a Map (missing/null = no active portal) and
 * a `refresh` for after the globe modal mints or revokes something.
 */
export function useGcPortalLinks(customerIds: readonly string[], enabled = true): { links: Map<string, GcPortalLink>; loaded: boolean; refresh: () => void } {
  const [rows, setRows] = useState<{ links: PortalLinkRow[]; slugs: PortalSlugRow[] } | null>(null)
  const [tick, setTick] = useState(0)
  const key = useMemo(() => [...customerIds].sort().join(','), [customerIds])

  useEffect(() => {
    if (!enabled || !key) {
      setRows(null)
      return
    }
    let cancelled = false
    const ids = key.split(',')
    void (async () => {
      const [l, s] = await Promise.all([
        supabase.from('customer_portal_links').select('customer_id, audience, token, revoked_at').in('customer_id', ids).is('revoked_at', null),
        supabase.from('customer_portal_slugs').select('customer_id, slug, locked_at').in('customer_id', ids),
      ])
      if (cancelled) return
      setRows({ links: (l.data as PortalLinkRow[] | null) ?? [], slugs: (s.data as PortalSlugRow[] | null) ?? [] })
    })()
    return () => {
      cancelled = true
    }
  }, [key, enabled, tick])

  const links = useMemo(() => {
    const m = new Map<string, GcPortalLink>()
    if (!rows || !key) return m
    const origin = typeof window !== 'undefined' ? window.location.origin : APP_ORIGIN
    for (const id of key.split(',')) {
      const r = resolveGcPortalLink(id, rows.links, rows.slugs, origin)
      if (r) m.set(id, r)
    }
    return m
  }, [rows, key])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { links, loaded: rows != null, refresh }
}

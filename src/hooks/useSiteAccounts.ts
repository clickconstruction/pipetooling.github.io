import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import type { SiteKey, SitePerson, SiteRead } from '../lib/people/siteAccounts'
import { fetchSitePeople, fetchSiteRoster } from '../lib/people/siteAccountsIo'

export type SiteAccountsState = {
  /** Each site's read, on its own: one that fails never blanks the other. */
  reads: Record<SiteKey, SiteRead>
  /** The people here as the lens matches them, or why they could not be read. Null while reading. */
  people: { ok: true; rows: SitePerson[]; countLinkByUserId: ReadonlyMap<string, string> } | { ok: false; reason: string } | null
  refresh: () => void
}

const LOADING: Record<SiteKey, SiteRead> = { count: { state: 'loading' }, takeoff: { state: 'loading' } }

/**
 * The Sites lens's data (v2.8657): read only while the lens is open and the viewer is a dev. Nothing is read for
 * anyone else, and nothing is written for anyone.
 */
export function useSiteAccounts(enabled: boolean): SiteAccountsState {
  const [reads, setReads] = useState<Record<SiteKey, SiteRead>>(LOADING)
  const [people, setPeople] = useState<SiteAccountsState['people']>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    // A read that lands after the lens closed, or after Read again, is dropped.
    let alive = true
    const live = () => alive
    setReads(LOADING)
    setPeople(null)
    for (const site of ['count', 'takeoff'] as const) {
      void fetchSiteRoster(supabase, site).then((read) => {
        if (live()) setReads((prev) => ({ ...prev, [site]: read }))
      })
    }
    fetchSitePeople(supabase)
      .then((rows) => {
        if (!live()) return
        const links = new Map<string, string>()
        for (const r of rows) if (r.counttooling_user_id) links.set(r.id, r.counttooling_user_id)
        setPeople({ ok: true, rows: rows.map((r) => ({ email: r.email, linkedId: r.counttooling_user_id })), countLinkByUserId: links })
      })
      .catch((e: unknown) => {
        if (live()) setPeople({ ok: false, reason: formatErrorMessage(e, 'The people here could not be read.') })
      })
    return () => {
      alive = false
    }
  }, [enabled, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { reads, people, refresh }
}

/**
 * The two sites' accounts alone (v2.8667), for one person's desk: read only while `enabled`, each site on its own.
 * `refresh` reads again after a press changed a seat.
 */
export function useSiteRosters(enabled: boolean): { reads: Record<SiteKey, SiteRead>; refresh: () => void } {
  const [reads, setReads] = useState<Record<SiteKey, SiteRead>>(LOADING)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    for (const site of ['count', 'takeoff'] as const) {
      void fetchSiteRoster(supabase, site).then((read) => {
        if (alive) setReads((prev) => ({ ...prev, [site]: read }))
      })
    }
    return () => {
      alive = false
    }
  }, [enabled, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { reads, refresh }
}

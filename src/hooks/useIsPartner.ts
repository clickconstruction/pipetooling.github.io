import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { parsePartnerSummary } from '../lib/partnerLedger/partnerWeeks'
import {
  NO_PARTNER_NAV,
  PARTNER_NAV_CACHE_KEY,
  parsePartnerNavCache,
  partnerNavStatusFromSummary,
  type PartnerNavStatus,
} from '../lib/partnerLedger/partnerNavStatus'
import type { UserRole } from './useAuth'

const CHANGED_EVENT = 'partner-nav-status-changed'

function readCache(uid: string): PartnerNavStatus | null {
  try {
    return parsePartnerNavCache(sessionStorage.getItem(PARTNER_NAV_CACHE_KEY), Date.now(), uid)
  } catch {
    return null
  }
}

/** Drop the cache and make every mounted hook refetch — call after an acknowledge. */
export function invalidatePartnerNavStatus() {
  try {
    sessionStorage.removeItem(PARTNER_NAV_CACHE_KEY)
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

/** Roles a partner account can have: anything that isn't office/dev. (Bryan is an `estimator`.) */
export function roleCanBePartner(role: UserRole | null): boolean {
  return role != null && role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role)
}

/**
 * Is the signed-in account a partner with the weekly statement on — and is a
 * statement waiting on their sign-off? One `get_my_partner_summary` call per
 * session for roles that can be partners (field + estimating roles; never
 * dev/office), cached in sessionStorage for 10 minutes. Drives the Statement
 * link in the nav.
 */
export function useIsPartner(role: UserRole | null, userId: string | null | undefined): PartnerNavStatus {
  const eligible = roleCanBePartner(role) && !!userId
  const [status, setStatus] = useState<PartnerNavStatus>(() => (eligible && userId ? readCache(userId) ?? NO_PARTNER_NAV : NO_PARTNER_NAV))

  useEffect(() => {
    if (!eligible || !userId) return
    const uid = userId
    let cancelled = false
    async function load(force: boolean) {
      const cached = force ? null : readCache(uid)
      if (cached) {
        setStatus(cached)
        return
      }
      const { data, error } = await supabase.rpc('get_my_partner_summary')
      if (cancelled) return
      const next = error ? NO_PARTNER_NAV : partnerNavStatusFromSummary(parsePartnerSummary(data))
      setStatus(next)
      try {
        sessionStorage.setItem(PARTNER_NAV_CACHE_KEY, JSON.stringify({ ...next, at: Date.now(), uid }))
      } catch {
        /* private mode */
      }
    }
    void load(false)
    const onChanged = () => void load(true)
    window.addEventListener(CHANGED_EVENT, onChanged)
    return () => {
      cancelled = true
      window.removeEventListener(CHANGED_EVENT, onChanged)
    }
  }, [eligible, userId])

  return eligible ? status : NO_PARTNER_NAV
}

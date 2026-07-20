import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { isAssistantLike } from '../lib/subcontractorLikeRole'

export type CantReachProspect = {
  id: string
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  address: string | null
  links_to_website: string | null
  last_contact: string | null
  prospect_fit_status: string | null
}

/**
 * Quickfill "Unreachable Prospects": prospects flagged `cant_reach`, hoisted to page
 * level so the section can be count-gated. The metric must be reported from the page
 * (not the section body): hiding the section unmounts the body, and metrics clear on
 * unmount, so a body-reported count would flap the gate.
 */
export function useQuickfillCantReachProspects(): {
  prospects: CantReachProspect[]
  loading: boolean
  fetchEnabled: boolean
  refetch: () => Promise<void>
} {
  const { user: authUser, role } = useAuth()
  const fetchEnabled =
    Boolean(authUser?.id) && (role === 'dev' || role === 'master_technician' || isAssistantLike(role))
  const [prospects, setProspects] = useState<CantReachProspect[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!fetchEnabled) return
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('prospects')
            .select(
              'id, company_name, contact_name, phone_number, email, address, links_to_website, last_contact, prospect_fit_status',
            )
            .eq('prospect_fit_status', 'cant_reach')
            .order('last_contact', { ascending: false, nullsFirst: false }),
        'quickfill cant-reach prospects',
      )
      setProspects((data ?? []) as CantReachProspect[])
    } catch {
      setProspects([])
    }
  }, [fetchEnabled])

  useEffect(() => {
    if (!fetchEnabled) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      await refetch()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchEnabled, refetch])

  return { prospects, loading, fetchEnabled, refetch }
}

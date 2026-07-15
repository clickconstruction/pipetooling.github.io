import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Owns the access-control flags for the People page. Loads the current user's
 * role and pay/cost-matrix permissions, then exposes the resulting capability
 * flags. The parent component destructures the returned object and derives any
 * additional flags from these values.
 */
export function usePeopleAccess(authUserId: string | undefined) {
  const [canAccessPay, setCanAccessPay] = useState(false)
  const [canAccessHours, setCanAccessHours] = useState(false)
  const [canAccessLicenses, setCanAccessLicenses] = useState(false)
  const [canAccessContracts, setCanAccessContracts] = useState(false)
  const [isDev, setIsDev] = useState(false)
  const [canSeePushStatus, setCanSeePushStatus] = useState(false)

  useEffect(() => {
    async function loadPayAccess() {
      if (!authUserId) return
      const [meRes, approvedRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUserId).single(),
        supabase.from('pay_approved_masters').select('master_id'),
      ])
      const role = (meRes.data as { role?: string } | null)?.role ?? null
      const approvedIds = new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id))
      if (role === 'dev') {
        setCanAccessPay(true)
        setCanAccessHours(true)
        setCanAccessLicenses(true)
        setCanAccessContracts(true)
        setIsDev(true)
        setCanSeePushStatus(true)
        return
      }
      if (role === 'controller') {
        // Assistant-like + dev-level financial visibility (v2.662): full pay/hours access,
        // but not dev admin (isDev stays false).
        setCanAccessPay(true)
        setCanAccessHours(true)
        setCanAccessLicenses(true)
        setCanAccessContracts(true)
        setCanSeePushStatus(true)
        return
      }
      if (role === 'assistant') {
        setCanAccessHours(true)
        setCanAccessLicenses(true)
        setCanAccessContracts(true)
        setCanSeePushStatus(true)
        return
      }
      if (role === 'master_technician') {
        setCanSeePushStatus(true)
        setCanAccessContracts(true)
        if (approvedIds.has(authUserId)) {
          setCanAccessPay(true)
          setCanAccessHours(true)
          setCanAccessLicenses(true)
        }
      }
    }
    loadPayAccess()
  }, [authUserId])

  return {
    canAccessPay,
    canAccessHours,
    canAccessLicenses,
    canAccessContracts,
    isDev,
    canSeePushStatus,
  }
}

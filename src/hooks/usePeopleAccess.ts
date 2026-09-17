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
  const [canAccessVehicles, setCanAccessVehicles] = useState(false)
  const [canAccessHours, setCanAccessHours] = useState(false)
  const [canAccessLicenses, setCanAccessLicenses] = useState(false)
  const [canAccessContracts, setCanAccessContracts] = useState(false)
  const [isDev, setIsDev] = useState(false)
  const [isAssistant, setIsAssistant] = useState(false)
  const [canSeePushStatus, setCanSeePushStatus] = useState(false)
  /**
   * People → Day book (to-dos/day-book). Every office role may open it and read
   * their own days; picking another person and seeing amounts follows the payroll
   * gate (dev, controller, pay-approved master). The RPC enforces the same rule
   * server-side, so these only shape the toolbar.
   */
  const [canSeeDayBook, setCanSeeDayBook] = useState(false)
  const [canPickDayBookPerson, setCanPickDayBookPerson] = useState(false)
  /**
   * True once the flags above reflect the signed-in user (v2.2882). Every flag
   * starts false, so a URL gate that reads them before this flips would bounce
   * a dev's cold deep link to Users — gate only after `accessResolved`.
   */
  const [accessResolved, setAccessResolved] = useState(false)

  useEffect(() => {
    async function loadPayAccess() {
      if (!authUserId) return
      const [meRes, approvedRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUserId).single(),
        supabase.from('pay_approved_masters').select('master_id'),
      ])
      applyRole(
        (meRes.data as { role?: string } | null)?.role ?? null,
        new Set((approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id)),
      )
      setAccessResolved(true)
    }
    function applyRole(role: string | null, approvedIds: Set<string>) {
      if (!authUserId) return
      if (role === 'dev' || role === 'controller' || role === 'assistant' || role === 'master_technician') {
        setCanSeeDayBook(true)
        setCanPickDayBookPerson(role === 'dev' || role === 'controller' || (role === 'master_technician' && approvedIds.has(authUserId)))
      }
      if (role === 'dev') {
        setCanAccessPay(true)
        setCanAccessVehicles(true)
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
        setCanAccessVehicles(true)
        setCanAccessHours(true)
        setCanAccessLicenses(true)
        setCanAccessContracts(true)
        setCanSeePushStatus(true)
        return
      }
      if (role === 'assistant') {
        setIsAssistant(true)
        // Vehicles split off the pay gate (v2.1650, owner decision): fleet
        // management is assistant work and the table RLS always admitted
        // is_assistant() — only the tab was hidden by the v2.660 pay bundle.
        setCanAccessVehicles(true)
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
          setCanAccessVehicles(true)
          setCanAccessHours(true)
          setCanAccessLicenses(true)
        }
      }
    }
    loadPayAccess()
  }, [authUserId])

  return {
    canAccessPay,
    canAccessVehicles,
    canAccessHours,
    canAccessLicenses,
    canAccessContracts,
    isDev,
    isAssistant,
    canSeePushStatus,
    canSeeDayBook,
    canPickDayBookPerson,
    accessResolved,
  }
}

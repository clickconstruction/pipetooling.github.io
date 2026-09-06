import { useEffect, useState } from 'react'
import type { UserRole } from './useAuth'
import { resolveOrgDefault, type OrgDefaultKey, type OrgDefaultRow, type OrgDefaultSource } from '../lib/orgDefaults'
import { getOrgDefaultRowsSync, loadOrgDefaults, subscribeOrgDefaults } from '../lib/orgDefaultsStore'

/**
 * T5-08: what one switch should be for this role on this device — device override → role →
 * everyone → fallback — resolved once the org rows are in. `loaded` flips when they are, so a
 * consumer can seed its state from the org default only when the device has said nothing.
 */
export function useOrgDefault(
  key: OrgDefaultKey,
  role: UserRole | string | null | undefined,
  deviceRaw: string | null | undefined,
): { value: string; source: OrgDefaultSource; loaded: boolean } {
  const [rows, setRows] = useState<OrgDefaultRow[] | null>(() => getOrgDefaultRowsSync())
  useEffect(() => {
    let cancelled = false
    void loadOrgDefaults().then((r) => {
      if (!cancelled) setRows(r)
    })
    const off = subscribeOrgDefaults((r) => setRows(r))
    return () => {
      cancelled = true
      off()
    }
  }, [])
  const resolved = resolveOrgDefault(key, role, rows, deviceRaw)
  return { ...resolved, loaded: rows !== null }
}

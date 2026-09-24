/**
 * The Hiring column shares and the column names, for surfaces outside the board that only say
 * who holds what (Settings → Active accounts, v2.3802). Both tables are readable by a dev and a
 * full Hiring-board holder (`20260924040000_team_prospect_role_shares`); for anyone else the reads
 * come back empty and the line simply does not render. Fail-soft: an error leaves both empty.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ColumnShare } from '../lib/hiring/columnShares'

export type HiringColumnName = { id: string; name: string }

export function useHiringColumnShares(enabled: boolean) {
  const [shares, setShares] = useState<ColumnShare[]>([])
  const [roles, setRoles] = useState<HiringColumnName[]>([])

  const reload = useCallback(async () => {
    if (!enabled) return
    const [sharesRes, rolesRes] = await Promise.all([
      supabase.from('team_prospect_role_shares').select('role_id, user_id, shared_by, created_at'),
      supabase.from('team_prospect_roles').select('id, name').order('position', { ascending: true }).order('created_at', { ascending: true }),
    ])
    setShares(sharesRes.error ? [] : ((sharesRes.data ?? []) as ColumnShare[]))
    setRoles(rolesRes.error ? [] : ((rolesRes.data ?? []) as HiringColumnName[]))
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { shares, roles, reload }
}

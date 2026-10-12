import { useCallback, useEffect, useState } from 'react'

import type { ClauseNeedRow } from '../lib/contracts/approval'
import { canApproveClause } from '../lib/gc/access'
import { formatDenverDateTimeShort } from '../utils/dateUtils'
import { useAuth } from './useAuth'

const when = (at: string): string => {
  const ms = Date.parse(at)
  return Number.isNaN(ms) ? '' : formatDenverDateTimeShort(ms)
}

/**
 * Messages, cut 4c: the clause changes waiting on the viewer's approval, for the Dashboard's Needs you and Follow up's
 * (helper 2's `followUpQueue` → `clauses`, drawn by `ClauseNeedRows`). Only a controller or a dev reads anything; for
 * anyone else the rows stay empty without a read. The reads load on demand, so the Dashboard's own chunk does not grow,
 * and refetch on window focus like the neighbouring nudges. `reload` reads again after an approve or a decline.
 */
export function useClauseNeeds(enabled = true): { rows: ClauseNeedRow[]; reload: () => void } {
  const { role } = useAuth()
  const on = enabled && canApproveClause(role)
  const [rows, setRows] = useState<ClauseNeedRow[]>([])
  const load = useCallback(async () => {
    if (!on) {
      setRows([])
      return
    }
    try {
      const { loadClauseNeeds } = await import('../lib/contracts/clausesIo')
      setRows(await loadClauseNeeds(role, when))
    } catch {
      setRows([])
    }
  }, [on, role])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { rows, reload: () => void load() }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ArReturnCaseRow } from '../lib/jobs/arReturnCase'
import { groupArDepositTrailRows, type ArDepositTrailRow } from '../lib/jobs/arDepositTrail'

/** PostgREST's "no such function": the migration is not on this database yet, so the cases stay off for the visit. */
function isMissingRpc(message: string | undefined): boolean {
  return /could not find the function|PGRST202/i.test(message ?? '')
}

/**
 * The open cases of checks that came back (v2.4325, punch list #76 PR 3) — one read of
 * `list_ar_return_cases` and one of `list_ar_deposit_trails` for their deposits, so the
 * pane can tell who applied it and who took it off. Fail-soft: a refused read leaves the
 * list without a Came back group, never an error over the deposits.
 */
export function useArReturnCases(open: boolean, enabled: boolean): {
  /** The open cases. */
  cases: ArReturnCaseRow[]
  /** v2.4328: every case, closed too — the payer's history on a new deposit's row. */
  allCases: ArReturnCaseRow[]
  trails: Map<string, ArDepositTrailRow[]>
  ready: boolean
  refresh: () => Promise<void>
} {
  const [cases, setCases] = useState<ArReturnCaseRow[]>([])
  const [allCases, setAllCases] = useState<ArReturnCaseRow[]>([])
  const [trails, setTrails] = useState<Map<string, ArDepositTrailRow[]>>(new Map())
  const [ready, setReady] = useState(false)
  const offRef = useRef(false)
  const seqRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!open || !enabled || offRef.current) {
      setReady(true)
      return
    }
    const seq = ++seqRef.current
    try {
      const { data, error } = await supabase.rpc('list_ar_return_cases' as never, { p_include_closed: true } as never)
      if (seq !== seqRef.current) return
      if (error) {
        if (isMissingRpc(error.message)) offRef.current = true
        setCases([])
        setAllCases([])
        setTrails(new Map())
        return
      }
      const every = ((data ?? []) as unknown as ArReturnCaseRow[]).filter((r) => r && typeof r.mercury_transaction_id === 'string')
      setAllCases(every)
      const rows = every.filter((r) => r.closed_at == null)
      setCases(rows)
      // An unbanked case's id names no deposit (v2.4902), so it has no trail to read.
      const ids = rows.filter((r) => r.source !== 'unbanked').map((r) => r.mercury_transaction_id)
      if (ids.length === 0) {
        setTrails(new Map())
        return
      }
      const { data: trailData, error: trailError } = await supabase.rpc('list_ar_deposit_trails' as never, { p_tx_ids: ids } as never)
      if (seq !== seqRef.current) return
      setTrails(trailError ? new Map() : groupArDepositTrailRows((trailData ?? []) as unknown as ArDepositTrailRow[]))
    } catch {
      if (seq === seqRef.current) {
        setCases([])
        setAllCases([])
        setTrails(new Map())
      }
    } finally {
      if (seq === seqRef.current) setReady(true)
    }
  }, [open, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { cases, allCases, trails, ready, refresh }
}

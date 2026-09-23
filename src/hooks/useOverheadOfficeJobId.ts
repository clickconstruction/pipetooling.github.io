/**
 * The overhead office job (`overhead_office_job_ledger_id_v1`) for the
 * clocked-in map (v2.3756): sessions on it sit on the office anchor, not a
 * pin. One app setting, fetched once per page and shared by every caller;
 * a failed read is simply no office job.
 */
import { useEffect, useState } from 'react'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../lib/overheadOfficeJobSettings'

let officeJobPromise: Promise<string | null> | null = null

function loadOfficeJobId(): Promise<string | null> {
  if (!officeJobPromise) officeJobPromise = fetchOverheadOfficeJobLedgerIdFromAppSettings().catch(() => null)
  return officeJobPromise
}

export function resetOverheadOfficeJobIdCacheForTests(): void {
  officeJobPromise = null
}

export function useOverheadOfficeJobId(enabled: boolean): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void loadOfficeJobId().then((v) => {
      if (!cancelled) setId(v)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return id
}

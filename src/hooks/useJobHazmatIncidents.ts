import { useEffect, useState } from 'react'
import { loadJobHazmatIncidents, type JobHazmatIncidentRow } from '../lib/hazmatIncidents'

/**
 * Hazmat incidents for the job open in Edit Job — feeds the Riders strip and
 * the rider labels on the invoice list. Incidents are immutable once created
 * (written only by the create RPC), so a per-job load with no realtime is
 * enough. RLS limits reads to office/billing roles; others just get [].
 */
export function useJobHazmatIncidents(jobId: string | null | undefined): {
  incidents: JobHazmatIncidentRow[]
  hazmatInvoiceIds: Set<string>
} {
  const [incidents, setIncidents] = useState<JobHazmatIncidentRow[]>([])
  const [hazmatInvoiceIds, setHazmatInvoiceIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!jobId) {
      setIncidents([])
      setHazmatInvoiceIds(new Set())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadJobHazmatIncidents(jobId)
        if (cancelled) return
        setIncidents(rows)
        setHazmatInvoiceIds(new Set(rows.map((r) => r.invoice_id).filter((id): id is string => id != null)))
      } catch {
        if (!cancelled) {
          setIncidents([])
          setHazmatInvoiceIds(new Set())
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  return { incidents, hazmatInvoiceIds }
}

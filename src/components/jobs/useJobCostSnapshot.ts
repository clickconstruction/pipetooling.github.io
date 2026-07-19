import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchJobMaterialsCostSnapshot,
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../lib/fetchJobMaterialsCostSnapshot'

export type MaterialsAccordionKey = 'supply' | 'mercury' | 'tally' | 'billed'

/**
 * Loads and holds the Edit-Job "Parts / Materials cost" snapshot (supply
 * invoices, Mercury card allocations, Tally parts) for a job, plus the
 * accordion open-state and the two derived card totals. Extracted verbatim from
 * JobFormModal. Reloads whenever `jobId` changes; clears for new jobs (null id).
 */
export function useJobCostSnapshot(jobId: string | null) {
  const [materialsAccordionOpen, setMaterialsAccordionOpen] = useState<MaterialsAccordionKey | null>('billed')
  const [jobMaterialsSnapshotLoading, setJobMaterialsSnapshotLoading] = useState(false)
  const [supplyInvoiceTotal, setSupplyInvoiceTotal] = useState(0)
  const [supplyInvoiceRpcFailed, setSupplyInvoiceRpcFailed] = useState(false)
  const [supplyInvoiceLines, setSupplyInvoiceLines] = useState<JobSupplyInvoiceLine[]>([])
  const [mercuryAllocLines, setMercuryAllocLines] = useState<JobMercuryAllocLine[]>([])
  const [mercuryFetchFailed, setMercuryFetchFailed] = useState(false)
  const [tallyPartLines, setTallyPartLines] = useState<JobTallyPartLine[]>([])
  const [tallyFetchFailed, setTallyFetchFailed] = useState(false)

  useEffect(() => {
    if (!jobId) {
      setJobMaterialsSnapshotLoading(false)
      setSupplyInvoiceTotal(0)
      setSupplyInvoiceRpcFailed(false)
      setSupplyInvoiceLines([])
      setMercuryAllocLines([])
      setMercuryFetchFailed(false)
      setTallyPartLines([])
      setTallyFetchFailed(false)
      setMaterialsAccordionOpen('billed')
      return
    }
    let cancelled = false
    setJobMaterialsSnapshotLoading(true)
    setMaterialsAccordionOpen('billed')
    setSupplyInvoiceRpcFailed(false)
    setMercuryFetchFailed(false)
    setTallyFetchFailed(false)

    void (async () => {
      try {
        const snap = await fetchJobMaterialsCostSnapshot(jobId)
        if (cancelled) return
        setSupplyInvoiceTotal(snap.supplyInvoiceTotal)
        setSupplyInvoiceRpcFailed(snap.supplyInvoiceRpcFailed)
        setSupplyInvoiceLines(snap.supplyInvoiceLines)
        setMercuryAllocLines(snap.mercuryAllocLines)
        setMercuryFetchFailed(snap.mercuryFetchFailed)
        setTallyPartLines(snap.tallyPartLines)
        setTallyFetchFailed(snap.tallyFetchFailed)
      } finally {
        if (!cancelled) setJobMaterialsSnapshotLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [jobId])

  const mercuryCardTotal = useMemo(
    () => mercuryAllocLines.reduce((s, l) => s + Math.abs(Number(l.allocationAmount)), 0),
    [mercuryAllocLines],
  )

  const tallyPartsTotal = useMemo(() => tallyPartLines.reduce((s, l) => s + l.lineTotal, 0), [tallyPartLines])

  const toggleMaterialsAccordion = useCallback((key: MaterialsAccordionKey) => {
    setMaterialsAccordionOpen((prev) => (prev === key ? null : key))
  }, [])

  return {
    materialsAccordionOpen,
    jobMaterialsSnapshotLoading,
    supplyInvoiceTotal,
    supplyInvoiceRpcFailed,
    supplyInvoiceLines,
    mercuryAllocLines,
    mercuryFetchFailed,
    tallyPartLines,
    tallyFetchFailed,
    mercuryCardTotal,
    tallyPartsTotal,
    toggleMaterialsAccordion,
  }
}

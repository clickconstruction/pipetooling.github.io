import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchJobMaterialsCostSnapshot,
  jobCardChargesCountedFromLines,
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import type { CardChargeExclusions } from '../../lib/jobs/cardChargeAllocationFilter'

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
  const [mercuryCardExclusions, setMercuryCardExclusions] = useState<CardChargeExclusions | undefined>(undefined)
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
      setMercuryCardExclusions(undefined)
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
        setMercuryCardExclusions(snap.cardExclusions)
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

  // Signed cost (a refund nets, v2.3519) under Job Summary's rule (v2.2692): Internal
  // Transfers out, an invoice-linked charge counted once.
  const mercuryCardTotal = useMemo(
    () => jobCardChargesCountedFromLines(mercuryAllocLines, mercuryCardExclusions),
    [mercuryAllocLines, mercuryCardExclusions],
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
    mercuryCardExclusions,
    tallyPartLines,
    tallyFetchFailed,
    mercuryCardTotal,
    tallyPartsTotal,
    toggleMaterialsAccordion,
  }
}

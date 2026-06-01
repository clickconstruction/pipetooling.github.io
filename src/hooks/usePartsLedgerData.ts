import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildInvoiceAmountMap, collectInvoiceJobIds } from '../lib/jobs/partsLedger'
import type { TallyPartRow } from '../types/tallyPart'

export type UsePartsLedgerDataArgs = {
  authUserId: string | null
  /** True while the user is on a tab that needs parts data (Parts or Job Summary); gates the deferred load. */
  isActive: boolean
  onError: (msg: string | null) => void
}

export type PartsLedgerData = {
  tallyParts: TallyPartRow[]
  tallyPartsLoading: boolean
  invoiceAmountByJob: Record<string, number>
  deletingTallyPartId: string | null
  updatingFixtureCostId: string | null
  loadTallyParts: () => Promise<void>
  deleteTallyPart: (id: string) => Promise<void>
  updateFixtureCost: (id: string, cost: number) => Promise<void>
}

/**
 * Owns the shared tally-parts ledger substrate (parts list + per-job supply-house invoice amounts) consumed by both
 * the Parts tab and the Job Summary tab. Self-manages the deferred load when `isActive` && a user is present.
 */
export function usePartsLedgerData({ authUserId, isActive, onError }: UsePartsLedgerDataArgs): PartsLedgerData {
  const [tallyParts, setTallyParts] = useState<TallyPartRow[]>([])
  const [tallyPartsLoading, setTallyPartsLoading] = useState(false)
  const [invoiceAmountByJob, setInvoiceAmountByJob] = useState<Record<string, number>>({})
  const [deletingTallyPartId, setDeletingTallyPartId] = useState<string | null>(null)
  const [updatingFixtureCostId, setUpdatingFixtureCostId] = useState<string | null>(null)

  async function loadTallyParts() {
    if (!authUserId) return
    setTallyPartsLoading(true)
    onError(null)
    const { data, error: err } = await supabase.rpc('list_tally_parts_with_po')
    if (err) {
      onError(err.message)
      setTallyParts([])
      setInvoiceAmountByJob({})
    } else {
      const parts = (data ?? []) as TallyPartRow[]
      setTallyParts(parts)
      const { data: allocData } = await supabase.from('supply_house_invoice_job_allocations').select('job_id')
      const jobIds = collectInvoiceJobIds(parts, allocData ?? [])
      if (jobIds.length > 0) {
        const { data: amountsData } = await supabase.rpc('get_invoice_amounts_for_jobs', { p_job_ids: jobIds })
        setInvoiceAmountByJob(
          buildInvoiceAmountMap((amountsData ?? []) as { job_id: string; invoice_amount: number }[]),
        )
      } else {
        setInvoiceAmountByJob({})
      }
    }
    setTallyPartsLoading(false)
  }

  async function deleteTallyPart(id: string) {
    if (!confirm('Remove this part from the tally?')) return
    setDeletingTallyPartId(id)
    onError(null)
    const { error: err } = await supabase.from('jobs_tally_parts').delete().eq('id', id)
    if (err) {
      onError(err.message)
    } else {
      setTallyParts((prev) => prev.filter((r) => r.id !== id))
    }
    setDeletingTallyPartId(null)
  }

  async function updateFixtureCost(id: string, cost: number) {
    setUpdatingFixtureCostId(id)
    onError(null)
    const { error: err } = await supabase.from('jobs_tally_parts').update({ fixture_cost: cost }).eq('id', id)
    if (err) {
      onError(err.message)
    } else {
      setTallyParts((prev) => prev.map((r) => (r.id === id ? { ...r, fixture_cost: cost } : r)))
    }
    setUpdatingFixtureCostId(null)
  }

  useEffect(() => {
    if (isActive && authUserId) {
      const t = setTimeout(() => void loadTallyParts(), 80)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, authUserId])

  return {
    tallyParts,
    tallyPartsLoading,
    invoiceAmountByJob,
    deletingTallyPartId,
    updatingFixtureCostId,
    loadTallyParts,
    deleteTallyPart,
    updateFixtureCost,
  }
}

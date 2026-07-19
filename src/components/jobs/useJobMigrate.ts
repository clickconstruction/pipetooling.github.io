import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  fetchJobMaterialsCostSnapshot,
  mercuryCardTotalFromLines,
  tallyPartsTotalFromLines,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import { loadTeamLaborData } from '../../utils/teamLabor'

type MigrateCandidate = { id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string }
type MigratePreview = { supply: number; tally: number; mercury: number; teamCost: number; teamHours: number }

/**
 * State + non-destructive search/preview effects for the Edit-Job "Migrate costs
 * to another job, then delete this one" modal. Extracted verbatim from
 * JobFormModal. The destructive `migrate_job_ledger_costs_and_delete` handler
 * stays in the modal (it needs the modal's close/onSaved callbacks); this hook
 * only holds the picker state, the debounced target search, and the cost preview.
 * `sourceJobId` is the job being migrated FROM (excluded from candidates).
 */
export function useJobMigrate(sourceJobId: string | null) {
  const [migrateJobModalOpen, setMigrateJobModalOpen] = useState(false)
  const [migrateTargetSearch, setMigrateTargetSearch] = useState('')
  const [migrateTargetCandidates, setMigrateTargetCandidates] = useState<MigrateCandidate[]>([])
  const [migrateTargetSearchLoading, setMigrateTargetSearchLoading] = useState(false)
  const [migrateTargetJobId, setMigrateTargetJobId] = useState<string | null>(null)
  const [migrateTargetPreviewLoading, setMigrateTargetPreviewLoading] = useState(false)
  const [migrateTargetPreview, setMigrateTargetPreview] = useState<MigratePreview | null>(null)
  const [migratingJob, setMigratingJob] = useState(false)

  // Debounced target search (excludes the source job).
  useEffect(() => {
    if (!migrateJobModalOpen || !sourceJobId) {
      setMigrateTargetCandidates([])
      setMigrateTargetSearchLoading(false)
      return
    }
    const q = migrateTargetSearch.trim()
    if (q.length < 2) {
      setMigrateTargetCandidates([])
      setMigrateTargetSearchLoading(false)
      return
    }
    setMigrateTargetSearchLoading(true)
    let cancelledOuter = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await withSupabaseRetry(
            async () => supabase.rpc('search_jobs_ledger', { search_text: q }),
            'migrate job target search',
          )
          const rows = (raw ?? []) as MigrateCandidate[]
          if (cancelledOuter) return
          setMigrateTargetCandidates(rows.filter((r) => r.id !== sourceJobId).slice(0, 30))
        } catch {
          if (!cancelledOuter) setMigrateTargetCandidates([])
        } finally {
          if (!cancelledOuter) setMigrateTargetSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelledOuter = true
      window.clearTimeout(timer)
    }
  }, [migrateJobModalOpen, migrateTargetSearch, sourceJobId])

  // Cost preview for the selected target job.
  useEffect(() => {
    const tid = migrateTargetJobId
    if (!tid) {
      setMigrateTargetPreview(null)
      setMigrateTargetPreviewLoading(false)
      return
    }
    let cancelled = false
    setMigrateTargetPreviewLoading(true)
    setMigrateTargetPreview(null)
    void (async () => {
      try {
        const snap = await fetchJobMaterialsCostSnapshot(tid)
        const teamRows = await loadTeamLaborData(supabase)
        const teamRow = teamRows.find((r) => r.jobId === tid) ?? null
        if (cancelled) return
        setMigrateTargetPreview({
          supply: snap.supplyInvoiceTotal,
          tally: tallyPartsTotalFromLines(snap.tallyPartLines),
          mercury: mercuryCardTotalFromLines(snap.mercuryAllocLines),
          teamCost: teamRow?.jobCost ?? 0,
          teamHours: teamRow?.manHours ?? 0,
        })
      } catch {
        if (!cancelled) setMigrateTargetPreview(null)
      } finally {
        if (!cancelled) setMigrateTargetPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [migrateTargetJobId])

  /** Reset the whole migrate picker — called by the modal's close / apply-edit / reset-new lifecycle. */
  const resetMigrate = useCallback(() => {
    setMigrateJobModalOpen(false)
    setMigrateTargetSearch('')
    setMigrateTargetCandidates([])
    setMigrateTargetJobId(null)
    setMigrateTargetPreview(null)
    setMigrateTargetPreviewLoading(false)
    setMigrateTargetSearchLoading(false)
    setMigratingJob(false)
  }, [])

  return {
    migrateJobModalOpen,
    setMigrateJobModalOpen,
    migrateTargetSearch,
    setMigrateTargetSearch,
    migrateTargetCandidates,
    setMigrateTargetCandidates,
    migrateTargetSearchLoading,
    migrateTargetJobId,
    setMigrateTargetJobId,
    migrateTargetPreviewLoading,
    migrateTargetPreview,
    migratingJob,
    setMigratingJob,
    resetMigrate,
  }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  fetchJobMaterialsCostSnapshot,
  mercuryCardTotalFromLines,
  tallyPartsTotalFromLines,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import { loadTeamLaborData } from '../../utils/teamLabor'

type MigrateCandidate = { id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string; service_type_id?: string | null; service_type_name?: string | null }
type MigratePreview = { supply: number; tally: number; mercury: number; teamCost: number; teamHours: number }

/** Bid rows from `search_bids_for_clock` — the same picker Clock-in uses. */
export type MigrateBidCandidate = {
  id: string
  bid_number: string
  project_name: string
  address: string
  customer_name: string
  service_type_id?: string | null
  service_type_name?: string | null
}

/**
 * What `migrate_job_ledger_costs_to_bid_and_delete(..., p_dry_run => true)`
 * returns: it performs the whole migration, reports it, then rolls back via a
 * sentinel exception. Previewing through the real code path is the point —
 * a hand-written estimate would drift from what the RPC actually does.
 */
export type MigrateBidDryRun = {
  ok: boolean
  dry_run?: boolean
  moved?: Record<string, number>
  dropped?: Record<string, number>
  revenue_dropped?: number | string
  error?: string
  code?: string
}

/** Target side of the migrate modal: another job, or a bid (v2.1166). */
export type MigrateTargetKind = 'job' | 'bid'

/** Prefills for creating a target bid inline from the picker (all from the source job). */
export type CreateMigrateBidInput = {
  projectName: string
  serviceTypeId: string
  customerId: string | null
  address: string | null
}

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
  const [migrateTargetKind, setMigrateTargetKind] = useState<MigrateTargetKind>('job')
  const [migrateBidSearch, setMigrateBidSearch] = useState('')
  const [migrateBidCandidates, setMigrateBidCandidates] = useState<MigrateBidCandidate[]>([])
  const [migrateBidSearchLoading, setMigrateBidSearchLoading] = useState(false)
  const [migrateTargetBidId, setMigrateTargetBidId] = useState<string | null>(null)
  const [migrateBidDryRun, setMigrateBidDryRun] = useState<MigrateBidDryRun | null>(null)
  const [migrateBidDryRunLoading, setMigrateBidDryRunLoading] = useState(false)
  const [migrateTargetSearch, setMigrateTargetSearch] = useState('')
  const [migrateTargetCandidates, setMigrateTargetCandidates] = useState<MigrateCandidate[]>([])
  const [migrateTargetSearchLoading, setMigrateTargetSearchLoading] = useState(false)
  const [migrateTargetJobId, setMigrateTargetJobId] = useState<string | null>(null)
  const [migrateTargetPreviewLoading, setMigrateTargetPreviewLoading] = useState(false)
  const [migrateTargetPreview, setMigrateTargetPreview] = useState<MigratePreview | null>(null)
  const [migratingJob, setMigratingJob] = useState(false)
  const [creatingMigrateBid, setCreatingMigrateBid] = useState(false)
  const [createMigrateBidError, setCreateMigrateBidError] = useState<string | null>(null)

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

  // Debounced BID search — same RPC the Clock-in bid picker uses.
  useEffect(() => {
    if (!migrateJobModalOpen || migrateTargetKind !== 'bid') {
      setMigrateBidCandidates([])
      setMigrateBidSearchLoading(false)
      return
    }
    const q = migrateBidSearch.trim()
    if (q.length < 2) {
      setMigrateBidCandidates([])
      setMigrateBidSearchLoading(false)
      return
    }
    setMigrateBidSearchLoading(true)
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await withSupabaseRetry(
            async () => supabase.rpc('search_bids_for_clock', { p_search_text: q }),
            'migrate bid target search',
          )
          if (cancelled) return
          setMigrateBidCandidates(((raw ?? []) as MigrateBidCandidate[]).slice(0, 30))
        } catch {
          if (!cancelled) setMigrateBidCandidates([])
        } finally {
          if (!cancelled) setMigrateBidSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [migrateJobModalOpen, migrateTargetKind, migrateBidSearch])

  // Dry run for the selected bid. Runs the real migration server-side and rolls
  // it back, so the counts shown are exactly what a confirm would do — including
  // what gets DESTROYED, which the user must see before an irreversible action.
  useEffect(() => {
    const bidId = migrateTargetBidId
    if (!bidId || !sourceJobId || migrateTargetKind !== 'bid') {
      setMigrateBidDryRun(null)
      setMigrateBidDryRunLoading(false)
      return
    }
    let cancelled = false
    setMigrateBidDryRunLoading(true)
    setMigrateBidDryRun(null)
    void (async () => {
      try {
        const raw = await withSupabaseRetry(
          async () =>
            supabase.rpc('migrate_job_ledger_costs_to_bid_and_delete', {
              p_from: sourceJobId,
              p_to_bid: bidId,
              p_allow_billed: true,
              p_dry_run: true,
            }),
          'migrate to bid dry run',
        )
        if (cancelled) return
        setMigrateBidDryRun((raw ?? null) as MigrateBidDryRun | null)
      } catch {
        if (!cancelled) setMigrateBidDryRun(null)
      } finally {
        if (!cancelled) setMigrateBidDryRunLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [migrateTargetBidId, sourceJobId, migrateTargetKind])

  // Create a target bid inline from the picker when the search finds nothing
  // usable. Prefilled from the source job; `set_bid_number_if_empty` assigns
  // the bid number server-side (same minimal insert as the Prospects convert
  // flow). The new bid is prepended to the candidate list and selected, so the
  // dry-run preview fires immediately.
  const createMigrateTargetBid = useCallback(async (input: CreateMigrateBidInput) => {
    setCreatingMigrateBid(true)
    setCreateMigrateBidError(null)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const createdBy = userData?.user?.id
      if (!createdBy) throw new Error('Not signed in')
      const raw = await withSupabaseRetry(
        async () =>
          supabase
            .from('bids')
            .insert({
              project_name: input.projectName,
              service_type_id: input.serviceTypeId,
              customer_id: input.customerId,
              address: input.address,
              created_by: createdBy,
              materials_model: 'rough',
            })
            .select('id, bid_number, project_name, address, customers(name)')
            .single(),
        'create migrate target bid',
      )
      if (!raw) throw new Error('Bid was not returned after create')
      const row = raw as unknown as {
        id: string
        bid_number: string | null
        project_name: string | null
        address: string | null
        customers: { name: string | null } | { name: string | null }[] | null
      }
      // PostgREST returns embedded to-one as an object or a 1-element array.
      const cust = Array.isArray(row.customers) ? row.customers[0] ?? null : row.customers
      const candidate: MigrateBidCandidate = {
        id: row.id,
        bid_number: row.bid_number ?? '',
        project_name: row.project_name ?? '',
        address: row.address ?? '',
        customer_name: cust?.name ?? '',
      }
      setMigrateBidCandidates((prev) => [candidate, ...prev.filter((c) => c.id !== candidate.id)])
      setMigrateTargetBidId(candidate.id)
      return true
    } catch (err) {
      setCreateMigrateBidError(err instanceof Error ? err.message : 'Failed to create the bid')
      return false
    } finally {
      setCreatingMigrateBid(false)
    }
  }, [])

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
    setMigrateTargetKind('job')
    setMigrateBidSearch('')
    setMigrateBidCandidates([])
    setMigrateBidSearchLoading(false)
    setMigrateTargetBidId(null)
    setMigrateBidDryRun(null)
    setMigrateBidDryRunLoading(false)
    setCreatingMigrateBid(false)
    setCreateMigrateBidError(null)
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
    migrateTargetKind,
    setMigrateTargetKind,
    migrateBidSearch,
    setMigrateBidSearch,
    migrateBidCandidates,
    migrateBidSearchLoading,
    migrateTargetBidId,
    setMigrateTargetBidId,
    migrateBidDryRun,
    migrateBidDryRunLoading,
    createMigrateTargetBid,
    creatingMigrateBid,
    createMigrateBidError,
  }
}

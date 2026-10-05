import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  buildJobContractCoverage,
  JOB_CONTRACT_COVERAGE_COLUMNS,
  type JobContractCoverage,
  type JobContractRowLike,
  type JobForCoverage,
  type SignedEstimateLike,
} from '../lib/jobs/jobContractCoverage'

/**
 * The row-flag lookups behind Stages' job rows (moved out of JobsStagesTab,
 * punch list #46 row 2, the Stages map's step 3): which jobs have a sent
 * demand letter, what contract covers each job, and which have a live hazmat
 * fee or lien release. Three hooks, not one, so the tab calls each where its
 * loader stood and its effects keep their order around the contract nudge
 * and crew-position hooks. All fail-soft — a glanceable extra never blocks
 * the page: a failed read leaves the rows plain.
 */

function jobIdSet(data: unknown): ReadonlySet<string> {
  return new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id))
}

/** Jobs with a live SENT demand letter — the lien icon wears an amber box. */
export function useDemandOutJobIds(): { demandOutJobIds: ReadonlySet<string>; loadDemandOutJobIds: () => Promise<void> } {
  const [demandOutJobIds, setDemandOutJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const loadDemandOutJobIds = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('job_demand_letters')
        .select('job_id')
        .is('voided_at', null)
        .not('sent_at', 'is', null)
      setDemandOutJobIds(jobIdSet(data))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [])
  useEffect(() => {
    void loadDemandOutJobIds()
  }, [loadDemandOutJobIds])
  return { demandOutJobIds, loadDemandOutJobIds }
}

/**
 * Contract coverage (Contract Desk PR 1): one job_contracts scan + one
 * customer-accepted estimates scan, folded per job by the coverage kernel.
 * Office-only read-back; a fetch failure leaves rows chipless. Re-reads on
 * the `job-contract-changed` window event.
 */
export function useJobContractCoverage(
  jobs: ReadonlyArray<JobForCoverage>,
  canSeeJobContracts: boolean,
): { jobContractCoverageByJobId: Map<string, JobContractCoverage>; loadJobContractCoverage: () => Promise<void> } {
  const [jobContractRows, setJobContractRows] = useState<JobContractRowLike[]>([])
  const [signedEstimateRows, setSignedEstimateRows] = useState<SignedEstimateLike[]>([])
  const loadJobContractCoverage = useCallback(async () => {
    if (!canSeeJobContracts) return
    try {
      const [contractsRes, estimatesRes] = await Promise.all([
        supabase
          .from('job_contracts')
          .select(JOB_CONTRACT_COVERAGE_COLUMNS)
          .is('voided_at', null),
        supabase
          .from('estimates')
          .select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents')
          .eq('status', 'customer_accepted')
          .not('acceptor_consented_at', 'is', null),
      ])
      if (!contractsRes.error) setJobContractRows((contractsRes.data ?? []) as JobContractRowLike[])
      if (!estimatesRes.error) setSignedEstimateRows((estimatesRes.data ?? []) as SignedEstimateLike[])
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canSeeJobContracts])
  useEffect(() => {
    void loadJobContractCoverage()
  }, [loadJobContractCoverage])
  useEffect(() => {
    const onChanged = () => void loadJobContractCoverage()
    window.addEventListener('job-contract-changed', onChanged)
    return () => window.removeEventListener('job-contract-changed', onChanged)
  }, [loadJobContractCoverage])
  const jobContractCoverageByJobId = useMemo(
    () => buildJobContractCoverage(jobs, jobContractRows, signedEstimateRows),
    [jobs, jobContractRows, signedEstimateRows],
  )
  return { jobContractCoverageByJobId, loadJobContractCoverage }
}

/**
 * Jobs with a live (non-voided) hazmat fee — the ☣ button wears a bright
 * green box on those rows (v2.1040) — and jobs with a live lien release —
 * their release button wears a blue box (v2.2582). One tiny table-wide query
 * each (both are rare); gated on the office set that may create them.
 */
export function useHazmatAndReleaseJobIds(canCreateHazmatFee: boolean): {
  hazmatFeeJobIds: ReadonlySet<string>
  loadHazmatFeeJobIds: () => Promise<void>
  lienReleaseJobIds: ReadonlySet<string>
  loadLienReleaseJobIds: () => Promise<void>
} {
  const [hazmatFeeJobIds, setHazmatFeeJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const loadHazmatFeeJobIds = useCallback(async () => {
    if (!canCreateHazmatFee) return
    try {
      const { data } = await supabase.from('job_hazmat_incidents').select('job_id').is('voided_at', null)
      setHazmatFeeJobIds(jobIdSet(data))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canCreateHazmatFee])
  useEffect(() => {
    void loadHazmatFeeJobIds()
  }, [loadHazmatFeeJobIds])
  const [lienReleaseJobIds, setLienReleaseJobIds] = useState<ReadonlySet<string>>(() => new Set())
  const loadLienReleaseJobIds = useCallback(async () => {
    if (!canCreateHazmatFee) return
    try {
      // Issued means issued: a draft still being written does not box the icon (its tooltip says "issued").
      const { data } = await supabase.from('job_lien_releases').select('job_id, status').is('voided_at', null)
      setLienReleaseJobIds(jobIdSet((data ?? []).filter((r) => (r.status ?? '').trim() !== 'draft')))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canCreateHazmatFee])
  useEffect(() => {
    void loadLienReleaseJobIds()
  }, [loadLienReleaseJobIds])
  return { hazmatFeeJobIds, loadHazmatFeeJobIds, lienReleaseJobIds, loadLienReleaseJobIds }
}

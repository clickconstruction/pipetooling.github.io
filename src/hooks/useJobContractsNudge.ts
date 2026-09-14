/**
 * Jobs without a contract + sent contracts gone quiet (Contract Desk PR 4) —
 * the Needs You watch. Three small scans (live jobs, live contracts,
 * e-signed estimates) plus the floor setting, folded by the nudge kernel;
 * null while loading, zero on error so the card stays quiet. Refreshes on
 * `job-contract-changed` (a send, a filing, a Not needed answer, a new floor).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { JobContractRowLike, SignedEstimateLike } from '../lib/jobs/jobContractCoverage'
import { fetchJobContractFloorCents } from '../lib/jobs/jobContractFloor'
import { CONTRACT_NUDGE_STATUSES, summarizeContractNudge, type ContractNudgeJob, type ContractNudgeSummary } from '../lib/jobs/jobContractNudge'

export type ContractNudge = Pick<ContractNudgeSummary, 'missing' | 'stale' | 'byStage' | 'liveTotal' | 'underFloor' | 'notNeeded' | 'floorCents'>

export function useJobContractsNudge(enabled: boolean): { nudge: ContractNudge | null } {
  const [nudge, setNudge] = useState<ContractNudge | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setNudge(null)
      return
    }
    try {
      const [jobsRes, contractsRes, estimatesRes, floorCents] = await Promise.all([
        supabase
          .from('jobs_ledger')
          .select('id, bid_id, status, revenue, collections_at, contract_not_needed_at, contract_not_needed_reason')
          .in('status', [...CONTRACT_NUDGE_STATUSES]),
        supabase
          .from('job_contracts')
          .select('id, job_id, status, revision, recipient_email, sent_at, last_sent_at, view_count, signed_at, signer_printed_name, signer_mode, voided_at, signed_document_url')
          .is('voided_at', null),
        supabase
          .from('estimates')
          .select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents')
          .eq('status', 'customer_accepted')
          .not('acceptor_consented_at', 'is', null),
        fetchJobContractFloorCents(),
      ])
      if (jobsRes.error) throw jobsRes.error
      const summary = summarizeContractNudge(
        (jobsRes.data ?? []) as ContractNudgeJob[],
        (contractsRes.error ? [] : (contractsRes.data ?? [])) as JobContractRowLike[],
        (estimatesRes.error ? [] : (estimatesRes.data ?? [])) as SignedEstimateLike[],
        new Date(),
        { floorCents },
      )
      setNudge({
        missing: summary.missing,
        stale: summary.stale,
        byStage: summary.byStage,
        liveTotal: summary.liveTotal,
        underFloor: summary.underFloor,
        notNeeded: summary.notNeeded,
        floorCents: summary.floorCents,
      })
    } catch {
      setNudge(null)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onChanged = () => void load()
    window.addEventListener('job-contract-changed', onChanged)
    return () => window.removeEventListener('job-contract-changed', onChanged)
  }, [load])

  return { nudge }
}

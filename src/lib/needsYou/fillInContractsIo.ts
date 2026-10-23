import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { CONTRACT_NUDGE_STATUSES } from '../jobs/jobContractNudge'
import { fetchJobContractFloorCents } from '../jobs/jobContractFloor'
import type { SignedEstimateLike } from '../jobs/jobContractCoverage'
import { freshJobContractLink } from '../jobs/jobContractLinkHandOut'
import { fileSignedJobContract } from '../jobs/jobContractFileWrite'
import type { JobContractRow } from '../jobs/jobContractLifecycle'
import { smsHref } from '../gc/followUpSheet'
import type { ContractJobSource, ContractRowSource, ContractWrites } from './fillInContracts'

/**
 * The contract kind's reads and writes (v2.5777, punch list #145): the three reads the Needs
 * you line's own hook makes (live jobs, live contracts, e-signed estimates) and the floor; the
 * writes are the Contract window's doors — `send-job-contract` in email mode for a resend, the
 * link the row carries (or a fresh one) handed to the phone's messages for a text, and
 * `fileSignedJobContract` for paper. Each tells the line to re-read (`job-contract-changed`).
 */
export type ContractSources = { jobs: ContractJobSource[]; contracts: ContractRowSource[]; estimates: SignedEstimateLike[]; floorCents: number }

export type ContractFillInIo = {
  fetchSources: () => Promise<ContractSources>
  resend: (w: Extract<ContractWrites, { choice: 'resend' }>, origin: string) => Promise<void>
  /** Hands the link to the phone's messages; returns false when no link could be had. */
  text: (w: Extract<ContractWrites, { choice: 'text' }>, origin: string) => Promise<boolean>
  filePaper: (w: Extract<ContractWrites, { choice: 'paper' }>, existing: ContractRowSource, authUserId: string | null) => Promise<{ uploadError: string | null }>
}

const changed = () => window.dispatchEvent(new Event('job-contract-changed'))

export const contractFillInIo: ContractFillInIo = {
  async fetchSources() {
    const [jobs, contracts, estimates, floorCents] = await Promise.all([
      withSupabaseRetry(
        async () =>
          supabase
            .from('jobs_ledger')
            .select('id, bid_id, status, revenue, collections_at, uncollectible_at, contract_not_needed_at, contract_not_needed_reason, hcp_number, click_number, job_name, customer_name, job_address')
            .in('status', [...CONTRACT_NUDGE_STATUSES]),
        'fill in: live jobs',
      ),
      withSupabaseRetry(async () => supabase.from('job_contracts').select('*').is('voided_at', null), 'fill in: live contracts'),
      withSupabaseRetry(
        async () =>
          supabase
            .from('estimates')
            .select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents')
            .eq('status', 'customer_accepted')
            .not('acceptor_consented_at', 'is', null),
        'fill in: signed estimates',
      ),
      fetchJobContractFloorCents(),
    ])
    return { jobs: (jobs ?? []) as ContractJobSource[], contracts: (contracts ?? []) as ContractRowSource[], estimates: (estimates ?? []) as SignedEstimateLike[], floorCents }
  },
  async resend(w, origin) {
    const { data, error } = await supabase.functions.invoke('send-job-contract', {
      body: { contract_id: w.contractId, mode: 'email', recipient_email: w.recipientEmail, recipient_name: w.recipientName, cc_emails: [], public_origin: origin, message: w.message || undefined },
    })
    const res = (data ?? {}) as { ok?: boolean; emailed?: boolean; error?: string; email_error?: string }
    if (error || !res.ok) throw new Error(res.error || error?.message || 'Could not send the contract.')
    if (!res.emailed) throw new Error(`The link is ready, but the email did not send${res.email_error ? ` (${res.email_error})` : ''}. Open the contract and copy the link instead.`)
    changed()
  },
  async text(w, origin) {
    // The link the row carries, as the window's Text the link hands it out; a send mints or renews it otherwise.
    let url = await freshJobContractLink(w.contractId, origin)
    if (!url) {
      const { data, error } = await supabase.functions.invoke('send-job-contract', { body: { contract_id: w.contractId, mode: 'link', public_origin: origin } })
      const res = (data ?? {}) as { ok?: boolean; sign_url?: string; error?: string }
      if (error || !res.ok || !res.sign_url) throw new Error(res.error || error?.message || 'Could not get the signing link.')
      url = res.sign_url
      changed()
    }
    window.location.href = smsHref(w.phone, w.body(url))
    return true
  },
  async filePaper(w, existing, authUserId) {
    const { uploadError } = await fileSignedJobContract({
      jobId: w.jobId,
      existingDraft: existing as unknown as JobContractRow,
      basePayload: null,
      signerName: w.signerName,
      signedOn: w.signedOn,
      link: w.link,
      file: w.file,
      authUserId,
    })
    changed()
    return { uploadError }
  },
}

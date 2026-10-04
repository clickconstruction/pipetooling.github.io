import { supabase } from './supabase'
import { effectiveInvoiceParty, payerCustomerId } from './jobs/billToParty'
import { type AiaPrefillFacts, aiaContractSignedOn } from './aiaG702G703Template'

/**
 * What the AIA window reads beside the job row before it prefills: the party the bills go to
 * (name and mailing address from its customers row) and the day the job's contract was signed.
 * Three small reads; any that fails leaves its facts empty, and the form opens all the same.
 */
export async function loadAiaPrefillFacts(jobId: string): Promise<AiaPrefillFacts> {
  const facts: AiaPrefillFacts = { ownerName: '', ownerAddress: '', contractSignedOn: '' }

  const [jobRes, contractsRes] = await Promise.all([
    supabase.from('jobs_ledger').select('id, customer_id, gc_customer_id, bill_to_party').eq('id', jobId).maybeSingle(),
    supabase.from('job_contracts').select('status, voided_at, signed_at, paper_signed_on').eq('job_id', jobId).limit(200),
  ])

  if (!contractsRes.error) facts.contractSignedOn = aiaContractSignedOn(contractsRes.data ?? [])

  const job = jobRes.error ? null : jobRes.data
  if (job) {
    const party = effectiveInvoiceParty(job, null)
    // `other` cannot happen with no invoice; a job with neither party has no payer row.
    const payerId = payerCustomerId(job, party) ?? job.gc_customer_id ?? job.customer_id
    if (payerId) {
      const { data, error } = await supabase.from('customers').select('name, address').eq('id', payerId).maybeSingle()
      if (!error && data) {
        facts.ownerName = (data.name ?? '').trim()
        facts.ownerAddress = (data.address ?? '').trim()
      }
    }
  }
  return facts
}

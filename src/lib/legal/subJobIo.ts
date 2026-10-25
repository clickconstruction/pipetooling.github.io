import { supabase } from '../supabase'

/**
 * The two doors on the desk's *Probably a subcontract* note (punch list #166, v2.5840).
 *
 * Set the GC writes the customer's id into the GC slot and nothing else: the database's
 * `jobs_ledger_customer_gc_distinct` trigger (v2.3404) then clears the customer link and its
 * copies and sets `bill_to_party = 'gc'`, exactly as the job form's GC picker does when it moves
 * the customer. Ours with the owner stamps `owner_contract_confirmed_at / _by`
 * (migration 20261025130000), which silences the note on that job.
 */
export async function setJobGcFromCustomer(jobId: string, customerId: string): Promise<void> {
  const { error } = await supabase.from('jobs_ledger').update({ gc_customer_id: customerId }).eq('id', jobId)
  if (error) throw error
}

export async function confirmJobOwnerContract(jobId: string): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id ?? null
  const { error } = await supabase.from('jobs_ledger').update({ owner_contract_confirmed_at: new Date().toISOString(), owner_contract_confirmed_by: userId } as Record<string, unknown>).eq('id', jobId)
  if (error) throw error
}

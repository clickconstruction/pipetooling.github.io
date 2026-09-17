/**
 * "Sent — log it" (v2.3451), shared: after the estimator emails a house's
 * job-accounts rep from their own inbox, the job reads `requested` at that
 * house (an existing row is never overwritten) and the send log carries the
 * bid. The rep email sheet logs one job; the Job accounts lens logs one per
 * ticked property. Throws on the first failed write.
 */
import { supabase } from '../supabase'

export interface JobAccountAskRep {
  name: string | null
  label?: string | null
  email: string
}

export async function logJobAccountAskByEmail(args: {
  jobId: string
  houseId: string
  bidId: string | null
  rep: JobAccountAskRep
  userId: string
  senderName: string
}): Promise<void> {
  const repName = args.rep.name ?? args.rep.label ?? args.rep.email
  const { error: accErr } = await supabase.from('job_supply_house_accounts').upsert(
    [{ job_id: args.jobId, supply_house_id: args.houseId, status: 'requested', requested_by: args.userId, requested_from_counter: false, note: `Asked ${repName} by email` }],
    { onConflict: 'job_id,supply_house_id', ignoreDuplicates: true },
  )
  if (accErr) throw accErr
  const { error: logErr } = await supabase.from('supply_house_job_accounts').insert({
    job_id: args.jobId,
    contact_label: repName,
    contact_email: args.rep.email,
    sent_by: args.userId,
    sent_by_name: args.senderName,
    send_method: 'user_email',
    supply_house_id: args.houseId,
    bid_id: args.bidId,
  })
  if (logErr) throw logErr
}

import { supabase } from '../supabase'
import { JOB_BUDGET_CHANGED_EVENT } from '../../hooks/useJobBudget'
import type { AwardBaselineRpcArgs } from './awardBaseline'
import { saveBidLaborRate } from './bidLaborRateIo'

/**
 * The award's one write, shared by New Job's Create Job, the Costs strip's late award and the Quickfill
 * deck's press (punch list #234, the second walk's slip 8). A bid whose rows carry hours but whose cost
 * estimate has no rate of its own is priced at the company rate, the one the Labor tab reads; the kernel
 * puts that rate on the bid pick's `p_labor_rate` (`award_job_baseline` ignores it for a bid), and this
 * reads it as the cue to save the rate on the bid before the snapshot, so the frozen award carries the
 * Labor tab's dollars. Throws the refusal; raises `job-budget-changed` on success.
 */
export async function awardJobBaseline(args: AwardBaselineRpcArgs): Promise<void> {
  if (args.p_source === 'bid' && args.p_bid_id && args.p_labor_rate != null && args.p_labor_rate > 0) await saveBidLaborRate(args.p_bid_id, args.p_labor_rate)
  const { error } = await supabase.rpc('award_job_baseline' as never, args as never)
  if (error) throw error
  window.dispatchEvent(new Event(JOB_BUDGET_CHANGED_EVENT))
}

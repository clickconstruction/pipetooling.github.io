import { supabase } from '../supabase'

/**
 * The company rate saved on a bid whose cost estimate has none of its own (punch list #234, the second
 * walk's slip 8): the same `cost_estimates.labor_rate` the Labor tab's *save it on the bid* writes, so
 * `bid_estimate_breakdown` reads *rate set* and the baseline snapshot carries the Labor tab's dollars and
 * not zero. A bid that already has a rate is never touched. Throws the refusal.
 */
export async function saveBidLaborRate(bidId: string, rateUsd: number): Promise<void> {
  if (!(rateUsd > 0)) return
  const { error } = await supabase.from('cost_estimates').update({ labor_rate: rateUsd }).eq('bid_id', bidId).or('labor_rate.is.null,labor_rate.eq.0')
  if (error) throw error
}

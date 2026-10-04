import { supabase } from './supabase'
import { type BidSchedule, linesFromBidSovLines, linesFromStageSplits } from './aiaBidSchedule'
import { scheduleOfValuesLetter } from './bidDocuments/scheduleOfValues'
import { splitStageValues } from './bidDocuments/sovLaborMaterial'
import { loadMaterialsByStageForBid } from './bids/materialsByStageIo'
import { pickActiveVersion } from './bids/pickActiveVersion'
import { loadSovLaborShareDefault, loadSovLines, loadSovSplitInputsForBid } from './bids/sovLaborMaterialIo'

/**
 * The bid's schedule of values for a job's first pay application (v2.4502), read through the
 * doors the Cover Letter tab and the Approval PDF use so the lines are the ones the GC saw.
 * `contractAmount` is the job's price: a bid left on the three stages spreads it by each stage's
 * share. Anything that fails, or a bid with fewer than two stages staged, is null: the job keeps one line.
 */
export async function loadBidScheduleForJob(bidId: string, contractAmount: number): Promise<BidSchedule | null> {
  try {
    const [bidRes, versionsRes] = await Promise.all([
      supabase.from('bids').select('id, sov_shape, sov_split_labor_material, sov_material_factor, selected_bid_version_id').eq('id', bidId).maybeSingle(),
      supabase.from('bid_versions').select('id, sort_order').eq('bid_id', bidId).limit(200),
    ])
    const bid = bidRes.error ? null : bidRes.data
    if (!bid) return null
    const splitLaborMaterial = bid.sov_split_labor_material === true

    if (bid.sov_shape === 'lines') {
      const [sovLines, ruleLaborPct] = await Promise.all([loadSovLines(supabase, bidId), loadSovLaborShareDefault(supabase)])
      const lines = linesFromBidSovLines(sovLines, ruleLaborPct)
      if (lines.length > 0) return { lines, splitLaborMaterial, shape: 'lines' }
    }

    const bidVersionId = pickActiveVersion({ savedVersionId: bid.selected_bid_version_id ?? null, bidVersions: versionsRes.error ? [] : (versionsRes.data ?? []) })
    const stageDoc = await loadMaterialsByStageForBid(supabase, { bidId, bidVersionId, bidFactorOverride: bid.sov_material_factor ?? null })
    const letter = scheduleOfValuesLetter(stageDoc.summary, contractAmount)
    if (!letter || letter.rows.length === 0) return null
    const inputs = await loadSovSplitInputsForBid(supabase, bidId)
    const splits = splitStageValues(letter, { costs: { labor: inputs.costs.labor, material: stageDoc.summary.scaled }, ruleLaborPct: inputs.ruleLaborPct, overrides: inputs.overrides })
    const lines = linesFromStageSplits(splits)
    return lines.length > 0 ? { lines, splitLaborMaterial, shape: 'stage' } : null
  } catch {
    return null
  }
}

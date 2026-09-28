/**
 * The reads behind the schedule of values' labor / material split (v2.4075): the
 * Labor tab's rows and rate, the subcontractor rows, the company labor share and
 * the bid's typed overrides — one door for the Cover Letter tab and the Approval PDF,
 * so both say the same thing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { APP_SETTINGS_KEY_BID_SOV_LABOR_SHARE_PCT_V1 } from '../appSettingsKeys'
import { laborRowRough, laborRowTop, laborRowTrim } from './laborRowHours'
import { STAGE_KEYS, type StageMoney } from './materialsByStage'
import type { TakeoffStage } from './bidTakeoffHelpers'
import { laborCostByStage, parseSovLaborSharePct, type SovStageOverride } from '../bidDocuments/sovLaborMaterial'
import type { SovLine } from '../bidDocuments/sovLines'

type Client = SupabaseClient<Database>

export type SovLaborCosts = {
  /** Labor dollars per stage: hours × rate + the subs' dollars. */
  labor: StageMoney
  hoursByStage: StageMoney
  laborRate: number
  subByStage: StageMoney
}

/** Labor dollars per stage for a bid: the cost estimate's rows × its rate, plus the subcontractor rows. All zero when the bid has no cost estimate. */
export async function loadSovLaborCostsForBid(supabase: Client, bidId: string): Promise<SovLaborCosts> {
  const zero = (): StageMoney => ({ rough_in: 0, top_out: 0, trim_set: 0 })
  const { data: est } = await supabase.from('cost_estimates').select('id, labor_rate').eq('bid_id', bidId).maybeSingle()
  if (!est) return { labor: zero(), hoursByStage: zero(), laborRate: 0, subByStage: zero() }
  const [rowsRes, subsRes] = await Promise.all([
    supabase.from('cost_estimate_labor_rows').select('count, is_fixed, kind, unit, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit').eq('cost_estimate_id', est.id),
    supabase.from('cost_estimate_subcontractor_rows').select('rough_in, top_out, trim_set').eq('cost_estimate_id', est.id),
  ])
  const hoursByStage = zero()
  for (const r of rowsRes.data ?? []) {
    hoursByStage.rough_in += laborRowRough(r)
    hoursByStage.top_out += laborRowTop(r)
    hoursByStage.trim_set += laborRowTrim(r)
  }
  const subByStage = zero()
  for (const s of subsRes.data ?? []) {
    subByStage.rough_in += Number(s.rough_in) || 0
    subByStage.top_out += Number(s.top_out) || 0
    subByStage.trim_set += Number(s.trim_set) || 0
  }
  const laborRate = Number(est.labor_rate) || 0
  return { labor: laborCostByStage({ hoursByStage, laborRate, subByStage }), hoursByStage, laborRate, subByStage }
}

/** The company labor share from app_settings (45 when unset). */
export async function loadSovLaborShareDefault(supabase: Client): Promise<number> {
  const { data } = await supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_BID_SOV_LABOR_SHARE_PCT_V1).maybeSingle()
  return parseSovLaborSharePct(data?.value_num ?? null)
}

export type SovStageOverrideRow = Database['public']['Tables']['bid_sov_stage_overrides']['Row']

/** The bid's typed labor figures and notes, keyed by stage. */
export async function loadSovStageOverrides(supabase: Client, bidId: string): Promise<Map<TakeoffStage, SovStageOverride>> {
  const { data } = await supabase.from('bid_sov_stage_overrides').select('stage, labor, note').eq('bid_id', bidId)
  const out = new Map<TakeoffStage, SovStageOverride>()
  for (const r of data ?? []) {
    if ((STAGE_KEYS as readonly string[]).includes(r.stage)) out.set(r.stage as TakeoffStage, { labor: r.labor == null ? null : Number(r.labor), note: r.note ?? '' })
  }
  return out
}

export type SovLineRow = Database['public']['Tables']['bid_sov_lines']['Row']

export function sovLineFromRow(r: Pick<SovLineRow, 'id' | 'sort_order' | 'label' | 'value' | 'labor' | 'note' | 'stage'>): SovLine {
  return {
    id: r.id,
    sortOrder: r.sort_order,
    label: r.label ?? '',
    value: Number(r.value) || 0,
    labor: r.labor == null ? null : Number(r.labor),
    note: r.note ?? '',
    stage: r.stage && (STAGE_KEYS as readonly string[]).includes(r.stage) ? (r.stage as TakeoffStage) : null,
  }
}

/** The bid's My lines rows, in order (v2.4070). */
export async function loadSovLines(supabase: Client, bidId: string): Promise<SovLine[]> {
  const { data } = await supabase.from('bid_sov_lines').select('id, sort_order, label, value, labor, note, stage').eq('bid_id', bidId).order('sort_order').order('created_at')
  return (data ?? []).map(sovLineFromRow)
}

/** Everything the split needs for one bid, in one call. */
export async function loadSovSplitInputsForBid(supabase: Client, bidId: string): Promise<{ costs: SovLaborCosts; ruleLaborPct: number; overrides: Map<TakeoffStage, SovStageOverride> }> {
  const [costs, ruleLaborPct, overrides] = await Promise.all([loadSovLaborCostsForBid(supabase, bidId), loadSovLaborShareDefault(supabase), loadSovStageOverrides(supabase, bidId)])
  return { costs, ruleLaborPct, overrides }
}

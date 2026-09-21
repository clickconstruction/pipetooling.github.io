/**
 * Materials by stage — the reads and writes around the pure kernel
 * (`materialsByStage.ts`). Splits live in `bid_takeoff_stage_splits`; the
 * company factor in `app_settings` (`bid_sov_material_factor_v1`) with a
 * per-bid override on `bids.sov_material_factor`.
 *
 * `loadMaterialsByStageForBid` is the one door the paper uses (the printed
 * schedule, the cover letter, the Approval PDF): it gathers the count rows,
 * the part lines, the splits, the bundle parts and the factor, and runs the
 * kernel — so every document says what the Takeoffs rail says.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { APP_SETTINGS_KEY_BID_SOV_MATERIAL_FACTOR_V1 } from '../appSettingsKeys'
import { loadBundlePartLines, type BundlePartLine } from './assemblyBundleBreakdown'
import {
  computeMaterialsByStage,
  normalizeWeights,
  parseSovMaterialFactor,
  type BundlePartInput,
  type MaterialsByStageSummary,
  type StageSplitRecord,
  type StageSplitSource,
  type StageWeights,
} from './materialsByStage'
import { summarizeTakeoffCoverage } from './takeoffCoverage'

type Client = SupabaseClient<Database>
type SplitRow = Database['public']['Tables']['bid_takeoff_stage_splits']['Row']

export type StageSplitRowRecord = StageSplitRecord & { id: string; bidId: string }

const SOURCES: ReadonlySet<string> = new Set(['hand', 'rule', 'book', 'assembly'])

export function stageSplitRecordFromRow(r: Pick<SplitRow, 'id' | 'bid_id' | 'count_row_id' | 'line_id' | 'part_id' | 'rough_in' | 'top_out' | 'trim_set' | 'source'>): StageSplitRowRecord {
  return {
    id: r.id,
    bidId: r.bid_id,
    countRowId: r.count_row_id,
    lineId: r.line_id,
    partId: r.part_id,
    weights: { rough_in: Number(r.rough_in), top_out: Number(r.top_out), trim_set: Number(r.trim_set) },
    source: (SOURCES.has(r.source) ? r.source : 'hand') as StageSplitSource,
  }
}

/** PostgREST's "no such table" (PGRST205) or Postgres's 42P01 — the client shipped before the migration was pushed. */
function tableMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === 'PGRST205' || error.code === '42P01' || /bid_takeoff_stage_splits/.test(error.message ?? '') && /not (find|exist)/i.test(error.message ?? ''))
}

/** Every split on the bid (all versions — the caller filters by its count rows). A missing table reads as no splits. */
export async function loadStageSplitsForBid(supabase: Client, bidId: string): Promise<StageSplitRowRecord[]> {
  const { data, error } = await supabase
    .from('bid_takeoff_stage_splits')
    .select('id, bid_id, count_row_id, line_id, part_id, rough_in, top_out, trim_set, source')
    .eq('bid_id', bidId)
  if (error) {
    if (tableMissing(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map(stageSplitRecordFromRow)
}

export type StageSplitScopeKey = { countRowId: string; lineId?: string | null; partId?: string | null }

/**
 * Write one scope's split: null deletes (fall back to the scope above), else
 * insert or update. The unique index coalesces NULLs, so PostgREST's upsert
 * cannot name it — a select decides insert vs update instead.
 */
export async function saveStageSplit(
  supabase: Client,
  args: { bidId: string; scope: StageSplitScopeKey; weights: StageWeights | null; source: StageSplitSource },
): Promise<StageSplitRowRecord | null> {
  const lineId = args.scope.lineId ?? null
  const partId = args.scope.partId ?? null
  let q = supabase.from('bid_takeoff_stage_splits').select('id').eq('count_row_id', args.scope.countRowId)
  q = lineId ? q.eq('line_id', lineId) : q.is('line_id', null)
  q = partId ? q.eq('part_id', partId) : q.is('part_id', null)
  const { data: existing, error: selErr } = await q.maybeSingle()
  if (selErr) throw new Error(selErr.message)
  const normalized = normalizeWeights(args.weights)
  if (!normalized) {
    if (existing?.id) {
      const { error } = await supabase.from('bid_takeoff_stage_splits').delete().eq('id', existing.id)
      if (error) throw new Error(error.message)
    }
    return null
  }
  const w = args.weights as StageWeights
  const values = { rough_in: Number(w.rough_in) || 0, top_out: Number(w.top_out) || 0, trim_set: Number(w.trim_set) || 0, source: args.source }
  if (existing?.id) {
    const { data, error } = await supabase.from('bid_takeoff_stage_splits').update(values).eq('id', existing.id).select('id, bid_id, count_row_id, line_id, part_id, rough_in, top_out, trim_set, source').single()
    if (error) throw new Error(error.message)
    return stageSplitRecordFromRow(data)
  }
  const { data, error } = await supabase
    .from('bid_takeoff_stage_splits')
    .insert({ bid_id: args.bidId, count_row_id: args.scope.countRowId, line_id: lineId, part_id: partId, ...values })
    .select('id, bid_id, count_row_id, line_id, part_id, rough_in, top_out, trim_set, source')
    .single()
  if (error) throw new Error(error.message)
  return stageSplitRecordFromRow(data)
}

/** Fixture-scope splits in one round trip (the rule pass). Rows with a hand split are the caller's to skip. */
export async function saveFixtureSplitsBatch(
  supabase: Client,
  bidId: string,
  rows: ReadonlyArray<{ countRowId: string; weights: StageWeights; source: StageSplitSource }>,
): Promise<number> {
  let n = 0
  for (const r of rows) {
    await saveStageSplit(supabase, { bidId, scope: { countRowId: r.countRowId }, weights: r.weights, source: r.source })
    n += 1
  }
  return n
}

/** The company factor from app_settings (1.5 when unset). */
export async function loadSovMaterialFactorDefault(supabase: Client): Promise<number> {
  const { data } = await supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_BID_SOV_MATERIAL_FACTOR_V1).maybeSingle()
  return parseSovMaterialFactor(data?.value_num ?? null)
}

/** The factor a bid uses: its override, else the company default. */
export function effectiveSovFactor(bidOverride: number | string | null | undefined, companyDefault: number): number {
  return parseSovMaterialFactor(bidOverride, companyDefault)
}

export function bundlePartInputs(lines: ReadonlyArray<BundlePartLine>): BundlePartInput[] {
  return lines.map((l) => ({ partId: l.partId, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, hasPrice: l.hasPrice }))
}

/**
 * Bundle parts for every bundle line that has a part-level split — the only
 * bundles whose parts change the arithmetic. Cached by template id.
 */
export async function loadBundlePartsForSplits(
  supabase: Client,
  lines: ReadonlyArray<{ id: string; partId: string | null; sourceTemplateId: string | null }>,
  splits: ReadonlyArray<StageSplitRecord>,
  cache: Map<string, BundlePartInput[]> = new Map(),
): Promise<Map<string, BundlePartInput[]>> {
  const linesWithPartSplits = new Set(splits.filter((s) => s.lineId && s.partId).map((s) => s.lineId as string))
  const templateIds = new Set(
    lines.filter((l) => l.partId == null && l.sourceTemplateId && linesWithPartSplits.has(l.id)).map((l) => l.sourceTemplateId as string),
  )
  for (const templateId of templateIds) {
    if (cache.has(templateId)) continue
    cache.set(templateId, bundlePartInputs(await loadBundlePartLines(supabase, templateId)))
  }
  return cache
}

export type MaterialsByStageDocument = {
  summary: MaterialsByStageSummary
  factor: number
  factorIsBidOverride: boolean
  countRows: Array<{ id: string; fixture: string | null; count: number }>
}

/**
 * Everything the paper needs for one bid (and one version, or the unsplit base
 * when `bidVersionId` is null), computed the way the Takeoffs rail computes it.
 */
export async function loadMaterialsByStageForBid(
  supabase: Client,
  args: { bidId: string; bidVersionId: string | null; bidFactorOverride?: number | string | null },
): Promise<MaterialsByStageDocument> {
  const rowsQ = supabase.from('bids_count_rows').select('id, fixture, count, sequence_order').eq('bid_id', args.bidId).order('sequence_order')
  const linesQ = supabase
    .from('bids_takeoff_rough_part_lines')
    .select('id, count_row_id, part_id, source_template_id, quantity, unit_price, source_material_part_price_id, order_increment, order_increment_unit')
    .eq('bid_id', args.bidId)
  const [rowsRes, linesRes, splits, companyFactor] = await Promise.all([
    args.bidVersionId == null ? rowsQ.is('bid_version_id', null) : rowsQ.eq('bid_version_id', args.bidVersionId),
    args.bidVersionId == null ? linesQ.is('bid_version_id', null) : linesQ.eq('bid_version_id', args.bidVersionId),
    loadStageSplitsForBid(supabase, args.bidId),
    loadSovMaterialFactorDefault(supabase),
  ])
  const countRows = ((rowsRes.data ?? []) as Array<{ id: string; fixture: string | null; count: number }>).map((r) => ({ id: r.id, fixture: r.fixture, count: Number(r.count) }))
  const rowIds = new Set(countRows.map((r) => r.id))
  const lines = ((linesRes.data ?? []) as Array<{
    id: string
    count_row_id: string
    part_id: string | null
    source_template_id: string | null
    quantity: number
    unit_price: number
    source_material_part_price_id: string | null
    order_increment: number | null
    order_increment_unit: string | null
  }>)
    .filter((l) => rowIds.has(l.count_row_id))
    .map((l) => ({
      id: l.id,
      countRowId: l.count_row_id,
      partId: l.part_id,
      sourceTemplateId: l.source_template_id,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      sourceMaterialPartPriceId: l.source_material_part_price_id,
      orderIncrement: l.order_increment,
      orderIncrementUnit: l.order_increment_unit,
    }))
  const versionSplits = splits.filter((s) => rowIds.has(s.countRowId))
  const bundleParts = await loadBundlePartsForSplits(supabase, lines, versionSplits)
  const coverage = summarizeTakeoffCoverage(countRows, lines)
  const roundingExtraByCountRow = new Map<string, number>()
  for (const f of coverage.perFixture.values()) roundingExtraByCountRow.set(f.countRowId, f.roundingExtra)
  const override = parseSovMaterialFactor(args.bidFactorOverride, NaN)
  const factorIsBidOverride = Number.isFinite(override)
  const factor = factorIsBidOverride ? override : companyFactor
  const summary = computeMaterialsByStage({ countRows, lines, roundingExtraByCountRow, splits: versionSplits, bundleParts, factor })
  return { summary, factor, factorIsBidOverride, countRows }
}

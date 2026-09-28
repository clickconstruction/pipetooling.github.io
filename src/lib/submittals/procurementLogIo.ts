/**
 * The reads and writes behind the procurement log (Submittals → Procure, v2.4083):
 * the bid's `bid_procurement_items` and `_updates`, each tag's stage from the takeoff,
 * and the job's stage windows for the required dates. One door, so the panel and any
 * later reader (the GC's room) say the same thing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { effectiveSplit, indexStageSplits } from '../bids/materialsByStage'
import { defaultSplitForFixture } from '../bids/materialsByStage'
import { loadStageSplitsForBid } from '../bids/materialsByStageIo'
import { asDecision } from './submittalRevision'
import {
  stageDatesFromJob,
  stageOfWeights,
  tagMatchesFixture,
  type ProcurementItemSource,
  type ProcurementRecord,
  type ProcurementSnapshotRow,
  type ProcurementStage,
  type StageDates,
} from './procurementLog'

type Client = SupabaseClient<Database>
export type ProcurementItemRow = Database['public']['Tables']['bid_procurement_items']['Row']
export type ProcurementUpdateRow = Database['public']['Tables']['bid_procurement_updates']['Row']

export function procurementRecordFromRow(r: ProcurementItemRow): ProcurementRecord {
  return {
    id: r.id,
    tag: r.tag,
    label: r.label ?? '',
    leadTimeDays: r.lead_time_days,
    stage: (r.stage as ProcurementStage | null) ?? null,
    orderedOn: r.ordered_on,
    poRef: r.po_ref ?? '',
    expectedOn: r.expected_on,
    deliveredOn: r.delivered_on,
    note: r.note ?? '',
    sortOrder: r.sort_order,
  }
}

export async function loadProcurementRecords(supabase: Client, bidId: string): Promise<ProcurementRecord[]> {
  const { data } = await supabase.from('bid_procurement_items').select('*').eq('bid_id', bidId).order('sort_order').order('created_at')
  return (data ?? []).map(procurementRecordFromRow)
}

export type ProcurementUpdate = { id: string; sentAt: string; sentByName: string; sentTo: string; line: string; rows: ProcurementSnapshotRow[]; changes: Array<{ key: string; tag: string | null; product: string; text: string }> }

/** Newest first. */
export async function loadProcurementUpdates(supabase: Client, bidId: string): Promise<ProcurementUpdate[]> {
  const { data } = await supabase.from('bid_procurement_updates').select('id, sent_at, sent_by_name, sent_to, line, rows, changes').eq('bid_id', bidId).order('sent_at', { ascending: false }).limit(50)
  return (data ?? []).map((u) => ({
    id: u.id,
    sentAt: u.sent_at,
    sentByName: u.sent_by_name ?? '',
    sentTo: u.sent_to ?? '',
    line: u.line ?? '',
    rows: Array.isArray(u.rows) ? (u.rows as unknown as ProcurementSnapshotRow[]) : [],
    changes: Array.isArray(u.changes) ? (u.changes as unknown as ProcurementUpdate['changes']) : [],
  }))
}

/**
 * Each submittal tag's stage from the takeoff: the count row that carries the tag
 * (`tagMatchesFixture`), its effective split (a hand or rule split on the fixture,
 * else the name rule), the heaviest stage. Tags with no fixture stay unknown.
 */
export async function loadTagStagesForBid(supabase: Client, bidId: string, tags: ReadonlyArray<string>): Promise<Record<string, ProcurementStage | undefined>> {
  const out: Record<string, ProcurementStage | undefined> = {}
  if (tags.length === 0) return out
  const [{ data: rows }, splits] = await Promise.all([
    supabase.from('bids_count_rows').select('id, fixture').eq('bid_id', bidId),
    loadStageSplitsForBid(supabase, bidId).catch(() => []),
  ])
  const lookup = indexStageSplits(splits)
  for (const tag of tags) {
    const row = (rows ?? []).find((r) => tagMatchesFixture(tag, r.fixture))
    if (!row) continue
    const split = effectiveSplit(lookup, row.id)
    const weights = split.weights ?? defaultSplitForFixture(row.fixture)?.weights ?? null
    const stage = stageOfWeights(weights)
    if (stage) out[tag] = stage
  }
  return out
}

/** The required dates: the job made from this bid, its Order stages and their windows. Empty when the bid is not a job yet. */
export async function loadStageDatesForBid(supabase: Client, bidId: string): Promise<{ jobId: string | null; stageDates: StageDates }> {
  const { data: job } = await supabase.from('jobs_ledger').select('id').eq('bid_id', bidId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!job) return { jobId: null, stageDates: {} }
  const [{ data: fixtures }, { data: windows }] = await Promise.all([
    supabase.from('jobs_ledger_fixtures').select('id, name, stage_kind').eq('job_id', job.id),
    supabase.from('job_stage_windows').select('fixture_id, window_start').eq('job_id', job.id),
  ])
  return { jobId: job.id, stageDates: stageDatesFromJob(fixtures ?? [], windows ?? []) }
}

type ItemLike = { tag: string; submitted_manufacturer: string | null; submitted_model: string | null; submitted_label: string | null; specified_manufacturer: string | null; specified_model: string | null; specified_description: string | null; lead_time_days: number | null; review_decision: string | null; reviewed_at: string | null; supply_house_id: string | null }

/** The newest revision's rows as the log reads them; the house names come from one read. */
export async function procurementItemsFrom(supabase: Client, items: ReadonlyArray<ItemLike>, shared: boolean): Promise<ProcurementItemSource[]> {
  const houseIds = [...new Set(items.map((i) => i.supply_house_id).filter((x): x is string => !!x))]
  const names = new Map<string, string>()
  if (houseIds.length > 0) {
    const { data } = await supabase.from('supply_houses').select('id, name').in('id', houseIds)
    for (const h of data ?? []) names.set(h.id, h.name)
  }
  return items
    .filter((i) => i.tag.trim())
    .map((i) => {
      const submitted = [i.submitted_manufacturer, i.submitted_model].filter(Boolean).join(' ') || i.submitted_label || ''
      const specified = [i.specified_manufacturer, i.specified_model].filter(Boolean).join(' ') || i.specified_description || ''
      const d = asDecision(i.review_decision)
      return {
        tag: i.tag.trim(),
        product: submitted || specified || '(no product)',
        supplyHouse: i.supply_house_id ? names.get(i.supply_house_id) ?? null : null,
        leadTimeDays: i.lead_time_days,
        decision: d ? { kind: d, at: i.reviewed_at } : null,
        shared,
      }
    })
}

/**
 * The reads and writes behind the procurement log (Submittals → Procure, v2.4083):
 * the bid's `bid_procurement_items` and `_updates`, each tag's stage from the takeoff,
 * and the job's stage windows for the required dates. One door, so the panel and any
 * later reader (the GC's room) say the same thing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { loadStageSplitsForBid } from '../bids/materialsByStageIo'
import type { SubmittalPartRow } from './itemParts'
import { procurementItemSources, procurementSourceIds, type ProcurementItemLike } from './procurementItemSources'
import {
  stageDatesFromJob,
  tagStagesFrom,
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
    // 2026-10-01 · a part's line (typed by hand until the types regen after the push).
    partKey: (r as ProcurementItemRow & { part_key?: string | null }).part_key ?? null,
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
  if (tags.length === 0) return {}
  const [{ data: rows }, splits] = await Promise.all([
    supabase.from('bids_count_rows').select('id, fixture').eq('bid_id', bidId),
    loadStageSplitsForBid(supabase, bidId).catch(() => []),
  ])
  return tagStagesFrom(rows ?? [], splits, tags)
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

/**
 * The newest revision's rows as the log reads them; the house names come from one read. The reads
 * are here; the mapping is `procurementItemSources` (v2.6804), which the dev seat reads too.
 */
export async function procurementItemsFrom(supabase: Client, items: ReadonlyArray<ProcurementItemLike>, shared: boolean, parts: ReadonlyArray<SubmittalPartRow> = []): Promise<ProcurementItemSource[]> {
  const { houseIds, countRowIds } = procurementSourceIds(items, parts)
  const names = new Map<string, string>()
  // v2.4685 · a house's usual lead time stands in for a part that has none of its own; a typed number wins.
  const usual = new Map<string, number>()
  if (houseIds.length > 0) {
    // Until the column is pushed the select with it fails: read the names alone then, as the Materials tab does.
    let res: { data: unknown; error: unknown } = await supabase.from('supply_houses').select('id, name, default_lead_time_days').in('id', houseIds)
    if (res.error) res = await supabase.from('supply_houses').select('id, name').in('id', houseIds)
    for (const h of ((res.data ?? []) as Array<{ id: string; name: string; default_lead_time_days?: number | null }>)) {
      names.set(h.id, h.name)
      if (h.default_lead_time_days != null) usual.set(h.id, h.default_lead_time_days)
    }
  }
  // How many fixtures the takeoff counted, for the parts' quantities and each tag's heading (2026-10-02).
  const counts = new Map<string, number>()
  const fixtures = new Map<string, string>()
  if (countRowIds.length > 0) {
    const { data } = await supabase.from('bids_count_rows').select('id, count, fixture').in('id', countRowIds)
    for (const c of (data ?? []) as Array<{ id: string; count: number; fixture: string | null }>) {
      counts.set(c.id, Number(c.count) || 0)
      if (c.fixture) fixtures.set(c.id, c.fixture)
    }
  }
  return procurementItemSources(items, shared, parts, { houseNames: names, usualLead: usual, counts, fixtures })
}

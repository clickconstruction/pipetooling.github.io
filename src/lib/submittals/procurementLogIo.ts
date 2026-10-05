/**
 * The reads and writes behind the procurement log (Submittals → Procure, v2.4083):
 * the bid's `bid_procurement_items` and `_updates`, each tag's stage from the takeoff,
 * and the job's stage windows for the required dates. One door, so the panel and any
 * later reader (the GC's room) say the same thing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { loadStageSplitsForBid } from '../bids/materialsByStageIo'
import { asDecision } from './submittalRevision'
import { isOrderOnlyRow } from './orderOnly'
import type { SubmittalPartRow } from './itemParts'
import { asPartStage, isCarrier } from './itemParts'
import {
  partLineDecision,
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

type ItemLike = { id?: string; review_note?: string | null; tag: string; submitted_manufacturer: string | null; submitted_model: string | null; submitted_label: string | null; specified_manufacturer: string | null; specified_model: string | null; specified_description: string | null; lead_time_days: number | null; review_decision: string | null; reviewed_at: string | null; supply_house_id: string | null; source_count_row_id?: string | null; order_only?: boolean | null }

/**
 * The newest revision's rows as the log reads them; the house names come from one read. A row
 * with parts (2026-10-01) gives one line per part: the part's name, house, lead time and stage,
 * the fixtures counted × how many go on one, and its call (`partLineDecision`: its own; the
 * row's when the row was called whole; an order-only part is released with its fixture). An
 * order-only row (2026-10-02) waits for no call: every line of it is ready to order and stays
 * off the GC's copies.
 */
export async function procurementItemsFrom(supabase: Client, items: ReadonlyArray<ItemLike>, shared: boolean, parts: ReadonlyArray<SubmittalPartRow> = []): Promise<ProcurementItemSource[]> {
  const houseIds = [...new Set([...items.map((i) => i.supply_house_id), ...parts.map((p) => p.supply_house_id)].filter((x): x is string => !!x))]
  const names = new Map<string, string>()
  if (houseIds.length > 0) {
    const { data } = await supabase.from('supply_houses').select('id, name').in('id', houseIds)
    for (const h of data ?? []) names.set(h.id, h.name)
  }
  // How many fixtures the takeoff counted, for the parts' quantities and each tag's heading (2026-10-02).
  const countRowIds = [...new Set(items.map((i) => i.source_count_row_id).filter((x): x is string => !!x))]
  const counts = new Map<string, number>()
  const fixtures = new Map<string, string>()
  if (countRowIds.length > 0) {
    const { data } = await supabase.from('bids_count_rows').select('id, count, fixture').in('id', countRowIds)
    for (const c of (data ?? []) as Array<{ id: string; count: number; fixture: string | null }>) {
      counts.set(c.id, Number(c.count) || 0)
      if (c.fixture) fixtures.set(c.id, c.fixture)
    }
  }
  const out: ProcurementItemSource[] = []
  for (const i of items) {
    if (!i.tag.trim()) continue
    const submitted = [i.submitted_manufacturer, i.submitted_model].filter(Boolean).join(' ') || i.submitted_label || ''
    const specified = [i.specified_manufacturer, i.specified_model].filter(Boolean).join(' ') || i.specified_description || ''
    const d = asDecision(i.review_decision)
    // The whole fixture is the office's: no call is read, and no line of it reaches the GC.
    const noGc = isOrderOnlyRow(i)
    const rowDecision = d && !noGc ? { kind: d, at: i.reviewed_at } : null
    const itemId = (i as ItemLike & { id?: string }).id
    const counted = i.source_count_row_id ?? null
    const base = { tag: i.tag.trim(), shared, sourceCountRowId: counted, itemId: itemId ?? null, fixture: counted ? fixtures.get(counted) ?? null : null, fixtureCount: counted ? counts.get(counted) ?? null : null }
    const rowParts = itemId ? parts.filter((p) => p.item_id === itemId).sort((a, b) => a.sequence_order - b.sequence_order) : []
    if (rowParts.length === 0) {
      out.push({ ...base, product: submitted || specified || '(no product)', supplyHouse: i.supply_house_id ? names.get(i.supply_house_id) ?? null : null, leadTimeDays: i.lead_time_days, decision: rowDecision, reviewNote: i.review_note?.trim() || null, ...(submitted ? {} : { noProduct: true }), ...(noGc ? { orderOnly: true, noGc: true } : {}) })
      continue
    }
    const fixtureCount = i.source_count_row_id ? counts.get(i.source_count_row_id) ?? null : null
    const rowCalledByPart = rowParts.some((p) => p.on_submittal && asDecision(p.review_decision) != null)
    for (const p of rowParts) {
      const own = asDecision(p.review_decision)
      out.push({
        ...base,
        product: p.label.trim(),
        supplyHouse: p.supply_house_id ? names.get(p.supply_house_id) ?? null : null,
        leadTimeDays: p.lead_time_days ?? i.lead_time_days,
        decision: noGc ? null : partLineDecision({ onSubmittal: p.on_submittal, own: own ? { kind: own, at: p.reviewed_at } : null, row: rowDecision, rowCalledByPart }),
        partKey: p.procure_key,
        partOrder: p.sequence_order,
        orderOnly: noGc || !p.on_submittal,
        ...(noGc ? { noGc: true } : {}),
        quantity: fixtureCount != null ? fixtureCount * Number(p.quantity) : null,
        pricedLabel: p.priced_label ?? null,
        // The part's own note, else the row's when the row was called whole.
        reviewNote: p.review_note?.trim() || i.review_note?.trim() || null,
        assembly: p.assembly ?? null,
        addedByHand: p.source === 'hand',
        // A carrier with no stage of its own is needed at Rough In (2026-10-02).
        stage: asPartStage(p.stage) ?? (isCarrier(p.label) ? 'rough_in' : null),
      })
    }
  }
  return out
}

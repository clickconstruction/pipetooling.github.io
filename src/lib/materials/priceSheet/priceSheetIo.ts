/**
 * Reads and writes for a whole price sheet (punch list #308, PR 4): keep one that was just read,
 * open one that was kept, list a bid's sheets, settle the house, leave a row out, remove a sheet.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../../utils/errorHandling'
import type { PastedSheet, PricingUnit } from './pastedRow'
import type { SheetHeader } from './sheetHouse'
import { isChargeRow, type SheetGroup, type SheetLine } from './sheetPlan'

// The tables' new columns and the RPCs are not in the generated types until the types PR that follows their push.
type Db = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type SheetPaper = {
  id: string
  supplyHouseId: string | null
  number: string
  datedOn: string | null
  validUntil: string | null
  bidId: string | null
  fileSha256: string | null
  pages: number | null
  createdAt: string
  createdBy: string | null
  readBy: string
}

type PaperRow = { id: string; supply_house_id: string | null; number: string; dated_on: string | null; valid_until: string | null; bid_id: string | null; file_sha256: string | null; page_to: number | null; created_at: string; created_by: string | null; read_by: string }
const PAPER_SELECT = 'id,supply_house_id,number,dated_on,valid_until,bid_id,file_sha256,page_to,created_at,created_by,read_by'
const toPaper = (r: PaperRow): SheetPaper => ({
  id: r.id, supplyHouseId: r.supply_house_id, number: r.number, datedOn: r.dated_on, validUntil: r.valid_until, bidId: r.bid_id, fileSha256: r.file_sha256, pages: r.page_to, createdAt: r.created_at, createdBy: r.created_by, readBy: r.read_by,
})

const isMissing = (e: { code?: string | null; message?: string | null } | null): boolean =>
  e != null && (['PGRST202', 'PGRST205', '42883', '42P01', '42703', 'PGRST204'].includes(String(e.code ?? '')) || /could not find|does not exist/i.test(e.message ?? ''))

export type SaveSheetInput = {
  sheet: PastedSheet
  header: SheetHeader
  supplyHouseId: string | null
  bidId: string | null
  sha256: string | null
  pages: number | null
  /** How it was read: `text` for a file's own text layer or pasted text, `model:<name>` for the reader of pictures. */
  readBy?: string
}

/** The rows of a read sheet as the database keeps them: grouped rows in their order, then the loose ones. */
export function sheetRowsForSave(sheet: PastedSheet): { groups: Record<string, unknown>[]; lines: Record<string, unknown>[] } {
  const groups = sheet.groups.map((g, i) => ({ group_no: i + 1, tag: g.tag, label: g.label, each_price: g.each }))
  const lines: Record<string, unknown>[] = []
  sheet.groups.forEach((g, i) => {
    for (const r of g.rows) {
      const charge = isChargeRow({ kind: 'part', description: r.description })
      lines.push({
        group_no: i + 1, group_tag: g.tag, group_label: g.label,
        // A row under a fixture with no price of its own is a component of the fixture's bundle.
        line_kind: charge ? 'charge' : r.unitPrice == null ? 'component' : 'part',
        house_code: r.houseCode, description: r.description, qty: r.qty, unit_price: r.unitPrice, pricing_unit: r.pricingUnit, page_no: r.page ?? null,
      })
    }
  })
  for (const r of sheet.loose) {
    lines.push({
      group_no: null, group_tag: '', group_label: '', line_kind: isChargeRow({ kind: 'part', description: r.description }) ? 'charge' : 'part',
      house_code: r.houseCode, description: r.description, qty: r.qty, unit_price: r.unitPrice, pricing_unit: r.pricingUnit, page_no: r.page ?? null,
    })
  }
  return { groups, lines }
}

export async function saveSheet(supabase: Db, input: SaveSheetInput): Promise<{ ok: true; paperId: string } | { ok: false; error: string; notLive: boolean }> {
  const { groups, lines } = sheetRowsForSave(input.sheet)
  const { data, error } = await supabase.rpc('price_sheet_save', {
    p_paper: {
      supply_house_id: input.supplyHouseId, bid_id: input.bidId, number: input.header.number, dated_on: input.header.datedOn, valid_until: input.header.validUntil,
      file_sha256: input.sha256, page_from: input.pages ? 1 : null, page_to: input.pages, read_by: input.readBy ?? 'text',
    },
    p_groups: groups,
    p_lines: lines,
  })
  if (error) {
    const notLive = isMissing(error)
    return { ok: false, notLive, error: notLive ? 'Reading a price sheet is not switched on yet. It arrives with the next database update.' : formatErrorMessage(error, 'The sheet could not be kept') }
  }
  return { ok: true, paperId: String(data) }
}

type LineRow = { id: string; line_no: number; group_no: number | null; line_kind: SheetLine['kind']; house_code: string; description: string; qty_ordered: number | string | null; unit_price: number | string | null; pricing_unit: PricingUnit; part_id: string | null; filed_at: string | null; filed_price: number | string | null; held_why: string; page_no: number | null }
type GroupRow = { id: string; group_no: number; tag: string; label: string; each_price: number | string | null; placed_at: string | null; held_why: string }
const num = (v: number | string | null): number | null => (v == null ? null : Number(v))

export type LoadedSheet = { paper: SheetPaper; groups: SheetGroup[]; lines: SheetLine[] }

/** One kept sheet whole, or null when it is gone. */
export async function loadSheet(supabase: Db, paperId: string): Promise<{ ok: true; sheet: LoadedSheet | null } | { ok: false; error: string }> {
  const [paper, groups, lines] = await Promise.all([
    supabase.from('supply_papers').select(PAPER_SELECT).eq('id', paperId).maybeSingle(),
    supabase.from('supply_paper_groups').select('id,group_no,tag,label,each_price,placed_at,held_why').eq('paper_id', paperId).order('group_no'),
    supabase.from('supply_paper_lines').select('id,line_no,group_no,line_kind,house_code,description,qty_ordered,unit_price,pricing_unit,part_id,filed_at,filed_price,held_why,page_no').eq('paper_id', paperId).order('line_no').limit(1000),
  ])
  const failed = paper.error ?? groups.error ?? lines.error
  if (failed) return { ok: false, error: formatErrorMessage(failed, 'The sheet could not be read') }
  if (!paper.data) return { ok: true, sheet: null }
  return {
    ok: true,
    sheet: {
      paper: toPaper(paper.data as unknown as PaperRow),
      groups: ((groups.data ?? []) as unknown as GroupRow[]).map((g) => ({ id: g.id, groupNo: g.group_no, tag: g.tag, label: g.label, eachPrice: num(g.each_price), placedAt: g.placed_at, heldWhy: g.held_why })),
      lines: ((lines.data ?? []) as unknown as LineRow[]).map((l) => ({
        id: l.id, lineNo: l.line_no, groupNo: l.group_no, kind: l.line_kind, houseCode: l.house_code, description: l.description, qty: num(l.qty_ordered), unitPrice: num(l.unit_price),
        pricingUnit: l.pricing_unit, partId: l.part_id, filedAt: l.filed_at, filedPrice: num(l.filed_price), heldWhy: l.held_why, page: l.page_no,
      })),
    },
  }
}

/** The sheet already kept from this very file, when there is one: a sheet is not read twice. */
export async function findSheetByHash(supabase: Db, sha256: string): Promise<SheetPaper | null> {
  const { data, error } = await supabase.from('supply_papers').select(PAPER_SELECT).eq('came_by', 'sheet').eq('file_sha256', sha256).order('created_at', { ascending: false }).limit(1)
  if (error || !data?.length) return null
  return toPaper(data[0] as unknown as PaperRow)
}

export type SheetSummary = { paper: SheetPaper; rows: number; filed: number; waiting: number }

/** A bid's sheets (or every sheet with no bid filter), newest first, each with how many rows still wait. */
export async function listSheets(supabase: Db, filter: { bidId?: string } = {}): Promise<SheetSummary[]> {
  let q = supabase.from('supply_papers').select(`${PAPER_SELECT}, supply_paper_lines(line_kind,filed_at,held_why)`).eq('came_by', 'sheet').order('created_at', { ascending: false }).limit(100)
  if (filter.bidId) q = q.eq('bid_id', filter.bidId)
  const { data, error } = await q
  if (error) return []
  return ((data ?? []) as unknown as (PaperRow & { supply_paper_lines: { line_kind: string; filed_at: string | null; held_why: string }[] })[]).map((r) => {
    const lines = r.supply_paper_lines ?? []
    return {
      paper: toPaper(r),
      rows: lines.length,
      filed: lines.filter((l) => l.filed_at).length,
      waiting: lines.filter((l) => !l.filed_at && l.held_why === '' && l.line_kind !== 'charge').length,
    }
  })
}

const done = async (call: PromiseLike<{ error: unknown }>, fallback: string): Promise<{ error: string | null }> => {
  const { error } = await call
  return { error: error ? formatErrorMessage(error, fallback) : null }
}

export const setSheet = (supabase: Db, paperId: string, patch: { supplyHouseId?: string | null; number?: string; datedOn?: string | null; validUntil?: string | null }) =>
  done(
    supabase.rpc('price_sheet_set', {
      p_paper_id: paperId,
      p: {
        ...(patch.supplyHouseId !== undefined ? { supply_house_id: patch.supplyHouseId } : {}),
        ...(patch.number !== undefined ? { number: patch.number } : {}),
        ...(patch.datedOn !== undefined ? { dated_on: patch.datedOn } : {}),
        ...(patch.validUntil !== undefined ? { valid_until: patch.validUntil } : {}),
      },
    }),
    'The sheet could not be changed',
  )

/** Leave a row out (`left_out`), or bring it back (empty). */
export const holdSheetLine = (supabase: Db, lineId: string, why: 'left_out' | '') => done(supabase.rpc('price_sheet_line_hold', { p_line_id: lineId, p_why: why }), 'The row could not be changed')

/** Keep a person's pick of the part for a row, or undo it with null. */
export const pickSheetLinePart = (supabase: Db, lineId: string, partId: string | null) => done(supabase.rpc('price_sheet_line_part', { p_line_id: lineId, p_part_id: partId }), 'The pick could not be kept')

export const discardSheet = (supabase: Db, paperId: string) => done(supabase.rpc('price_sheet_discard', { p_paper_id: paperId }), 'The sheet could not be removed')

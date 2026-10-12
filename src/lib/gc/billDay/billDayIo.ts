/**
 * Messages, cut 9 (wave 2, helper 7): where Bill day talks to the database (migration 20261012140000_gc_bill_day_walk).
 * It reads the superintendent's taps (`gc_superintendent_checks`), a trade's word that it sends nothing this period
 * (`gc_bill_day_nothing`), where each line is on site (`gc_sow_lines.where_on_site`) and the cut-off
 * (`app_settings.gc_bill_day_cutoff_days`), and carries each press to its function, which checks who may. The draws
 * themselves are `drawsIo.ts`'s. The three tables are not in the generated types until the types PR after the push, so
 * each read and write goes through the house `as never` cast and maps its rows here.
 */
import { checkSupabaseError, type SupabaseResultError } from '../../../utils/errorHandling'
import { supabase } from '../../supabase'
import type { DrawTables } from '../drawRows'
import { BILL_DAY_CUTOFF_DAYS, type NothingThisPeriod } from './trades'
import type { LineCheck } from './walk'

/** The cut-off's row in `app_settings` (its `value_num`). */
export const BILL_DAY_CUTOFF_KEY = 'gc_bill_day_cutoff_days'

/** A tap as its row holds it. */
export interface LineCheckRow {
  id: string
  draw_id: string
  sow_line_id: string
  we_see_pct: number | string | null
  stored_on_site: boolean | null
  photo_url: string | null
  note: string
  checked_by: string | null
  checked_at: string
  seq: number
}

/** A trade's word that it sends nothing for a bill day, as its row holds it. */
export interface NothingRow {
  id: string
  sow_id: string
  period_to: string
  said_by: string
  recorded_by: string | null
  said_at: string
}

/** Nothing this period with its row's id, so Put it back can delete it. */
export type NothingRecord = NothingThisPeriod & { id: string }

type Result<T> = { data: T | null; error: SupabaseResultError | null; status?: number }

/** The rows of a read, or the read's problem thrown in plain words. */
function taken<T>(result: Result<T>, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** Ids an `.in()` filter takes at once, so a long list never makes a request line too long. */
const IN_CHUNK = 100

async function inChunks<T>(ids: string[], read: (chunk: string[]) => PromiseLike<Result<T[]>>, operation: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(...(taken(await read(ids.slice(i, i + IN_CHUNK)), operation) ?? []))
  return out
}

/** A statement of work's line by its row id, as the kernels name it: its scope item, or its own id on a change order's line. */
function kernelIdOf(sowLines: DrawTables['sowLines']): (sowLineId: string) => string {
  const byId = new Map(sowLines.map((l) => [l.id, l.scope_item_id ?? l.id]))
  return (sowLineId) => byId.get(sowLineId) ?? sowLineId
}

/** Pure: the taps as the kernels read them (`LineCheck`), each line by its kernel id. */
export function lineChecksOf(rows: LineCheckRow[], sowLines: DrawTables['sowLines']): LineCheck[] {
  const keyOf = kernelIdOf(sowLines)
  return [...rows]
    .sort((a, b) => a.seq - b.seq)
    .map((r) => ({
      drawId: r.draw_id,
      sovId: keyOf(r.sow_line_id),
      weSee: r.we_see_pct === null ? null : Number(r.we_see_pct),
      onSite: r.stored_on_site,
      photo: r.photo_url !== null && r.photo_url.trim() !== '',
      note: r.note ?? '',
      by: r.checked_by ?? '',
      at: r.checked_at,
    }))
}

/** Pure: the photo links on the taps, by `drawId:sovId`, newest kept, so the office can open the one a line carries. */
export function photoLinksOf(rows: LineCheckRow[], sowLines: DrawTables['sowLines']): Map<string, string> {
  const keyOf = kernelIdOf(sowLines)
  const out = new Map<string, string>()
  for (const r of [...rows].sort((a, b) => a.seq - b.seq)) {
    if (r.photo_url && r.photo_url.trim() !== '') out.set(`${r.draw_id}:${keyOf(r.sow_line_id)}`, r.photo_url.trim())
  }
  return out
}

/** Pure: the nothing rows as the kernels read them, with their ids. */
export function nothingOf(rows: NothingRow[]): NothingRecord[] {
  return rows.map((r) => ({ id: r.id, sowId: r.sow_id, periodTo: r.period_to, saidBy: r.said_by, at: r.said_at }))
}

/** Pure: where each line is on site, by its kernel id. A line with no place is left out: the walk puts it on the site. */
export function whereOnSiteOf(rows: { id: string; scope_item_id: string | null; where_on_site: string | null }[]): Record<string, string> {
  return Object.fromEntries(rows.filter((r) => r.where_on_site && r.where_on_site.trim() !== '').map((r) => [r.scope_item_id ?? r.id, (r.where_on_site ?? '').trim()]))
}

/** Pure: the cut-off from its row, or the default when the row is missing or not a whole number of days. */
export function cutoffOf(value: number | string | null | undefined): number {
  const n = Number(value)
  return value !== null && value !== undefined && Number.isInteger(n) && n >= 2 && n <= 20 ? n : BILL_DAY_CUTOFF_DAYS
}

/** The taps on these draws, oldest first. */
export async function loadLineChecks(drawIds: string[]): Promise<LineCheckRow[]> {
  if (drawIds.length === 0) return []
  return inChunks<LineCheckRow>(
    drawIds,
    (c) => supabase.from('gc_superintendent_checks' as never).select('*').in('draw_id', c) as unknown as PromiseLike<Result<LineCheckRow[]>>,
    'load the walk’s taps',
  )
}

/** The trades' word that they send nothing, on these statements of work. */
export async function loadBillDayNothing(sowIds: string[]): Promise<NothingRow[]> {
  if (sowIds.length === 0) return []
  return inChunks<NothingRow>(
    sowIds,
    (c) => supabase.from('gc_bill_day_nothing' as never).select('*').in('sow_id', c) as unknown as PromiseLike<Result<NothingRow[]>>,
    'load nothing this period',
  )
}

/** Where each line of these statements of work is on site. */
export async function loadWhereOnSite(sowIds: string[]): Promise<{ id: string; scope_item_id: string | null; where_on_site: string | null }[]> {
  if (sowIds.length === 0) return []
  return inChunks(
    sowIds,
    (c) =>
      supabase.from('gc_sow_lines').select('id, scope_item_id, where_on_site' as never).in('sow_id', c) as unknown as PromiseLike<
        Result<{ id: string; scope_item_id: string | null; where_on_site: string | null }[]>
      >,
    'load where each line is on site',
  )
}

/** The cut-off in days before bill day. A failed read or a missing row reads the default, so Bill day still draws. */
export async function loadBillDayCutoff(): Promise<number> {
  const { data, error } = await supabase.from('app_settings').select('value_num').eq('key', BILL_DAY_CUTOFF_KEY).maybeSingle()
  if (error) return BILL_DAY_CUTOFF_DAYS
  return cutoffOf((data as { value_num?: number | null } | null)?.value_num ?? null)
}

/** A tap of the walk, by the kernels' line id: the percent seen or whether the stored material is on site. Returns the tap's id. */
export async function recordLineCheck(tap: { drawId: string; sovId: string; weSee: number | null; onSite: boolean | null; photoUrl?: string; note?: string }): Promise<string> {
  const result = (await supabase.rpc('gc_record_line_check' as never, {
    p_draw_id: tap.drawId,
    p_line: tap.sovId,
    p_we_see: tap.weSee,
    p_on_site: tap.onSite,
    p_photo_url: tap.photoUrl?.trim() || null,
    p_note: tap.note?.trim() ?? '',
  } as never)) as unknown as Result<string>
  return taken(result, 'keep the tap')
}

/** A trade sends nothing for a bill day, said by whom. Saying it again for the same bill day replaces who said it. */
export async function sayNothingThisPeriod(sowId: string, periodTo: string, saidBy: string): Promise<string> {
  const result = (await supabase.rpc('gc_say_nothing_this_period' as never, { p_sow_id: sowId, p_period_to: periodTo, p_said_by: saidBy } as never)) as unknown as Result<string>
  return taken(result, 'record nothing this period')
}

/** Put it back: the trade's word comes off, and it reads as not in again. */
export async function putBackNothing(id: string): Promise<void> {
  const result = (await supabase.from('gc_bill_day_nothing' as never).delete().eq('id', id)) as unknown as Result<null>
  checkSupabaseError(result, 'put it back')
}

/** The cut-off, 2 to 20 days before bill day, for every job. Returns the days set. */
export async function setBillDayCutoff(days: number): Promise<number> {
  const result = (await supabase.rpc('gc_set_bill_day_cutoff' as never, { p_days: days } as never)) as unknown as Result<number>
  return taken(result, 'set the cut-off')
}

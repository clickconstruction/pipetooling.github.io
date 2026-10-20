/**
 * GC mode, the real build, the Building lane's U6b: where the Draws window talks to the database. It reads the trades'
 * money for some jobs in one round and carries each press to its function (migration 20261010021000_gc_trade_draws,
 * the Building lane's U6a), which checks whose move it is and works the money out itself; the window sends only what
 * was claimed, approved or seen. A back-charge is the Portal's record (P4a): charged, kept or dropped here through its
 * own functions, and taken off a draw through U6a's. The plan: to-dos/gc-mode/mockups/building-u6.md on branch
 * spike/gc-mode.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import type { DrawEmail } from './drawEmail'
import { drawCameInPayload, linePercents, NO_DRAWS, type DrawCameIn, type DrawTables } from './drawRows'
import type { PortalLang } from './portalI18n'
import { tradeMailLang, type TradeEmailAnswer } from './tradeEmail'
import { sendGcTradeEmail } from './tradeEmailIo'

/** The rows of a read, or the read's problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** Ids an `.in()` filter takes at once, so a long list never makes a request line too long. */
const IN_CHUNK = 100

async function inChunks<T>(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: SupabaseResultError | null }>, operation: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(...taken(await read(ids.slice(i, i + IN_CHUNK)), operation))
  return out
}

/** The trades' money on these trades (their packages): the statements of work, their lines, draws, reports, charges and changes. */
export async function loadGcDraws(packageIds: string[]): Promise<DrawTables> {
  if (packageIds.length === 0) return NO_DRAWS
  const sows = await inChunks(packageIds, (c) => supabase.from('gc_sows').select('id, package_id').in('package_id', c), 'load the statements of work')
  const sowIds = sows.map((s) => s.id)
  if (sowIds.length === 0) return { ...NO_DRAWS, sows }
  const [sowLines, draws, backCharges, tradeSends] = await Promise.all([
    inChunks(sowIds, (c) => supabase.from('gc_sow_lines').select('id, sow_id, position, scope_item_id').in('sow_id', c), 'load the statements of work’s lines'),
    inChunks(sowIds, (c) => supabase.from('gc_draws').select('*').in('sow_id', c), 'load the draws'),
    inChunks(sowIds, (c) => supabase.from('gc_back_charges').select('*').in('sow_id', c), 'load the back-charges'),
    inChunks(sowIds, (c) => supabase.from('gc_change_order_trade_sends').select('*').in('sow_id', c), 'load the changes sent to the trades'),
  ])
  const [drawLines, reports] = await Promise.all([
    inChunks(draws.map((d) => d.id), (c) => supabase.from('gc_draw_lines').select('*').in('draw_id', c), 'load the draws’ lines'),
    inChunks(sowLines.map((l) => l.id), (c) => supabase.from('gc_sow_line_reports').select('*').in('sow_line_id', c), 'load the trades’ reports'),
  ])
  return { sows, sowLines, draws, drawLines, reports, backCharges, tradeSends }
}

/** A pay application that came by email or on paper. Returns the draw's id. */
export async function drawCameIn(d: DrawCameIn): Promise<string> {
  return taken(await supabase.rpc('gc_draw_came_in', { p_package_id: d.packageId, p: drawCameInPayload(d) }), 'record the pay application')
}

/** Approve a pay application as asked. */
export async function approveDraw(drawId: string): Promise<void> {
  taken(await supabase.rpc('gc_approve_draw', { p_draw_id: drawId }), 'approve the pay application')
}

/** Approve it for less: the percent we approve on each line we doubt, by the kernels' line id, and why. */
export async function approveDrawLess(drawId: string, weApprove: Record<string, number>, note: string): Promise<void> {
  taken(await supabase.rpc('gc_approve_draw_less', { p_draw_id: drawId, p_we_approve: linePercents(weApprove), p_note: note }), 'approve it for less')
}

/** Send it back: what to fix, and the percent we see on each line we doubt. */
export async function sendDrawBack(drawId: string, weSee: Record<string, number>, note: string): Promise<void> {
  taken(await supabase.rpc('gc_send_draw_back', { p_draw_id: drawId, p_we_see: linePercents(weSee), p_note: note }), 'send it back')
}

/** Mark an approved draw paid. */
export async function payDraw(drawId: string): Promise<void> {
  taken(await supabase.rpc('gc_pay_draw', { p_draw_id: drawId }), 'mark it paid')
}

/** Their unconditional waiver came in, for a paid draw. */
export async function drawWaiverIn(drawId: string): Promise<void> {
  taken(await supabase.rpc('gc_draw_waiver_in', { p_draw_id: drawId }), 'record the waiver')
}

/** A back-charge to the trade on its signed statement of work (P4a's), with its photo's link if there is one. Returns its id. */
export async function chargeTrade(packageId: string, amount: number, reason: string, photoUrl = ''): Promise<string> {
  const photo = photoUrl.trim()
  return taken(await supabase.rpc('gc_back_charge', { p_package_id: packageId, p_amount: amount, p_reason: reason, ...(photo ? { p_photo_url: photo } : {}) }), 'charge them')
}

/** Keep a charge they disputed, or drop one, with why (P4a's). */
export async function settleBackCharge(chargeId: string, keep: boolean, note: string): Promise<void> {
  if (keep) taken(await supabase.rpc('gc_keep_back_charge', { p_id: chargeId, p_note: note }), 'keep the charge')
  else taken(await supabase.rpc('gc_drop_back_charge', { p_id: chargeId, p_note: note }), 'drop the charge')
}

/** Take a back-charge off an approved draw that is not paid yet. */
export async function takeBackCharge(chargeId: string, drawId: string): Promise<void> {
  taken(await supabase.rpc('gc_take_back_charge', { p_charge_id: chargeId, p_draw_id: drawId }), 'take the charge off the draw')
}

/** Send a change order the customer signed to its trade, as a change to its statement of work. */
export async function sendTradeChange(changeOrderId: string): Promise<void> {
  taken(await supabase.rpc('gc_send_trade_change', { p_change_order_id: changeOrderId }), 'send the change to the trade')
}

/**
 * An email to the trade about its money (`drawEmail.ts`), in its company's language, sent once by its key. Null: nothing
 * to say at this stage. A refusal comes back in the answer, never thrown.
 */
export async function emailTheTrade(companyId: string, make: (lang: PortalLang) => DrawEmail | null): Promise<TradeEmailAnswer | null> {
  const { data } = await supabase.from('gc_companies').select('lang').eq('id', companyId).maybeSingle()
  const mail = make(tradeMailLang(data?.lang))
  return mail ? sendGcTradeEmail(mail) : null
}

/**
 * Reads and writes shared by the Submittals tab and the won question (stage 4c):
 * the picks a bid's Rev 1 is built from, building it, and the office's "not needed"
 * answer on the bid. Supabase in, kernels (`picksFromQuotes`, `buildSubmittalRows`) do
 * the thinking.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { buildSubmittalRows, type PickInput, type SpecifiedInput } from './buildSubmittalRows'
import { fixtureKey, PICK_COLS_ANNOTATED, PICK_COLS_BASE, picksFromQuotes, type RawQuote } from './picksFromQuotes'
import type { StatusOverride } from './productStatus'
import { draftToItemInsert } from './submittalRevision'

type Db = SupabaseClient<Database>

export type BidPicks = { specified: SpecifiedInput[]; picks: PickInput[]; overridesByFixture: Map<string, StatusOverride> }

/** The schedule and the picked lines of a bid — the widest line shape first, the base shape on a checkout behind the stage 1 push. */
export async function loadPicksForBid(db: Db, bidId: string): Promise<BidPicks> {
  let specified: SpecifiedInput[] = []
  try {
    const { data } = await db.from('bid_specified_products').select('tag, fixture, manufacturer, model, description').eq('bid_id', bidId).order('tag')
    specified = ((data ?? []) as SpecifiedInput[]).map((r) => ({ tag: r.tag, fixture: r.fixture, manufacturer: r.manufacturer, model: r.model, description: r.description }))
  } catch {
    specified = []
  }
  const selectQuotes = (cols: string) => db.from('bid_quotes').select(`id, supply_house_id, received_at, supply_house:supply_houses(name), bid_quote_lines(${cols})`).eq('bid_id', bidId).order('received_at')
  let q = await selectQuotes(PICK_COLS_ANNOTATED)
  if (q.error) q = await selectQuotes(PICK_COLS_BASE)
  const derived = picksFromQuotes(((q.error ? [] : q.data) ?? []) as unknown as RawQuote[])
  return { specified, picks: derived.picks, overridesByFixture: derived.overridesByFixture }
}

export function overridesByTag(p: Pick<BidPicks, 'specified' | 'overridesByFixture'>): Record<string, StatusOverride> {
  const out: Record<string, StatusOverride> = {}
  for (const s of p.specified) {
    const ov = p.overridesByFixture.get(fixtureKey(s.fixture))
    if (ov) out[s.tag] = ov
  }
  return out
}

/** Rev 1 from today's picks; `jobLedgerId` links it to the job the question was asked on. */
export async function createFirstRevisionFromPicks(db: Db, args: { bidId: string; userId: string | null; jobLedgerId?: string | null; picks?: BidPicks }): Promise<{ revId: string; rows: number }> {
  const p = args.picks ?? (await loadPicksForBid(db, args.bidId))
  const { data, error } = await db
    .from('bid_submittals')
    .insert({ bid_id: args.bidId, rev_number: 1, status: 'draft', created_by: args.userId, job_ledger_id: args.jobLedgerId ?? null })
    .select('id')
    .single()
  if (error) throw error
  const revId = (data as { id: string }).id
  const rows = buildSubmittalRows({ specified: p.specified, picks: p.picks, previous: [], overrides: overridesByTag(p) })
  if (rows.length > 0) {
    const { error: itemErr } = await db.from('bid_submittal_items').insert(rows.map((r) => draftToItemInsert(r, revId)))
    if (itemErr) throw itemErr
  }
  return { revId, rows: rows.length }
}

/** Revisions of the bid that carry no job yet take this one (the back-fill from `jobs_ledger.bid_id`). */
export async function backfillSubmittalJob(db: Db, bidId: string, jobLedgerId: string): Promise<void> {
  await db.from('bid_submittals').update({ job_ledger_id: jobLedgerId }).eq('bid_id', bidId).is('job_ledger_id', null)
}

/** "Not needed on this job" — on the bid, once; `null` to undo. */
export async function setSubmittalsNotNeeded(db: Db, bidId: string, by: string | null, on: boolean): Promise<void> {
  const { error } = await db.from('bids').update({ submittals_not_needed_at: on ? new Date().toISOString() : null, submittals_not_needed_by: on ? by : null }).eq('id', bidId)
  if (error) throw error
}

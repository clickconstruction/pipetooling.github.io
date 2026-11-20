/**
 * The reads behind *customers owe us answers* (punch list #382, PR 6). The first read is small and usually empty:
 * the bullets on them that are still on a list. With none, nothing else is read. With some, their jobs come in with
 * each job's site and who we ask, then the jobs' stage lines with our days, the rest of the rows and the settings.
 * The office reads these tables by its own row security; the line is the office's alone.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { StageLine, StartSettingsRow } from '../startChecks/startCheckRows'
import { readStartCheckRows } from '../startChecks/startChecksIo'
import type { StartOwedJob, StartOwedSources } from './startAnswersOwed'

// The tables are younger than the generated types; the types PR that follows the push removes this cast.
const db = supabase as unknown as SupabaseClient

export type StartAnswersOwedIo = { fetchSources: () => Promise<StartOwedSources> }

const NONE: StartOwedSources = { jobs: [], lines: [], rows: { bullets: [], marks: [], asks: [], theirDays: [], decisions: [], arrivals: [] }, settings: [] }

type Paged<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; customer_name: string | null; development_id: string | null; bid_id: string | null; developments: { name: string | null } | null; gc: { name: string | null } | null }
type LineRow = { id: string; job_id: string; name: string | null; sequence_order: number | null; stage_kind: string | null; progress_pct: number | null }
type WindowRow = { fixture_id: string; window_start: string | null; window_end: string | null }
type BidRow = { id: string; development_id: string | null; gc_contact_name: string | null; created_at: string | null }

async function fetchSources(): Promise<StartOwedSources> {
  const open = await fetchAllRows<{ job_id: string }>((from, to) => db.from('start_check_bullets').select('job_id').eq('waits_on', 'them').is('removed_at', null).order('id').range(from, to) as unknown as Paged<{ job_id: string }>, 'answers owed: the open bullets')
  const jobIds = [...new Set(open.map((r) => r.job_id))]
  if (jobIds.length === 0) return NONE
  const [jobRows, lineRows, windowRows, rows] = await Promise.all([
    fetchAllRowsChunkedIn<JobRow, string>(
      jobIds,
      (chunk, from, to) => db.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, customer_name, development_id, bid_id, developments:development_id(name), gc:gc_customer_id(name)').in('id', chunk).order('id').range(from, to) as unknown as Paged<JobRow>,
      'answers owed: the jobs',
    ),
    fetchAllRowsChunkedIn<LineRow, string>(jobIds, (chunk, from, to) => db.from('jobs_ledger_fixtures').select('id, job_id, name, sequence_order, stage_kind, progress_pct').in('job_id', chunk).order('id').range(from, to) as unknown as Paged<LineRow>, 'answers owed: the stage lines'),
    fetchAllRowsChunkedIn<WindowRow, string>(jobIds, (chunk, from, to) => db.from('job_stage_windows').select('fixture_id, window_start, window_end').in('job_id', chunk).order('id').range(from, to) as unknown as Paged<WindowRow>, 'answers owed: our days'),
    readStartCheckRows(jobIds),
  ])
  const developmentIds = [...new Set(jobRows.map((j) => j.development_id).filter((id): id is string => !!id))]
  const bidIds = [...new Set(jobRows.map((j) => j.bid_id).filter((id): id is string => !!id))]
  const [settings, siteBids, jobBids] = await Promise.all([
    withSupabaseRetry(async () => db.from('start_check_settings').select('id, development_id, job_id, notice_days, shows_on_gc_page'), 'answers owed: the settings'),
    developmentIds.length ? fetchAllRowsChunkedIn<BidRow, string>(developmentIds, (chunk, from, to) => db.from('bids').select('id, development_id, gc_contact_name, created_at').in('development_id', chunk).order('id').range(from, to) as unknown as Paged<BidRow>, 'answers owed: the sites’ bids') : Promise.resolve([] as BidRow[]),
    bidIds.length ? fetchAllRowsChunkedIn<BidRow, string>(bidIds, (chunk, from, to) => db.from('bids').select('id, development_id, gc_contact_name, created_at').in('id', chunk).order('id').range(from, to) as unknown as Paged<BidRow>, 'answers owed: the jobs’ bids') : Promise.resolve([] as BidRow[]),
  ])
  // Who we ask on a site is the GC's contact on its newest bid that names one, as the Development page's head reads it.
  const siteContact = new Map<string, string>()
  for (const b of [...siteBids].sort((a, c) => (c.created_at ?? '').localeCompare(a.created_at ?? ''))) {
    const name = (b.gc_contact_name ?? '').trim()
    if (b.development_id && name.length >= 2 && !siteContact.has(b.development_id)) siteContact.set(b.development_id, name)
  }
  const bidContact = new Map(jobBids.map((b) => [b.id, (b.gc_contact_name ?? '').trim()] as const))
  const jobs: StartOwedJob[] = jobRows.map((j) => ({
    id: j.id,
    label: (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || j.id.slice(0, 8),
    name: (j.job_name ?? '').trim(),
    developmentId: j.development_id,
    developmentName: j.developments?.name ?? null,
    address: j.job_address,
    gcContact: (j.development_id ? siteContact.get(j.development_id) : null) || (j.bid_id ? bidContact.get(j.bid_id) : null) || null,
    gcName: j.gc?.name ?? null,
    customerName: j.customer_name,
  }))
  const windowOf = new Map<string, [string, string]>()
  for (const w of windowRows) if (w.window_start) windowOf.set(w.fixture_id, [w.window_start, w.window_end ?? w.window_start])
  const lines: StageLine[] = lineRows
    .filter((l) => l.stage_kind === 'order' || l.stage_kind === 'any')
    .map((l) => ({ fixtureId: l.id, jobId: l.job_id, name: (l.name ?? '').trim() || 'Stage', order: Number(l.sequence_order ?? 0), finished: (l.progress_pct ?? 0) >= 100, window: windowOf.get(l.id) ?? null }))
  return { jobs, lines, rows, settings: (settings ?? []) as StartSettingsRow[] }
}

export const startAnswersOwedIo: StartAnswersOwedIo = { fetchSources }

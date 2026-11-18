/**
 * Which job is it for? (punch list #392, step 4): the reads behind the picker. Reads only. The
 * sheet is handed these, so its render test hands it fakes.
 *
 * Whether a person may paint on a job is the tables' own rule (`on_site_can_touch_job`): they can
 * read the job under their own access, or they are on its team. Both halves are read here in two
 * batched selects, so a list of forty search hits costs two reads and not forty calls.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { requestMyFix, type MyFixFailure } from '../materials/myLocation'
import { pickerNearBox, pickerNearJobsFilter, pickerNearestPlaced, pickerPaintable, type PickerJob, type PickerLately, type PickerPlaced, type PickerPoint } from './paintedMapJobPicker'
import type { PaintPressStop } from './paintedMapPress'
import { loadPaintPressDay } from './paintedMapPressIo'

/** How far back the Lately list looks. */
export const PICKER_LATELY_DAYS = 45
/** How many search hits the picker lists. */
export const PICKER_SEARCH_MAX = 30

export type PickerLists = { todayStops: PaintPressStop[]; lately: PickerLately[]; paintable: Set<string>; todayYmd: string }

type JobRow = { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null; billing_only?: boolean | null; development_id?: string | null }

const jobOf = (r: JobRow): PickerJob => ({ id: r.id, number: r.hcp_number ?? null, name: r.job_name ?? null, address: r.job_address ?? null, billingOnly: r.billing_only ?? false, developmentId: r.development_id ?? null })

/** The jobs of these ids the person can read, with their words, and the ids whose team they are on. */
async function readJobs(ids: readonly string[], userId: string): Promise<{ visible: Map<string, PickerJob>; team: Set<string> }> {
  const wanted = [...new Set(ids.filter(Boolean))]
  if (wanted.length === 0) return { visible: new Map(), team: new Set() }
  const [jobs, team] = await Promise.all([
    withSupabaseRetry(async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, billing_only, development_id').in('id', wanted), 'load jobs to paint on'),
    withSupabaseRetry(async () => supabase.from('jobs_ledger_team_members').select('job_id').eq('user_id', userId).in('job_id', wanted), 'load job teams'),
  ])
  const visible = new Map<string, PickerJob>()
  for (const r of (jobs ?? []) as JobRow[]) if (r?.id) visible.set(r.id, jobOf(r))
  return { visible, team: new Set(((team ?? []) as Array<{ job_id: string | null }>).map((t) => t.job_id).filter((id): id is string => !!id)) }
}

/** Today's stops and the jobs clocked onto lately, with which of them the person may paint on. */
export async function loadPickerLists(userId: string, nowMs: number = Date.now()): Promise<PickerLists> {
  const todayYmd = denverCalendarDayKey(nowMs)
  const since = denverCalendarDayKey(nowMs - PICKER_LATELY_DAYS * 86_400_000)
  const [day, sessions] = await Promise.all([
    loadPaintPressDay(userId, nowMs),
    withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .select('job_ledger_id, work_date')
          .eq('user_id', userId)
          .not('job_ledger_id', 'is', null)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .gte('work_date', since)
          .order('work_date', { ascending: false })
          .limit(300),
      'load recent clock sessions',
    ),
  ])
  // The newest day on each job. The rows arrive newest first.
  const lastOn = new Map<string, string>()
  for (const r of (sessions ?? []) as Array<{ job_ledger_id: string | null; work_date: string }>) {
    if (r?.job_ledger_id && !lastOn.has(r.job_ledger_id)) lastOn.set(r.job_ledger_id, r.work_date)
  }
  const stopIds = day.todayStops.map((s) => s.job.id)
  const { visible, team } = await readJobs([...stopIds, ...lastOn.keys()], userId)
  // A stop's job as the job read has it, so a lot carries its development.
  const todayStops = day.todayStops.map((s) => ({ ...s, job: visible.get(s.job.id) ?? s.job }))
  const lately: PickerLately[] = []
  for (const [id, on] of lastOn) {
    const job = visible.get(id)
    // A job on whose team the person is, and cannot read: still theirs, with no words to show.
    if (job) lately.push({ job, lastOn: on })
    else if (team.has(id)) lately.push({ job: { id, number: null, name: null, address: null }, lastOn: on })
  }
  return { todayStops, lately, paintable: pickerPaintable(visible.keys(), team), todayYmd }
}

/** The app's job search, billing-only jobs left out, with which hits the person may paint on. */
export async function searchPickerJobs(query: string, userId: string): Promise<{ hits: PickerJob[]; paintable: Set<string> }> {
  const q = query.trim()
  if (!q) return { hits: [], paintable: new Set() }
  const rows = await withSupabaseRetry(async () => supabase.rpc('search_jobs_ledger', { search_text: q, include_billing_only: false }), 'search jobs to paint on')
  const found = ((rows ?? []) as JobRow[]).filter((r) => !!r?.id).slice(0, PICKER_SEARCH_MAX)
  const { visible, team } = await readJobs(found.map((r) => r.id), userId)
  // The search reads past the person's own access. A hit keeps the search's words, and gains its development when the person can read the job.
  const hits = found.map((r) => visible.get(r.id) ?? jobOf(r))
  return { hits, paintable: pickerPaintable(visible.keys(), team) }
}

/** Where the phone is, read once on the press. Rejects with why it gave no place. */
export function locateForPicker(): Promise<PickerPoint> {
  return new Promise((resolve, reject) => {
    requestMyFix(
      (p) => resolve({ lat: p.lat, lng: p.lng }),
      (why: MyFixFailure) => reject(new PickerNoFix(why)),
    )
  })
}

/** The phone gave no place. `why` picks the words. */
export class PickerNoFix extends Error {
  constructor(readonly why: MyFixFailure) {
    super(why)
    this.name = 'PickerNoFix'
  }
}

/**
 * The jobs near a point: the addresses the app has placed within reach (`address_geocodes`), then
 * the jobs at those addresses that the person can read. The point itself is sent nowhere but into
 * the two filters, and nothing is kept.
 */
export async function loadPickerNear(me: PickerPoint): Promise<{ nearest: Array<{ key: string; meters: number }>; jobs: PickerJob[]; paintable: Set<string> }> {
  const box = pickerNearBox(me)
  const placedRows = await withSupabaseRetry(
    async () => supabase.from('address_geocodes').select('address_normalized, lat, lng').is('geocode_error', null).gte('lat', box.latMin).lte('lat', box.latMax).gte('lng', box.lngMin).lte('lng', box.lngMax).limit(800),
    'load placed addresses near me',
  )
  const placed: PickerPlaced[] = ((placedRows ?? []) as Array<{ address_normalized: string; lat: number; lng: number }>).map((r) => ({ key: r.address_normalized, lat: r.lat, lng: r.lng }))
  const nearest = pickerNearestPlaced(me, placed)
  const filter = pickerNearJobsFilter(nearest.map((n) => n.key))
  if (!filter) return { nearest, jobs: [], paintable: new Set() }
  const rows = await withSupabaseRetry(
    async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, billing_only, development_id').or(filter).eq('billing_only', false).order('created_at', { ascending: false }).limit(120),
    'load jobs near me',
  )
  const jobs = ((rows ?? []) as JobRow[]).filter((r) => !!r?.id).map(jobOf)
  // Every job here was read under the person's own access, so each is theirs to paint on.
  return { nearest, jobs, paintable: new Set(jobs.map((j) => j.id)) }
}

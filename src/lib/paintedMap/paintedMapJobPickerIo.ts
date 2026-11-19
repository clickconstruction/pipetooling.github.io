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
import { PICKER_SOON_DAYS, pickerDayPlus, pickerNearBox, pickerNearJobsFilter, pickerNearestPlaced, pickerPaintable, pickerPlan, type PickerJob, type PickerLast, type PickerPlaced, type PickerPoint, type PickerSoon } from './paintedMapJobPicker'
import type { PaintPressStop } from './paintedMapPress'
import { loadPaintOfficeJobId, loadPaintPressDay } from './paintedMapPressIo'

/** How many of the person's newest clocks are read for Your last jobs. There is no day past which a clock is too old. */
export const PICKER_CLOCKS_READ = 300
/** How many of their days on the schedule, from two weeks ahead back. The days ahead are Coming up, the days behind are last jobs. */
export const PICKER_BLOCKS_READ = 260
/** How many of the newest changes they made to a job in the app (the job's activity record). */
export const PICKER_CHANGES_READ = 200
/** How many of the teams they joined last. */
export const PICKER_TEAMS_READ = 60
/** How many search hits the picker lists. */
export const PICKER_SEARCH_MAX = 30

export type PickerLists = { todayStops: PaintPressStop[]; soon?: PickerSoon[]; last: PickerLast[]; paintable: Set<string>; todayYmd: string }

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

/**
 * Today's stops, the jobs coming up and the person's last jobs, with which of them the person may
 * paint on. A last job is one they clocked onto, one that was on their schedule on a past day,
 * one they changed in the app, or one whose team they are on. The four are read at once, each by
 * an index on the person. One read of the schedule gives both the days ahead and the days behind.
 * The first `PICKER_LAST_READ` jobs in the list's own order are then read whole, in the two
 * batched selects. `last` comes back in that order, which `pickerSections` keeps.
 *
 * The changes are the job's activity record, read by who made them. That read is the one that may
 * fail by itself, since its rule is checked a row at a time, and the list is honest without it.
 */
export async function loadPickerLists(userId: string, nowMs: number = Date.now()): Promise<PickerLists> {
  const todayYmd = denverCalendarDayKey(nowMs)
  const [day, officeJobId, sessions, blocks, teams, changes] = await Promise.all([
    loadPaintPressDay(userId, nowMs),
    loadPaintOfficeJobId(),
    withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .select('job_ledger_id, work_date')
          .eq('user_id', userId)
          .not('job_ledger_id', 'is', null)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .order('work_date', { ascending: false })
          .limit(PICKER_CLOCKS_READ),
      'load clock sessions for last jobs',
    ),
    withSupabaseRetry(
      async () =>
        supabase
          .from('job_schedule_blocks')
          .select('job_id, work_date')
          .eq('assignee_user_id', userId)
          .lte('work_date', pickerDayPlus(todayYmd, PICKER_SOON_DAYS))
          .order('work_date', { ascending: false })
          .limit(PICKER_BLOCKS_READ),
      'load schedule for last jobs',
    ),
    withSupabaseRetry(
      async () => supabase.from('jobs_ledger_team_members').select('job_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(PICKER_TEAMS_READ),
      'load job teams for last jobs',
    ),
    withSupabaseRetry(
      async () => supabase.from('job_activity_events').select('job_id, occurred_at').eq('actor_user_id', userId).order('occurred_at', { ascending: false }).limit(PICKER_CHANGES_READ),
      'load changed jobs for last jobs',
    ).catch(() => null),
  ])
  /** A moment as its day on the company's calendar. */
  const dayOf = (iso: string | null): string | null => {
    const at = iso ? Date.parse(iso) : Number.NaN
    return Number.isFinite(at) ? denverCalendarDayKey(at) : null
  }
  const stopIds = day.todayStops.map((s) => s.job.id)
  const { order, soon: ahead } = pickerPlan({
    todayYmd,
    officeJobId,
    todayJobIds: stopIds,
    clocks: ((sessions ?? []) as Array<{ job_ledger_id: string | null; work_date: string }>).map((r) => ({ jobId: r.job_ledger_id, day: r.work_date })),
    blocks: ((blocks ?? []) as Array<{ job_id: string | null; work_date: string }>).map((r) => ({ jobId: r.job_id, day: r.work_date })),
    changes: ((changes ?? []) as Array<{ job_id: string | null; occurred_at: string | null }>).map((r) => ({ jobId: r.job_id, day: dayOf(r.occurred_at) })),
    // A team's day is the day the person joined it. It places the job in the list and is never shown.
    teams: ((teams ?? []) as Array<{ job_id: string | null; created_at: string | null }>).map((r) => ({ jobId: r.job_id, day: dayOf(r.created_at) })),
  })
  const { visible, team } = await readJobs([...stopIds, ...ahead.map((a) => a.jobId), ...order.map((m) => m.jobId)], userId)
  // A stop's job as the job read has it, so a lot carries its development. The office job keeps its mark.
  const todayStops = day.todayStops.map((s) => ({ ...s, job: { ...(visible.get(s.job.id) ?? s.job), office: s.job.office } }))
  /** A job on whose team the person is, and cannot read: still theirs, with no words to show. */
  const jobFor = (id: string): PickerJob | null => visible.get(id) ?? (team.has(id) ? { id, number: null, name: null, address: null } : null)
  const soon: PickerSoon[] = []
  for (const a of ahead) {
    const job = jobFor(a.jobId)
    if (job) soon.push({ job, day: a.day })
  }
  const last: PickerLast[] = []
  for (const m of order) {
    const job = jobFor(m.jobId)
    if (job) last.push({ job, how: m.how, day: m.day, there: m.there ?? null })
  }
  return { todayStops, soon, last, paintable: pickerPaintable(visible.keys(), team), todayYmd }
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

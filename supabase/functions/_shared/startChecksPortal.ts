/**
 * Before we start on the GC's page (punch list #382, PR 9): the reads and the writes behind it, as the service role.
 * `customer-portal` reads what the page may show (`loadGcPageJobs`), and `submit-portal-request` takes what it sends
 * back: a photo's upload slot (`gcPagePhotoSign`) and the answer itself (`gcPageAnswer`). The rules are the app's own
 * kernel, from the edge's copy: `gcPage.ts` decides what shows, and an answer is held against what the page shows at
 * that moment, so a page can never tick a bullet it is not shown.
 *
 * Their press is a yes on their word in the customer's name, source `portal`. With a photo it is a yes with their
 * photo, kept in `start-check-photos` under the job's folder. A day they give is one more row beside the days before.
 * Nothing here writes a bullet of ours, a decision, a window, or a line to Dispatch.
 */
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from './appTimeZone.ts'
import {
  GC_PAGE_HOW,
  GC_PAGE_MAX_ANSWERS_PER_HOUR,
  GC_PAGE_MAX_DAYS_PER_HOUR,
  GC_PAGE_MAX_PHOTO_SIGNS_PER_HOUR,
  GC_PAGE_PHOTO_MAX_BYTES,
  GC_PAGE_PHOTO_TYPES,
  gcPageAnswerProblem,
  gcPagePhotoPath,
  gcPagePhotoPathOk,
  gcPageStages,
  parseGcPageAnswer,
  type GcPageStage,
} from './gcKernels/lib/startChecks/gcPage.ts'
import type { StageLine, StartCheckRows } from './gcKernels/lib/startChecks/startCheckRows.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export const START_CHECK_PHOTO_BUCKET = 'start-check-photos'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const BULLET_COLS = 'id, job_id, fixture_id, sort_order, words, waits_on, wants_photo, shown_to_gc, by_day, reads, hand_ok, hand_ok_at, hand_ok_by_name, template_id, removed_at, created_at'
const MARK_COLS = 'id, bullet_id, job_id, know, who_name, how, said_on, source, photo_storage_path, photo_file_name, taken_back_at, created_at'
const DECISION_COLS = 'id, job_id, fixture_id, kind, decided_on, open_then, start_then, hold_until, by_name, taken_back_at, created_at'

/**
 * What the page may show, by job: only the jobs whose own switch is on. The caller has already held each job to the
 * viewer (its GC, sharing its stage dates), so `sharesStageDates` is true for every id handed in. A failed read shows
 * nothing, and the rest of the page still draws.
 */
export async function loadGcPageJobs(admin: Admin, sharingJobIds: readonly string[]): Promise<Map<string, GcPageStage[]>> {
  const out = new Map<string, GcPageStage[]>()
  if (sharingJobIds.length === 0) return out
  try {
    const { data: on } = await admin.from('start_check_settings').select('job_id').in('job_id', sharingJobIds).eq('shows_on_gc_page', true)
    const ids = ((on ?? []) as Array<{ job_id: string }>).map((r) => r.job_id)
    if (ids.length === 0) return out
    const [fx, wn, bl, mk, dc] = await Promise.all([
      admin.from('jobs_ledger_fixtures').select('id, job_id, name, sequence_order, stage_kind, count, line_unit_price, progress_pct').in('job_id', ids).in('stage_kind', ['order', 'any']),
      admin.from('job_stage_windows').select('job_id, fixture_id, window_start, window_end').in('job_id', ids),
      admin.from('start_check_bullets').select(BULLET_COLS).in('job_id', ids).is('removed_at', null),
      admin.from('start_check_marks').select(MARK_COLS).in('job_id', ids).is('taken_back_at', null),
      admin.from('start_check_decisions').select(DECISION_COLS).in('job_id', ids).is('taken_back_at', null),
    ])
    const windowOf = new Map<string, [string, string]>()
    for (const w of (wn.data ?? []) as Array<{ fixture_id: string; window_start: string | null; window_end: string | null }>) if (w.window_start) windowOf.set(w.fixture_id, [w.window_start, w.window_end ?? w.window_start])
    // A stage line is a priced Order or Any line, as the app's own stage read has it.
    const lines: StageLine[] = ((fx.data ?? []) as Array<Record<string, unknown>>)
      .filter((f) => (Number(f.count) || 0) * (Number(f.line_unit_price) || 0) > 0)
      .map((f) => ({ fixtureId: String(f.id), jobId: String(f.job_id), name: (typeof f.name === 'string' ? f.name.trim() : '') || 'Stage', order: Number(f.sequence_order) || 0, finished: (Number(f.progress_pct) || 0) >= 100, window: windowOf.get(String(f.id)) ?? null }))
    for (const jobId of ids) {
      const of = <T extends { job_id: string }>(rows: unknown): T[] => ((rows ?? []) as T[]).filter((r) => r.job_id === jobId)
      const rows: StartCheckRows = { bullets: of(bl.data), marks: of(mk.data), asks: [], theirDays: [], decisions: of(dc.data), arrivals: [] }
      const stages = gcPageStages(lines.filter((l) => l.jobId === jobId), rows, { sharesStageDates: true, showsWhatWeNeed: true }, calendarYmdInAppTzFromIso)
      if (stages.length) out.set(jobId, stages)
    }
  } catch (e) {
    console.error('start checks on the GC page', e)
  }
  return out
}

export type GcPageReply = { status: number; json: Record<string, unknown> }
const refuse = (status: number, error: string): GcPageReply => ({ status, json: { error } })
const GONE = 'This is not on your page any more. Please open the page again.'

/** The job, held to the link: its GC, sharing its stage dates, on a link that may see a GC's side. */
async function jobOnPage(admin: Admin, link: { customer_id: string; audience: string }, jobId: string | null): Promise<boolean> {
  if (!jobId || !UUID.test(jobId) || (link.audience !== 'gc' && link.audience !== 'all')) return false
  const { data: job } = await admin.from('jobs_ledger').select('id, gc_customer_id, gc_shares_stage_dates').eq('id', jobId).maybeSingle()
  return !!job && job.gc_customer_id === link.customer_id && job.gc_shares_stage_dates === true
}

const hourAgo = (): string => new Date(Date.now() - 60 * 60 * 1000).toISOString()

/**
 * A slot to upload one photo into, for a bullet the page still needs. The page uploads the bytes straight to the
 * bucket, which holds them to its own size and kinds, and names the path in its answer.
 */
export async function gcPagePhotoSign(admin: Admin, link: { customer_id: string; audience: string }, jobId: string | null, body: Record<string, unknown>): Promise<GcPageReply> {
  if (!(await jobOnPage(admin, link, jobId))) return refuse(404, GONE)
  const fixtureId = typeof body.fixtureId === 'string' ? body.fixtureId : ''
  const bulletId = typeof body.bulletId === 'string' ? body.bulletId : ''
  const bytes = Number(body.bytes) || 0
  const type = typeof body.type === 'string' ? body.type : ''
  if (!UUID.test(bulletId) || bytes <= 0 || bytes > GC_PAGE_PHOTO_MAX_BYTES || !GC_PAGE_PHOTO_TYPES.includes(type)) return refuse(400, 'That photo is too large or not a picture. Please try another.')
  const stage = (await loadGcPageJobs(admin, [jobId as string])).get(jobId as string)?.find((s) => s.fixtureId === fixtureId)
  if (!stage || !stage.need.some((b) => b.id === bulletId)) return refuse(404, GONE)
  const { data: files } = await admin.storage.from(START_CHECK_PHOTO_BUCKET).list(jobId, { limit: 200, search: 'page-', sortBy: { column: 'created_at', order: 'desc' } })
  const recent = ((files ?? []) as Array<{ created_at?: string | null }>).filter((f) => (f.created_at ?? '') >= hourAgo()).length
  if (recent >= GC_PAGE_MAX_PHOTO_SIGNS_PER_HOUR) return refuse(429, 'That is a lot of photos in one hour. Please try again later.')
  const path = gcPagePhotoPath(jobId as string, bulletId, Date.now())
  const { data: signed, error } = await admin.storage.from(START_CHECK_PHOTO_BUCKET).createSignedUploadUrl(path, { upsert: true })
  if (error || !signed?.signedUrl) return refuse(500, 'The photo could not be taken just now. Please try once more.')
  return { status: 200, json: { ok: true, bucket: START_CHECK_PHOTO_BUCKET, path, signedUrl: signed.signedUrl } }
}

/** One send from their page: the bullets they say are ready, a photo for any of them, a day it will be ready. */
export async function gcPageAnswer(admin: Admin, link: { customer_id: string; audience: string }, jobId: string | null, body: Record<string, unknown>): Promise<GcPageReply> {
  if (!(await jobOnPage(admin, link, jobId))) return refuse(404, GONE)
  const job = jobId as string
  const parsed = parseGcPageAnswer(body)
  if (!parsed.ok) return refuse(400, parsed.why)
  const answer = parsed.answer
  const today = todayYmdInAppTz()
  const stage = (await loadGcPageJobs(admin, [job])).get(job)?.find((s) => s.fixtureId === answer.fixtureId)
  const problem = gcPageAnswerProblem(answer, stage, today)
  if (problem) return refuse(stage ? 400 : 404, problem)
  for (const p of answer.photos) if (!gcPagePhotoPathOk(p.path, job, p.bulletId)) return refuse(400, 'That photo could not be read.')

  const [{ count: marksNow }, { count: daysNow }] = await Promise.all([
    admin.from('start_check_marks').select('id', { count: 'exact', head: true }).eq('job_id', job).eq('source', 'portal').gte('created_at', hourAgo()),
    admin.from('start_check_their_days').select('id', { count: 'exact', head: true }).eq('job_id', job).eq('source', 'portal').gte('created_at', hourAgo()),
  ])
  if ((marksNow ?? 0) >= GC_PAGE_MAX_ANSWERS_PER_HOUR || (answer.readyDay && (daysNow ?? 0) >= GC_PAGE_MAX_DAYS_PER_HOUR)) return refuse(429, 'That is a lot in one hour. Please try again later, or call our office.')

  const { data: customer } = await admin.from('customers').select('name').eq('id', link.customer_id).maybeSingle()
  const who = (typeof customer?.name === 'string' ? customer.name.trim() : '').slice(0, 120) || 'The customer'

  // A photo is only a yes once its bytes are in the bucket, under this job's folder.
  const photoOf = new Map<string, (typeof answer.photos)[number]>()
  if (answer.photos.length) {
    const { data: files } = await admin.storage.from(START_CHECK_PHOTO_BUCKET).list(job, { limit: 200, search: 'page-' })
    const sizes = new Map(((files ?? []) as Array<{ name: string; metadata?: { size?: number } | null }>).map((f) => [`${job}/${f.name}`, Number(f.metadata?.size) || 0]))
    for (const p of answer.photos) {
      const size = sizes.get(p.path)
      if (!size || size > GC_PAGE_PHOTO_MAX_BYTES) return refuse(400, 'That photo did not arrive. Please add it once more.')
      photoOf.set(p.bulletId, { ...p, bytes: size })
    }
  }

  const { data: live } = await admin.from('start_check_marks').select('id, bullet_id').eq('job_id', job).is('taken_back_at', null)
  const liveOf = new Map(((live ?? []) as Array<{ id: string; bullet_id: string }>).map((m) => [m.bullet_id, m.id]))
  const now = new Date().toISOString()
  let kept = 0
  for (const bulletId of new Set([...answer.ready, ...photoOf.keys()])) {
    const photo = photoOf.get(bulletId)
    const standing = liveOf.get(bulletId)
    // Their word already stands and no photo came: nothing new to keep.
    if (standing && !photo) continue
    if (standing) {
      const back = await admin.from('start_check_marks').update({ taken_back_at: now, taken_back_by_name: who }).eq('id', standing)
      if (back.error) continue
    }
    const row = { bullet_id: bulletId, job_id: job, know: photo ? 'photo' : 'word', who_name: who, how: GC_PAGE_HOW, said_on: today, source: 'portal', by_name: who, ...(photo ? { photo_storage_path: photo.path, photo_file_name: photo.fileName, photo_bytes: photo.bytes, photo_taken_at: now } : {}) }
    const { error } = await admin.from('start_check_marks').insert(row)
    // One yes stands on a bullet at a time: a tick that lost a race to the office's is not an error.
    if (!error) kept += 1
    else console.error('a yes from the GC page', error)
  }
  if (answer.readyDay) {
    const { error } = await admin.from('start_check_their_days').insert({ job_id: job, fixture_id: answer.fixtureId, ready_day: answer.readyDay, said_on: today, who_name: who, how: GC_PAGE_HOW, source: 'portal', by_name: who })
    if (error) return refuse(500, 'That day could not be kept. Please try once more.')
  }
  return { status: 200, json: { ok: true, kept, readyDay: answer.readyDay } }
}

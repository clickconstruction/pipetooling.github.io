// A job's last day of work from the dev seat (v2.7206 / 0.84.0 — the owner's ask of 2026-11-13, after three jobs read
// lien gone because nobody had told the app when the work ended).
//
// plan_last_work_day → apply_last_work_day is the Lien window's own save (src/components/jobs/LienLastWorkDayLine.tsx):
// one PATCH on jobs_ledger under RLS — lien_last_work_on, lien_last_work_note, lien_last_work_set_at now and
// lien_last_work_set_by the caller; clear nulls the day, the moment and the person and blanks the note, back to the clock
// hours or the job's creation. The window's rules hold, because the dry run runs the window's own kernels from the
// mirror (gcKernels/lib/jobs/lienLastWorkDay.ts and lienLastWorkDayPreview.ts): a day after today or earlier than the
// clock hours is refused, the day the job already reads is refused, a reason is required as the window's Set the day
// requires it, and a day far from the clock hours (the window's amber second look, Set the day anyway) is refused until
// the ask carries anyway: true. The plan replies with the window's own table: the months the notice names, the
// § 53.056 day of the last month, the § 53.052 affidavit day and the § 53.158 suit day, before and after.
// Clock hours and pay are never touched. No wrapper RPC and no migration: the dry run is this server's read of the
// job, its property's kind, its approved clock months and the months its live notices name, hashed with the payload.
// Pure: no env reads, no network; the test runs a recording fake (src/lib/devMcp/devMcpLastWorkDay.test.ts).

import { LIEN_LAST_WORK_CLEAR, lienLastWorkDay, lienLastWorkDayPatch } from './gcKernels/lib/jobs/lienLastWorkDay.ts'
import { lienLastWorkPreview, lienLastWorkDayWords, type LienLastWorkPreviewRow } from './gcKernels/lib/jobs/lienLastWorkDayPreview.ts'
import { jobLabelOf } from './devMcpJobMarks.ts'

export const LAST_WORK_DAY_VERBS = ['plan_last_work_day', 'apply_last_work_day'] as const
export type LastWorkDayVerb = (typeof LAST_WORK_DAY_VERBS)[number]
export function isLastWorkDayVerb(name: string): name is LastWorkDayVerb {
  return (LAST_WORK_DAY_VERBS as readonly string[]).includes(name)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
/** The reason is one line on the job, as the window's box takes it. */
export const LAST_WORK_REASON_MAX = 500
/** One read of clock sessions, and how many reads a job's months may take (a job past this many sessions keeps its newest months). */
export const CLOCK_PAGE = 1000
export const CLOCK_PAGES_MAX = 20

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export type LastWorkDayPayload =
  | { action: 'last_work_day'; job_id: string; last_work_on: string; reason: string; anyway?: true }
  | { action: 'last_work_day'; job_id: string; clear: true }

export type LastWorkDayInput = { ok: true; p: LastWorkDayPayload; target: string; planHash: string | null } | { ok: false; error: string }

const DAY_SHAPE = `needs day — { job_id (a jobs_ledger.id — find_job), last_work_on (YYYY-MM-DD, the last day anyone worked on the job), reason (one line, under ${LAST_WORK_REASON_MAX}: what was done that day, and why the hours do not show it), anyway? (true, only for a day the plan called far from the clock hours) } or { job_id, clear: true } to go back to the clock hours or the job's creation.`

/** plan_last_work_day / apply_last_work_day's input, shaped. */
export function lastWorkDayInput(verb: LastWorkDayVerb, input: Json): LastWorkDayInput {
  const src = obj(input.day)
  const shape = `${verb} ${DAY_SHAPE}`
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const jobId = str('job_id').toLowerCase()
  if (!UUID_RE.test(jobId)) return { ok: false, error: shape }
  let p: LastWorkDayPayload
  if (src.clear === true) {
    if (str('last_work_on') || str('reason')) return { ok: false, error: `${verb}: clear: true takes the day off and goes with no day and no reason.` }
    p = { action: 'last_work_day', job_id: jobId, clear: true }
  } else {
    const day = str('last_work_on')
    const reason = str('reason')
    if (!YMD_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return { ok: false, error: `${verb}: last_work_on is YYYY-MM-DD, the last day anyone worked on the job. ${DAY_SHAPE}` }
    if (!reason) return { ok: false, error: `${verb}: reason is required, as the Lien window's Set the day requires it: what was done that day, and why the hours do not show it.` }
    if (reason.length > LAST_WORK_REASON_MAX) return { ok: false, error: `${verb}: reason is one line, under ${LAST_WORK_REASON_MAX} characters.` }
    if (src.anyway !== undefined && src.anyway !== true) return { ok: false, error: `${verb}: anyway is true or left out.` }
    p = { action: 'last_work_day', job_id: jobId, last_work_on: day, reason, ...(src.anyway === true ? { anyway: true as const } : {}) }
  }
  let planHash: string | null = null
  if (verb.startsWith('apply_')) {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value ${verb.replace('apply_', 'plan_')} replied with.` }
    planHash = h
  }
  return { ok: true, p, target: jobId, planHash }
}

// ── the world and the dry run ────────────────────────────────────────────────────────────────────────────────────

export type LastWorkReads = { rows(table: string, query: string): Promise<Json[]> }

export type LastWorkJobRow = {
  id: string
  job_name: string | null
  click_number: string | null
  hcp_number: string | null
  status: string | null
  created_at: string | null
  customer_address_id: string | null
  last_work_date: string | null
  lien_last_work_on: string | null
  lien_last_work_note: string | null
  lien_last_work_set_at: string | null
  lien_last_work_set_by: string | null
}
export const LAST_WORK_JOB_COLS = 'id,job_name,click_number,hcp_number,status,created_at,customer_address_id,last_work_date,lien_last_work_on,lien_last_work_note,lien_last_work_set_at,lien_last_work_set_by'

/** What the window's confirm reads before it draws: the job, its property's kind, its approved clock months, the months its live notices name. */
export type LastWorkWorld = {
  job: LastWorkJobRow | null
  /** 'residential' | 'non_residential' | '' — the property record's own word; '' when the job has no record or no kind. */
  propertyKind: string
  /** YYYY-MM, oldest first: the months with an approved clock session (the SQL readers' rule: approved, not rejected, not revoked). */
  clockMonths: string[]
  /** YYYY-MM: the months a live § 53.056 notice on the job names; they never move. */
  noticedMonths: string[]
}

export async function readLastWorkWorld(reads: LastWorkReads, jobId: string): Promise<LastWorkWorld> {
  const job = ((await reads.rows('jobs_ledger', `select=${LAST_WORK_JOB_COLS}&id=eq.${jobId}`))[0] as LastWorkJobRow | undefined) ?? null
  if (!job) return { job: null, propertyKind: '', clockMonths: [], noticedMonths: [] }
  let propertyKind = ''
  if (job.customer_address_id) {
    const rec = (await reads.rows('customer_addresses', `select=property_kind&id=eq.${job.customer_address_id}`))[0]
    propertyKind = typeof rec?.property_kind === 'string' ? rec.property_kind.trim() : ''
  }
  // Paged, newest first: a long job has more approved sessions than one read hands back.
  const months = new Set<string>()
  for (let page = 0; page < CLOCK_PAGES_MAX; page++) {
    const rows = await reads.rows('clock_sessions', `select=work_date&job_ledger_id=eq.${jobId}&approved_at=not.is.null&rejected_at=is.null&revoked_at=is.null&order=work_date.desc,id.desc&limit=${CLOCK_PAGE}&offset=${page * CLOCK_PAGE}`)
    for (const r of rows) {
      const m = typeof r.work_date === 'string' ? r.work_date.slice(0, 7) : ''
      if (/^\d{4}-\d{2}$/.test(m)) months.add(m)
    }
    if (rows.length < CLOCK_PAGE) break
  }
  const filings = await reads.rows('job_lien_filings', `select=months_covered&job_id=eq.${jobId}&kind=eq.notice_53_056&voided_at=is.null`)
  const noticed = new Set<string>()
  for (const f of filings) for (const m of Array.isArray(f.months_covered) ? f.months_covered : []) if (typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) noticed.add(m)
  return { job, propertyKind, clockMonths: [...months].sort(), noticedMonths: [...noticed].sort() }
}

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/** The columns a save writes, as the window's `lienLastWorkDayPatch` and `LIEN_LAST_WORK_CLEAR` write them. */
export function lastWorkDayPatch(p: LastWorkDayPayload, who: { userId: string }, nowIso: string): Json {
  if ('clear' in p) return { ...LIEN_LAST_WORK_CLEAR }
  return { ...lienLastWorkDayPatch(p.last_work_on, p.reason, who.userId, nowIso) }
}

const NOT_DONE = 'Clock hours and pay are not changed. The day sets the lien months only. No notice or affidavit is drafted, approved, sent or recorded: a month this opens is the Lien desk’s to work.'
const SHOWS = 'the job’s Lien window (Last work and Last day of work) and the Lien desk’s Notices, Affidavits and Deadlines, on their next read'
const SOURCE_ROW_WORDS: Record<'hand' | 'hours' | 'created', string> = { hand: 'set by hand', hours: 'clock hours', created: "the job's creation" }

/**
 * What the plan says and what the hash commits to: the job as it stands (label, status, the day it reads and where
 * that comes from, the four hand-set columns) and the day as it will read, with the window's own table of dates.
 * Refuses a job not visible, whatever the window refuses (a day after today, earlier than the clock hours, or the day
 * the job already reads), a far day without anyway: true, anyway: true on a day that is not far, and a clear on a job
 * whose day is not set by hand.
 */
export function lastWorkDayDryRun(p: LastWorkDayPayload, world: LastWorkWorld, who: { userId: string }, todayYmd: string): DryRun {
  const job = world.job
  if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  const label = jobLabelOf(job)
  const now = lienLastWorkDay(job)
  const before = { reads: now.day, from: now.sourceWords, lien_last_work_on: job.lien_last_work_on, lien_last_work_note: job.lien_last_work_note ?? '', lien_last_work_set_at: job.lien_last_work_set_at, lien_last_work_set_by: job.lien_last_work_set_by }
  const head = { action: 'last_work_day', job: { id: job.id, label, status: job.status }, property_kind: world.propertyKind || 'not on record', clock_months: world.clockMonths, noticed_months: world.noticedMonths }
  const base = { currentDay: now.day, currentSource: now.source, lastSessionDay: job.last_work_date, clockMonths: world.clockMonths, noticedMonths: world.noticedMonths, propertyKind: world.propertyKind, todayYmd }

  if ('clear' in p) {
    if (!job.lien_last_work_on) return { ok: false, refused: `${label}'s last day of work is not set by hand (it reads ${now.day ? lienLastWorkDayWords(now.day, todayYmd) : 'no day'}, ${now.sourceWords}). Nothing to clear.` }
    // Without the hand-set day the job reads its clock hours, else its creation: the table is the window's, drawn toward that day.
    const back = lienLastWorkDay({ ...job, lien_last_work_on: null })
    const fallen = back.source === 'hours' ? 'clock hours' : "the job's creation"
    const preview = back.day ? lienLastWorkPreview({ ...base, candidate: back.day }) : null
    const dates: LienLastWorkPreviewRow[] = (preview?.rows ?? []).map((r, i) => (i === 0 ? { ...r, after: back.day ? `${lienLastWorkDayWords(back.day, todayYmd)} · ${fallen}` : 'none yet', changed: true } : { ...r, changed: r.after !== r.before }))
    return {
      ok: true,
      reply: { ...head, before, after: { reads: back.day, from: back.sourceWords, ...lastWorkDayPatch(p, who, 'now') }, says: `${label} goes back to ${back.day ? `${lienLastWorkDayWords(back.day, todayYmd)}, ${back.sourceWords}` : 'no day'}. The reason on the job is taken off with the day.`, dates, not_done: NOT_DONE, shows: SHOWS },
    }
  }

  const preview = lienLastWorkPreview({ ...base, candidate: p.last_work_on })
  if (preview.verdict === 'refused') {
    const sameDay = p.last_work_on === now.day && now.source === 'hand'
    return { ok: false, refused: `${label}: ${preview.shiftWords} ${preview.sayWords}${sameDay ? ' The window changes a reason the same way: clear the day, then set it again.' : ''}` }
  }
  if (preview.verdict === 'look' && !p.anyway) {
    return { ok: false, refused: `${label}: ${preview.shiftWords} ${preview.sayWords} The Lien window asks for a second look here (its button reads Set the day anyway). Say this to the person who knows the day; once they confirm it, plan again with anyway: true.` }
  }
  if (preview.verdict !== 'look' && p.anyway) return { ok: false, refused: `${label}: anyway: true is for a day the plan called far from the clock hours. This day is not; plan again without it.` }
  return {
    ok: true,
    reply: {
      ...head,
      before,
      after: { reads: p.last_work_on, from: SOURCE_ROW_WORDS.hand, ...lastWorkDayPatch(p, who, 'now') },
      verdict: preview.verdict === 'look' ? 'far from the clock hours, set anyway' : 'fine',
      shift: preview.shiftWords,
      says: preview.sayWords,
      dates: preview.rows,
      not_done: NOT_DONE,
      shows: SHOWS,
    },
  }
}

/** The apply's reply. */
export function lastWorkDayAppliedWords(p: LastWorkDayPayload, label: string, result: { ok: true; detail?: Json } | { ok: false; error: string }): Json {
  if (!result.ok) return { action: p.action, job: label, ok: false, error: result.error }
  return {
    action: p.action,
    job: label,
    ok: true,
    ...result.detail,
    next: 'clear' in p
      ? `${label}'s last day of work is no longer set by hand; the lien months follow the clock hours or the job's creation again.`
      : `${label}'s last day of work reads ${p.last_work_on}, set by hand. The lien months follow it; clock hours are untouched. list_lien_notice_months and list_lien_affidavit_windows (call_read) show what the Lien desk now asks for; nothing was drafted or sent.`,
  }
}

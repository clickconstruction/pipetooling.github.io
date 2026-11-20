/**
 * Before we start (punch list #382, PR 4): the reads and the writes behind a stage's list. The tables and their
 * rules are `20261120033820_start_checks.sql`: the desk reads and writes a job's rows under its own row security, our
 * days are read through `start_check_windows`, and the stage lines through `list_job_stage_progress`, the read the
 * stage checklist uses, since a field role reads no line item. A window is written the way Jobs → Subs writes one.
 * Nothing here sends anything to anyone.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import type { Know, UsReads } from './startChecks'
import {
  NO_START_ROWS,
  type StageLine,
  type StartArrivalRow,
  type StartAskRow,
  type StartBulletRow,
  type StartCheckRows,
  type StartDecisionRow,
  type StartMarkRow,
  type StartSettingsRow,
  type StartStageKind,
  type StartTemplateRow,
  type StartTheirDayRow,
} from './startCheckRows'

// The tables are younger than the generated types; the types PR that follows the push removes this cast.
const db = supabase as unknown as SupabaseClient

export const START_CHECK_PHOTOS_BUCKET = 'start-check-photos'

/** Who is pressing: their login and the name the app prints. */
export type StartWho = { userId: string | null; name: string }

export type NewBullet = { fixtureId: string; jobId: string; order: number; words: string; on: 'them' | 'us'; wantsPhoto: boolean; reads: UsReads | null; templateId: string | null }
/** `reads` is a bullet of ours alone: where the app reads it from, or `hand` for a tick. */
export type BulletPatch = Partial<{ words: string; wantsPhoto: boolean; shownToGc: boolean; byDay: string | null; reads: UsReads }>
export type NewYes = { id?: string; bulletId: string; jobId: string; know: Know; who: string; how: string; day: string; photo?: StartPhoto | null }
export type YesPatch = Partial<{ know: Know; who: string; how: string; day: string }>
export type StartPhoto = { path: string; fileName: string; bytes: number; takenAt: string }
/** How an ask went out. */
export type AskHow = 'text' | 'email' | 'phone'
/** One ask to keep: one message to one person, a row for each bullet it covers, or a hold note that names a stage alone. */
export type NewAsk = { kind: 'ask' | 'hold_note'; how: AskHow; to: string; day: string; rows: ReadonlyArray<{ jobId: string; fixtureId: string; bulletId: string | null }> }
export type NewTemplate = { kind: StartStageKind; order: number; words: string; on: 'them' | 'us'; wantsPhoto: boolean; reads: UsReads | null }

export interface StartChecksIo {
  /** Whether the signed-in person is on the job's desk: may read and write its list. */
  onDesk: (jobId: string) => Promise<boolean>
  /** A job's stage lines in order, each with our window when the office has planned one. */
  readLines: (jobId: string) => Promise<StageLine[]>
  readRows: (jobIds: readonly string[]) => Promise<StartCheckRows>
  readSettings: (at: { jobId: string; developmentId: string | null }) => Promise<{ site: StartSettingsRow | null; job: StartSettingsRow | null }>
  readTemplates: () => Promise<StartTemplateRow[]>
  /** The GC's contact on the job's bid, as the bid names them. Null when the bid names nobody or cannot be read. */
  readGcContact: (bidId: string) => Promise<string | null>
  addBullets: (bullets: readonly NewBullet[], who: StartWho) => Promise<void>
  changeBullet: (id: string, patch: BulletPatch) => Promise<void>
  removeBullet: (id: string, who: StartWho) => Promise<void>
  /** A bullet of ours that reads hand: marked done, or not done. */
  tickByHand: (id: string, done: boolean, who: StartWho) => Promise<void>
  /** A yes on a bullet on them. A yes that stood is taken back first, and stays as a row. */
  sayYes: (yes: NewYes, standing: string | null, who: StartWho) => Promise<void>
  changeYes: (markId: string, patch: YesPatch) => Promise<void>
  takeBackYes: (markId: string, who: StartWho) => Promise<void>
  giveTheirDay: (day: { jobId: string; fixtureId: string; readyDay: string; saidOn: string; who: string; how: string }, who: StartWho) => Promise<void>
  /** Every ask is kept: the day and how. One press is one batch, however many stages it covers. */
  keepAsk: (ask: NewAsk, who: StartWho) => Promise<void>
  /** Go or Hold, through the one door that keeps the name. A Hold moves our window to the day picked, its length kept. */
  decide: (fixtureId: string, kind: 'go' | 'hold', openThen: readonly string[], holdUntil: string | null) => Promise<void>
  /** Take a Go or a Hold back. The decision stays as a row. */
  takeBackDecision: (decisionId: string) => Promise<void>
  /** The days of notice on a site's row or a job's own. Null puts the default back. */
  setNotice: (home: { developmentId: string } | { jobId: string }, days: number | null, who: StartWho) => Promise<void>
  /** The job's second switch: show what we need before each stage on the GC's page. The job's row alone. */
  setShowsOnGcPage: (jobId: string, on: boolean, who: StartWho) => Promise<void>
  /** Our window on a stage line, written as Jobs → Subs writes one. */
  setWindow: (line: { jobId: string; fixtureId: string }, start: string, end: string, who: StartWho) => Promise<void>
  addTemplate: (template: NewTemplate, who: StartWho) => Promise<void>
  retireTemplate: (id: string, who: StartWho) => Promise<void>
  uploadPhoto: (jobId: string, markId: string, blob: Blob, fileName: string, takenAt: string) => Promise<StartPhoto>
  /** A link to a photo that works for a minute, or null when it cannot be made. */
  photoUrl: (path: string) => Promise<string | null>
}

type StageRpcRow = { fixture_id: string; name: string | null; stage_kind: string | null; sequence_order: number | null; progress_pct: number | null }
type WindowRpcRow = { job_id: string; fixture_id: string; window_start: string | null; window_end: string | null }

const BULLET_COLS = 'id, job_id, fixture_id, sort_order, words, waits_on, wants_photo, shown_to_gc, by_day, reads, hand_ok, hand_ok_at, hand_ok_by_name, template_id, removed_at, created_at'
const MARK_COLS = 'id, bullet_id, job_id, know, who_name, how, said_on, source, photo_storage_path, photo_file_name, taken_back_at, created_at'
const ASK_COLS = 'id, batch_id, job_id, fixture_id, bullet_id, kind, how, to_name, asked_on, created_at'
const DAY_COLS = 'id, job_id, fixture_id, ready_day, said_on, who_name, how, source, removed_at, created_at'
const DECISION_COLS = 'id, job_id, fixture_id, kind, decided_on, open_then, start_then, hold_until, by_name, taken_back_at, created_at'
const ARRIVAL_COLS = 'id, job_id, fixture_id, arrived_on, not_as_told, by_name, created_at'
const SETTINGS_COLS = 'id, development_id, job_id, notice_days, shows_on_gc_page'
const TEMPLATE_COLS = 'id, stage_kind, sort_order, words, waits_on, wants_photo, reads, retired_at'

async function readOf<T>(table: string, cols: string, jobIds: readonly string[], what: string): Promise<T[]> {
  const rows = await withSupabaseRetry(async () => db.from(table).select(cols).in('job_id', [...jobIds]).order('created_at').order('id'), what)
  return (rows ?? []) as T[]
}

export async function onStartChecksDesk(jobId: string): Promise<boolean> {
  // A check that fails throws: it is not a no, and the screen says why and offers Retry.
  const data = await withSupabaseRetry(async () => db.rpc('start_checks_desk', { p_job_id: jobId }), 'check the job’s desk')
  return data === true
}

export async function readStageLines(jobId: string): Promise<StageLine[]> {
  const [stages, windows] = await Promise.all([
    withSupabaseRetry(async () => db.rpc('list_job_stage_progress', { p_job_id: jobId }), 'read the job’s stages'),
    withSupabaseRetry(async () => db.rpc('start_check_windows', { p_job_ids: [jobId] }), 'read our days'),
  ])
  const windowOf = new Map<string, [string, string]>()
  for (const w of (windows ?? []) as WindowRpcRow[]) if (w.window_start) windowOf.set(w.fixture_id, [w.window_start, w.window_end ?? w.window_start])
  return ((stages ?? []) as StageRpcRow[])
    .filter((s) => s.stage_kind === 'order' || s.stage_kind === 'any')
    .map((s) => ({ fixtureId: s.fixture_id, jobId, name: (s.name ?? '').trim() || 'Stage', order: Number(s.sequence_order ?? 0), finished: (s.progress_pct ?? 0) >= 100, window: windowOf.get(s.fixture_id) ?? null }))
    .sort((a, b) => a.order - b.order || a.fixtureId.localeCompare(b.fixtureId))
}

export async function readStartCheckRows(jobIds: readonly string[]): Promise<StartCheckRows> {
  if (!jobIds.length) return NO_START_ROWS
  const [bullets, marks, asks, theirDays, decisions, arrivals] = await Promise.all([
    readOf<StartBulletRow>('start_check_bullets', BULLET_COLS, jobIds, 'read the bullets'),
    readOf<StartMarkRow>('start_check_marks', MARK_COLS, jobIds, 'read the yeses'),
    readOf<StartAskRow>('start_check_asks', ASK_COLS, jobIds, 'read the asks'),
    readOf<StartTheirDayRow>('start_check_their_days', DAY_COLS, jobIds, 'read the days they gave'),
    readOf<StartDecisionRow>('start_check_decisions', DECISION_COLS, jobIds, 'read the decisions'),
    readOf<StartArrivalRow>('start_check_arrivals', ARRIVAL_COLS, jobIds, 'read the arrivals'),
  ])
  return { bullets, marks, asks, theirDays, decisions, arrivals }
}

export async function readStartSettings(at: { jobId: string; developmentId: string | null }): Promise<{ site: StartSettingsRow | null; job: StartSettingsRow | null }> {
  const [job, site] = await Promise.all([
    withSupabaseRetry(async () => db.from('start_check_settings').select(SETTINGS_COLS).eq('job_id', at.jobId).maybeSingle(), 'read the job’s setting'),
    at.developmentId ? withSupabaseRetry(async () => db.from('start_check_settings').select(SETTINGS_COLS).eq('development_id', at.developmentId).maybeSingle(), 'read the site’s notice') : Promise.resolve(null),
  ])
  return { site: (site ?? null) as StartSettingsRow | null, job: (job ?? null) as StartSettingsRow | null }
}

export async function readStartTemplates(): Promise<StartTemplateRow[]> {
  const rows = await withSupabaseRetry(async () => db.from('start_check_templates').select(TEMPLATE_COLS).is('retired_at', null).order('sort_order').order('id'), 'read the company’s lists')
  return (rows ?? []) as StartTemplateRow[]
}

export async function readGcContactName(bidId: string): Promise<string | null> {
  const { data, error } = await db.from('bids').select('gc_contact_name').eq('id', bidId).maybeSingle()
  const name = error ? '' : (((data as { gc_contact_name?: string | null } | null)?.gc_contact_name ?? '').trim())
  return name.length >= 2 ? name : null
}

const nowIso = () => new Date().toISOString()

export const supabaseStartChecksIo: StartChecksIo = {
  onDesk: onStartChecksDesk,
  readLines: readStageLines,
  readRows: readStartCheckRows,
  readSettings: readStartSettings,
  readTemplates: readStartTemplates,
  readGcContact: readGcContactName,

  addBullets: async (bullets, who) => {
    if (!bullets.length) return
    const result = await db.from('start_check_bullets').insert(
      bullets.map((b) => ({
        job_id: b.jobId,
        fixture_id: b.fixtureId,
        sort_order: b.order,
        words: b.words.trim().slice(0, 300),
        waits_on: b.on,
        wants_photo: b.on === 'them' && b.wantsPhoto,
        // A bullet on them starts shown on the GC's page, which shows nothing until the job's two switches are on.
        shown_to_gc: b.on === 'them',
        reads: b.on === 'us' ? (b.reads ?? 'hand') : null,
        template_id: b.templateId,
        created_by: who.userId,
        created_by_name: who.name.slice(0, 120),
      })),
    )
    checkSupabaseError(result, 'add the bullet')
  },

  changeBullet: async (id, patch) => {
    const row: Record<string, unknown> = {}
    if (patch.words !== undefined) row.words = patch.words.trim().slice(0, 300)
    if (patch.wantsPhoto !== undefined) row.wants_photo = patch.wantsPhoto
    if (patch.shownToGc !== undefined) row.shown_to_gc = patch.shownToGc
    if (patch.byDay !== undefined) row.by_day = patch.byDay
    if (patch.reads !== undefined) {
      row.reads = patch.reads
      // A hand tick belongs to a bullet that reads hand alone: one that turns to the app drops its tick.
      if (patch.reads !== 'hand') Object.assign(row, { hand_ok: false, hand_ok_at: null, hand_ok_by: null, hand_ok_by_name: '' })
    }
    const result = await db.from('start_check_bullets').update(row).eq('id', id)
    checkSupabaseError(result, 'change the bullet')
  },

  removeBullet: async (id, who) => {
    const result = await db.from('start_check_bullets').update({ removed_at: nowIso(), removed_by: who.userId }).eq('id', id)
    checkSupabaseError(result, 'take the bullet off the list')
  },

  tickByHand: async (id, done, who) => {
    const result = await db
      .from('start_check_bullets')
      .update(done ? { hand_ok: true, hand_ok_at: nowIso(), hand_ok_by: who.userId, hand_ok_by_name: who.name.slice(0, 120) } : { hand_ok: false, hand_ok_at: null, hand_ok_by: null, hand_ok_by_name: '' })
      .eq('id', id)
    checkSupabaseError(result, done ? 'mark it done' : 'mark it not done')
  },

  sayYes: async (yes, standing, who) => {
    if (standing) {
      const back = await db.from('start_check_marks').update({ taken_back_at: nowIso(), taken_back_by: who.userId, taken_back_by_name: who.name.slice(0, 120) }).eq('id', standing)
      checkSupabaseError(back, 'take the old yes back')
    }
    const result = await db.from('start_check_marks').insert({
      ...(yes.id ? { id: yes.id } : {}),
      bullet_id: yes.bulletId,
      job_id: yes.jobId,
      know: yes.know,
      who_name: yes.who.trim().slice(0, 120),
      how: yes.how.trim().slice(0, 80),
      said_on: yes.day,
      source: 'office',
      by_user: who.userId,
      by_name: who.name.slice(0, 120),
      ...(yes.photo ? { photo_storage_path: yes.photo.path, photo_file_name: yes.photo.fileName.slice(0, 200), photo_bytes: yes.photo.bytes, photo_taken_at: yes.photo.takenAt } : {}),
    })
    checkSupabaseError(result, 'keep the yes')
  },

  changeYes: async (markId, patch) => {
    const row: Record<string, unknown> = {}
    if (patch.know !== undefined) row.know = patch.know
    if (patch.who !== undefined) row.who_name = patch.who.trim().slice(0, 120)
    if (patch.how !== undefined) row.how = patch.how.trim().slice(0, 80)
    if (patch.day !== undefined) row.said_on = patch.day
    const result = await db.from('start_check_marks').update(row).eq('id', markId)
    checkSupabaseError(result, 'change the yes')
  },

  takeBackYes: async (markId, who) => {
    const result = await db.from('start_check_marks').update({ taken_back_at: nowIso(), taken_back_by: who.userId, taken_back_by_name: who.name.slice(0, 120) }).eq('id', markId)
    checkSupabaseError(result, 'take the yes back')
  },

  giveTheirDay: async (day, who) => {
    const result = await db.from('start_check_their_days').insert({
      job_id: day.jobId,
      fixture_id: day.fixtureId,
      ready_day: day.readyDay,
      said_on: day.saidOn,
      who_name: day.who.trim().slice(0, 120),
      how: day.how.trim().slice(0, 80),
      source: 'office',
      by_user: who.userId,
      by_name: who.name.slice(0, 120),
    })
    checkSupabaseError(result, 'keep the day they gave')
  },

  keepAsk: async (ask, who) => {
    if (!ask.rows.length) return
    const batchId = crypto.randomUUID()
    const result = await db.from('start_check_asks').insert(
      ask.rows.map((r) => ({ batch_id: batchId, job_id: r.jobId, fixture_id: r.fixtureId, bullet_id: r.bulletId, kind: ask.kind, how: ask.how, to_name: ask.to.trim().slice(0, 120), asked_on: ask.day, by_user: who.userId, by_name: who.name.slice(0, 120) })),
    )
    checkSupabaseError(result, 'keep the ask')
  },

  decide: async (fixtureId, kind, openThen, holdUntil) => {
    const result = await db.rpc('start_check_decide', { p_fixture_id: fixtureId, p_kind: kind, p_open_then: [...openThen], p_hold_until: holdUntil })
    checkSupabaseError(result, kind === 'go' ? 'press Go' : 'hold the stage')
  },

  takeBackDecision: async (decisionId) => {
    const result = await db.rpc('start_check_take_back', { p_decision_id: decisionId })
    checkSupabaseError(result, 'take the decision back')
  },

  setNotice: async (home, days, who) => {
    const key = 'developmentId' in home ? { development_id: home.developmentId } : { job_id: home.jobId }
    const result = await db.from('start_check_settings').upsert({ ...key, notice_days: days, updated_by: who.userId, updated_by_name: who.name.slice(0, 120) }, { onConflict: 'developmentId' in home ? 'development_id' : 'job_id' })
    checkSupabaseError(result, 'keep the days of notice')
  },

  setShowsOnGcPage: async (jobId, on, who) => {
    const result = await db.from('start_check_settings').upsert({ job_id: jobId, shows_on_gc_page: on, updated_by: who.userId, updated_by_name: who.name.slice(0, 120) }, { onConflict: 'job_id' })
    checkSupabaseError(result, 'keep the switch')
  },

  setWindow: async (line, start, end, who) => {
    const result = await db.from('job_stage_windows').upsert({ job_id: line.jobId, fixture_id: line.fixtureId, window_start: start, window_end: end, window_by: 'office', created_by: who.userId }, { onConflict: 'job_id,fixture_id' })
    checkSupabaseError(result, 'move our days')
  },

  addTemplate: async (t, who) => {
    const result = await db.from('start_check_templates').insert({
      stage_kind: t.kind,
      sort_order: t.order,
      words: t.words.trim().slice(0, 300),
      waits_on: t.on,
      wants_photo: t.on === 'them' && t.wantsPhoto,
      reads: t.on === 'us' ? (t.reads ?? 'hand') : null,
      created_by: who.userId,
      created_by_name: who.name.slice(0, 120),
    })
    checkSupabaseError(result, 'add to the company’s list')
  },

  retireTemplate: async (id, who) => {
    const result = await db.from('start_check_templates').update({ retired_at: nowIso(), retired_by: who.userId }).eq('id', id)
    checkSupabaseError(result, 'take it off the company’s list')
  },

  uploadPhoto: async (jobId, markId, blob, fileName, takenAt) => {
    const path = `${jobId}/${markId}-${Date.parse(takenAt) || Date.now()}.jpg`
    const up = await db.storage.from(START_CHECK_PHOTOS_BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
    if (up.error) throw up.error
    return { path, fileName, bytes: blob.size, takenAt }
  },

  photoUrl: async (path) => {
    const { data, error } = await db.storage.from(START_CHECK_PHOTOS_BUCKET).createSignedUrl(path, 60)
    return error ? null : (data?.signedUrl ?? null)
  },
}

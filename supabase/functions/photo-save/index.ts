import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import { findOrCreateFolder, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { freeName, photoFolderOrWhy } from '../_shared/driveJobFolder.ts'
import { readDriveSettings } from '../_shared/driveSettings.ts'
import { calendarYmdInAppTzFromIso } from '../_shared/appTimeZone.ts'
import { roadmapTaskFolderPath, taskFolderName, taskPhotoDriveName, type TaskPhotoKind } from '../_shared/taskPhotoNames.ts'
import type { PdfLibLike } from '../_shared/jobContractPdf.ts'
import { buildStageChecklistPdf, recordPdfFileName, type RecordPdfRow } from '../_shared/stageChecklistPdf.ts'
import { machineFolderOrWhy } from '../_shared/driveMachineFolder.ts'
import { ticketFolderOrWhy } from '../_shared/driveTicketFolder.ts'
import { moveFolder } from '../_shared/jobFolders.ts'
import { COUNTER_TICKETS_BUCKET, ticketDriveName } from '../_shared/ticketNames.ts'
import { NO_TASKS_FOLDER_WORDS, driveFailWords } from '../_shared/whereFilesGo.ts'
import type { JobRef } from '../_shared/driveLink.ts'
import {
  PHOTO_ROWS_SELECT,
  PHOTO_SAVE_BATCH,
  PHOTO_SWITCHES_SELECT,
  onSwitches,
  photoDriveName,
  photoNameInputOf,
  photoRowOf,
  photosToSave,
  type PhotoAttachmentRow,
  type PhotoRow,
  type PhotoSwitch,
} from '../_shared/gcKernels/index.ts'

/**
 * Messages, cut 10 (photos saved on arrival): the file agent's sweep. Every few minutes, on a cron, it copies each photo
 * that came in on a line tied to a job whose office ticked *Save every photo on this job to Drive as it comes in*
 * (`photo_saves`, `set_photo_save`) into that job's photos: Team only › Photos under the job's Drive folder, or a Pipeline
 * job's own Customer Pictures folder when that link is plainly a Drive folder. Each takes its name by day, sender and
 * caption (`photoDriveName`), and its row keeps `drive_file_id`, so a photo is copied once and a failed copy is tried
 * again on the next run. Only a photo that came in after the tick went on is copied (`photosToSave`); a line tied to its
 * job later is caught then. The design is quo-messages-mockup.html drafts 8 and 9 on branch spike/gc-mode.
 *
 *   POST (X-Cron-Secret) → { ticks, saved, failed: [{ id, why }], boxes: { saved, failed }, reports: { saved, failed },
 *     checklists: { saved, failed }, jobPhotos: { saved, failed }, machines: { saved, failed }, records: { saved, failed },
 *     taskPhotos: { saved, failed }, tickets: { saved, failed } }
 *
 * Materials on site (punch list #209, v2.6045): a second source after the Messages pass. A photo a crew takes of a box on
 * the On site tab waits in the box-photos bucket with a row in job_box_photos; the sweep files it in the same photo folder
 * under the row's own file_name, keeps drive_file_id, filed_at and status = filed on the row, and deletes the bucket copy.
 * A shot it cannot file gets the reason written on its row as fail_why, whatever the reason (no Drive folder on the job,
 * Drive not set up, a copy that did not read, a Drive refusal), for the office and the dev to read, and is tried again every
 * run until it files; a filed row clears it.
 *
 * Phone first (punch list #189, PR 5b, v2.6083): a third source after the boxes. A photo a tech takes for a field
 * report waits in the report-photos bucket with a row in report_photos; once the report is saved (report_id set) the
 * sweep files it in the same photo folder, named by day, sender and caption as a text's photo is (`photoDriveName`:
 * *2026-10-29 Luis Ortega · Rough In.jpg*), keeps drive_file_id and filed_at on the row, and deletes the bucket copy.
 * A shot it cannot file gets the reason on its row as fail_why (no Drive folder on the job, Drive not set up, a copy
 * that did not read, a Drive refusal), which the report card reads as *not in Drive yet*, and is tried again every run.
 *
 * A checklist per stage (punch list #164, PR 3, v2.6084): a fourth source after the report photos. The photo a
 * checklist question asks for waits in the stage-checklist-photos bucket with its name on its stage_checklist_answers
 * row (photo_file_name, photo_storage_path); the sweep files it in the same photo folder, keeps photo_drive_file_id and
 * photo_filed_at on the row, clears photo_fail_why, and deletes the bucket copy, the box photo's rules to the letter
 * (`sweepWaiting`).
 *
 * Task cards (punch list #273, PR 4): an eighth source after the records. A photo taken on a task card, at a percent, at
 * the finish or on a Done when… line, waits in the task-photos bucket with a `task_photos` row; the sweep files it under
 * the office's Tasks folder (`app_settings` `drive_tasks_folder_id`, Documents → Where files go), in a folder per card
 * named by the day and the title (`taskFolderName`), a roadmap card's under its roadmap and stage
 * (`roadmapTaskFolderPath`), as *2026-11-04 Mateo · 67%.jpg* (`taskPhotoDriveName`, `_shared/taskPhotoNames.ts`), keeps
 * drive_file_id and filed_at on the row and clears fail_why. The bucket copy stays, the app's own thumbnail (the
 * hr-evidence-drive rule). No Tasks folder set answers NO_TASKS_FOLDER_WORDS on every row until the office sets one.
 *
 * Counter tickets (punch list #295, PR 1): a ninth source after the task photos. A page of a supply house ticket or a
 * receipt waits in the counter-tickets bucket with a `counter_ticket_pages` row; once the ticket is saved (added_at set),
 * has a job and is not removed, the sweep files the page under Team only › Tickets in the job's Drive folder
 * (`ticketFolderOrWhy`), never Customer Pictures, since a ticket shows prices, as *2026-11-04 Jordan · Ticket $228.58.jpg*
 * (`ticketDriveName`, `_shared/ticketNames.ts`), and keeps drive_file_id, drive_folder_id and filed_at on the row. A
 * ticket moved to another job has its pages' filed_at cleared by a trigger, and the sweep moves the Drive file to the
 * new job's folder instead of copying it again. The bucket copy stays, the app's own picture of the ticket.
 *
 * The cron calls only while one of these waits: each source is a clause of its WHERE, so a migration that adds a
 * source re-schedules it with every clause (20261030070000_photo_save_cron_all_sources.sql holds all four).
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, GOOGLE_SERVICE_ACCOUNT_JSON. config.toml keeps
 * verify_jwt = false: the cron sends no JWT, and the secret is the door.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** The job of a tick or a line, the way the save picks one: a GC project, then a bid, then a Pipeline job. */
function jobRefOf(j: { bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null }): JobRef | null {
  if (j.project_id) return { project_id: j.project_id }
  if (j.bid_id) return { bid_id: j.bid_id }
  if (j.jobs_ledger_id) return { jobs_ledger_id: j.jobs_ledger_id }
  return null
}

/** The column of the line that names a job. */
function jobColumn(job: JobRef): { column: string; id: string } {
  if ('project_id' in job) return { column: 'project_id', id: job.project_id }
  if ('bid_id' in job) return { column: 'bid_id', id: job.bid_id }
  return { column: 'jobs_ledger_id', id: job.jobs_ledger_id }
}

/** The files that may be a ticked job's photos: kept by us, not in Drive yet, on lines that came in since the tick. */
async function candidates(admin: SupabaseClient, tick: PhotoSwitch): Promise<PhotoAttachmentRow[]> {
  const job = jobRefOf(tick)
  if (!job || !tick.on_since) return []
  const { column, id } = jobColumn(job)
  const { data, error } = await admin
    .from('message_attachments')
    .select(PHOTO_ROWS_SELECT)
    .eq('kind', 'file')
    .is('drive_file_id', null)
    .is('sent_as', null)
    .not('bucket_path', 'is', null)
    .eq('messages.direction', 'in')
    .eq(`messages.${column}`, id)
    .gte('messages.at', tick.on_since)
    .order('created_at', { ascending: true })
    .limit(PHOTO_SAVE_BATCH * 5)
  if (error) throw new Error(`the files did not read: ${error.message}`)
  return (data ?? []) as unknown as PhotoAttachmentRow[]
}

async function sweep(admin: SupabaseClient): Promise<Response> {
  const { data: tickRows, error: ticksError } = await admin.from('photo_saves').select(PHOTO_SWITCHES_SELECT).not('on_since', 'is', null)
  if (ticksError) return json({ error: `The ticks did not read: ${ticksError.message}` }, 500)
  const ticks = onSwitches((tickRows ?? []) as PhotoSwitch[])
  if (ticks.length === 0) return json({ ticks: 0, saved: 0, failed: [] })

  const read: PhotoAttachmentRow[] = []
  for (const tick of ticks) read.push(...(await candidates(admin, tick)))
  const byId = new Map(read.map((a) => [a.id, a]))
  const rows = read.map(photoRowOf).filter((r): r is PhotoRow => r !== null)
  const picked = photosToSave(rows, ticks)
  if (picked.length === 0) return json({ ticks: ticks.length, saved: 0, failed: [] })

  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) return json({ error: 'Drive is not set up here yet.' }, 500)
  const google = await googleAccessToken(saJson)

  // One folder a job a run: the first photo makes Team only › Photos when it is not there yet.
  const folders = new Map<string, { id: string } | { why: string }>()
  let saved = 0
  const failed: { id: string; why: string }[] = []
  for (const row of picked) {
    const a = byId.get(row.id)!
    const job = jobRefOf(row.line)!
    const key = JSON.stringify(job)
    try {
      if (!folders.has(key)) folders.set(key, await photoFolderOrWhy(admin, google, job))
      const landing = folders.get(key)!
      if ('why' in landing) {
        failed.push({ id: row.id, why: landing.why })
        continue
      }
      const into = landing.id
      const input = photoNameInputOf(a)!
      const { data: blob, error } = await admin.storage.from('message-attachments').download(a.bucket_path!)
      if (error || !blob) {
        failed.push({ id: row.id, why: 'Our copy of that file did not read.' })
        continue
      }
      const name = await freeName(google, into, (taken) => photoDriveName(input, taken))
      const put = await uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, a.mime || 'application/octet-stream')
      // Kept only where no save got there first, so the row names the one copy.
      const { error: kept } = await admin.from('message_attachments').update({ drive_file_id: put.id }).eq('id', row.id).is('drive_file_id', null)
      if (kept) {
        failed.push({ id: row.id, why: 'Saved to Drive, but the row did not keep it.' })
        continue
      }
      saved += 1
    } catch (e) {
      failed.push({ id: row.id, why: driveFailWords(e instanceof Error ? e.message : String(e)) })
    }
  }
  if (failed.length) console.warn('photo-save: some photos were not saved', failed)
  return json({ ticks: ticks.length, saved, failed })
}

// ---------------------------------------------------------------------------
// Materials on site (#209): the box photos, and (#164) the checklist photos. Twenty a run each, oldest first; a failure
// is written on the row and tried again next run.
// ---------------------------------------------------------------------------

const BOX_PHOTO_BATCH = 20
const BOX_PHOTOS_BUCKET = 'box-photos'

type BoxPhotoRow = { id: string; job_id: string; file_name: string; storage_path: string }

type WaitingRead = { data: unknown; error: { message: string } | null }

/** A table whose rows hold a photo waiting in a bucket for the sweep: the read, how its columns are named, and what a filed row keeps. */
interface WaitingSource {
  kind: 'boxes' | 'checklist'
  table: string
  bucket: string
  /** The waiting rows under `BoxPhotoRow`'s names: the path set, nothing filed, oldest first, a batch at most. */
  waiting: (admin: SupabaseClient) => PromiseLike<WaitingRead>
  failWhyColumn: string
  filedAtColumn: string
  driveIdColumn: string
  /** What a filed row keeps beside the Drive id, the filed time and the cleared reason. */
  filedExtra: Record<string, unknown>
}

const BOX_SOURCE: WaitingSource = {
  kind: 'boxes',
  table: 'job_box_photos',
  bucket: BOX_PHOTOS_BUCKET,
  waiting: (admin) =>
    admin.from('job_box_photos').select('id, job_id, file_name, storage_path').is('filed_at', null).not('storage_path', 'is', null).order('taken_at', { ascending: true }).limit(BOX_PHOTO_BATCH),
  failWhyColumn: 'fail_why',
  filedAtColumn: 'filed_at',
  driveIdColumn: 'drive_file_id',
  filedExtra: { status: 'filed' },
}

/** The checklist photos (#164): the row's photo columns read under the box row's names, so one sweep serves both. */
const CHECKLIST_SOURCE: WaitingSource = {
  kind: 'checklist',
  table: 'stage_checklist_answers',
  bucket: 'stage-checklist-photos',
  waiting: (admin) =>
    admin
      .from('stage_checklist_answers')
      .select('id, job_id, file_name:photo_file_name, storage_path:photo_storage_path')
      .is('photo_filed_at', null)
      .not('photo_storage_path', 'is', null)
      .order('photo_taken_at', { ascending: true })
      .limit(BOX_PHOTO_BATCH),
  failWhyColumn: 'photo_fail_why',
  filedAtColumn: 'photo_filed_at',
  driveIdColumn: 'photo_drive_file_id',
  filedExtra: {},
}

/** The row's own name, or the next free "(2)", "(3)" when the folder already holds it (any case). */
function nextFreeName(name: string, taken: ReadonlySet<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()))
  if (!lower.has(name.toLowerCase())) return name
  const m = /^(.*?)(\.[a-z0-9]{1,5})?$/i.exec(name)
  const stem = m?.[1] ?? name
  const ext = m?.[2] ?? ''
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
}

async function sweepWaiting(admin: SupabaseClient, source: WaitingSource): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const { data, error } = await source.waiting(admin)
  if (error) return { saved: 0, failed: [{ id: '', why: `the ${source.kind === 'boxes' ? 'box' : 'checklist'} photos did not read: ${error.message}` }] }
  const rows = (data ?? []) as BoxPhotoRow[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  let saved = 0
  const failed: { id: string; why: string }[] = []
  // Every reason lands on the row, so a photo that waits says why without anyone reading this function's log.
  const fail = async (r: BoxPhotoRow, why: string) => {
    failed.push({ id: r.id, why })
    await admin.from(source.table).update({ [source.failWhyColumn]: why.slice(0, 300) }).eq('id', r.id).is(source.filedAtColumn, null)
  }
  if (!saJson) {
    for (const r of rows) await fail(r, 'Drive is not set up here yet.')
    return { saved, failed }
  }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    for (const r of rows) await fail(r, `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`)
    return { saved, failed }
  }
  const folders = new Map<string, { id: string } | { why: string }>()
  for (const r of rows) {
    try {
      const job: JobRef = { jobs_ledger_id: r.job_id }
      if (!folders.has(r.job_id)) folders.set(r.job_id, await photoFolderOrWhy(admin, google, job))
      const landing = folders.get(r.job_id)!
      if ('why' in landing) {
        await fail(r, landing.why)
        continue
      }
      const into = landing.id
      const { data: blob, error: dl } = await admin.storage.from(source.bucket).download(r.storage_path)
      if (dl || !blob) {
        await fail(r, 'Our copy of that photo did not read.')
        continue
      }
      const name = await freeName(google, into, (taken) => nextFreeName(r.file_name, taken))
      const put = await uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, blob.type || 'image/jpeg')
      // Kept only where no save got there first, and only while the row still names this copy (a checklist photo taken
      // again mid-run names a new path), so the row names the one copy.
      const { error: kept } = await admin
        .from(source.table)
        .update({ [source.driveIdColumn]: put.id, [source.filedAtColumn]: new Date().toISOString(), [source.failWhyColumn]: null, ...source.filedExtra })
        .eq('id', r.id)
        .is(source.driveIdColumn, null)
      if (kept) {
        await fail(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      // No lasting copy in the app: the bucket's is gone once Drive has the file.
      await admin.storage.from(source.bucket).remove([r.storage_path])
      saved += 1
    } catch (e) {
      await fail(r, driveFailWords(e instanceof Error ? e.message : String(e)))
    }
  }
  if (failed.length) console.warn(`photo-save: some ${source.kind === 'boxes' ? 'box' : 'checklist'} photos were not filed`, failed)
  return { saved, failed }
}

// ---------------------------------------------------------------------------
// Phone first (#189): the report photos. Twenty a run, oldest first, saved reports only; a failure is written on the
// row and tried again next run.
// ---------------------------------------------------------------------------

const REPORT_PHOTO_BATCH = 20

type ReportPhotoRow = { id: string; job_id: string; storage_path: string; by_name: string; taken_at: string; caption: string; stage_name: string }

/**
 * A table whose rows are named by day, sender and caption when filed (`photoDriveName`): the report photos, and since
 * punch list #244 (v2.6363) the job photos, `job_photo_notes`, a photo added to a job with a description from the Job
 * photos window, filed once the person pressed Add (`added_at` set) as a report's are once the report is saved.
 */
interface NamedSource {
  kind: 'report' | 'job'
  table: string
  bucket: string
  /** The waiting rows under `ReportPhotoRow`'s names: the path set, nothing filed, the row committed, oldest first, a batch at most. */
  waiting: (admin: SupabaseClient) => PromiseLike<WaitingRead>
  /** The caption when the row names none and no stage. */
  plainCaption: string
}

const REPORT_SOURCE: NamedSource = {
  kind: 'report',
  table: 'report_photos',
  bucket: 'report-photos',
  waiting: (admin) =>
    admin
      .from('report_photos')
      .select('id, job_id, storage_path, by_name, taken_at, caption, stage_name')
      .is('filed_at', null)
      .not('storage_path', 'is', null)
      .not('report_id', 'is', null)
      .order('taken_at', { ascending: true })
      .limit(REPORT_PHOTO_BATCH),
  plainCaption: 'Report photo',
}

const JOB_PHOTO_SOURCE: NamedSource = {
  kind: 'job',
  table: 'job_photo_notes',
  bucket: 'job-photo-notes',
  waiting: (admin) =>
    admin
      .from('job_photo_notes')
      .select('id, job_id, storage_path, by_name, taken_at, caption, stage_name')
      .is('filed_at', null)
      .not('storage_path', 'is', null)
      .not('added_at', 'is', null)
      .order('taken_at', { ascending: true })
      .limit(REPORT_PHOTO_BATCH),
  plainCaption: 'Job photo',
}

async function sweepNamedPhotos(admin: SupabaseClient, source: NamedSource): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const { data, error } = await source.waiting(admin)
  if (error) return { saved: 0, failed: [{ id: '', why: `the ${source.kind} photos did not read: ${error.message}` }] }
  const rows = (data ?? []) as ReportPhotoRow[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  let saved = 0
  const failed: { id: string; why: string }[] = []
  const fail = async (r: ReportPhotoRow, why: string) => {
    failed.push({ id: r.id, why })
    await admin.from(source.table).update({ fail_why: why.slice(0, 300) }).eq('id', r.id).is('filed_at', null)
  }
  if (!saJson) {
    for (const r of rows) await fail(r, 'Drive is not set up here yet.')
    return { saved, failed }
  }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    for (const r of rows) await fail(r, `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`)
    return { saved, failed }
  }
  const folders = new Map<string, { id: string } | { why: string }>()
  for (const r of rows) {
    try {
      const job: JobRef = { jobs_ledger_id: r.job_id }
      if (!folders.has(r.job_id)) folders.set(r.job_id, await photoFolderOrWhy(admin, google, job))
      const landing = folders.get(r.job_id)!
      if ('why' in landing) {
        await fail(r, landing.why)
        continue
      }
      const into = landing.id
      const { data: blob, error: dl } = await admin.storage.from(source.bucket).download(r.storage_path)
      if (dl || !blob) {
        await fail(r, 'Our copy of that photo did not read.')
        continue
      }
      const mime = blob.type || 'image/jpeg'
      // Named as a text's photo is: the day, the sender, the caption (the stage it shows, else the report's words).
      const nameInput = { at: r.taken_at, sender: r.by_name, fileName: 'photo', mime, words: r.caption || r.stage_name || source.plainCaption, place: 1 }
      const name = await freeName(google, into, (taken) => photoDriveName(nameInput, taken))
      const put = await uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, mime)
      const { error: kept } = await admin
        .from(source.table)
        .update({ drive_file_id: put.id, filed_at: new Date().toISOString(), fail_why: null })
        .eq('id', r.id)
        .is('drive_file_id', null)
      if (kept) {
        await fail(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      await admin.storage.from(source.bucket).remove([r.storage_path])
      saved += 1
    } catch (e) {
      await fail(r, driveFailWords(e instanceof Error ? e.message : String(e)))
    }
  }
  if (failed.length) console.warn(`photo-save: some ${source.kind} photos were not filed`, failed)
  return { saved, failed }
}

/* ------------------------------------------------------------------ a sixth source: a machine's check photos */

type MachinePhotoRow = { id: string; vehicle_id: string; storage_path: string; file_name: string }

/**
 * Equipment pre-use check (punch list #270, v2.6556): the photos a pre-use walk or a leaving check takes, up to twenty
 * `machine_check_photos` rows with a `storage_path` and no `filed_at`, oldest first. Each is copied from the
 * `machine-check-photos` bucket into the machine's own Drive folder (`machineFolderOrWhy`: the row's link, else one made
 * under the office's Fleet folder) under the row's `file_name` (*2026-11-05 Robert · E-12 pre-use front.jpg*), with
 * *(2)* when the folder holds the name; the row keeps `drive_file_id` and `filed_at`, `fail_why` is cleared, and the
 * bucket copy is deleted. A shot it cannot file gets the reason on its row and is tried again every run.
 */
async function sweepMachinePhotos(admin: SupabaseClient): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const { data, error } = await admin
    .from('machine_check_photos')
    .select('id, vehicle_id, storage_path, file_name')
    .is('filed_at', null)
    .not('storage_path', 'is', null)
    .order('taken_at', { ascending: true })
    .limit(REPORT_PHOTO_BATCH)
  if (error) return { saved: 0, failed: [{ id: '', why: `the machine photos did not read: ${error.message}` }] }
  const rows = (data ?? []) as MachinePhotoRow[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  let saved = 0
  const failed: { id: string; why: string }[] = []
  const fail = async (r: MachinePhotoRow, why: string) => {
    failed.push({ id: r.id, why })
    await admin.from('machine_check_photos').update({ fail_why: why.slice(0, 300) }).eq('id', r.id).is('filed_at', null)
  }
  if (!saJson) {
    for (const r of rows) await fail(r, 'Drive is not set up here yet.')
    return { saved, failed }
  }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    for (const r of rows) await fail(r, `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`)
    return { saved, failed }
  }
  const folders = new Map<string, { id: string } | { why: string }>()
  for (const r of rows) {
    try {
      if (!folders.has(r.vehicle_id)) folders.set(r.vehicle_id, await machineFolderOrWhy(admin, google, r.vehicle_id))
      const landing = folders.get(r.vehicle_id)!
      if ('why' in landing) {
        await fail(r, landing.why)
        continue
      }
      const { data: blob, error: dl } = await admin.storage.from('machine-check-photos').download(r.storage_path)
      if (dl || !blob) {
        await fail(r, 'Our copy of that photo did not read.')
        continue
      }
      const mime = blob.type || 'image/jpeg'
      const base = r.file_name.replace(/\.jpe?g$/i, '')
      const name = await freeName(google, landing.id, (taken) => {
        let n = 2
        let candidate = `${base}.jpg`
        while (taken.has(candidate)) candidate = `${base} (${n++}).jpg`
        return candidate
      })
      const put = await uploadBytes(google, landing.id, new Uint8Array(await blob.arrayBuffer()), name, mime)
      const { error: kept } = await admin
        .from('machine_check_photos')
        .update({ drive_file_id: put.id, filed_at: new Date().toISOString(), fail_why: null })
        .eq('id', r.id)
        .is('drive_file_id', null)
      if (kept) {
        await fail(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      await admin.storage.from('machine-check-photos').remove([r.storage_path])
      saved += 1
    } catch (e) {
      await fail(r, driveFailWords(e instanceof Error ? e.message : String(e)))
    }
  }
  if (failed.length) console.warn('photo-save: some machine photos were not filed', failed)
  return { saved, failed }
}

// ---------------------------------------------------------------------------
// The checklist records (punch list #237, PR 3): a stage's list files itself as stage_checklist_records at the last
// answer (migration 20261106050000); the sweep draws each record's PDF from its snapshot, with the drawn marks read from
// the stage-checklist-photos bucket, and files it in the job's photo folder, each version its own file. Five tries at
// most; a failure is written on the row and tried again next run.
// ---------------------------------------------------------------------------

const RECORD_BATCH = 10
const RECORD_PDF_TRIES = 5

type RecordRowDb = {
  id: string
  job_id: string
  record_id: string
  version: number
  stage_name: string
  filed_at: string
  snapshot: { rows?: RecordPdfRow[]; skipped?: Array<{ words: string; by?: string | null; why?: string | null }> } | null
  answer_count: number
  signed_count: number
  no_count: number
  pdf_file_name: string | null
  pdf_tries: number
}

async function sweepRecords(admin: SupabaseClient): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const { data, error } = await admin
    .from('stage_checklist_records')
    .select('id, job_id, record_id, version, stage_name, filed_at, snapshot, answer_count, signed_count, no_count, pdf_file_name, pdf_tries')
    .is('pdf_filed_at', null)
    .lt('pdf_tries', RECORD_PDF_TRIES)
    .order('filed_at', { ascending: true })
    .limit(RECORD_BATCH)
  if (error) return { saved: 0, failed: [{ id: '', why: `the checklist records did not read: ${error.message}` }] }
  const rows = (data ?? []) as RecordRowDb[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  let saved = 0
  const failed: { id: string; why: string }[] = []
  const fail = async (r: RecordRowDb, why: string) => {
    failed.push({ id: r.id, why })
    await admin.from('stage_checklist_records').update({ pdf_fail_why: why.slice(0, 300), pdf_tries: r.pdf_tries + 1, updated_at: new Date().toISOString() }).eq('id', r.id).is('pdf_filed_at', null)
  }
  if (!saJson) {
    for (const r of rows) await fail(r, 'Drive is not set up here yet.')
    return { saved, failed }
  }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    for (const r of rows) await fail(r, `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`)
    return { saved, failed }
  }
  const folders = new Map<string, { id: string } | { why: string }>()
  for (const r of rows) {
    try {
      const job: JobRef = { jobs_ledger_id: r.job_id }
      if (!folders.has(r.job_id)) folders.set(r.job_id, await photoFolderOrWhy(admin, google, job))
      const landing = folders.get(r.job_id)!
      if ('why' in landing) {
        await fail(r, landing.why)
        continue
      }
      const { data: jobRow } = await admin.from('jobs_ledger').select('hcp_number, click_number, job_name, customer_name, job_address').eq('id', r.job_id).maybeSingle()
      const j = (jobRow ?? {}) as { hcp_number?: string | null; click_number?: string | null; job_name?: string | null; customer_name?: string | null; job_address?: string | null }
      const number = (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || r.job_id.slice(0, 8)
      const snapRows = Array.isArray(r.snapshot?.rows) ? r.snapshot!.rows! : []
      // The drawn marks, read from the bucket; one that will not read prints the name instead.
      const inks = new Map<string, Uint8Array>()
      for (const row of snapRows) {
        const path = row.signature?.storagePath
        if (!path || inks.has(path)) continue
        const { data: blob } = await admin.storage.from('stage-checklist-photos').download(path)
        if (blob) inks.set(path, new Uint8Array(await blob.arrayBuffer()))
      }
      const bytes = await buildStageChecklistPdf(pdfLib as unknown as PdfLibLike, {
        recordId: r.record_id,
        version: r.version,
        stageName: r.stage_name,
        filedAtIso: r.filed_at,
        job: { number, name: (j.job_name ?? '').trim(), customer: (j.customer_name ?? '').trim() || null, address: (j.job_address ?? '').trim() || null },
        rows: snapRows,
        skipped: Array.isArray(r.snapshot?.skipped) ? r.snapshot!.skipped! : [],
        answerCount: r.answer_count,
        signedCount: r.signed_count,
        noCount: r.no_count,
        inks,
      })
      const wanted = r.pdf_file_name || recordPdfFileName(r.record_id, r.stage_name)
      const name = await freeName(google, landing.id, (taken) => nextFreeName(wanted, taken))
      const put = await uploadBytes(google, landing.id, bytes, name, 'application/pdf')
      const { error: kept } = await admin
        .from('stage_checklist_records')
        .update({ pdf_drive_file_id: put.id, pdf_file_name: name.slice(0, 200), pdf_filed_at: new Date().toISOString(), pdf_fail_why: null, updated_at: new Date().toISOString() })
        .eq('id', r.id)
        .is('pdf_drive_file_id', null)
      if (kept) {
        await fail(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      saved += 1
    } catch (e) {
      await fail(r, driveFailWords(e instanceof Error ? e.message : String(e)))
    }
  }
  if (failed.length) console.warn('photo-save: some checklist records were not filed', failed)
  return { saved, failed }
}

/* ------------------------------------------------------------------ an eighth source: a task card's photos */

type TaskPhotoRow = {
  id: string
  instance_id: string
  kind: TaskPhotoKind
  percent_at: number | null
  criterion_id: string | null
  by_name: string
  taken_at: string
  storage_path: string
  checklist_instances: {
    scheduled_date: string
    checklist_items: { title: string; start_date: string | null; roadmap_group_task_id: string | null } | null
  } | null
}

const TASK_PHOTO_BATCH = 20

/** The folders under the Tasks folder for one card: `<day> · <title>`, or `<roadmap> › <n · stage> › <n.m · task>` for a roadmap card. */
async function taskFolderPath(admin: SupabaseClient, r: TaskPhotoRow): Promise<string[]> {
  const inst = r.checklist_instances
  const item = inst?.checklist_items
  const roadmapTaskId = item?.roadmap_group_task_id ?? null
  if (roadmapTaskId) {
    const { data: task } = await admin.from('checklist_tech_tree_group_tasks').select('id, title, sort_index, group_id').eq('id', roadmapTaskId).maybeSingle()
    const t = task as { id: string; title: string; sort_index: number; group_id: string } | null
    if (t) {
      const { data: group } = await admin.from('checklist_tech_tree_groups').select('id, title, sort_index, roadmap_id').eq('id', t.group_id).maybeSingle()
      const g = group as { id: string; title: string; sort_index: number; roadmap_id: string } | null
      if (g) {
        const [{ data: roadmap }, { data: groups }, { data: tasks }] = await Promise.all([
          admin.from('checklist_tech_tree_roadmaps').select('title').eq('id', g.roadmap_id).maybeSingle(),
          admin.from('checklist_tech_tree_groups').select('id, sort_index').eq('roadmap_id', g.roadmap_id),
          admin.from('checklist_tech_tree_group_tasks').select('id, sort_index').eq('group_id', g.id),
        ])
        const byIndex = (rows: unknown, id: string) => {
          const list = ((rows ?? []) as Array<{ id: string; sort_index: number }>).sort((a, b) => a.sort_index - b.sort_index || a.id.localeCompare(b.id))
          const i = list.findIndex((x) => x.id === id)
          return i < 0 ? list.length + 1 : i + 1
        }
        const stageNumber = byIndex(groups, g.id)
        const taskNumber = `${stageNumber}.${byIndex(tasks, t.id)}`
        return roadmapTaskFolderPath({ roadmapTitle: (roadmap as { title?: string } | null)?.title ?? '', stageNumber, stageTitle: g.title, taskNumber, taskTitle: t.title })
      }
    }
  }
  const day = item?.start_date ?? inst?.scheduled_date ?? calendarYmdInAppTzFromIso(r.taken_at)
  return [taskFolderName({ dayYmd: day, title: item?.title ?? 'Task' })]
}

/**
 * Task cards (punch list #273, PR 4): up to twenty `task_photos` rows with a `storage_path` and no `filed_at`, oldest
 * first. Each is copied from the task-photos bucket into its card's folder under the office's Tasks folder, named by the
 * day, the person and what the shot is for, *(2)* when the folder holds the name; the row keeps drive_file_id and
 * filed_at, fail_why is cleared, and the bucket copy stays as the app's thumbnail. A failure writes fail_why and the row
 * is tried again next run; no Tasks folder set writes NO_TASKS_FOLDER_WORDS on every row.
 */
async function sweepTaskPhotos(admin: SupabaseClient): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const { data, error } = await admin
    .from('task_photos')
    .select('id, instance_id, kind, percent_at, criterion_id, by_name, taken_at, storage_path, checklist_instances!inner(scheduled_date, checklist_items!inner(title, start_date, roadmap_group_task_id))')
    .is('filed_at', null)
    .not('storage_path', 'is', null)
    .order('taken_at', { ascending: true })
    .limit(TASK_PHOTO_BATCH)
  if (error) return { saved: 0, failed: [{ id: '', why: `the task photos did not read: ${error.message}` }] }
  const rows = (data ?? []) as unknown as TaskPhotoRow[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  let saved = 0
  const failed: { id: string; why: string }[] = []
  const fail = async (r: TaskPhotoRow, why: string) => {
    failed.push({ id: r.id, why })
    await admin.from('task_photos').update({ fail_why: why.slice(0, 300) }).eq('id', r.id).is('filed_at', null)
  }
  const settings = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))
  const tasksRoot = settings.tasksFolderId
  if (!tasksRoot) {
    for (const r of rows) await fail(r, NO_TASKS_FOLDER_WORDS)
    return { saved, failed }
  }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) {
    for (const r of rows) await fail(r, 'Drive is not set up here yet.')
    return { saved, failed }
  }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    for (const r of rows) await fail(r, `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`)
    return { saved, failed }
  }
  const folders = new Map<string, string>()
  for (const r of rows) {
    try {
      const path = await taskFolderPath(admin, r)
      const key = path.join('/')
      let into = folders.get(key)
      if (!into) {
        let parent = tasksRoot
        for (const name of path) parent = (await findOrCreateFolder(google, parent, name)).id
        into = parent
        folders.set(key, into)
      }
      const { data: blob, error: dl } = await admin.storage.from('task-photos').download(r.storage_path)
      if (dl || !blob) {
        await fail(r, 'Our copy of that photo did not read.')
        continue
      }
      const mime = blob.type || 'image/jpeg'
      let lineBody: string | null = null
      if (r.kind === 'line' && r.criterion_id) {
        const { data: crit } = await admin.from('task_criteria').select('body').eq('id', r.criterion_id).maybeSingle()
        lineBody = (crit as { body?: string } | null)?.body ?? null
      }
      const nameInput = { dayYmd: calendarYmdInAppTzFromIso(r.taken_at), byName: r.by_name, kind: r.kind, percentAt: r.percent_at, lineBody }
      const name = await freeName(google, into, (taken) => {
        let n = 1
        let candidate = taskPhotoDriveName(nameInput, n)
        while (taken.has(candidate) && n < 50) candidate = taskPhotoDriveName(nameInput, ++n)
        return candidate
      })
      const put = await uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, mime)
      const { error: kept } = await admin
        .from('task_photos')
        .update({ drive_file_id: put.id, filed_at: new Date().toISOString(), fail_why: null })
        .eq('id', r.id)
        .is('drive_file_id', null)
      if (kept) {
        await fail(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      saved += 1
    } catch (e) {
      await fail(r, driveFailWords(e instanceof Error ? e.message : String(e)))
    }
  }
  if (failed.length) console.warn('photo-save: some task photos were not filed', failed)
  return { saved, failed }
}

/* ------------------------------------------------------------------ a ninth source: a counter ticket's pages */

type TicketPageRow = {
  id: string
  ticket_id: string
  page_no: number
  mime: string
  storage_path: string
  drive_file_id: string | null
  drive_folder_id: string | null
  counter_tickets: { job_id: string; taken_by_name: string; taken_at: string; total: number | null } | null
}

const TICKET_PAGE_BATCH = 20

/**
 * Counter tickets (punch list #295, PR 1): up to twenty `counter_ticket_pages` rows with a `storage_path` and no
 * `filed_at`, oldest first, whose ticket is saved, has a job and is not removed. A page with no `drive_file_id` is
 * copied from the counter-tickets bucket into Team only › Tickets under the job's folder, named by the day, the taker
 * and the total, *(2)* when the folder holds the name. A page that has one already is a ticket moved to another job:
 * its Drive file moves to the new job's folder. Either way the row keeps drive_file_id, drive_folder_id and filed_at
 * and fail_why is cleared; the bucket copy stays. A failure writes fail_why and the row is tried again next run.
 */
async function sweepTickets(admin: SupabaseClient): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const { data, error } = await admin
    .from('counter_ticket_pages')
    .select('id, ticket_id, page_no, mime, storage_path, drive_file_id, drive_folder_id, counter_tickets!inner(job_id, taken_by_name, taken_at, total)')
    .is('filed_at', null)
    .not('storage_path', 'is', null)
    .not('counter_tickets.job_id', 'is', null)
    .not('counter_tickets.added_at', 'is', null)
    .is('counter_tickets.removed_at', null)
    .order('taken_at', { ascending: true })
    .limit(TICKET_PAGE_BATCH)
  if (error) return { saved: 0, failed: [{ id: '', why: `the ticket pages did not read: ${error.message}` }] }
  const rows = (data ?? []) as unknown as TicketPageRow[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  let saved = 0
  const failed: { id: string; why: string }[] = []
  const fail = async (r: TicketPageRow, why: string) => {
    failed.push({ id: r.id, why })
    await admin.from('counter_ticket_pages').update({ fail_why: why.slice(0, 300) }).eq('id', r.id).is('filed_at', null)
  }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) {
    for (const r of rows) await fail(r, 'Drive is not set up here yet.')
    return { saved, failed }
  }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    for (const r of rows) await fail(r, `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`)
    return { saved, failed }
  }
  const folders = new Map<string, { id: string } | { why: string }>()
  for (const r of rows) {
    try {
      const ticket = r.counter_tickets
      if (!ticket?.job_id) continue
      const jobId = ticket.job_id
      if (!folders.has(jobId)) folders.set(jobId, await ticketFolderOrWhy(admin, google, jobId))
      const landing = folders.get(jobId)!
      if ('why' in landing) {
        await fail(r, landing.why)
        continue
      }
      const into = landing.id
      let driveFileId = r.drive_file_id
      if (driveFileId) {
        // A ticket moved to another job: the one file moves; its id and every link to it stay.
        if (r.drive_folder_id !== into) await moveFolder(google, driveFileId, r.drive_folder_id, into)
      } else {
        const { data: blob, error: dl } = await admin.storage.from(COUNTER_TICKETS_BUCKET).download(r.storage_path)
        if (dl || !blob) {
          await fail(r, 'Our copy of that page did not read.')
          continue
        }
        const mime = r.mime || blob.type || 'image/jpeg'
        const nameInput = { dayYmd: calendarYmdInAppTzFromIso(ticket.taken_at), byName: ticket.taken_by_name, total: ticket.total, pageNo: r.page_no, mime }
        const name = await freeName(google, into, (taken) => {
          let n = 1
          let candidate = ticketDriveName(nameInput, n)
          while (taken.has(candidate) && n < 50) candidate = ticketDriveName(nameInput, ++n)
          return candidate
        })
        driveFileId = (await uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, mime)).id
      }
      const { error: kept } = await admin
        .from('counter_ticket_pages')
        .update({ drive_file_id: driveFileId, drive_folder_id: into, filed_at: new Date().toISOString(), fail_why: null })
        .eq('id', r.id)
        .is('filed_at', null)
      if (kept) {
        await fail(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      // The job changed while this ran: the page is in the old job's folder, so it files again next run.
      const { data: now } = await admin.from('counter_tickets').select('job_id').eq('id', r.ticket_id).maybeSingle()
      if ((now as { job_id: string | null } | null)?.job_id !== jobId) {
        await admin.from('counter_ticket_pages').update({ filed_at: null }).eq('id', r.id)
        continue
      }
      saved += 1
    } catch (e) {
      await fail(r, driveFailWords(e instanceof Error ? e.message : String(e)))
    }
  }
  if (failed.length) console.warn('photo-save: some ticket pages were not filed', failed)
  return { saved, failed }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
  if (!cronSecret || headerSecret !== cronSecret) return json({ error: 'Unauthorized' }, 401)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const messages = await sweep(admin)
    const boxes = await sweepWaiting(admin, BOX_SOURCE)
    const reports = await sweepNamedPhotos(admin, REPORT_SOURCE)
    const checklists = await sweepWaiting(admin, CHECKLIST_SOURCE)
    const jobPhotos = await sweepNamedPhotos(admin, JOB_PHOTO_SOURCE)
    const machines = await sweepMachinePhotos(admin)
    const records = await sweepRecords(admin)
    const taskPhotos = await sweepTaskPhotos(admin)
    const tickets = await sweepTickets(admin)
    const body = (await messages.json()) as Record<string, unknown>
    return json({ ...body, boxes, reports, checklists, jobPhotos, machines, records, taskPhotos, tickets }, messages.status)
  } catch (e) {
    console.error('photo-save', e)
    return json({ error: e instanceof Error ? e.message : 'The sweep failed.' }, 500)
  }
})

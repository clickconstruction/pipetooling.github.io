import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import { findOrCreateFolder, googleAccessToken, putResumablePiece, resumableStatus, startResumableUpload, uploadBytes } from '../_shared/driveUpload.ts'
import { lookFolderOrWhy, lookTree, type LookForFolder, type LookTree } from '../_shared/driveLookFolder.ts'
import { DRIVE_WHOLE_MAX_BYTES, lookCountsAsSent, lookFileDriveName, lookFileDue } from '../_shared/firstLookDrive.ts'
import { copyInPieces } from '../_shared/driveCopyInPieces.ts'
import { FIRST_LOOK_UPLOAD_ADDRESS_HOURS, firstLookObjectPath, firstLookSentLine } from '../_shared/firstLook.ts'
import { driveFileState, folderFiles, freeName, photoFolderOrWhy } from '../_shared/driveJobFolder.ts'
import { REFILE_ASK_REFUSAL, REFILE_BUDGET_MS, REFILE_SWEEP_BATCH, dueRowsByJob, mayAskRefile, nextFreeName, refileAskOf, refileResult, refileRowNeedsClearing, refileRowPatch, refileStep, type RefileHeld, type RefileMoved, type RefileResult } from '../_shared/boxPhotoRefile.ts'
import { readDriveSettings } from '../_shared/driveSettings.ts'
import { calendarYmdInAppTzFromIso } from '../_shared/appTimeZone.ts'
import { roadmapTaskFolderPath, taskFolderName, taskPhotoDriveName, type TaskPhotoKind } from '../_shared/taskPhotoNames.ts'
import type { PdfLibLike } from '../_shared/jobContractPdf.ts'
import { buildStageChecklistPdf, recordPdfFileName, type RecordPdfRow } from '../_shared/stageChecklistPdf.ts'
import { machineFolderOrWhy } from '../_shared/driveMachineFolder.ts'
import { ticketFolderOrWhy } from '../_shared/driveTicketFolder.ts'
import { moveFile, moveFolder } from '../_shared/jobFolders.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { COUNTER_TICKETS_BUCKET, ticketDriveName } from '../_shared/ticketNames.ts'
import { NO_TASKS_FOLDER_WORDS, driveFailWords } from '../_shared/whereFilesGo.ts'
import type { JobRef } from '../_shared/driveLink.ts'
import { ensureBidPhotoFolder, readBidForFolder, type BidFolderContext, type BidPhotoFolder } from '../_shared/bidFolder.ts'
import { BID_PHOTOS_BUCKET, BID_PHOTO_BATCH, BID_PHOTO_PLAIN_CAPTION, BID_PHOTO_RETRY_MS, bidPhotoFailWords, isQuotaRefusal, namedPhotoFileName } from '../_shared/bidPhotos.ts'
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
 *     taskPhotos: { saved, failed }, tickets: { saved, failed }, bidPhotos: { saved, failed }, boxRefiles: { saved, failed },
 *     looks: { saved, failed } }
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
 * Bid photos (punch list #306, PR 2): a tenth source after the tickets. A photo added to a bid from the Bid Board waits
 * in the bid-photos bucket with a `bid_photos` row; once the person pressed Add (added_at set) and while it is not
 * removed, the sweep files it into the bid's project folder under Team only › Photos, where a text's photo saved onto a
 * bid already lands. A bid with no project folder gets one made under the jobs root by the office's bid pattern, and
 * its link written on the bid (`ensureBidPhotoFolder`, `_shared/bidFolder.ts`, the rule drive-intake uses). The file is
 * named as the person named it (*Mechanical room north.jpg*), else by day and sender as a text's photo is, and carries
 * the row's id as an app property, so the folder's listing never adopts it as a second row. Most hand-made bid folders
 * sit in a personal Drive, where a service account cannot own a file: there the sweep files as the Workspace person in
 * DRIVE_IMPERSONATE_USER when that secret is set, and without it writes the reason on the row. A row it could not file
 * keeps fail_why and tried_at, and is left alone for an hour (the cron's clause holds the same hour), since a held bid
 * folder is common and stays held until someone moves it. The bucket copy is deleted once the file is in Drive.
 *
 * The files follow a job that moved (punch list #297, v2.6885): a box photo's row moves with its box when a job's
 * Materials on site are moved to another job (the dev seat's `apply_materials_move`) or carried by a whole-job combine,
 * but a file already filed stays in the first job's photo folder. One ask moves them:
 *
 *   POST { refile_box_photos: <job_id> } (the session of a role that may combine jobs, or X-Cron-Secret) → { job_id, folder_id, folder_url, in_drive,
 *     moved: [{ id, file_name, drive_file_id, renamed_to? }], already, held: [{ id, file_name, why }], left, words }
 *
 * For each `job_box_photos` row of the job with a `drive_file_id`, a file not in the folder the job's photos land in
 * (`photoFolderOrWhy`, the sweep's own resolver, which makes the folder as a first photo would) is moved there with
 * Drive's addParents / removeParents (`moveFile`), its id and every link to it kept, under the next free name when
 * the folder holds its own. It does what is ready: a file Drive no longer holds, one in Drive's trash or one Drive
 * refuses is held with its reason, written on the row as fail_why (the app draws that only on a photo not filed), and
 * the rest move. The folder is listed once, so a second ask reads one page and moves nothing. An ask that runs past
 * REFILE_BUDGET_MS answers how many are left. Rules and words: `_shared/boxPhotoRefile.ts`.
 *
 * The engine (v2.6915): an eleventh source after the bid photos. A filed box photo whose job changes is marked due by
 * the database (`job_box_photos.refile_due_at`, trigger `job_box_photos_job_changed`), so a whole-job combine's files
 * follow here with no caller, twenty a run, oldest due first (`sweepRefileDue`), and an ask that failed or ran out of
 * time is finished here. A file that is where it belongs loses its mark; a held one keeps its reason in fail_why and is
 * due again a day on, so one restored from Drive's trash follows by itself.
 *
 * The cron calls only while one of these waits: each source is a clause of its WHERE, so a migration that adds a
 * source re-schedules it with every clause (20261111024500_box_photo_refile_due.sql holds all eleven).
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (who makes the re-file ask), CRON_SECRET,
 * GOOGLE_SERVICE_ACCOUNT_JSON; DRIVE_IMPERSONATE_USER
 * (optional) lets a bid photo reach a folder in a personal Drive. config.toml keeps
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
// The files follow a job that moved (#297): every filed box photo of one job into the folder its photos land in.
// ---------------------------------------------------------------------------

const BOX_REFILE_MAX_ROWS = 2000

type BoxRefileRow = { id: string; job_id: string; file_name: string; drive_file_id: string; fail_why: string | null; refile_due_at: string | null }

const BOX_REFILE_COLUMNS = 'id, job_id, file_name, drive_file_id, fail_why, refile_due_at'

type RefileTally = { folderId: string | null; moved: RefileMoved[]; already: number; held: RefileHeld[]; left: number }

/**
 * One job's rows moved into the folder its photos land in: the ask's rows (every filed photo of the job) or the
 * sweep's (the ones due). A row that is where it belongs loses its mark and its reason; a held one keeps its reason
 * and is due again a day on (`refileRowPatch`); one not reached before `deadline` stays due, so the sweep takes it.
 */
async function refileJobRows(admin: SupabaseClient, google: string, jobId: string, rows: readonly BoxRefileRow[], deadline: number | null): Promise<RefileTally> {
  const moved: RefileMoved[] = []
  const held: RefileHeld[] = []
  let already = 0
  let left = 0
  const hold = async (r: BoxRefileRow, why: string) => {
    held.push({ id: r.id, file_name: r.file_name, why })
    await admin.from('job_box_photos').update(refileRowPatch({ held: why }, new Date())).eq('id', r.id)
  }
  const settled = async (r: BoxRefileRow) => {
    if (refileRowNeedsClearing(r)) await admin.from('job_box_photos').update(refileRowPatch({ settled: true }, new Date())).eq('id', r.id)
  }
  let landing: { id: string } | { why: string }
  let inFolder: Map<string, string>
  try {
    landing = await photoFolderOrWhy(admin, google, { jobs_ledger_id: jobId })
    if ('why' in landing) {
      for (const r of rows) await hold(r, landing.why)
      return { folderId: null, moved, already, held, left }
    }
    inFolder = await folderFiles(google, landing.id)
  } catch (e) {
    // The folder could not be read: nothing is known about any file, so every row stays as it is and is tried again.
    throw new Error(`The job’s photo folder did not read: ${e instanceof Error ? e.message : String(e)}`)
  }
  const names = new Set(inFolder.values())
  for (const r of rows) {
    if (inFolder.has(r.drive_file_id)) {
      already += 1
      await settled(r)
      continue
    }
    if (deadline !== null && Date.now() > deadline) {
      left += 1
      continue
    }
    try {
      const step = refileStep(await driveFileState(google, r.drive_file_id), landing.id, names)
      if (step.kind === 'held') {
        await hold(r, step.why)
      } else if (step.kind === 'already') {
        already += 1
        await settled(r)
      } else {
        await moveFile(google, r.drive_file_id, step.removeParents, landing.id, step.renamed ? step.name : undefined)
        names.add(step.name)
        moved.push({ id: r.id, file_name: r.file_name, drive_file_id: r.drive_file_id, ...(step.renamed ? { renamed_to: step.name } : {}) })
        await settled(r)
      }
    } catch (e) {
      await hold(r, driveFailWords(e instanceof Error ? e.message : String(e)))
    }
  }
  return { folderId: landing.id, moved, already, held, left }
}

async function refileBoxPhotos(admin: SupabaseClient, jobId: string): Promise<{ result: RefileResult } | { error: string; status: number }> {
  const { data: job, error: jobError } = await admin.from('jobs_ledger').select('id').eq('id', jobId).maybeSingle()
  if (jobError) return { error: `The job did not read: ${jobError.message}`, status: 500 }
  if (!job) return { error: 'There is no job with that id.', status: 404 }
  const { data, error } = await admin
    .from('job_box_photos')
    .select(BOX_REFILE_COLUMNS)
    .eq('job_id', jobId)
    .not('drive_file_id', 'is', null)
    .order('taken_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(BOX_REFILE_MAX_ROWS)
  if (error) return { error: `The box photos did not read: ${error.message}`, status: 500 }
  const rows = (data ?? []) as BoxRefileRow[]
  if (rows.length === 0) return { result: refileResult({ jobId, folderId: null, inDrive: 0, moved: [], already: 0, held: [], left: 0 }) }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) return { error: 'Drive is not set up here yet.', status: 503 }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    return { error: `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`, status: 502 }
  }
  try {
    const t = await refileJobRows(admin, google, jobId, rows, Date.now() + REFILE_BUDGET_MS)
    if (t.held.length) console.warn('photo-save: some box photos were not moved to their job’s folder', t.held)
    return { result: refileResult({ jobId, folderId: t.folderId, inDrive: rows.length, moved: t.moved, already: t.already, held: t.held, left: t.left }) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), status: 502 }
  }
}

/**
 * The eleventh source (v2.6915): box photos due a move, twenty a run, oldest due first. The database marks a filed
 * photo due when its job changes, so a combine's files follow here with no caller, and an ask that failed or ran out of
 * time is finished here. `saved` counts the rows now where they belong; a held one is listed with its reason.
 */
async function sweepRefileDue(admin: SupabaseClient): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const { data, error } = await admin
    .from('job_box_photos')
    .select(BOX_REFILE_COLUMNS)
    .not('drive_file_id', 'is', null)
    .lte('refile_due_at', new Date().toISOString())
    .order('refile_due_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(REFILE_SWEEP_BATCH)
  if (error) return { saved: 0, failed: [{ id: '', why: `the box photos due a move did not read: ${error.message}` }] }
  const rows = (data ?? []) as BoxRefileRow[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  // Without Drive nothing can be known about a file: the rows stay due and are read again next run.
  if (!saJson) return { saved: 0, failed: rows.map((r) => ({ id: r.id, why: 'Drive is not set up here yet.' })) }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    const why = `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`
    return { saved: 0, failed: rows.map((r) => ({ id: r.id, why })) }
  }
  let saved = 0
  const failed: { id: string; why: string }[] = []
  for (const [jobId, jobRows] of dueRowsByJob(rows)) {
    try {
      const t = await refileJobRows(admin, google, jobId, jobRows, null)
      saved += t.moved.length + t.already
      for (const h of t.held) failed.push({ id: h.id, why: h.why })
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      for (const r of jobRows) failed.push({ id: r.id, why })
    }
  }
  if (failed.length) console.warn('photo-save: some box photos due a move were not moved', failed)
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

/* ------------------------------------------------------------------ a tenth source: a bid's photos */

type BidPhotoRow = { id: string; bid_id: string; storage_path: string; by_name: string; taken_at: string; name: string }

/** A bid's photo folder for this run, and whether the app files there as itself (the shared Drive) or as the person. */
type BidLanding = { into: string; asApp: boolean } | { why: string }

async function sweepBidPhotos(admin: SupabaseClient): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const dueBefore = new Date(Date.now() - BID_PHOTO_RETRY_MS).toISOString()
  const { data, error } = await admin
    .from('bid_photos')
    .select('id, bid_id, storage_path, by_name, taken_at, name')
    .is('filed_at', null)
    .not('storage_path', 'is', null)
    .not('added_at', 'is', null)
    .is('removed_at', null)
    .or(`tried_at.is.null,tried_at.lt.${dueBefore}`)
    .order('taken_at', { ascending: true })
    .limit(BID_PHOTO_BATCH)
  if (error) return { saved: 0, failed: [{ id: '', why: `the bid photos did not read: ${error.message}` }] }
  const rows = (data ?? []) as BidPhotoRow[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  let saved = 0
  const failed: { id: string; why: string }[] = []
  const fail = async (r: BidPhotoRow, why: string) => {
    failed.push({ id: r.id, why })
    await admin.from('bid_photos').update({ fail_why: why.slice(0, 300), tried_at: new Date().toISOString() }).eq('id', r.id).is('filed_at', null)
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
  // Filing as a person is how a file reaches a folder in a personal Drive; the token is made the first time one is needed.
  const person = Deno.env.get('DRIVE_IMPERSONATE_USER')?.trim() || null
  let personToken: string | null = null
  const asPerson = async (): Promise<string | null> => {
    if (!person) return null
    if (!personToken) personToken = await googleAccessToken(saJson, person)
    return personToken
  }
  const ctx: BidFolderContext = {
    admin,
    token: google,
    settings: await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID')),
    appEmail: String((JSON.parse(saJson) as { client_email?: string }).client_email ?? ''),
    canActAsPerson: !!person,
  }
  const landings = new Map<string, BidLanding>()
  const landingOf = async (bidId: string): Promise<BidLanding> => {
    const bid = await readBidForFolder(admin, bidId)
    if (!bid) return { why: 'That bid is gone.' }
    const folder: BidPhotoFolder = await ensureBidPhotoFolder(ctx, bid)
    if ('why' in folder) return folder
    // In the shared Drive the app files as itself; in a personal Drive, as the person.
    return { into: folder.id, asApp: folder.seen !== 'outside_drive' }
  }
  for (const r of rows) {
    try {
      // A bid whose folder did not read is not asked again for its other photos this run.
      if (!landings.has(r.bid_id)) {
        landings.set(r.bid_id, await landingOf(r.bid_id).catch((e): BidLanding => ({ why: bidPhotoFailWords(e instanceof Error ? e.message : String(e)) })))
      }
      const landing = landings.get(r.bid_id)!
      if ('why' in landing) {
        await fail(r, landing.why)
        continue
      }
      const { data: blob, error: dl } = await admin.storage.from(BID_PHOTOS_BUCKET).download(r.storage_path)
      if (dl || !blob) {
        await fail(r, 'Our copy of that photo did not read.')
        continue
      }
      const mime = blob.type || 'image/jpeg'
      const bytes = new Uint8Array(await blob.arrayBuffer())
      // The person's own name for it, else the day, the sender and *Bid photo*, as a text's photo is named.
      const nameInput = { at: r.taken_at, sender: r.by_name, fileName: 'photo', mime, words: BID_PHOTO_PLAIN_CAPTION, place: 1 }
      const name = await freeName(google, landing.into, (taken) => namedPhotoFileName(r.name, mime, taken) ?? photoDriveName(nameInput, taken))
      const marks = { bid_photo_id: r.id }
      let put: { id: string }
      if (landing.asApp) {
        try {
          put = await uploadBytes(google, landing.into, bytes, name, mime, marks)
        } catch (e) {
          // A quota refusal the folder's own facts did not foretell: once more as the person, when there is one.
          const raw = e instanceof Error ? e.message : String(e)
          const theirs = isQuotaRefusal(raw) ? await asPerson().catch(() => null) : null
          if (!theirs) throw e
          put = await uploadBytes(theirs, landing.into, bytes, name, mime, marks)
        }
      } else {
        const theirs = await asPerson()
        if (!theirs) throw new Error('storage quota')
        put = await uploadBytes(theirs, landing.into, bytes, name, mime, marks)
      }
      const { error: kept } = await admin
        .from('bid_photos')
        .update({ drive_file_id: put.id, filed_at: new Date().toISOString(), fail_why: null, tried_at: null })
        .eq('id', r.id)
        .is('drive_file_id', null)
      if (kept) {
        await fail(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      await admin.storage.from(BID_PHOTOS_BUCKET).remove([r.storage_path])
      saved += 1
    } catch (e) {
      await fail(r, bidPhotoFailWords(e instanceof Error ? e.message : String(e)))
    }
  }
  if (failed.length) console.warn('photo-save: some bid photos were not filed', failed)
  return { saved, failed }
}

/* ------------------------------------------------------------------ a twelfth source: a First look's files */

const LOOK_FILE_BATCH = 24
const LOOK_BUDGET_MS = 40_000
const LOOK_FILES_BUCKET = 'first-look-files'
const LOOK_TEXTED_DAYS = 14
const LOOK_TEXTED_LOOKS = 20

type LookRow = LookForFolder & { sent_at: string | null; sent_count: number; words: string | null }
type LookFileRow = {
  id: string
  look_id: string
  kind: 'photo' | 'video'
  mime: string
  storage_path: string
  bytes: number | null
  finished_at: string | null
  drive_upload_uri: string | null
  drive_upload_offset: number | null
  first_looks: LookRow
}

/**
 * One file from the app's storage into a Drive folder. A file of 8 MiB or less goes in one request, as every photo
 * does. A bigger one, a video, goes in pieces read from storage one range at a time, so the function never holds more
 * than a piece; `resume` keeps Drive's address and how far it got, and past the deadline the copy stops where it is
 * and answers `paused` for the next run to pick up.
 */
async function copyToDrive(
  admin: SupabaseClient,
  google: string,
  src: { bucket: string; path: string; bytes: number | null; mime: string },
  into: string,
  name: string,
  resume: { uri: string | null; save: (uri: string | null, offset: number | null) => Promise<void> } | null,
  deadline: number,
): Promise<{ id: string } | { paused: true }> {
  const total = Number(src.bytes ?? 0)
  if (!(total > DRIVE_WHOLE_MAX_BYTES)) {
    const { data: blob, error } = await admin.storage.from(src.bucket).download(src.path)
    if (error || !blob) throw new Error('Our copy of that file did not read.')
    return uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, src.mime)
  }
  const { data: signed, error: signErr } = await admin.storage.from(src.bucket).createSignedUrl(src.path, 900)
  if (signErr || !signed?.signedUrl) throw new Error('Our copy of that file did not read.')
  return copyInPieces(
    total,
    resume?.uri ?? null,
    {
      start: () => startResumableUpload(google, into, name, src.mime, total),
      status: (uri) => resumableStatus(google, uri, total),
      put: (uri, bytes, contentRange) => putResumablePiece(google, uri, bytes, contentRange),
      read: async (from, to) => {
        const got = await fetch(signed.signedUrl, { headers: { Range: `bytes=${from}-${to}` } })
        if (!got.ok) throw new Error('Our copy of that file did not read.')
        return new Uint8Array(await got.arrayBuffer())
      },
      save: async (uri, offset) => {
        await resume?.save(uri, offset)
      },
    },
    deadline,
  )
}

/** A name nobody in the folder holds: *Photo 1.jpg*, then *Photo 2.jpg*, in the order the files reach Drive. */
function lookFreeName(google: string, into: string, kind: 'photo' | 'video', mime: string): Promise<string> {
  return freeName(
    google,
    into,
    (taken) => {
      let n = 1
      let candidate = lookFileDriveName(kind, n, mime)
      while (taken.has(candidate) && n < 60) candidate = lookFileDriveName(kind, ++n, mime)
      return candidate
    },
    60,
  )
}

/**
 * First look (punch list #319 PR 2): the files a customer sent through a look's link, and the pictures they texted in
 * since the ask, filed in Drive under the customer's **Customer supplied photos**, a folder a look
 * (`driveLookFolder.ts`). Up to twenty-four `first_look_files` rows that are finished, not removed and not in Drive,
 * the ones not tried lately first. A file is due once its look was sent, or half an hour after it finished with no
 * Send; a look whose newest file is that old is stamped sent here, with the thread's line the Send would have written.
 * A photo goes in one request and a video in pieces, its place kept on the row. A caller who is not a customer yet has
 * no folder: the reason is written as fail_why and the row waits at the back of the line. The app's own copy stays,
 * since the thread, the estimate and a tech draw from it.
 */
async function sweepLooks(admin: SupabaseClient): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const nowMs = Date.now()
  const deadline = nowMs + LOOK_BUDGET_MS
  let saved = 0
  const failed: { id: string; why: string }[] = []
  const { data, error } = await admin
    .from('first_look_files')
    .select('id, look_id, kind, mime, storage_path, bytes, finished_at, drive_upload_uri, drive_upload_offset, first_looks!inner(id, contact_id, made_at, place, drive_folder_id, sent_at, sent_count, words)')
    .is('drive_file_id', null)
    .not('finished_at', 'is', null)
    .is('removed_at', null)
    .order('drive_tried_at', { ascending: true, nullsFirst: true })
    .order('finished_at', { ascending: true })
    .limit(LOOK_FILE_BATCH)
  if (error) return { saved: 0, failed: [{ id: '', why: `the looks' files did not read: ${error.message}` }] }
  const rows = (data ?? []) as unknown as LookFileRow[]

  // A look with files in and no Send for half an hour counts as sent.
  const looks = new Map<string, LookRow>()
  for (const r of rows) if (!looks.has(r.look_id)) looks.set(r.look_id, r.first_looks)
  for (const look of looks.values()) {
    if (look.sent_at) continue
    const { data: all } = await admin.from('first_look_files').select('kind, finished_at').eq('look_id', look.id).not('finished_at', 'is', null).is('removed_at', null)
    const files = (all ?? []) as { kind: string; finished_at: string | null }[]
    if (!lookCountsAsSent(look, files.map((f) => f.finished_at), nowMs)) continue
    const nowIso = new Date(nowMs).toISOString()
    const { data: stamped } = await admin.from('first_looks').update({ sent_at: nowIso, sent_count: look.sent_count + 1 }).eq('id', look.id).is('sent_at', null).select('id')
    if (!(stamped ?? []).length) continue
    look.sent_at = nowIso
    if (look.contact_id) {
      const line = firstLookSentLine({ lookId: look.id, sentCount: look.sent_count + 1, photos: files.filter((f) => f.kind === 'photo').length, videos: files.filter((f) => f.kind === 'video').length })
      await admin.from('messages').upsert({ contact_id: look.contact_id, channel: 'portal', direction: 'in', body: line.body, quo_id: line.key }, { onConflict: 'quo_id', ignoreDuplicates: true })
    }
  }

  const due = rows.filter((r) => lookFileDue(r, r.first_looks, nowMs))
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  const tried = async (r: LookFileRow, why: string | null) => {
    if (why) failed.push({ id: r.id, why })
    await admin.from('first_look_files').update({ fail_why: why ? why.slice(0, 300) : null, drive_tried_at: new Date().toISOString() }).eq('id', r.id).is('drive_file_id', null)
  }
  if (!saJson) {
    for (const r of due) await tried(r, 'Drive is not set up here yet.')
    return { saved, failed }
  }
  let google: string
  let trees: LookTree
  try {
    google = await googleAccessToken(saJson)
    trees = await lookTree(admin, google)
  } catch (e) {
    for (const r of due) await tried(r, `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`)
    return { saved, failed }
  }
  const folders = new Map<string, { id: string } | { why: string }>()
  const folderOf = async (look: LookForFolder) => {
    if (!folders.has(look.id)) folders.set(look.id, await lookFolderOrWhy(admin, google, look, trees))
    return folders.get(look.id)!
  }
  for (const r of due) {
    if (Date.now() > deadline) break
    try {
      const landing = await folderOf(r.first_looks)
      if ('why' in landing) {
        await tried(r, landing.why)
        continue
      }
      const name = await lookFreeName(google, landing.id, r.kind, r.mime)
      const put = await copyToDrive(
        admin,
        google,
        { bucket: LOOK_FILES_BUCKET, path: r.storage_path, bytes: r.bytes, mime: r.mime },
        landing.id,
        name,
        {
          uri: r.drive_upload_uri,
          save: async (uri, offset) => {
            await admin.from('first_look_files').update({ drive_upload_uri: uri, drive_upload_offset: offset }).eq('id', r.id)
          },
        },
        deadline,
      )
      if ('paused' in put) {
        // Part way: no reason to show, and no stamp. The cron calls again in five minutes for a file never tried or
        // not tried lately, and the copy goes on from where Drive says it stopped.
        continue
      }
      const { error: kept } = await admin
        .from('first_look_files')
        .update({ drive_file_id: put.id, filed_at: new Date().toISOString(), fail_why: null, drive_upload_uri: null, drive_upload_offset: null, drive_tried_at: new Date().toISOString() })
        .eq('id', r.id)
        .is('drive_file_id', null)
      if (kept) {
        await tried(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      saved += 1
    } catch (e) {
      await tried(r, driveFailWords(e instanceof Error ? e.message : String(e)))
    }
  }

  // The pictures and videos they texted in since the ask go to the look's folder too (the owner's call 12): a file on a
  // line from that person, kept by us and in Drive nowhere yet. One the Messages pass above already took for a ticked
  // job stays where that put it.
  const since = new Date(nowMs - LOOK_TEXTED_DAYS * 86_400_000).toISOString()
  const { data: openLooks } = await admin
    .from('first_looks')
    .select('id, contact_id, made_at, place, drive_folder_id')
    .is('closed_at', null)
    .not('contact_id', 'is', null)
    .gte('made_at', since)
    .order('made_at', { ascending: false })
    .limit(LOOK_TEXTED_LOOKS)
  const claimed = new Set<string>()
  for (const look of (openLooks ?? []) as LookForFolder[]) {
    if (Date.now() > deadline) break
    const { data: texted } = await admin
      .from('message_attachments')
      .select('id, name, mime, size_bytes, bucket_path, messages!inner(contact_id, direction, at)')
      .eq('kind', 'file')
      .is('drive_file_id', null)
      .is('sent_as', null)
      .not('bucket_path', 'is', null)
      .eq('messages.direction', 'in')
      .eq('messages.contact_id', look.contact_id)
      .gte('messages.at', look.made_at)
      .limit(10)
    for (const a of (texted ?? []) as unknown as { id: string; name: string; mime: string | null; size_bytes: number | null; bucket_path: string }[]) {
      if (Date.now() > deadline) break
      // The newest look asked before it came holds it; an older open look does not take it again.
      if (claimed.has(a.id)) continue
      claimed.add(a.id)
      const mime = (a.mime ?? '').toLowerCase()
      const kind = mime.startsWith('image/') ? 'photo' : mime.startsWith('video/') ? 'video' : null
      if (!kind) continue
      try {
        const landing = await folderOf(look)
        if ('why' in landing) break
        const name = await lookFreeName(google, landing.id, kind, mime)
        const put = await copyToDrive(admin, google, { bucket: 'message-attachments', path: a.bucket_path, bytes: a.size_bytes, mime }, landing.id, name, null, deadline)
        if ('paused' in put) continue
        const { error: kept } = await admin.from('message_attachments').update({ drive_file_id: put.id }).eq('id', a.id).is('drive_file_id', null)
        if (kept) failed.push({ id: a.id, why: 'Saved to Drive, but the row did not keep it.' })
        else saved += 1
      } catch (e) {
        failed.push({ id: a.id, why: driveFailWords(e instanceof Error ? e.message : String(e)) })
      }
    }
  }
  // PR 3: a finished file was moved out from under its upload address (`firstLookKeptPath`). Once that address has run
  // out, anything written to the old place since is dropped. Removing a place that holds nothing is not an error.
  try {
    const from = new Date(nowMs - 26 * 3_600_000).toISOString()
    const until = new Date(nowMs - FIRST_LOOK_UPLOAD_ADDRESS_HOURS * 3_600_000).toISOString()
    const { data: moved } = await admin.from('first_look_files').select('id, look_id, mime, storage_path').gte('finished_at', from).lte('finished_at', until).like('storage_path', '%/kept/%').limit(200)
    const old = ((moved ?? []) as { id: string; look_id: string; mime: string; storage_path: string }[]).map((f) => firstLookObjectPath(f.look_id, f.id, f.mime))
    if (old.length) await admin.storage.from(LOOK_FILES_BUCKET).remove(old)
  } catch (e) {
    console.warn('photo-save: the looks’ old upload places were not cleared', e instanceof Error ? e.message : e)
  }
  if (failed.length) console.warn('photo-save: some of a look’s files were not filed', failed)
  return { saved, failed }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
  const isCron = Boolean(cronSecret) && headerSecret === cronSecret
  // The sweep's call carries no body; the re-file ask (#297) names its job in one.
  const ask = refileAskOf(await req.json().catch(() => null))
  if (ask) {
    try {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      // The one ask a person may make, with their own session. Everything else here is the cron's.
      if (!isCron) {
        const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
        const { data: me } = await asUser.auth.getUser()
        const archivedRefusal = await refuseArchivedCaller(admin, me?.user?.id, corsHeaders)
        if (archivedRefusal) return archivedRefusal
        if (!me?.user) return json({ error: 'Sign in first.' }, 401)
        // v2.6927: the roles that may combine two jobs may ask, since the app asks for them right after a combine.
        const { data: asker } = await admin.from('users').select('role').eq('id', me.user.id).maybeSingle()
        if (!mayAskRefile((asker as { role: string | null } | null)?.role)) return json({ error: REFILE_ASK_REFUSAL }, 403)
      }
      if (!ask.ok) return json({ error: ask.error }, 400)
      const out = await refileBoxPhotos(admin, ask.jobId)
      return 'error' in out ? json({ error: out.error }, out.status) : json(out.result)
    } catch (e) {
      console.error('photo-save refile', e)
      return json({ error: e instanceof Error ? e.message : 'The move failed.' }, 500)
    }
  }
  if (!isCron) return json({ error: 'Unauthorized' }, 401)
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
    const bidPhotos = await sweepBidPhotos(admin)
    const boxRefiles = await sweepRefileDue(admin)
    // The newest source runs last and inside its own guard, so nothing it meets can cost the eleven before it.
    const looks = await sweepLooks(admin).catch((e) => ({ saved: 0, failed: [{ id: '', why: e instanceof Error ? e.message : 'The looks pass failed.' }] }))
    const body = (await messages.json()) as Record<string, unknown>
    return json({ ...body, boxes, reports, checklists, jobPhotos, machines, records, taskPhotos, tickets, bidPhotos, boxRefiles, looks }, messages.status)
  } catch (e) {
    console.error('photo-save', e)
    return json({ error: e instanceof Error ? e.message : 'The sweep failed.' }, 500)
  }
})

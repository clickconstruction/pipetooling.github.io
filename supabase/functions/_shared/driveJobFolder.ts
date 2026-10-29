/**
 * A job's Drive folder, read and written through the service account (lifted from drive-link, Messages cut 10, so the
 * office's door and the photo-save sweep share one implementation; cut 7e lifted the rest, so messages-email reads a
 * file's bytes and makes our link to it as drive-link does). A job is one of the spine's three: a GC project
 * (`gc_projects.drive_folder_url`, with its Plans and Team only halves), a bid (`bids.drive_link`) or a Pipeline job
 * (`jobs_ledger.google_drive_link`). A bid's or a Pipeline job's folder has no halves. A photo lands in Team only › Photos
 * under the job's folder, or in a Pipeline job's own Customer Pictures folder when that link is plainly a Drive folder
 * (`photoLanding`, the lead, 2026-10-13).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findExistingFile, findOrCreateFolder } from './driveUpload.ts'
import { DRIVE_FOLDER_MIME, LINK_TOKEN_BYTES, fileLinkUrl, linkToken, photoLanding, type JobRef } from './driveLink.ts'
import { readDriveSettings } from './driveSettings.ts'
import { JOB_FOLDER_TREE } from './whereFilesGo.ts'
import { sha256Hex } from './gcTradeLink.ts'

export type Half = 'plans' | 'team_only'

export interface JobFolder {
  folderId: string
  /** The halves, or null where a job's folder has none. */
  plansId: string | null
  teamId: string | null
}

export async function driveGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Drive answered ${res.status}`)
  return (await res.json()) as T
}

/** A child folder by its name, or null; never made here. */
export async function childFolder(token: string, parentId: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`)
  const body = await driveGet<{ files?: { id: string }[] }>(token, `${DRIVE}/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`)
  return body.files?.[0]?.id ?? null
}

/** The job's folder and its halves, from the row that holds its link. */
export async function jobFolder(admin: SupabaseClient, token: string, job: JobRef): Promise<JobFolder | null> {
  let url: string | null = null
  if ('project_id' in job) {
    const { data } = await admin.from('gc_projects').select('drive_folder_url').eq('project_id', job.project_id).maybeSingle()
    url = (data as { drive_folder_url?: string } | null)?.drive_folder_url ?? null
  } else if ('bid_id' in job) {
    const { data } = await admin.from('bids').select('drive_link').eq('id', job.bid_id).maybeSingle()
    url = (data as { drive_link?: string } | null)?.drive_link ?? null
  } else {
    const { data } = await admin.from('jobs_ledger').select('google_drive_link').eq('id', job.jobs_ledger_id).maybeSingle()
    url = (data as { google_drive_link?: string } | null)?.google_drive_link ?? null
  }
  const folderId = driveFolderIdFromUrl(url)
  if (!folderId) return null
  if (!('project_id' in job)) return { folderId, plansId: null, teamId: null }
  const [plansId, teamId] = await Promise.all([childFolder(token, folderId, 'Plans'), childFolder(token, folderId, 'Team only')])
  return { folderId, plansId, teamId }
}

/** A folder path under the job's folder, made as needed: Team only → Sent by us, and the like. */
export async function landingFolder(token: string, folder: JobFolder, path: readonly string[]): Promise<string> {
  let parent = folder.folderId
  for (const name of path) parent = (await findOrCreateFolder(token, parent, name)).id
  return parent
}

/**
 * The folder a job's photos land in, made as needed, or null when the job has no Drive folder yet. A Pipeline job with
 * its folder but no pictures folder gets Customer Pictures made under it the first time a photo lands, and the link
 * written on the job, when the office's choice is as-needed (Where files go, punch list #211, PR 3); up front, the
 * press made it already and a job with none keeps landing in Team only › Photos.
 */
export async function photoFolderFor(admin: SupabaseClient, token: string, job: JobRef): Promise<string | null> {
  let picturesFolderId: string | null = null
  if ('jobs_ledger_id' in job) {
    const { data } = await admin.from('jobs_ledger').select('job_pictures_link, google_drive_link').eq('id', job.jobs_ledger_id).maybeSingle()
    const row = data as { job_pictures_link?: string | null; google_drive_link?: string | null } | null
    picturesFolderId = driveFolderIdFromUrl(row?.job_pictures_link ?? null)
    if (!picturesFolderId && !String(row?.job_pictures_link ?? '').trim()) {
      const jobFolderId = driveFolderIdFromUrl(row?.google_drive_link ?? null)
      if (jobFolderId && (await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))).foldersMade === 'as-needed') {
        const made = await findOrCreateFolder(token, jobFolderId, JOB_FOLDER_TREE.pictures)
        await admin
          .from('jobs_ledger')
          .update({ job_pictures_link: `https://drive.google.com/drive/folders/${made.id}` })
          .eq('id', job.jobs_ledger_id)
          .or('job_pictures_link.is.null,job_pictures_link.eq.')
        picturesFolderId = made.id
      }
    }
  }
  const landing = photoLanding(job, picturesFolderId)
  if (landing.kind === 'pictures') return landing.folderId
  const folder = await jobFolder(admin, token, job)
  return folder ? await landingFolder(token, folder, landing.path) : null
}

/** The first of a photo's names the folder does not hold yet: `nameFor(taken)` gives the next, *(2)* and on. */
export async function freeName(token: string, folderId: string, nameFor: (taken: ReadonlySet<string>) => string, tries = 20): Promise<string> {
  const taken = new Set<string>()
  for (let i = 0; i < tries; i += 1) {
    const name = nameFor(taken)
    if (!(await findExistingFile(token, folderId, name))) return name
    taken.add(name)
  }
  throw new Error('Too many photos of that name in the folder.')
}

/** Whether a Drive file sits inside the job's folder, by its parents, a few levels up; and which half it is in. */
export async function halfInside(token: string, folder: JobFolder, fileId: string): Promise<Half | null> {
  let id = fileId
  for (let i = 0; i < 6; i += 1) {
    const meta = await driveGet<{ parents?: string[] }>(token, `${DRIVE}/files/${encodeURIComponent(id)}?fields=parents&supportsAllDrives=true`)
    const parent = meta.parents?.[0]
    if (!parent) return null
    if (folder.plansId && parent === folder.plansId) return 'plans'
    if (folder.teamId && parent === folder.teamId) return 'team_only'
    // A bid's or a Pipeline job's folder has no halves: inside it is Team only.
    if (parent === folder.folderId) return folder.plansId || folder.teamId ? null : 'team_only'
    id = parent
  }
  return null
}

/** A Drive file's name, type and size; a Google Doc or a folder has no size. */
export interface DriveFileMeta {
  name: string
  mimeType: string
  size: number | null
}

export async function driveFileMeta(token: string, fileId: string): Promise<DriveFileMeta> {
  const meta = await driveGet<{ name: string; mimeType: string; size?: string }>(token, `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=name,mimeType,size&supportsAllDrives=true`)
  return { name: meta.name, mimeType: meta.mimeType, size: meta.size == null ? null : Number(meta.size) }
}

/** A Drive file's bytes as Drive answers them (`alt=media`): the open door streams the body, a send reads it whole. */
export function driveMedia(token: string, fileId: string): Promise<Response> {
  return fetch(`${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } })
}

/**
 * A Drive file's bytes, whole, for a send that carries the file. Past `maxBytes` it is refused, by Drive's own length when
 * it gives one and else as the bytes come, so a file is never held past the cap. Null when Drive has no bytes for it.
 */
export async function driveFileBytes(token: string, fileId: string, maxBytes: number): Promise<Uint8Array | 'tooBig' | null> {
  const res = await driveMedia(token, fileId)
  if (!res.ok || !res.body) return null
  const length = Number(res.headers.get('Content-Length') ?? '')
  if (Number.isFinite(length) && length > maxBytes) {
    void res.body.cancel().catch(() => {})
    return 'tooBig'
  }
  const parts: Uint8Array[] = []
  let total = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      void reader.cancel().catch(() => {})
      return 'tooBig'
    }
    parts.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Why our link to a file was not made. */
export type LinkRefusal = 'notInFolder' | 'teamOnlyFolder' | 'failed'

/**
 * Our link to one file inside the job's folder (cut 7b's `drive_links`, by the link's SHA-256): the app's own page,
 * `<origin>/f/<link>`. A file whose parents do not reach the job's folder is refused. A plan set's folder in Plans links
 * as the folder; a Team only folder has no bytes to hand over, so it is refused.
 */
export async function makeDriveLink(
  admin: SupabaseClient,
  token: string,
  input: { job: JobRef; folder: JobFolder; driveFileId: string; messageId: string | null; madeBy: string; origin: string },
): Promise<{ ok: true; linkId: string; url: string; half: Half; meta: DriveFileMeta } | { ok: false; why: LinkRefusal }> {
  const half = await halfInside(token, input.folder, input.driveFileId)
  if (!half) return { ok: false, why: 'notInFolder' }
  const meta = await driveFileMeta(token, input.driveFileId)
  if (meta.mimeType === DRIVE_FOLDER_MIME && half !== 'plans') return { ok: false, why: 'teamOnlyFolder' }
  const link = linkToken(crypto.getRandomValues(new Uint8Array(LINK_TOKEN_BYTES)))
  const { data: made, error } = await admin
    .from('drive_links')
    .insert({
      token_hash: await sha256Hex(link),
      ...input.job,
      drive_file_id: input.driveFileId,
      half,
      name: meta.name.slice(0, 300),
      mime: meta.mimeType,
      size_bytes: meta.size,
      message_id: input.messageId,
      made_by: input.madeBy,
    })
    .select('id')
    .single()
  if (error || !made) return { ok: false, why: 'failed' }
  return { ok: true, linkId: (made as { id: string }).id, url: fileLinkUrl(input.origin, link), half, meta }
}

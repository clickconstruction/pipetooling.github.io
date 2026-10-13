/**
 * A job's Drive folder, read and written through the service account (lifted from drive-link, Messages cut 10, so the
 * office's door and the photo-save sweep share one implementation). A job is one of the spine's three: a GC project
 * (`gc_projects.drive_folder_url`, with its Plans and Team only halves), a bid (`bids.drive_link`) or a Pipeline job
 * (`jobs_ledger.google_drive_link`). A bid's or a Pipeline job's folder has no halves. A photo lands in Team only › Photos
 * under the job's folder, or in a Pipeline job's own Customer Pictures folder when that link is plainly a Drive folder
 * (`photoLanding`, the lead, 2026-10-13).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findExistingFile, findOrCreateFolder } from './driveUpload.ts'
import { DRIVE_FOLDER_MIME, photoLanding, type JobRef } from './driveLink.ts'

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

/** The folder a job's photos land in, made as needed, or null when the job has no Drive folder yet. */
export async function photoFolderFor(admin: SupabaseClient, token: string, job: JobRef): Promise<string | null> {
  let picturesFolderId: string | null = null
  if ('jobs_ledger_id' in job) {
    const { data } = await admin.from('jobs_ledger').select('job_pictures_link').eq('id', job.jobs_ledger_id).maybeSingle()
    picturesFolderId = driveFolderIdFromUrl((data as { job_pictures_link?: string | null } | null)?.job_pictures_link ?? null)
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

/**
 * Where files go (punch list #211): the office's Drive settings as the functions read them, and the write check. The
 * rules are pure in `whereFilesGo.ts`; this file holds the reads of `app_settings` through the service client and of Drive
 * through the service account. Every function that makes a folder under the jobs root reads the root here, so the office
 * moving it on Documents → Where files go moves every maker at once; the `DRIVE_JOBS_FOLDER_ID` env fills in while the
 * setting is empty.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE } from './driveUpload.ts'
import {
  DRIVE_BID_FOLDER_PATTERN_KEY,
  DRIVE_FOLDERS_MADE_KEY,
  DRIVE_JOB_FOLDER_PATTERN_KEY,
  DRIVE_JOBS_ROOT_FOLDER_ID_KEY,
  driveSettingsFromRows,
  writeCheckWords,
  type DriveSettings,
  type WriteCheckSeen,
} from './whereFilesGo.ts'

export const DRIVE_SETTINGS_KEYS = [DRIVE_JOBS_ROOT_FOLDER_ID_KEY, DRIVE_JOB_FOLDER_PATTERN_KEY, DRIVE_BID_FOLDER_PATTERN_KEY, DRIVE_FOLDERS_MADE_KEY] as const

/** The four settings, the env's root as the fallback. A read that fails reads as no rows, so the env still serves. */
export async function readDriveSettings(admin: SupabaseClient, envRoot: string | null | undefined): Promise<DriveSettings> {
  const { data } = await admin.from('app_settings').select('key, value_text').in('key', [...DRIVE_SETTINGS_KEYS])
  return driveSettingsFromRows((data ?? []) as { key: string; value_text: string | null }[], envRoot)
}

/** The jobs root the functions make folders under, or null when neither the setting nor the env names one. */
export async function jobsRootFolderId(admin: SupabaseClient): Promise<string | null> {
  return (await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))).rootFolderId
}

/** The words every maker answers when no root is set anywhere. */
export const NO_ROOT_WORDS = 'The jobs root is not set yet. Set it on Documents → Where files go.'

/** A folder as Drive describes it to the service account, for the root card. */
export interface DriveFolderFacts {
  id: string
  name: string
  /** The folder's place from the top: the Shared Drive's name, then each parent. */
  path: string[]
  /** The owner's name or address, or null inside a Shared Drive, where the drive owns it. */
  owner: string | null
  /** The Shared Drive it lives in, or null in a My Drive. */
  drive: string | null
  /** The folders directly inside it; the job folders when it is the root. Null when the count did not read. */
  folders: number | null
}

export type DriveMeta = {
  id?: string
  name?: string
  mimeType?: string
  parents?: string[]
  driveId?: string
  owners?: { displayName?: string; emailAddress?: string }[]
  capabilities?: { canAddChildren?: boolean }
  error?: { message?: string }
}

/** A Drive folder's MIME type, the one test that a link is a folder. */
export const FOLDER_MIME = 'application/vnd.google-apps.folder'

/** A file or folder as Drive describes it to the service account: the write check's read, and `jobFolders.ts`' (v2.6284). */
export async function driveFolderMeta(token: string, id: string): Promise<{ status: number; body: DriveMeta }> {
  const res = await fetch(`${DRIVE}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,parents,driveId,owners(displayName,emailAddress),capabilities/canAddChildren&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = (await res.json().catch(() => ({}))) as DriveMeta
  return { status: res.status, body }
}

/** The owner's name or address as Drive gives it; null inside a Shared Drive, where the drive owns the file. */
export function metaOwner(body: DriveMeta): string | null {
  const owner = body.owners?.[0]
  return owner ? owner.displayName || owner.emailAddress || null : null
}

/**
 * The write check: whether the service account can put a file in a folder, as Drive states its capabilities
 * (`canAddChildren`, the reading v2.6054's `writable` and the photo sweep's 403 agree on), with the folder's facts when it
 * can be opened. Nothing is written to Drive by the check itself.
 */
export async function checkFolderWrite(token: string, folderId: string | null, appEmail: string, withFacts = true): Promise<{ ok: boolean; words: string; seen: WriteCheckSeen; folder: DriveFolderFacts | null }> {
  const answer = (seen: WriteCheckSeen, folder: DriveFolderFacts | null = null) => ({ ...writeCheckWords(seen, appEmail), seen, folder })
  if (!folderId) return answer({ kind: 'no_link' })
  const { status, body } = await driveFolderMeta(token, folderId)
  if (status === 403 || status === 404) return answer({ kind: 'cannot_open', status, reason: body.error?.message ?? null })
  if (status < 200 || status >= 300) throw new Error(`Drive answered ${status} when the app looked at the folder.`)
  if (body.mimeType !== FOLDER_MIME) return answer({ kind: 'not_a_folder' })
  const facts = withFacts ? await folderFacts(token, folderId, body) : null
  if (body.capabilities?.canAddChildren !== true) return answer({ kind: 'cannot_write' }, facts)
  // A folder in a My Drive takes the app's folders but never its files (v2.6284): the check says so before a photo finds out.
  if (!body.driveId) return answer({ kind: 'outside_drive', owner: metaOwner(body) }, facts)
  return answer({ kind: 'ok' }, facts)
}

/** The folder's name, path, owner, Shared Drive and the count of folders inside, each read best-effort. */
async function folderFacts(token: string, id: string, body: DriveMeta): Promise<DriveFolderFacts> {
  const path: string[] = []
  let parent = body.parents?.[0] ?? null
  for (let i = 0; i < 6 && parent; i += 1) {
    const p = await driveFolderMeta(token, parent).catch(() => null)
    if (!p || p.status < 200 || p.status >= 300 || !p.body.name) break
    path.unshift(p.body.name)
    parent = p.body.parents?.[0] ?? null
  }
  let drive: string | null = null
  if (body.driveId) {
    const res = await fetch(`${DRIVE}/drives/${encodeURIComponent(body.driveId)}?fields=name`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
    const d: { name?: string } = res && res.ok ? ((await res.json().catch(() => ({}))) as { name?: string }) : {}
    drive = d.name ?? null
    // A Shared Drive's root reads as a parent with the drive's own name; the path begins there.
    if (drive && path[0] !== drive) path.unshift(drive)
  }
  const owner = metaOwner(body)
  let folders: number | null = null
  const q = encodeURIComponent(`'${id}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`)
  const res = await fetch(`${DRIVE}/files?q=${q}&fields=files(id),nextPageToken&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
  if (res && res.ok) {
    const list = (await res.json().catch(() => ({}))) as { files?: { id: string }[]; nextPageToken?: string }
    folders = (list.files?.length ?? 0) + (list.nextPageToken ? 1 : 0)
  }
  return { id, name: body.name ?? '', path, owner, drive, folders }
}

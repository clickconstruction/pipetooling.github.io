/**
 * The company folder (the Documents spike of 2026-11-01, the owner's ask): the company's papers, the W-9, the insurance and
 * the licenses, live in one Drive folder the office sets on Documents → Where files go (`drive_company_folder_id`), the way
 * a job's papers live in the job's folder. Documents → Company lists that folder live from Drive and offers **Upload a
 * file** to the four office roles, the owner's word of 2026-11-01: the estimator reads, the office puts. The pure rules
 * are here; `companyFilesIo.ts` makes the calls to `drive-link`'s `list_company` and `put_company`.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { DriveFileRow } from './jobFiles'
import { canSetWhereFilesGo } from './whereFilesGoTab'

/** Who puts a paper in the company folder: the four office roles, never the estimator (the function's `COMPANY_PUT_ROLES`). */
export function canUploadCompanyFiles(role: string | null | undefined): boolean {
  return canSetWhereFilesGo(role)
}

/** Who sets the company folder: the same four, on Where files go. */
export const canSetCompanyFolder = canSetWhereFilesGo

/** A file from this computer goes through the function as base64, up to the Drive door's cap. */
export const COMPANY_UPLOAD_MAX_BYTES = 10 * 1024 * 1024

/** Why a picked file is held before it is sent, or null when it may go. */
export function companyUploadHold(file: { size: number; name: string }): string | null {
  if (!file.name.trim()) return 'That file has no name.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > COMPANY_UPLOAD_MAX_BYTES) return `${file.name} is over 10 MB. Put it in the company folder in Drive instead.`
  return null
}

/** A file's size in words: `1.2 MB`, `340 KB`, `12 B`; nothing when Drive gave none. */
export function fileSizeWords(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/** One row of the Company tab's list. */
export interface CompanyFileRow {
  id: string
  name: string
  url: string
  size: string
  /** The day Drive last changed it, in the app's calendar, or '' when unknown. */
  day: string
}

/** The folder's files as the tab lists them: newest change first, a name tie by name. */
export function companyFileRows(files: readonly DriveFileRow[]): CompanyFileRow[] {
  return [...files]
    .sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? '') || a.name.localeCompare(b.name))
    .map((f) => ({ id: f.id, name: f.name, url: f.url, size: fileSizeWords(f.bytes), day: f.modified ? calendarYmdInAppTzFromIso(f.modified) : '' }))
}

/** The list's count line: *12 files in the company folder.* */
export function companyFilesCountWords(count: number, capped: boolean): string {
  const n = count === 1 ? '1 file' : `${count} files`
  return capped ? `The first ${n} in the company folder. Open the folder for the rest.` : `${n} in the company folder.`
}

/** The upload's done line. */
export function companyUploadedWords(name: string): string {
  return `${name} is in the company folder.`
}

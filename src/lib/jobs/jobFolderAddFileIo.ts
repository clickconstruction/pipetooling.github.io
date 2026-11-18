/**
 * The io half of Add a file on the Documents tab (v2.6303): one call to `drive-link`'s `put` as the signed-in person,
 * the file read from this computer as base64, up to the function's 10 MB. The function's own words come back as the
 * error, with its answer on whether the same file can go again (`AddFileFailure`, v2.7635); a call nothing answered
 * says the file did not reach the app.
 */
import { supabase } from '../supabase'
import type { FnResult } from '../gc/gcIo'
import { base64OfBytes } from '../../../supabase/functions/_shared/messagesEmailFiles'
import type { AddFileWhere } from './jobFolderAddFile'
import { addFileFailureOf, type AddFileAnswer, type AddFileFailure } from './addFileFailure'

export type AddedFile = { driveFileId: string; url: string }

export type JobFolderAddFileIo = {
  put: (jobId: string, where: AddFileWhere, file: File) => Promise<AddedFile>
}

/** Put one file from this computer into a Pipeline job's folder, its Plans folder or its Customer Pictures. */
export async function putJobFolderFile(jobId: string, where: AddFileWhere, file: File): Promise<AddedFile> {
  const base64 = base64OfBytes(new Uint8Array(await file.arrayBuffer()))
  const r = (await supabase.functions.invoke('drive-link', {
    body: { action: 'put', job: { jobs_ledger_id: jobId }, name: file.name, mime: file.type || 'application/octet-stream', where, base64 },
  })) as FnResult
  const failure = await addFileFailureFrom(r)
  if (failure) throw failure
  const d = r.data as { driveFileId?: unknown; url?: unknown } | null
  if (typeof d?.driveFileId !== 'string' || typeof d?.url !== 'string') throw addFileFailureOf({ error: '', status: null })
  return { driveFileId: d.driveFileId, url: d.url }
}

/**
 * The failure in one `invoke` result, or null when it went through. The function answers a refusal with its own
 * sentence in the body; an error with no body to read is a call nothing answered. `fallback` is what a failure with
 * no reason says, for a caller that is not adding a file.
 */
export async function addFileFailureFrom(r: FnResult, fallback?: string): Promise<AddFileFailure | null> {
  const data = r.data as AddFileAnswer | null
  if (data?.error) return addFileFailureOf({ ...data, status: null }, fallback)
  if (!r.error) return null
  const context = r.error.context as { json?: () => Promise<unknown>; status?: unknown } | undefined
  if (typeof context?.json !== 'function') return addFileFailureOf(null)
  const body = (await context.json().catch(() => null)) as AddFileAnswer | null
  const status = typeof context.status === 'number' ? context.status : null
  return addFileFailureOf({ error: body?.error, retry: body?.retry, status }, fallback)
}

export const supabaseJobFolderAddFileIo: JobFolderAddFileIo = { put: putJobFolderFile }

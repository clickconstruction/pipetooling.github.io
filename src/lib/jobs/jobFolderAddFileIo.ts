/**
 * The io half of Add a file on the Documents tab (v2.6303): one call to `drive-link`'s `put` as the signed-in person,
 * the file read from this computer as base64, up to the function's 10 MB. The function's own words come back as the
 * error (`fnProblem`, as the job's other Drive calls read theirs).
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { base64OfBytes } from '../../../supabase/functions/_shared/messagesEmailFiles'
import { ADD_FILE_WORDS, type AddFileWhere } from './jobFolderAddFile'

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
  const problem = await fnProblem(r, ADD_FILE_WORDS.failed)
  if (problem) throw new Error(problem)
  const d = r.data as { driveFileId?: unknown; url?: unknown } | null
  if (typeof d?.driveFileId !== 'string' || typeof d?.url !== 'string') throw new Error(ADD_FILE_WORDS.failed)
  return { driveFileId: d.driveFileId, url: d.url }
}

export const supabaseJobFolderAddFileIo: JobFolderAddFileIo = { put: putJobFolderFile }

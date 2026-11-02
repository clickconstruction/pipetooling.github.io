/**
 * The io behind a set's Drive folder and the files in it (punch list #239, PR 5): one call each to `plan-set-files`
 * as the signed-in person — the folder made as needed, a file from this computer or the phone as base64 (the
 * function's 10 MB), our copy of a mail's attachment by its id — and one read of a tagged mail's files for the mail
 * door. The function's own words come back as the error (`fnProblem`, as the job's other Drive calls read theirs).
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { base64OfBytes } from '../../../supabase/functions/_shared/messagesEmailFiles'

export type SetFolder = { folderId: string; url: string; made: boolean }
export type FiledFile = { driveFileId: string; url: string; folderUrl: string }
export type MailFile = { id: string; name: string; mime: string | null }

export type PlanSetFilesIo = {
  /** The set's folder under the job's Plans folder, made as needed; a set with no link takes the folder's. */
  folder(setId: string): Promise<SetFolder>
  /** One file into the set's folder, under the name given (else the file's own). */
  put(setId: string, file: File, name?: string): Promise<FiledFile>
  /** Our copy of a mail's attachment into the set's folder. */
  saveAttachment(setId: string, attachmentId: string): Promise<FiledFile>
  /** The files kept on a mail's line, for the mail door; fail-soft. */
  attachmentsOf(messageId: string): Promise<MailFile[]>
}

const FAILED = 'The file did not land in the set’s folder.'

async function answer<T>(r: FnResult, fallback: string, check: (d: Record<string, unknown>) => T | null): Promise<T> {
  const problem = await fnProblem(r, fallback)
  if (problem) throw new Error(problem)
  const out = check((r.data ?? {}) as Record<string, unknown>)
  if (!out) throw new Error(fallback)
  return out
}

const filed = (d: Record<string, unknown>): FiledFile | null =>
  typeof d.driveFileId === 'string' && typeof d.url === 'string' && typeof d.folderUrl === 'string' ? { driveFileId: d.driveFileId, url: d.url, folderUrl: d.folderUrl } : null

export const supabasePlanSetFilesIo: PlanSetFilesIo = {
  async folder(setId) {
    const r = (await supabase.functions.invoke('plan-set-files', { body: { action: 'folder', set_id: setId } })) as FnResult
    return answer(r, 'The set’s folder was not made.', (d) => (typeof d.folderId === 'string' && typeof d.url === 'string' ? { folderId: d.folderId, url: d.url, made: d.made === true } : null))
  },
  async put(setId, file, name) {
    const base64 = base64OfBytes(new Uint8Array(await file.arrayBuffer()))
    const r = (await supabase.functions.invoke('plan-set-files', {
      body: { action: 'put', set_id: setId, name: (name ?? file.name).trim() || file.name, mime: file.type || 'application/octet-stream', base64 },
    })) as FnResult
    return answer(r, FAILED, filed)
  },
  async saveAttachment(setId, attachmentId) {
    const r = (await supabase.functions.invoke('plan-set-files', { body: { action: 'save_attachment', set_id: setId, attachment_id: attachmentId } })) as FnResult
    return answer(r, FAILED, filed)
  },
  async attachmentsOf(messageId) {
    try {
      const r = await supabase.from('message_attachments').select('id, name, mime, kind').eq('message_id', messageId).order('sort_order')
      if (r.error) return []
      return ((r.data ?? []) as Array<{ id: string; name: string; mime: string | null; kind: string }>).filter((a) => a.kind === 'file').map((a) => ({ id: a.id, name: a.name, mime: a.mime }))
    } catch {
      return []
    }
  },
}

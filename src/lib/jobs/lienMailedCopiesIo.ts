/**
 * The io half of *Add what was mailed* on the run's checklist: the file goes into the job's Drive folder
 * (`drive-link`'s `put`, the Documents tab's own call), and the notice's list takes the link. The list is read
 * fresh before it is written, so two people adding files to one notice keep both.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { putJobFolderFile, type AddedFile } from './jobFolderAddFileIo'
import { lienMailedCopiesWith, lienMailedCopyName, parseLienMailedCopies, type LienMailedCopy } from './lienMailedCopies'

export type AddLienMailedCopyArgs = {
  itemId: string
  jobId: string
  jobNumber: string
  file: File
  /** Today in the company's zone, for the file's name. */
  todayYmd: string
  userId: string | null
}

export type LienMailedCopiesIo = {
  put: (jobId: string, file: File) => Promise<AddedFile>
  read: (itemId: string) => Promise<LienMailedCopy[]>
  write: (itemId: string, list: LienMailedCopy[]) => Promise<void>
  now: () => string
}

export const supabaseLienMailedCopiesIo: LienMailedCopiesIo = {
  put: (jobId, file) => putJobFolderFile(jobId, 'sent', file),
  read: async (itemId) => {
    const row = await withSupabaseRetry<{ mailed_copies?: unknown } | null>(() => supabase.from('job_lien_desk_items').select('mailed_copies').eq('id', itemId).maybeSingle() as never, 'lien desk: read the mailed copies')
    return parseLienMailedCopies(row?.mailed_copies)
  },
  write: async (itemId, list) => {
    await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ mailed_copies: list } as never).eq('id', itemId), 'lien desk: keep the mailed copy')
  },
  now: () => new Date().toISOString(),
}

/** Put the file in the job's folder under a name that says what it is, then add it to the notice's list. Returns the list as written. */
export async function addLienMailedCopy(args: AddLienMailedCopyArgs, io: LienMailedCopiesIo = supabaseLienMailedCopiesIo): Promise<LienMailedCopy[]> {
  const before = await io.read(args.itemId)
  const name = lienMailedCopyName({ jobNumber: args.jobNumber, ymd: args.todayYmd, already: before.length, file: args.file })
  const named = new File([args.file], name, { type: args.file.type || 'application/octet-stream' })
  const added = await io.put(args.jobId, named)
  // Read again: the upload takes a while, and someone else may have added a file to this notice meanwhile.
  const list = lienMailedCopiesWith(await io.read(args.itemId), { url: added.url, driveFileId: added.driveFileId, name, at: io.now(), by: args.userId })
  await io.write(args.itemId, list)
  return list
}

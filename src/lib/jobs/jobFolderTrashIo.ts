/**
 * The io half of a file taken off into Drive's trash (v2.7699): `drive-link`'s `trash` and `untrash`, as the
 * signed-in person. The function's own sentence comes back with its answer on a second try (`AddFileFailure`).
 */
import { supabase } from '../supabase'
import type { FnResult } from '../gc/gcIo'
import { addFileFailureFrom } from './jobFolderAddFileIo'
import { ADD_FILE_FAILURE_WORDS, addFileCanRetry } from './addFileFailure'
import { TAKE_OFF_FILE_WORDS, type FileTakenOff } from './jobFolderTrash'
import { formatErrorMessage } from '../../utils/errorHandling'

async function ask(action: 'trash' | 'untrash', jobId: string, driveFileId: string): Promise<{ url: string }> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action, job: { jobs_ledger_id: jobId }, driveFileId } })) as FnResult
  const failure = await addFileFailureFrom(r, TAKE_OFF_FILE_WORDS.noReason)
  if (failure) throw failure
  const url = (r.data as { url?: unknown } | null)?.url
  return { url: typeof url === 'string' ? url : '' }
}

/** Move one of a job's Sent by us files to Drive's trash. Throws the function's reason. */
export async function trashJobFolderFile(jobId: string, driveFileId: string): Promise<void> {
  await ask('trash', jobId, driveFileId)
}

/** Put a trashed file back in the job's folder. Answers its link. Throws the function's reason. */
export async function untrashJobFolderFile(jobId: string, driveFileId: string): Promise<{ url: string }> {
  return ask('untrash', jobId, driveFileId)
}

/**
 * The file's fate after its link came off, never thrown: in the trash, or still in Drive with the reason and whether
 * a second try can help. A link that is not a Drive file's has no id, and nothing is asked.
 */
export async function takeFileToTrash(jobId: string, driveFileId: string | null, trash: typeof trashJobFolderFile = trashJobFolderFile): Promise<FileTakenOff | null> {
  if (!driveFileId) return null
  try {
    await trash(jobId, driveFileId)
    return { where: 'trash' }
  } catch (e) {
    const said = formatErrorMessage(e, TAKE_OFF_FILE_WORDS.noReason)
    return { where: 'drive', why: said === ADD_FILE_FAILURE_WORDS.lost ? TAKE_OFF_FILE_WORDS.lost : said, retry: addFileCanRetry(e) }
  }
}

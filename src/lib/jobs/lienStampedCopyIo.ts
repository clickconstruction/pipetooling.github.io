/**
 * Reading a filed lien's saved copy (v2.7916): the stamped scan's own bytes, asked of `drive-link`'s office door
 * (`read`) as the signed-in person. The door answers only for a file inside that job's Drive folder, so the read is
 * under the job's own access, and it says in words why a file is not handed over. Then the bytes are looked at
 * (`inspectLienCopy`): what the file is, how many pages, and whether the print can carry it.
 *
 * Never throws: a read that fails is a hold with the door's own reason, so one lien's file never stops the run.
 */
import { supabase } from '../supabase'
import type { FnResult } from '../gc/gcIo'
import { addFileFailureFrom } from './jobFolderAddFileIo'
import { inspectLienCopy } from './lienServePdf'
import { lienCopyUnreadableHold, type LienCopyRead } from './lienStampedCopy'
import { formatErrorMessage } from '../../utils/errorHandling'

/** A saved copy as read: what the window shows of it, and the bytes the print carries when it can. */
export type LienCopyLoaded = { read: LienCopyRead; bytes: Uint8Array | null }

/** The saved copy's bytes. Throws the door's own words when it does not hand the file over. */
export async function readLienSavedCopyBytes(jobId: string, driveFileId: string): Promise<Uint8Array> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action: 'read', job: { jobs_ledger_id: jobId }, driveFileId } })) as FnResult
  const failure = await addFileFailureFrom(r, 'Drive did not hand the file over')
  if (failure) throw failure
  if (r.data instanceof Blob) return new Uint8Array(await r.data.arrayBuffer())
  if (r.data instanceof ArrayBuffer) return new Uint8Array(r.data)
  throw new Error('the file came back empty')
}

/** One filing's saved copy, read and looked at. */
export async function loadLienSavedCopy(jobId: string, driveFileId: string, readBytes: typeof readLienSavedCopyBytes = readLienSavedCopyBytes): Promise<LienCopyLoaded> {
  let bytes: Uint8Array
  try {
    bytes = await readBytes(jobId, driveFileId)
  } catch (e) {
    return { read: { state: 'held', hold: lienCopyUnreadableHold(formatErrorMessage(e, '')) }, bytes: null }
  }
  if (bytes.length === 0) return { read: { state: 'held', hold: lienCopyUnreadableHold('the file is empty') }, bytes: null }
  const read = await inspectLienCopy(bytes)
  return { read, bytes: read.state === 'ok' ? bytes : null }
}

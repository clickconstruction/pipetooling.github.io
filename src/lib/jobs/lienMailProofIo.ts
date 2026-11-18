/**
 * The io half of *What went out* (`lienMailProof.ts`): the mailed files a job's recorded notices keep, and one more
 * file added to a paper already recorded. The file goes where every mailed copy goes, the job's Drive folder under
 * Sent by us, and onto the notice's own list. A paper with no saved copy takes the new file as its saved copy too,
 * so the job's Documents tab and counsel's packet, which read that one link, open it.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { putJobFolderFile, type AddedFile } from './jobFolderAddFileIo'
import { filingDocumentPayload } from './lienFilingDocumentLink'
import { lienMailedCopyName, type LienMailedCopyPaper } from './lienMailedCopies'
import { addLienMailedCopy } from './lienMailedCopiesIo'

/** A job's recorded notices' mailed files, by the filing each notice became. */
export type JobMailedCopies = Record<string, { itemId: string; copies: unknown }>

/** Every desk item of the job that became a filing, with its `mailed_copies` as stored. */
export async function readJobMailedCopies(jobId: string): Promise<JobMailedCopies> {
  const rows = await withSupabaseRetry<Array<{ id: string; sent_filing_id: string | null; mailed_copies: unknown }> | null>(
    () => supabase.from('job_lien_desk_items').select('id, sent_filing_id, mailed_copies').eq('job_id', jobId).not('sent_filing_id', 'is', null) as never,
    'lien mail proof: read the mailed copies',
  )
  const out: JobMailedCopies = {}
  for (const r of rows ?? []) if (r.sent_filing_id) out[r.sent_filing_id] = { itemId: r.id, copies: r.mailed_copies }
  return out
}

export type AddRecordedCopyArgs = {
  filingId: string
  /** The notice's desk item; null on a paper recorded with no desk item, which keeps one file as its saved copy. */
  itemId: string | null
  jobId: string
  jobNumber: string
  file: File
  /** Today in the company's zone, for the file's name. */
  todayYmd: string
  userId: string | null
  paper: LienMailedCopyPaper
  /** The filing already has a saved copy, so it keeps it. */
  hasDocument: boolean
}

export type AddRecordedCopyIo = {
  addToItem: typeof addLienMailedCopy
  put: (jobId: string, file: File) => Promise<AddedFile>
  setDocument: (filingId: string, url: string, note: string) => Promise<void>
}

export const supabaseAddRecordedCopyIo: AddRecordedCopyIo = {
  addToItem: addLienMailedCopy,
  put: (jobId, file) => putJobFolderFile(jobId, 'sent', file),
  setDocument: async (filingId, url, note) => {
    await withSupabaseRetry(() => supabase.from('job_lien_filings').update(filingDocumentPayload({ url, note }) as never).eq('id', filingId), 'lien mail proof: keep the saved copy')
  },
}

/** Add one file to a recorded paper. Returns the file's name and link. */
export async function addRecordedMailedCopy(args: AddRecordedCopyArgs, io: AddRecordedCopyIo = supabaseAddRecordedCopyIo): Promise<{ name: string; url: string }> {
  let added: { name: string; url: string }
  if (args.itemId) {
    const list = await io.addToItem({ itemId: args.itemId, jobId: args.jobId, jobNumber: args.jobNumber, file: args.file, todayYmd: args.todayYmd, userId: args.userId, paper: args.paper })
    const last = list[list.length - 1]!
    added = { name: last.name, url: last.url }
  } else {
    const name = lienMailedCopyName({ jobNumber: args.jobNumber, ymd: args.todayYmd, already: 0, file: args.file, paper: args.paper })
    const put = await io.put(args.jobId, new File([args.file], name, { type: args.file.type || 'application/octet-stream' }))
    added = { name, url: put.url }
  }
  if (!args.hasDocument) await io.setDocument(args.filingId, added.url, `What was mailed: ${added.name}`)
  return added
}

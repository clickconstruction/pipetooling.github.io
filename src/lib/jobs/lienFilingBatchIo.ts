/**
 * The io half of **Back from the clerk** (`lienFilingBatch.ts`): one lien recorded as filed, as the job's Lien window
 * records it. Three steps, each its own write:
 *
 *  1. the `job_lien_filings` row, after a read that no live filed affidavit is on the job already, so two people at
 *     two desks cannot file one lien twice;
 *  2. the desk's affidavit item marked sent (`syncLienDeskAfterRecord`). A miss here is quiet: the lien's pile reads
 *     the filing, and the next record on the job marks the item;
 *  3. the stamped file, when one was chosen, into the job's Drive folder and onto the filing as its saved copy
 *     (`saveLienScans`). A miss here is said: the lien is on record and its file can be added again.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { syncLienDeskAfterRecord } from './lienDeskIo'
import { lienFilingPayload, type LienFilingTarget } from './lienFilingBatch'
import { lienDocNumberClean } from './lienDocNumber'
import { saveLienScans } from './lienScanBatchIo'

export type LienFilingRecorded = { filingId: string; /** '' when there was no file or it was saved; else why it was not. */ scanProblem: string; scanSaved: boolean }

export type LienFilingBatchDeps = {
  /** Whether the job already has a live filed affidavit. */
  alreadyFiled: (jobId: string) => Promise<boolean>
  insert: (row: Record<string, unknown>) => Promise<string>
  sync: (jobId: string) => Promise<unknown>
  saveScans: typeof saveLienScans
}

export const supabaseLienFilingBatchDeps: LienFilingBatchDeps = {
  alreadyFiled: async (jobId) => {
    const rows = await withSupabaseRetry<Array<{ id: string }>>(
      () => supabase.from('job_lien_filings').select('id').eq('job_id', jobId).eq('kind', 'affidavit').is('voided_at', null).not('filed_at', 'is', null).limit(1) as never,
      'read lien filing',
    )
    return (rows ?? []).length > 0
  },
  insert: async (row) => {
    const made = await withSupabaseRetry<{ id: string }>(() => supabase.from('job_lien_filings').insert(row as never).select('id').single() as never, 'record lien filing')
    return made.id
  },
  sync: (jobId) => syncLienDeskAfterRecord(jobId),
  saveScans: saveLienScans,
}

/** The stamped file onto a filing already on record, as its saved copy. Answers '' when saved, else the reason. */
export async function saveLienFilingScan(args: { target: LienFilingTarget; filingId: string; number: string; filedYmd: string; file: File }, saveScans: typeof saveLienScans = saveLienScans): Promise<string> {
  const { target } = args
  const result = await saveScans([{ key: target.jobId, file: args.file, target: { filingId: args.filingId, jobId: target.jobId, jobNumber: target.jobNumber, jobLabel: target.jobLabel, recordingNumber: args.number, filedYmd: args.filedYmd, county: target.county, hasScan: false } }])
  return result.failed[0]?.reason ?? ''
}

/** Record one lien as filed. Throws with the reason when the row did not land; a file that did not save is said in the answer. */
export async function recordLienFiling(args: { target: LienFilingTarget; number: string; filedYmd: string; createdBy: string | null; file?: File | null }, deps: LienFilingBatchDeps = supabaseLienFilingBatchDeps): Promise<LienFilingRecorded> {
  const { target } = args
  if (await deps.alreadyFiled(target.jobId)) throw new Error('This lien is already on record as filed. Close the window and open it again.')
  const filingId = await deps.insert({ ...lienFilingPayload(target, { number: args.number, filedYmd: args.filedYmd }), created_by: args.createdBy })
  try {
    await deps.sync(target.jobId)
  } catch {
    // The filing is on record, which is what the lien's pile reads. The item is marked on the next record.
  }
  if (!args.file) return { filingId, scanProblem: '', scanSaved: false }
  const scanProblem = await saveLienFilingScan({ target, filingId, number: lienDocNumberClean(args.number), filedYmd: args.filedYmd, file: args.file }, deps.saveScans)
  return { filingId, scanProblem, scanSaved: !scanProblem }
}

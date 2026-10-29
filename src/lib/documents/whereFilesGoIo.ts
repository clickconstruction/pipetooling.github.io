/**
 * The io half of Documents → Where files go (punch list #211, PR 2): the three verbs of the `job-drive-folders` edge
 * function the tab speaks to (`settings`, `check`, `set`), and the two table reads the live example and the presses
 * under the cards need. The function's own words come back as the error (`fnProblem`, as the press's call reads
 * them); a `set` the function refuses carries its `why` (`root_unwritable`, `not_a_folder`) on the error.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fnProblem, type FnResult } from '../gc/gcIo'
import type { BidFolderPiece, FoldersMade, JobFolderPiece } from './folderName'
import { folderCheckFromAnswer, pickerQuery, whereFilesGoFromAnswer, type FolderCheck, type WhereFilesGo, type WhereFilesGoBid, type WhereFilesGoJob } from './whereFilesGoTab'

/** A `set` the function refused in words, with the reason it named. */
export class WhereFilesGoRefused extends Error {
  readonly why: string | null
  constructor(message: string, why: string | null) {
    super(message)
    this.name = 'WhereFilesGoRefused'
    this.why = why
  }
}

async function fnWhy(r: FnResult): Promise<string | null> {
  const data = r.data as { why?: unknown } | null
  if (typeof data?.why === 'string') return data.why
  const fromBody = (await r.error?.context?.json?.().catch(() => null)) as { why?: unknown } | null
  return typeof fromBody?.why === 'string' ? fromBody.why : null
}

/** The four settings, where the root came from and its live check. */
export async function readWhereFilesGo(): Promise<WhereFilesGo> {
  const r = (await supabase.functions.invoke('job-drive-folders', { body: { settings: true } })) as FnResult
  const problem = await fnProblem(r, 'The settings did not read.')
  if (problem) throw new Error(problem)
  return whereFilesGoFromAnswer(r.data)
}

/** The write check on a folder link or id: the words every surface shares, and the folder's facts. */
export async function checkDriveFolder(folder: string): Promise<FolderCheck> {
  const r = (await supabase.functions.invoke('job-drive-folders', { body: { check: { folder } } })) as FnResult
  const problem = await fnProblem(r, 'The folder was not checked.')
  if (problem) throw new Error(problem)
  return folderCheckFromAnswer(r.data)
}

export interface WhereFilesGoSet {
  root?: string
  job_pattern?: readonly JobFolderPiece[]
  bid_pattern?: readonly BidFolderPiece[]
  folders_made?: FoldersMade
}

/** Save what is given; the answer is the settings after the save. A root the app cannot write in is refused (`root_unwritable`). */
export async function setWhereFilesGo(set: WhereFilesGoSet): Promise<WhereFilesGo> {
  const r = (await supabase.functions.invoke('job-drive-folders', { body: { set } })) as FnResult
  const problem = await fnProblem(r, 'The setting was not saved.')
  if (problem) throw new WhereFilesGoRefused(problem, await fnWhy(r))
  return whereFilesGoFromAnswer(r.data)
}

const JOB_COLUMNS = 'id, hcp_number, job_name, customer_name, job_address, created_at, google_drive_link, job_pictures_link, job_plans_link'

/** Every live job (the Pipeline's own scope: a status that is null or not paid), newest number first. */
export async function loadWhereFilesGoJobs(): Promise<WhereFilesGoJob[]> {
  const data = await withSupabaseRetry(
    () => supabase.from('jobs_ledger').select(JOB_COLUMNS).or('status.is.null,status.neq.paid').order('hcp_number', { ascending: false }).limit(1000),
    'loadWhereFilesGoJobs',
  )
  return (data ?? []) as WhereFilesGoJob[]
}

/**
 * Any job, a paid one too, by its number or its name: the picker's look-up when the live jobs hold no match (v2.6073),
 * so the owner's test job, which is paid, can have its folder checked. At most eight, the newest number first.
 */
export async function findWhereFilesGoJobs(typed: string): Promise<WhereFilesGoJob[]> {
  const q = pickerQuery(typed)
  if (!q) return []
  const data = await withSupabaseRetry(
    () =>
      supabase
        .from('jobs_ledger')
        .select(JOB_COLUMNS)
        .or(`hcp_number.ilike.*${q}*,click_number.ilike.*${q}*,job_name.ilike.*${q}*`)
        .order('hcp_number', { ascending: false })
        .limit(8),
    'findWhereFilesGoJobs',
  )
  return (data ?? []) as WhereFilesGoJob[]
}

type BidRow = { id: string; project_name: string | null; bid_number: string | null; address: string | null; created_at: string | null; customers: { name: string | null } | { name: string | null }[] | null }

/** The newest bid with a project name, for the bid pattern's live example; null when there is none. */
export async function loadWhereFilesGoBid(): Promise<WhereFilesGoBid | null> {
  const data = await withSupabaseRetry(
    () =>
      supabase
        .from('bids')
        .select('id, project_name, bid_number, address, created_at, customers(name)')
        .not('project_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1),
    'loadWhereFilesGoBid',
  )
  const row = ((data ?? []) as unknown as BidRow[])[0]
  if (!row) return null
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers
  return { id: row.id, project_name: row.project_name, bid_number: row.bid_number, customer_name: customer?.name ?? null, address: row.address, created_at: row.created_at }
}

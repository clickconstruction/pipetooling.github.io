/**
 * Messages, cut 7c: the reads behind the one list of a job's files (`jobFiles.ts`; `BUILD_PLAN.md` → *Cut 7*, the mock-up
 * `files-out-mockups.html` on branch spike/gc-mode). One read per job hands `jobFiles` its six sources, side by side:
 *
 * - the papers the app makes for a GC project: our contract as last sent, each pay application, each change order sent,
 *   each trade's statement of work once awarded, and the schedule once it has work on it
 * - the plan sets (`gc_plan_sets`), a GC project's alone
 * - the job's Drive folder in its two halves, from the `drive-link` function's office door (cut 7b)
 * - what trade partners uploaded from their portals (`gc_trade_files`), a GC project's alone
 * - the files on the copies of what we sent about the job (`sent_documents.attachments`): a bid's by its id, a Pipeline
 *   job's by its id, a GC project's by its billing job
 * - the files that came in on the job's messages (`message_attachments`, cut 6): kept copies, never a link, never one
 *   left in Gmail, and never a file we sent (`sent_as`, cut 7a), which is on its sent copy
 *
 * Drive is the one copy of a Drive file, so it is read each time and nothing is copied in. When Drive does not answer,
 * the rest still comes back and `driveFailed` says so, so the list shows what the database holds.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { fnProblem, type FnResult } from '../gc/gcIo'
import type { JobRef } from '../messages/load'
import { jobFiles, type AppPaperRow, type ArrivedFileRow, type DriveFileRow, type JobFile, type JobFileSources, type PlanSetRow, type SentFileRow, type TradeFileRow } from './jobFiles'

type Result<T> = { data: T | null; error: SupabaseResultError | null }

/** Cut 6's and 7a's tables are not in the generated types until they are regenerated. */
const from = (table: string) => supabase.from(table as never)

function taken<T>(result: Result<T>, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data ?? ([] as unknown as T)
}

/** How many copies of what we sent a list reads, newest first. */
export const SENT_COPIES_READ = 500

/** The job as `drive-link` takes it: one of its three ids. */
export function driveJobOf(ref: JobRef): { bid_id: string } | { project_id: string } | { jobs_ledger_id: string } {
  if (ref.kind === 'bid') return { bid_id: ref.id }
  if (ref.kind === 'project') return { project_id: ref.id }
  return { jobs_ledger_id: ref.id }
}

// ---------- the rows, as each table holds them ----------

export interface ContractSendRow {
  id: string
  file_name: string
  sent_on: string
}

export interface PayAppRow {
  id: string
  number: number
  sent_on: string
}

export interface ChangeOrderRow {
  id: string
  number: number
  sent_on: string | null
}

export interface TradePackageRow {
  id: string
  trade: string
  ours: boolean
  awarded_on: string | null
}

/** The papers the app makes for a GC project, as the one list names them. Our contract is the newest one sent. */
export function appPapersFromRows(rows: {
  contracts: readonly ContractSendRow[]
  payApps: readonly PayAppRow[]
  changeOrders: readonly ChangeOrderRow[]
  packages: readonly TradePackageRow[]
  hasSchedule: boolean
}): AppPaperRow[] {
  const out: AppPaperRow[] = []
  const contract = [...rows.contracts].sort((a, b) => b.sent_on.localeCompare(a.sent_on))[0]
  if (contract) out.push({ id: contract.id, paper: 'contract', name: contract.file_name.trim() || 'Our contract.pdf', bytes: null, at: contract.sent_on })
  for (const p of rows.payApps) out.push({ id: p.id, paper: 'payapp', name: `Pay application ${p.number}`, bytes: null, at: p.sent_on })
  // A change order not sent yet is a draft, not a paper.
  for (const c of rows.changeOrders) if (c.sent_on) out.push({ id: c.id, paper: 'co', name: `Change order ${c.number}`, bytes: null, at: c.sent_on })
  // Our own trade has no statement of work from us, and one not awarded has none yet.
  for (const k of rows.packages)
    if (!k.ours && k.awarded_on) out.push({ id: k.id, paper: 'sow', name: `Statement of work, ${k.trade.trim() || 'a trade'}`, bytes: null, at: k.awarded_on })
  if (rows.hasSchedule) out.push({ id: 'schedule', paper: 'schedule', name: 'Schedule', bytes: null, at: null })
  return out
}

/** A copy of what we sent, with its files as `fileSentCopy` stored them. */
export interface SentCopyRow {
  id: string
  sent_at: string
  attachments: unknown
}

/** The files on the copies of what we sent, read defensively: a file with no path was named but not kept. */
export function sentFilesFromRows(rows: readonly SentCopyRow[]): SentFileRow[] {
  return rows.flatMap((r) =>
    (Array.isArray(r.attachments) ? r.attachments : []).flatMap((raw): SentFileRow[] => {
      const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const path = typeof a.path === 'string' ? a.path : ''
      if (!path) return []
      const bytes = typeof a.bytes === 'number' && Number.isFinite(a.bytes) && a.bytes >= 0 ? a.bytes : null
      return [{ sentId: r.id, name: (typeof a.name === 'string' && a.name.trim()) || 'Attachment', path, type: typeof a.type === 'string' ? a.type : '', bytes, sent_at: r.sent_at }]
    }),
  )
}

/** A file on one of the job's messages, with the line's time. */
export interface MessageFileRow {
  id: string
  name: string
  mime: string | null
  size_bytes: number | null
  drive_file_id: string | null
  messages: { at: string } | null
}

export function arrivedFromRows(rows: readonly MessageFileRow[]): ArrivedFileRow[] {
  return rows.map((r) => ({ id: r.id, name: r.name, bytes: r.size_bytes, mime: r.mime, drive_file_id: r.drive_file_id, at: r.messages?.at ?? '' }))
}

// ---------- the reads ----------

/** The job's Drive folder in its two halves, from `drive-link`'s office door. */
export async function loadDriveFiles(ref: JobRef): Promise<{ files: DriveFileRow[]; capped: boolean }> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action: 'list', job: driveJobOf(ref) } })) as FnResult
  const problem = await fnProblem(r, 'The job’s Drive folder did not read.')
  if (problem) throw new Error(problem)
  const d = (r.data ?? {}) as { files?: DriveFileRow[]; capped?: boolean }
  return { files: d.files ?? [], capped: d.capped === true }
}

async function loadAppPapers(projectId: string): Promise<AppPaperRow[]> {
  const [contracts, payApps, changeOrders, packages, schedule] = await Promise.all([
    from('gc_owner_contract_sends').select('id, file_name, sent_on').eq('project_id', projectId),
    from('gc_owner_pay_apps').select('id, number, sent_on').eq('project_id', projectId),
    from('gc_change_orders').select('id, number, sent_on').eq('project_id', projectId),
    from('gc_trade_packages').select('id, trade, ours, awarded_on').eq('project_id', projectId),
    from('gc_schedule_activities').select('id').eq('project_id', projectId).limit(1),
  ])
  return appPapersFromRows({
    contracts: taken(contracts as Result<ContractSendRow[]>, 'read our contract'),
    payApps: taken(payApps as Result<PayAppRow[]>, 'read the pay applications'),
    changeOrders: taken(changeOrders as Result<ChangeOrderRow[]>, 'read the change orders'),
    packages: taken(packages as Result<TradePackageRow[]>, 'read the statements of work'),
    hasSchedule: taken(schedule as Result<{ id: string }[]>, 'read the schedule').length > 0,
  })
}

async function loadSentFiles(ref: JobRef): Promise<SentFileRow[]> {
  let jobsLedgerId: string | null = ref.kind === 'pipeline' ? ref.id : null
  if (ref.kind === 'project') {
    // What we sent about a GC project is filed on its billing job; a project with none has sent nothing that names it.
    const gc = (await from('gc_projects').select('billing_job_id').eq('project_id', ref.id).maybeSingle()) as Result<{ billing_job_id: string | null }>
    checkSupabaseError(gc, 'read the project’s billing job')
    jobsLedgerId = gc.data?.billing_job_id ?? null
    if (!jobsLedgerId) return []
  }
  const sends = from('sent_documents').select('id, sent_at, attachments')
  const scoped = ref.kind === 'bid' ? sends.eq('bid_id', ref.id) : sends.contains('job_ids', [jobsLedgerId])
  const rows = taken((await scoped.order('sent_at', { ascending: false }).limit(SENT_COPIES_READ)) as Result<SentCopyRow[]>, 'read what we sent')
  return sentFilesFromRows(rows)
}

async function loadArrivedFiles(ref: JobRef): Promise<ArrivedFileRow[]> {
  const column = ref.kind === 'bid' ? 'bid_id' : ref.kind === 'project' ? 'project_id' : 'jobs_ledger_id'
  const rows = taken(
    (await from('message_attachments')
      .select('id, name, mime, size_bytes, drive_file_id, messages!inner(at)')
      .eq(`messages.${column}`, ref.id)
      .eq('kind', 'file')
      .is('sent_as', null)
      .or('bucket_path.not.is.null,drive_file_id.not.is.null')) as Result<MessageFileRow[]>,
    'read the files that came in',
  )
  return arrivedFromRows(rows)
}

export interface JobFileSourcesRead {
  sources: JobFileSources
  /** Drive did not answer: the list shows what the database holds, and says Drive is missing. */
  driveFailed: boolean
  /** The folder holds more files than one list reads. */
  driveCapped: boolean
}

/** Every place a job's files live, read side by side. A GC project has all six; a bid or a Pipeline job has no papers, plan sets or trades' uploads. */
export async function loadJobFileSources(ref: JobRef): Promise<JobFileSourcesRead> {
  const project = ref.kind === 'project' ? ref.id : null
  const [papers, planSets, drive, trade, sent, arrived] = await Promise.all([
    project ? loadAppPapers(project) : Promise.resolve([]),
    project
      ? from('gc_plan_sets')
          .select('id, label, drive_url, issued_on')
          .eq('project_id', project)
          .then((r) => taken(r as Result<PlanSetRow[]>, 'read the plan sets'))
      : Promise.resolve([]),
    loadDriveFiles(ref).then(
      (d) => ({ ...d, failed: false }),
      () => ({ files: [] as DriveFileRow[], capped: false, failed: true }),
    ),
    project
      ? from('gc_trade_files')
          .select('id, name, bytes, mime, drive_file_id, drive_url, uploaded_at')
          .eq('project_id', project)
          .then((r) => taken(r as Result<TradeFileRow[]>, 'read the trades’ files'))
      : Promise.resolve([]),
    loadSentFiles(ref),
    loadArrivedFiles(ref),
  ])
  return { sources: { papers, planSets, drive: drive.files, trade, sent, arrived }, driveFailed: drive.failed, driveCapped: drive.capped }
}

/** The one list of a job's files, as the Attach picker, the job's page and Documents read it. */
export async function loadJobFiles(ref: JobRef): Promise<{ files: JobFile[]; driveFailed: boolean; driveCapped: boolean }> {
  const read = await loadJobFileSources(ref)
  return { files: jobFiles(read.sources), driveFailed: read.driveFailed, driveCapped: read.driveCapped }
}

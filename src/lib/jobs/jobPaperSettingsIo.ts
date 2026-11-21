/**
 * The reads and writes behind the office's settings page on a job (punch list #389, step 4): the database functions of
 * `20261120163000_settings_on_the_job.sql` and `20261121150000_settings_page_ground.sql`. One interface, so the
 * window's smoke hands it a fake; one implementation on the app's client. The database decides every rule: who may
 * set a job's settings, the notice's box, the read-revision rule, and what a change does once someone has signed.
 */
import { supabase } from '../supabase'
import {
  checkSupabaseError,
  withSupabaseRetry,
} from '../../utils/errorHandling'
import {
  parseSettingsDef,
  type PaperPicks,
  type SettingsDef,
} from '../contracts/paperSettings'

/** A Contract Book entry built from settings, as the page reads it. */
export interface BookSettingsPaper {
  id: string
  name: string
  def: SettingsDef
  /** One up on every publish. */
  revision: number
  /** The revision an attorney read, or null. */
  readRevision: number | null
}

/** A paper built from settings that a job requires, with what the job set. */
export interface JobSettingsPaper {
  requiredPaperId: string
  bookDocumentId: string | null
  picks: PaperPicks
  typed: Record<string, string> | null
  /** The level the office picked before walking the topics, or null. */
  basis: string | null
  /** The row's number in its chain: 1, then one up for every change made after a signature. */
  settingsRevision: number
  /** The Book revision the settings were set against. */
  bookRevision: number
  /** How many signed copies the row holds. One or more locks it. */
  signed: number
}

/** What the office hands over to require a paper built from settings. */
export interface JobSettingsEntry {
  picks: PaperPicks
  typed: Record<string, string> | null
  basis: string | null
  /** True when the box on the notice was ticked. The database asks for it when the list opens on a notice. */
  noticeRead: boolean
}

/** What `job_paper_set_settings` answered. */
export interface JobSettingsSaved {
  state: 'saved' | 'revised'
  requiredPaperId: string
  signAgain: number
}

/** The job, as far as the page reads it: its number for a title, and the two names the ZZ rule reads. */
export interface JobForSettings {
  number: string
  job_name: string | null
  customer_name: string | null
}

export interface JobPaperSettingsIo {
  /** The job's number and names. */
  readJob(jobId: string): Promise<JobForSettings>
  /** One Book entry with its settings list. Null when it has none, or is gone. */
  readBookPaper(bookDocumentId: string): Promise<BookSettingsPaper | null>
  /** The papers built from settings this job requires now, with what the job set. */
  readSettingsPapers(jobId: string): Promise<JobSettingsPaper[]>
  /** Require one paper built from settings on the job, with its settings. */
  requireWithSettings(
    jobId: string,
    bookDocumentId: string,
    entry: JobSettingsEntry,
  ): Promise<void>
  /** Change a required paper's settings. After a signature it makes the next version, which everyone signs again. */
  setSettings(
    requiredPaperId: string,
    picks: PaperPicks,
    typed: Record<string, string> | null,
  ): Promise<JobSettingsSaved>
  /** Move a required paper's basis. It marks the page and never the paper. */
  setBasis(requiredPaperId: string, basis: string | null): Promise<void>
}

const bag = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  if (typeof v === 'object' && v !== null && !Array.isArray(v))
    for (const [k, x] of Object.entries(v))
      if (typeof x === 'string') out[k] = x
  return out
}

/** A row of `job_required_papers` as the page keeps it. Null for a row with no settings. */
export function parseJobSettingsPaper(
  row: Record<string, unknown>,
  signed: number,
): JobSettingsPaper | null {
  if (
    typeof row.id !== 'string' ||
    typeof row.settings !== 'object' ||
    row.settings === null
  )
    return null
  const typed = bag(row.fields)
  return {
    requiredPaperId: row.id,
    bookDocumentId:
      typeof row.book_document_id === 'string' ? row.book_document_id : null,
    picks: bag(row.settings),
    typed: Object.keys(typed).length > 0 ? typed : null,
    basis: typeof row.basis === 'string' && row.basis !== '' ? row.basis : null,
    settingsRevision:
      typeof row.settings_revision === 'number' ? row.settings_revision : 1,
    bookRevision: typeof row.book_revision === 'number' ? row.book_revision : 0,
    signed,
  }
}

export const supabaseJobPaperSettingsIo: JobPaperSettingsIo = {
  async readJob(jobId) {
    const row = await withSupabaseRetry(
      () =>
        supabase
          .from('jobs_ledger')
          .select('hcp_number, click_number, job_name, customer_name')
          .eq('id', jobId)
          .maybeSingle(),
      'read the job',
    )
    const r = row as {
      hcp_number: string | null
      click_number: string | null
      job_name: string | null
      customer_name: string | null
    } | null
    return {
      number: (r?.hcp_number ?? '').trim() || (r?.click_number ?? '').trim(),
      job_name: r?.job_name ?? null,
      customer_name: r?.customer_name ?? null,
    }
  },
  async readBookPaper(bookDocumentId) {
    const row = await withSupabaseRetry(
      () =>
        supabase
          .from('contract_template_documents')
          .select('id, document_name, settings_def, revision, read_revision')
          .eq('id', bookDocumentId)
          .maybeSingle(),
      'read the paper’s settings list',
    )
    const r = row as {
      id: string
      document_name: string
      settings_def: unknown
      revision: number | null
      read_revision: number | null
    } | null
    const def = r ? parseSettingsDef(r.settings_def) : null
    return r && def
      ? {
          id: r.id,
          name: r.document_name,
          def,
          revision: r.revision ?? 0,
          readRevision: r.read_revision,
        }
      : null
  },
  async readSettingsPapers(jobId) {
    // The row is read loosely and checked by `parseJobSettingsPaper`.
    const rows = (await withSupabaseRetry(
      () =>
        supabase
          .from('job_required_papers' as never)
          .select(
            'id, book_document_id, settings, fields, basis, settings_revision, book_revision' as never,
          )
          .eq('job_id' as never, jobId as never)
          .is('removed_at' as never, null as never)
          .not('settings' as never, 'is', null) as never,
      'read this job’s paper settings',
    )) as unknown as Array<Record<string, unknown>> | null
    const live = rows ?? []
    if (live.length === 0) return []
    const ids = live.map((r) => String(r.id))
    const signedRows = (await withSupabaseRetry(
      () =>
        supabase
          .from('person_contract_documents')
          .select('job_required_paper_id')
          .in('job_required_paper_id', ids)
          .eq('status', 'signed'),
      'read who has signed',
    )) as unknown as Array<{ job_required_paper_id: string | null }> | null
    const count = new Map<string, number>()
    for (const s of signedRows ?? [])
      if (s.job_required_paper_id)
        count.set(
          s.job_required_paper_id,
          (count.get(s.job_required_paper_id) ?? 0) + 1,
        )
    return live
      .map((r) => parseJobSettingsPaper(r, count.get(String(r.id)) ?? 0))
      .filter((p): p is JobSettingsPaper => p !== null)
  },
  async requireWithSettings(jobId, bookDocumentId, entry) {
    const res = await supabase.rpc(
      'job_papers_require' as never,
      {
        p_job_id: jobId,
        p_book_document_ids: [bookDocumentId],
        p_settings: {
          [bookDocumentId]: {
            settings: entry.picks,
            ...(entry.typed ? { fields: entry.typed } : {}),
            ...(entry.basis ? { basis: entry.basis } : {}),
            ...(entry.noticeRead ? { notice_read: true } : {}),
          },
        },
      } as never,
    )
    checkSupabaseError(res, 'require the paper')
  },
  async setSettings(requiredPaperId, picks, typed) {
    const res = await supabase.rpc(
      'job_paper_set_settings' as never,
      {
        p_required_paper_id: requiredPaperId,
        p_settings: picks,
        p_fields: typed,
      } as never,
    )
    checkSupabaseError(res, 'save the settings')
    const d = (res.data ?? {}) as {
      state?: string
      id?: string
      sign_again?: number
    }
    return {
      state: d.state === 'revised' ? 'revised' : 'saved',
      requiredPaperId: typeof d.id === 'string' ? d.id : requiredPaperId,
      signAgain: typeof d.sign_again === 'number' ? d.sign_again : 0,
    }
  },
  async setBasis(requiredPaperId, basis) {
    const res = await supabase.rpc(
      'job_paper_set_basis' as never,
      { p_required_paper_id: requiredPaperId, p_basis: basis ?? '' } as never,
    )
    checkSupabaseError(res, 'move the basis')
  },
}

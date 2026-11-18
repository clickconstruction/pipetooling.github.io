/**
 * The reads and writes behind Papers before a job opens: the database functions of
 * `20261117220000_job_required_papers.sql` and, for a signing link, `send-contract-for-signature` in link mode. One
 * interface, so a section's smoke hands it a fake; one implementation on the app's client.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { type BookPaperRow, type JobNeedingMe, type JobPapersRoster, type MyJobPapers, parseClosedJobIds, parseJobPapersRoster, parseJobsNeedingMe, parseMyJobPapers } from './jobPapers'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export interface JobPapersIo {
  /** Everyone who can open the job against each required paper. Office only. */
  readRoster(jobId: string): Promise<JobPapersRoster>
  /** The Contract Book's entries, for Add a paper. */
  readBook(): Promise<BookPaperRow[]>
  /** Require these Book entries on the job. Answers how many were added. */
  requirePapers(jobId: string, bookDocumentIds: readonly string[]): Promise<number>
  /** Take a required paper off its job. Every signature is kept. */
  removePaper(requiredPaperId: string): Promise<void>
  /** A signing link for one person's copy of one required paper. The copy is made if it is not there yet. */
  signingLink(requiredPaperId: string, personId: string): Promise<string>
  /** How many papers the job requires, for the chip. */
  countRequired(jobId: string): Promise<number>
  /** The ids of the jobs the caller still owes a paper on. */
  readClosed(): Promise<string[]>
  /** The caller's own papers on one job, for the prompt: the job's number and the papers' names, nothing else. */
  readMine(jobId: string): Promise<MyJobPapers>
  /** A signing link for the caller's own copy of one required paper. The copy is made if it is not there yet. */
  ownSigningLink(requiredPaperId: string): Promise<string>
  /** The jobs that wait on the caller's signature and are theirs to open. */
  readNeedingMe(): Promise<JobNeedingMe[]>
}

async function jwt(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in.')
  return token
}

export const supabaseJobPapersIo: JobPapersIo = {
  async readRoster(jobId) {
    // The functions are not in the generated types until the types PR that follows the push.
    const raw = await withSupabaseRetry(() => supabase.rpc('job_papers_roster' as never, { p_job_id: jobId } as never), 'read who has signed the job’s papers')
    return parseJobPapersRoster(raw)
  },
  async readBook() {
    const rows = await withSupabaseRetry(
      () =>
        supabase
          .from('contract_template_documents')
          .select('id, document_name, book_body_html, book_body_format, canonical_document_url, form_template_id, book_version_date, updated_at, audience, flow_kind')
          .order('document_name'),
      'read the Contract Book',
    )
    return (rows as unknown as BookPaperRow[] | null) ?? []
  },
  async requirePapers(jobId, bookDocumentIds) {
    const added = await withSupabaseRetry(
      () => supabase.rpc('job_papers_require' as never, { p_job_id: jobId, p_book_document_ids: [...bookDocumentIds] } as never) as never,
      'require the papers',
      { maxRetries: 0 },
    )
    return typeof added === 'number' ? added : 0
  },
  async removePaper(requiredPaperId) {
    await withSupabaseRetry(() => supabase.rpc('job_paper_remove' as never, { p_required_paper_id: requiredPaperId } as never) as never, 'take the paper off', { maxRetries: 0 })
  },
  async signingLink(requiredPaperId, personId) {
    const documentId = await withSupabaseRetry(
      () => supabase.rpc('job_paper_start' as never, { p_required_paper_id: requiredPaperId, p_person_id: personId } as never) as never,
      'start the paper',
      { maxRetries: 0 },
    )
    if (typeof documentId !== 'string' || !documentId) throw new Error('The paper could not be started.')
    const res = await fetch(`${supabaseUrl}/functions/v1/send-contract-for-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await jwt()}`, apikey: anonKey },
      body: JSON.stringify({ person_contract_document_id: documentId, public_origin: window.location.origin, mode: 'link' }),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; accept_url?: string; error?: string }
    if (!res.ok || json.ok === false || !json.accept_url) throw new Error(json.error || `The signing link could not be made (${res.status}).`)
    return json.accept_url
  },
  async readClosed() {
    return parseClosedJobIds(await withSupabaseRetry(() => supabase.rpc('jobs_closed_to_me' as never), 'read the jobs that wait on your signature'))
  },
  async readMine(jobId) {
    return parseMyJobPapers(await withSupabaseRetry(() => supabase.rpc('job_papers_mine' as never, { p_job_id: jobId } as never), 'read this job’s papers'))
  },
  async ownSigningLink(requiredPaperId) {
    const documentId = await withSupabaseRetry(() => supabase.rpc('job_paper_start' as never, { p_required_paper_id: requiredPaperId } as never) as never, 'start the paper', { maxRetries: 0 })
    if (typeof documentId !== 'string' || !documentId) throw new Error('The paper could not be started.')
    const res = await fetch(`${supabaseUrl}/functions/v1/get-contract-signing-link-for-self`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await jwt()}`, apikey: anonKey },
      body: JSON.stringify({ person_contract_document_id: documentId, public_origin: window.location.origin }),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; accept_url?: string; error?: string }
    if (!res.ok || json.ok === false || !json.accept_url) throw new Error(json.error || `The signing page could not be opened (${res.status}).`)
    return json.accept_url
  },
  async readNeedingMe() {
    return parseJobsNeedingMe(await withSupabaseRetry(() => supabase.rpc('job_papers_needing_me' as never), 'read the jobs that wait on your signature'))
  },
  async countRequired(jobId) {
    const res = await supabase
      .from('job_required_papers' as never)
      .select('id', { count: 'exact', head: true })
      .eq('job_id' as never, jobId as never)
      .is('removed_at' as never, null as never)
    if (res.error) throw res.error
    return res.count ?? 0
  },
}

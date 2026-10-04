import { supabase } from '../supabase'
import type { JobContractRow } from './jobContractLifecycle'
import type { JobLienPaper } from './jobLienPaperRows'

/**
 * Reads behind the Documents tab's contract and lien paper sections (v2.4496), one job at a time.
 * Each read fails soft: a role the tables' RLS leaves out (primary) simply sees none.
 */

/** The job's filings, demand letters and releases of lien, voided ones included (the row kernel filters). */
export async function loadJobLienPaper(jobId: string): Promise<JobLienPaper> {
  const [filings, letters, releases] = await Promise.all([
    supabase.from('job_lien_filings').select('*').eq('job_id', jobId).order('created_at').limit(500),
    supabase.from('job_demand_letters').select('*').eq('job_id', jobId).order('created_at').limit(500),
    supabase.from('job_lien_releases').select('*').eq('job_id', jobId).order('created_at').limit(500),
  ])
  return {
    filings: filings.error ? [] : (filings.data ?? []),
    letters: letters.error ? [] : (letters.data ?? []),
    releases: releases.error ? [] : (releases.data ?? []),
  }
}

/** The job's contracts that were sent, signed or voided, oldest first. Drafts stay in the Contract window. */
export async function loadJobContractRows(jobId: string): Promise<JobContractRow[]> {
  const { data, error } = await supabase.from('job_contracts').select('*').eq('job_id', jobId).neq('status', 'draft').order('created_at').limit(500)
  return error ? [] : (data ?? [])
}

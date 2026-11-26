/**
 * The reads behind a returned check's liens (punch list #435, piece 6; the rule is `payoffReturned.ts`).
 *
 * Read when a case opens in Accounts Receivable, and nothing is written. Up to five small reads:
 *
 *   1. the bank's own row of the deposit, for the number it read off the check;
 *   2. the unlinked check payments that carry that number near the deposit's day (the check's mark);
 *   3. the live filed liens and releases of record on the check's jobs;
 *   4. those jobs' numbers and names;
 *   5. the printed copies of a release on those jobs (`sent_documents`).
 *
 * A check on no job with no mark stops after read 2, and jobs with no filed lien stop after read 3: most cases.
 * Reads 1 to 4 throw, so the pane can say the liens could not be read. Read 5 never does: a seat that may not read
 * the copies gets `prints: null`, and a saved release is then read as printed.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { ymdAddDays } from '../../utils/dateUtils'
import { arCaseJobLabel } from './arReturnCase'
import { BANK_CHECK_COLUMNS, BANK_CHECK_WINDOW_DAYS, bankCheckFromRow, checkNumberKey, type BankCheck, type BankCheckRow } from './checkCleared'
import type { LienPayoffAffidavit, LienPayoffRelease } from './lienPayoff'
import { releaseTargets } from './lienReleaseOfRecord'
import { paymentsOnReturnedCheck, returnedCaseJobs, type PayoffReturnedInput, type ReleasePrint, type ReturnedCaseJobs, type ReturnedLienTarget, type ReturnedMarkPayment } from './payoffReturned'

type FilingRow = LienPayoffAffidavit & LienPayoffRelease & { kind: string }

/** The kind a release's print files its copy under (`LienFilingTabs.tsx`). */
export const RELEASE_PRINT_KIND = 'lien_release_of_record'

/** The bank's row of the deposit as a check, or null when the case names no deposit. */
async function readDeposit(depositId: string | null): Promise<BankCheck | null> {
  if (!depositId) return null
  const rows = ((await withSupabaseRetry(() => supabase.from('mercury_transactions').select(BANK_CHECK_COLUMNS).eq('id', depositId).limit(1), 'returned check: the deposit')) ?? []) as unknown as BankCheckRow[]
  return rows[0] ? bankCheckFromRow(rows[0]) : null
}

/** The payments typed off this check and never linked to it: read by the number, then held to the mark's rule. */
async function readMarked(deposit: BankCheck | null): Promise<ReturnedMarkPayment[]> {
  const key = checkNumberKey(deposit?.checkNumber)
  if (!deposit || !key || !deposit.depositedYmd) return []
  const from = ymdAddDays(deposit.depositedYmd, -BANK_CHECK_WINDOW_DAYS)
  const to = ymdAddDays(deposit.depositedYmd, BANK_CHECK_WINDOW_DAYS)
  const rows = ((await withSupabaseRetry(
    () => supabase.from('jobs_ledger_payments').select('id, job_id, amount, paid_on, payment_type, reference_number, mercury_transaction_id').is('mercury_transaction_id', null).ilike('reference_number', `%${key}%`).gte('paid_on', from).lte('paid_on', to).limit(200),
    'returned check: the check’s mark',
  )) ?? []) as ReturnedMarkPayment[]
  return paymentsOnReturnedCheck(deposit, rows)
}

/** The printed copies of a release on these jobs. Null when they cannot be read. */
async function readPrints(jobIds: string[]): Promise<ReleasePrint[] | null> {
  try {
    const { data, error } = await supabase.from('sent_documents').select('job_ids, sent_at, sent_by_name').eq('kind', RELEASE_PRINT_KIND).overlaps('job_ids', jobIds).order('sent_at', { ascending: false }).limit(500)
    if (error) return null
    const out: ReleasePrint[] = []
    for (const r of data ?? []) {
      for (const jobId of r.job_ids ?? []) if (jobIds.includes(jobId)) out.push({ jobId, printedAt: r.sent_at, by: r.sent_by_name ?? '' })
    }
    return out
  } catch {
    return null
  }
}

/**
 * Everything `payoffReturnedView` reads for one case. `depositId` is the bank's row the case stands on, which is a
 * bank or hand case's own id. Null reads no mark.
 */
export async function readReturnedCaseLiens(caseJobs: ReturnedCaseJobs, depositId: string | null): Promise<PayoffReturnedInput> {
  const deposit = await readDeposit(depositId)
  const marked = await readMarked(deposit)
  const jobs = returnedCaseJobs(caseJobs, marked)
  const checkNumber = deposit?.checkNumber ?? ''
  const nothing: PayoffReturnedInput = { jobs, labelByJob: {}, targets: [], prints: [], checkNumber }
  if (jobs.length === 0) return nothing
  const jobIds = jobs.map((j) => j.jobId)
  const filings = ((await withSupabaseRetry(
    () => supabase.from('job_lien_filings').select('id, job_id, kind, amount, county, recording_number, filed_at, created_at, fields').in('job_id', jobIds).in('kind', ['affidavit', 'release_of_record']).is('voided_at', null),
    'returned check: the filed liens',
  )) ?? []) as FilingRow[]
  const targets: ReturnedLienTarget[] = []
  for (const jobId of jobIds) {
    const mine = filings.filter((f) => f.job_id === jobId)
    targets.push(...releaseTargets(mine.filter((f) => f.kind === 'affidavit'), mine.filter((f) => f.kind === 'release_of_record')))
  }
  if (targets.length === 0) return nothing
  const liened = [...new Set(targets.map((t) => t.affidavit.job_id))]
  const jobRows = ((await withSupabaseRetry(() => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name').in('id', liened), 'returned check: the jobs')) ?? []) as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }>
  const labelByJob: Record<string, string> = {}
  for (const j of jobRows) labelByJob[j.id] = arCaseJobLabel({ job_number: (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim(), job_name: j.job_name })
  return { jobs, labelByJob, targets, prints: await readPrints(liened), checkNumber }
}

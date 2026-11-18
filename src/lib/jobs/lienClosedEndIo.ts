import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { uncollectibleFirmWarning } from '../legal/uncollectibleFirmWarning'
import type { LegalMatterRow } from '../legal/legalMatters'
import { invokeMarkStripeInvoiceUncollectible } from '../markStripeInvoiceUncollectible'
import { setJobCollectionsFlag } from '../setJobCollectionsFlag'
import { setJobUncollectible } from '../setJobUncollectible'
import { getAccessTokenForEdgeFunctions } from '../supabaseAccessTokenForEdge'
import { stripeModeForBillingFromRole } from '../voidStripeInvoiceForRevert'
import { noteLienWindowMissed } from './lienDeskIo'
import { setJobLienPathAnswer } from './lienJobPathIo'
import type { LienJobPathResult } from './lienJobPathWindow'
import { parseLienDeskDraftFields } from './lienNoticeDraft'

/**
 * The reads and writes behind the window a closed chip opens (`LienClosedWindow`; the words and the rule are
 * `lienClosedEnd.ts`). Nothing here is a new write: each answer goes through the function the desk or the Pipeline
 * already uses, so the same roles may press it and the same record is kept.
 *
 *  - **Keep collecting** is the job taken off the lien path with its reason (`set_job_lien_path_answer`), which also
 *    puts a billed job in Collections when it is not there yet.
 *  - **Let it go** is the Pipeline's Uncollectible mark, step for step (`confirmUncollectible` in `JobsStagesTab.tsx`):
 *    the job goes to Collections first when it is not there, since the mark takes a Collections job only, then
 *    `set_job_uncollectible`, then Stripe's own mark on each billed invoice. A failure at Stripe never undoes the mark
 *    here, and it is said.
 *  - **Record it closed** is the noted miss of v2.3679 (`noteLienWindowMissed`).
 */

/** The warning the Pipeline's Uncollectible window shows when a law firm holds the payer's account, or null. A read that fails says nothing: the press still works, as it does there. */
export async function readLienClosedFirmWarning(job: { gc_customer_id?: string | null; customer_id?: string | null }): Promise<string | null> {
  const payer = job.gc_customer_id || job.customer_id
  if (!payer) return null
  const rows = await withSupabaseRetry(() => supabase.from('legal_matters' as never).select('stage, closed_at').eq('payer_key', `c:${payer}`), 'closed lien day: the legal matter').catch(() => null)
  const matter = ((rows ?? []) as unknown as Array<Pick<LegalMatterRow, 'stage' | 'closed_at'>>)[0] ?? null
  return uncollectibleFirmWarning(matter)
}

/** Keep collecting: off the lien path with the reason, and into Collections when the job is not there yet. */
export async function keepCollectingLienClosed(input: { jobId: string; reason: string; inCollections: boolean }): Promise<LienJobPathResult> {
  return setJobLienPathAnswer({ jobId: input.jobId, answer: 'off_path', reason: input.reason, attorneyList: !input.inCollections })
}

/** What Let it go did: the mark stands, and `stripe` names each Stripe invoice that could not be marked. */
export type LienClosedLetGoResult = { stripe: string[] }

/** Let it go: into Collections when it is not there, the Uncollectible mark, then Stripe's own. Throws with the reason when the mark does not stand. */
export async function letLienClosedJobGo(input: { jobId: string; reason: string; inCollections: boolean; authRole: string | null }): Promise<LienClosedLetGoResult> {
  if (!input.inCollections) {
    const flagged = await setJobCollectionsFlag(input.jobId, true, input.reason)
    if (!flagged.ok) throw new Error(flagged.error ?? 'The job could not go to Collections.')
  }
  const marked = await setJobUncollectible(input.jobId, true, input.reason)
  if (!marked.ok) throw new Error(marked.error ?? 'The job could not be marked Uncollectible.')
  // Stripe's invoice is marked uncollectible too (punch list #94): a failure there never undoes the mark here.
  const stripe: string[] = []
  const invoices = ((await withSupabaseRetry(() => supabase.from('jobs_ledger_invoices').select('id, status, stripe_invoice_id').eq('job_id', input.jobId), 'closed lien day: the bills').catch(() => null)) ?? []) as Array<{ id: string; status: string | null; stripe_invoice_id: string | null }>
  const onStripe = invoices.filter((i) => i.status === 'billed' && (i.stripe_invoice_id ?? '').trim() !== '')
  if (onStripe.length > 0) {
    const token = await getAccessTokenForEdgeFunctions()
    if (!token) stripe.push('not signed in for the Stripe call')
    else {
      for (const inv of onStripe) {
        const r = await invokeMarkStripeInvoiceUncollectible({ invoiceId: inv.id, stripeModeForBilling: stripeModeForBillingFromRole(input.authRole), accessToken: token })
        if (!r.ok) stripe.push(r.message)
      }
    }
  }
  return { stripe }
}

/** Record it closed: one `missed` row naming the months and who looked. The job has no draft here, so the row carries a blank notice. */
export async function recordLienMonthsClosed(input: { jobId: string; months: string[]; userId: string | null; userName: string }): Promise<void> {
  const blank = parseLienDeskDraftFields({ notice: {}, gcEmail: '' })
  if (!blank) throw new Error('The months could not be recorded.')
  await noteLienWindowMissed({ jobId: input.jobId, months: input.months, fields: blank, userId: input.userId, userName: input.userName })
}

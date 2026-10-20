/**
 * Where a step's paper opens from the boards, with its send for a nudge. A trade partner's company window opens on
 * Documents at the step's paper, and a customer's window opens on Documents at the job's contract. A chip's own press
 * opens the window's Flow tab instead (`GcFlowBoard`). Pure: the screen hands the result to the openers.
 */
import type { FlowStep } from './state'

/** A step's paper as a Documents row of the company window (`DOC_KEYS` in `gc/companyFile.ts`). */
const COMPANY_DOC: Readonly<Record<string, string>> = { w9: 'w9', coi: 'insurance', msa: 'msa' }

/** Where a trade partner's window opens for a step: Documents at its first paper with a row there, else Activity. */
export function companyAtForStep(step: Pick<FlowStep, 'papers'> | null, send = false): { tab: 'documents' | 'activity'; doc?: string; send?: boolean } {
  const doc = step?.papers.map((p) => COMPANY_DOC[p]).find(Boolean)
  if (doc) return send ? { tab: 'documents', doc, send: true } : { tab: 'documents', doc }
  return { tab: 'activity' }
}

/** Where a customer's window opens for a step: Documents at the job's contract on the contract step, else Activity. */
export function customerAtForStep(step: Pick<FlowStep, 'papers'> | null, jobId: string | null, send = false): { tab: 'documents' | 'activity'; doc?: string; send?: boolean } {
  if (jobId && step?.papers.includes('contract')) return send ? { tab: 'documents', doc: `contract-${jobId}`, send: true } : { tab: 'documents', doc: `contract-${jobId}` }
  return { tab: 'activity' }
}

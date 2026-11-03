/**
 * The thread's line for a job agreement the office sent or the customer signed (the warranty in place of a contract,
 * 2026-11-02; a contract gets the same line, which it never had). One `messages` row as the app's event on the
 * customer's own thread — `channel: 'event'`, `direction: 'team'`, `who_text: 'The app'` — keyed on `quo_id` with
 * duplicates ignored, as `estimateThreadLine.ts` writes an estimate's. The customer is the job's (`jobs_ledger.customer_id`);
 * the thread is found, never made (`findPageContact`). Best effort: logs and never throws.
 */
import { findPageContact } from './gcPortalThread.ts'
import { agreementNoun, type JobAgreementKind } from './jobContract.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export type JobAgreementThreadEvent = 'sent' | 'signed'

/** The line's words and its key, pure: "The app sent Dana the warranty for 407 E 6th St to initial and sign." */
export function jobAgreementThreadLine(input: { contractId: string; kind: JobAgreementKind; event: JobAgreementThreadEvent; heading: string; firstName: string | null; signerName: string | null; sentAtIso?: string | null }): { body: string; key: string } {
  const { noun } = agreementNoun(input.kind)
  const who = input.firstName?.trim() || 'the customer'
  if (input.event === 'signed') {
    const signer = input.signerName?.trim() || who
    return {
      body: `${signer} signed the ${noun}: ${input.heading}.${input.kind === 'warranty' ? ' Each line is initialled.' : ''} The signed copy is on the job.`,
      key: `contract:${input.contractId}:signed`,
    }
  }
  const epoch = input.sentAtIso ? Math.floor(new Date(input.sentAtIso).getTime() / 1000) : 0
  return {
    body: `The ${noun} went to ${who} to ${input.kind === 'warranty' ? 'initial and sign' : 'sign'}: ${input.heading}.`,
    key: `contract:${input.contractId}:sent:${epoch}`,
  }
}

export async function writeJobAgreementThreadLine(
  admin: Admin,
  input: { contractId: string; jobId: string; kind: JobAgreementKind; event: JobAgreementThreadEvent; heading: string; signerName: string | null; sentAtIso?: string | null },
): Promise<void> {
  try {
    const job = (await admin.from('jobs_ledger').select('customer_id, customer_name').eq('id', input.jobId).maybeSingle()).data as { customer_id: string | null; customer_name: string | null } | null
    if (!job?.customer_id) return
    const contactId = await findPageContact(admin, job.customer_id)
    if (!contactId) return
    const firstName = (job.customer_name ?? '').trim().split(/\s+/)[0] || null
    const line = jobAgreementThreadLine({ ...input, firstName })
    const { error } = await admin.from('messages').upsert(
      { contact_id: contactId, channel: 'event', direction: 'team', who_text: 'The app', body: line.body, jobs_ledger_id: input.jobId, quo_id: line.key },
      { onConflict: 'quo_id', ignoreDuplicates: true },
    )
    if (error) console.error('writeJobAgreementThreadLine', JSON.stringify(error))
  } catch (e) {
    console.error('writeJobAgreementThreadLine', e instanceof Error ? e.message : String(e))
  }
}

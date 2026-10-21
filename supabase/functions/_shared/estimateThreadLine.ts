/**
 * The thread's line for what a customer did with an estimate, written (v2.5705, punch list #139 PR 13). The words
 * and the key are `estimateEventLine.ts` (pure); this is the read and the write: the estimate's customer, number
 * and job, the customer's own thread (`findPageContact`, never made here), and one `messages` row as the app's
 * event — `channel: 'event'`, `direction: 'team'`, `who_text: 'The app'` — keyed on `quo_id` with duplicates
 * ignored, the morning run's own shape. Best effort: it logs and never throws, since the customer's answer must
 * never wait on it.
 */
import { estimateEventLine, type EstimateEventForLine } from './estimateEventLine.ts'
import { findPageContact } from './gcPortalThread.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export async function writeEstimateThreadLine(
  admin: Admin,
  input: { estimateId: string; eventType: EstimateEventForLine; metadata?: Record<string, unknown> | null },
): Promise<void> {
  try {
    const est = (await admin.from('estimates').select('customer_id, estimate_number, job_ledger_id, customers(name)').eq('id', input.estimateId).maybeSingle()).data as {
      customer_id: string | null
      estimate_number: number | null
      job_ledger_id: string | null
      customers: { name: string | null } | null
    } | null
    if (!est?.customer_id) return
    const line = estimateEventLine(input.eventType, { estimateId: input.estimateId, estimateNumber: est.estimate_number, customerName: est.customers?.name ?? null, metadata: input.metadata ?? null })
    if (!line) return
    const contactId = await findPageContact(admin, est.customer_id)
    if (!contactId) return
    const { error } = await admin.from('messages').upsert(
      {
        contact_id: contactId,
        channel: 'event',
        direction: 'team',
        who_text: 'The app',
        body: line.body,
        jobs_ledger_id: est.job_ledger_id,
        quo_id: line.key,
      },
      { onConflict: 'quo_id', ignoreDuplicates: true },
    )
    if (error) console.error('writeEstimateThreadLine', JSON.stringify(error))
  } catch (e) {
    console.error('writeEstimateThreadLine', e instanceof Error ? e.message : String(e))
  }
}

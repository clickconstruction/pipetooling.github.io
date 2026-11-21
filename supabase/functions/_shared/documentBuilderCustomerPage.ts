/**
 * The builders a GC's own page shows (punch list #404, step 9): each published builder that was sent to the customer
 * and is still on their page, with the job it sits under. Read as the service role by `customer-portal`, for the
 * customer its link names and no other. A builder shows as published, never as a draft, and a send taken off the page
 * shows nothing.
 */
import { officeYmd } from './bidFollowupReminder.ts'
import type { CustomerPageBuilder } from './documentBuilderSend.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

/** `gcJobs` are the jobs on this page that the customer is the GC on, with the label the page gives each. */
export async function customerPageBuilders(admin: Admin, customerId: string, gcJobs: ReadonlyArray<{ id: string; label: string }>): Promise<CustomerPageBuilder[]> {
  const { data: sendRows, error } = await admin.from('document_builder_sends').select('id, builder_key, about_job_id, opened_at, opened_revision').eq('customer_id', customerId).is('sheet_id', null).is('taken_off_at', null)
  if (error) throw new Error(`the builders sent: ${error.message}`)
  const sends = (sendRows ?? []) as Array<{ id: string; builder_key: string; about_job_id: string | null; opened_at: string | null; opened_revision: number | null }>
  if (sends.length === 0) return []
  const { data: builderRows, error: builderError } = await admin.from('document_builders').select('key, revision, published').in('key', sends.map((s) => s.builder_key))
  if (builderError) throw new Error(`the builders: ${builderError.message}`)
  const builders = ((builderRows ?? []) as Array<{ key: string; revision: number; published: unknown }>).filter((b) => b.revision >= 1 && b.published)
  const out: CustomerPageBuilder[] = []
  for (const send of sends) {
    const builder = builders.find((b) => b.key === send.builder_key)
    if (!builder) continue
    // A job that is no longer theirs, or is not on this page, places the builder with all their jobs.
    const job = send.about_job_id ? gcJobs.find((j) => j.id === send.about_job_id) : undefined
    out.push({
      sendId: send.id,
      builderKey: builder.key,
      aboutJobId: job?.id ?? null,
      aboutJob: job?.label ?? null,
      revision: builder.revision,
      contents: builder.published,
      openedOn: send.opened_at ? officeYmd(send.opened_at) : null,
      opened: send.opened_revision === builder.revision,
      changed: send.opened_revision != null && send.opened_revision < builder.revision,
    })
  }
  return out
}

/** The same, and an empty list when the read fails: a page that cannot read its builders still draws everything else. */
export async function customerPageBuildersOrNone(admin: Admin, customerId: string, gcJobs: ReadonlyArray<{ id: string; label: string }>): Promise<CustomerPageBuilder[]> {
  try {
    return await customerPageBuilders(admin, customerId, gcJobs)
  } catch (e) {
    console.error('document builder builders', e)
    return []
  }
}

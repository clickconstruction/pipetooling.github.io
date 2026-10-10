// Punch list #61 (v2.5122): a customer's page without its ZZ test jobs. The page knows its customer, so a job is
// a test job when its own name, its stored customer name (the rule the list's shared ids use, review on #5246) or
// the page customer's name is a ZZ name; no shared read is needed. The jobs leave the page and its money, and
// their bills and payments leave the Invoices tab.
// Pure: the page (`CustomerDetail.tsx`) calls it for every role but a dev who shows them.

import { isZzTestJob, isZzTestName } from '../jobs/zzTestJobSweep'
import type { CustomerInvoicesData } from './fetchCustomerInvoices'

type PageData = { customer: { name: string | null }; jobs: Array<{ id: string; job_name: string | null; customer_name?: string | null }> }

/** The ZZ jobs on the page: `all` for a ZZ customer, the ids otherwise, null when there is none. */
export function customerPageZzJobs(data: PageData | null): ReadonlySet<string> | 'all' | null {
  if (!data) return null
  if (isZzTestName(data.customer.name)) return 'all'
  const ids = new Set(data.jobs.filter((j) => isZzTestJob(j)).map((j) => j.id))
  return ids.size > 0 ? ids : null
}

const isZz = (zz: ReadonlySet<string> | 'all', jobId: string | null | undefined) => zz === 'all' || (jobId != null && zz.has(jobId))

/** The page's data without the ZZ jobs (the same object when there is none). */
export function customerPageDataWithoutZz<T extends PageData>(data: T | null, zz: ReadonlySet<string> | 'all' | null): T | null {
  if (!data || !zz) return data
  return { ...data, jobs: data.jobs.filter((j) => !isZz(zz, j.id)) }
}

/** The Invoices tab without the ZZ jobs' bills and payments (the same object when there is none). */
export function customerInvoicesWithoutZz(
  data: CustomerInvoicesData | null,
  zz: ReadonlySet<string> | 'all' | null,
): CustomerInvoicesData | null {
  if (!data || !zz) return data
  const dropped = new Set(data.invoices.filter((i) => isZz(zz, i.job_id)).map((i) => i.id))
  return {
    invoices: data.invoices.filter((i) => !dropped.has(i.id)),
    payments: data.payments.filter((p) => !(p.invoice_id && dropped.has(p.invoice_id)) && !(p.job_id != null && isZz(zz, p.job_id))),
    jobs: data.jobs.filter((j) => !isZz(zz, j.id)),
  }
}

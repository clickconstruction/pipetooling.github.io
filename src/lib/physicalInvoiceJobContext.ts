import type { JobWithDetails } from '../types/jobWithDetails'
import type { JobBillingContext } from './jobBillingContext'
import type { PhysicalInvoiceDetailFromJob, PhysicalInvoiceJobContext } from './physicalInvoiceDocument'

export function buildPhysicalInvoiceDetailFromJob(
  details: JobWithDetails | null,
  billingKind: 'job' | 'invoice',
  invoiceId: string | null,
): PhysicalInvoiceDetailFromJob | null {
  if (!details) return null
  const inv = invoiceId ? details.invoices.find((i) => i.id === invoiceId) : undefined
  return {
    fixtures: details.fixtures,
    materials: details.materials,
    payments: details.payments,
    billingKind,
    invoiceId,
    invoiceSequenceOrder: inv?.sequence_order ?? null,
  }
}

export function jobContextForPhysicalDoc(
  job: JobBillingContext,
  details: JobWithDetails | null,
): PhysicalInvoiceJobContext {
  return {
    customer_name: job.customer_name,
    customer_email: job.customer_email,
    job_name: job.job_name,
    hcp_number: job.hcp_number,
    job_address: details?.job_address ?? job.job_address,
    customer_phone: details?.customer_phone ?? job.customer_phone,
    last_work_date: details?.last_work_date ?? job.last_work_date,
  }
}

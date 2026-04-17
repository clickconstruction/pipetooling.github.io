import type { JobWithDetails } from '../types/jobWithDetails'

export type JobBillingContext = {
  id: string
  master_user_id: string
  hcp_number: string | null
  job_name: string | null
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
  job_address?: string | null
  customer_phone?: string | null
  last_work_date?: string | null
}

export function jobBillingContextFromJob(j: JobWithDetails): JobBillingContext {
  return {
    id: j.id,
    master_user_id: j.master_user_id,
    hcp_number: j.hcp_number,
    job_name: j.job_name,
    customer_id: j.customer_id,
    customer_name: j.customer_name,
    customer_email: j.customer_email,
    job_address: j.job_address,
    customer_phone: j.customer_phone,
    last_work_date: j.last_work_date,
  }
}

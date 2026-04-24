import type { Database } from '../types/database'
import type { JobWithDetails } from '../types/jobWithDetails'
import { isStaffFullJobLedgerDetailRole } from './jobDetailModalRole'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

function isReadyToBillOrBilledStatus(s: string | null | undefined): boolean {
  return s === 'ready_to_bill' || s === 'billed'
}

/** Whether the AIA G702-G703 workbook control should appear (Stages rows, View bill, etc.). */
export function showAiaG702G703(
  authRole: string | null,
  job: Pick<JobWithDetails, 'status'>,
  invoice?: Pick<JobsLedgerInvoice, 'status'> | null,
): boolean {
  if (!isStaffFullJobLedgerDetailRole(authRole)) return false
  if (isReadyToBillOrBilledStatus(job.status)) return true
  if (invoice != null && isReadyToBillOrBilledStatus(invoice.status)) return true
  return false
}

import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { testReportDataFromRowLike, type GasFixture, type TestReportData, type TestReportJobInfo } from './testReport'

/**
 * The `job_test_reports` row ↔ the kernel's `TestReportData` (v2.3298), plus
 * the two things the modal reads off the job: who the paper is for and the
 * Stripe pay link Send will paste into the email.
 */
export type TestReportRow = Database['public']['Tables']['job_test_reports']['Row']
export type TestReportInsert = Database['public']['Tables']['job_test_reports']['Insert']

export function parseGasFixtures(raw: unknown): GasFixture[] {
  return testReportDataFromRowLike({ gas_fixtures: raw }).gasFixtures
}

/** The kernel's loose mapper, typed at this door. */
export function testReportDataFromRow(row: TestReportRow): TestReportData {
  return testReportDataFromRowLike(row as unknown as Record<string, unknown>)
}

/** The writable columns for an insert or update; ids, status and the send record are set elsewhere. */
export function testReportRowFromData(data: TestReportData): Omit<TestReportInsert, 'job_id' | 'id' | 'created_by'> {
  const hydro = data.testType === 'pre_test' || data.testType === 'post_test'
  return {
    test_type: data.testType,
    system: hydro ? data.system : null,
    result: hydro ? data.result : null,
    test_date: data.testDateYmd,
    duration_minutes: hydro ? data.durationMinutes : null,
    notes: data.notes.trim(),
    pinpoint_location: data.testType === 'pinpoint' ? data.pinpointLocation.trim() : '',
    pinpoint_method: data.testType === 'pinpoint' ? data.pinpointMethod.trim() : '',
    pinpoint_findings: data.testType === 'pinpoint' ? data.pinpointFindings.trim() : '',
    gas_pressure_psi: data.testType === 'gas' ? data.gasPressurePsi : null,
    gas_fixtures: data.testType === 'gas' ? data.gasFixtures.map((f) => ({ name: f.name.trim(), btuPerHour: f.btuPerHour })) : [],
    system_tested: nullIfBlank(data.systemTested),
    test_method: nullIfBlank(data.testMethod),
    test_pressure: nullIfBlank(data.testPressure),
    conclusion: nullIfBlank(data.conclusion),
  }
}

function nullIfBlank(s: string | null): string | null {
  const t = (s ?? '').trim()
  return t ? t : null
}

/** Who the paper is for, read off the job — the GC's name rides as "Company". */
export function testReportJobInfoFromJob(job: JobWithDetails): TestReportJobInfo {
  return {
    jobNumber: (job.hcp_number ?? '').trim() || null,
    jobName: (job.job_name ?? '').trim(),
    jobAddress: (job.job_address ?? '').trim(),
    customerName: (job.customer_name ?? '').trim(),
    customerEmail: (job.customer_email ?? '').trim() || null,
    customerPhone: (job.customer_phone ?? '').trim() || null,
    customerCompany: (job.gcCustomer?.name ?? '').trim() || null,
  }
}

/** The Stripe hosted pay link on the job's newest billed Stripe invoice, if any. */
export function jobStripePayLink(job: Pick<JobWithDetails, 'invoices'>): { url: string; amount: number; invoiceId: string } | null {
  const candidates = (job.invoices ?? [])
    .filter((i) => i.status === 'billed' && (i.hosted_invoice_url ?? '').trim() !== '')
    .sort((a, b) => (b.billed_at ?? '').localeCompare(a.billed_at ?? '') || b.sequence_order - a.sequence_order)
  const inv = candidates[0]
  if (!inv) return null
  return { url: inv.hosted_invoice_url!.trim(), amount: Number(inv.amount), invoiceId: inv.id }
}

/** "Draft" / "Sent Sep 11" — the list chip inside the modal. */
export function testReportStatusLabel(row: Pick<TestReportRow, 'status' | 'sent_at'>): string {
  if (row.status === 'sent' && row.sent_at) {
    const d = new Date(row.sent_at)
    return Number.isNaN(d.getTime()) ? 'Sent' : `Sent ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
  return row.status === 'sent' ? 'Sent' : 'Draft'
}

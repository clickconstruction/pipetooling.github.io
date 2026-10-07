import { supabase } from '../supabase'
import { type TestReportDocumentRow, type TestReportDocumentRowSource, testReportDocumentRow } from '../jobsDocuments/testReportDocumentRow'

/**
 * A job's test reports as document rows, and the door to a sent one's stored PDF. Shared by the
 * Documents page and the job window's Documents tab.
 */

/** The private bucket the send function files test-report PDFs in (v2.3331: office reads via a storage policy). */
export const TEST_REPORT_BUCKET = 'job-test-reports'

export const TEST_REPORT_DOCUMENT_COLS = 'id, job_id, test_type, system, result, test_date, status, sent_at, pdf_path, pdf_version'

/** One job's test reports, oldest test first. A read that fails is no reports. */
export async function loadJobTestReportRows(jobId: string): Promise<TestReportDocumentRow[]> {
  const { data, error } = await supabase
    .from('job_test_reports')
    .select(TEST_REPORT_DOCUMENT_COLS)
    .eq('job_id', jobId)
    .order('test_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) return []
  return ((data ?? []) as TestReportDocumentRowSource[]).map(testReportDocumentRow)
}

/** A five-minute link to a sent report's stored PDF. Throws when the link cannot be made. */
export async function testReportPdfSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(TEST_REPORT_BUCKET).createSignedUrl(path, 300)
  if (error || !data?.signedUrl) throw error ?? new Error('No link')
  return data.signedUrl
}

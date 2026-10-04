import { useCallback, useEffect, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { type TestReportDocumentRow, testReportDocumentChipColors } from '../../lib/jobsDocuments/testReportDocumentRow'
import { loadJobTestReportRows, testReportPdfSignedUrl } from '../../lib/jobs/testReportDocumentOpen'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useTestReportModalOptional } from '../../contexts/TestReportModalContext'
import { useToastContext } from '../../contexts/ToastContext'
import { documentsHeading, documentsLinkButton, documentsQuietButton, documentsTd } from './jobDocumentsStyles'

/**
 * The Documents tab's test reports (v2.4495). A sent report opens the PDF the GC received; a draft
 * opens the Test report window, as on the Documents page.
 */
export function JobDocumentsTestReports({ job }: { job: JobWithDetails }) {
  const { showToast } = useToastContext()
  const testReportModal = useTestReportModalOptional()
  const [rows, setRows] = useState<TestReportDocumentRow[] | null>(null)

  const reload = useCallback(() => {
    let cancelled = false
    void loadJobTestReportRows(job.id).then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [job.id])

  useEffect(() => reload(), [reload])

  const openRow = async (row: TestReportDocumentRow) => {
    if (row.door.kind === 'pdf') {
      try {
        openInExternalBrowser(await testReportPdfSignedUrl(row.door.path))
      } catch {
        showToast('Could not open the report PDF.', 'error')
      }
      return
    }
    testReportModal?.openTestReport({ job, reportId: row.id, onChanged: () => void reload() })
  }

  return (
    <section aria-labelledby="job-documents-test-reports" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h3 id="job-documents-test-reports" style={{ ...documentsHeading, flex: 1 }}>
          Test reports
        </h3>
        {testReportModal ? (
          <button type="button" style={documentsQuietButton} onClick={() => testReportModal.openTestReport({ job, onChanged: () => void reload() })}>
            Test report
          </button>
        ) : null}
      </div>
      {rows == null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No test report is on this job.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-testid="job-documents-test-report">
                <td style={documentsTd}>
                  <button type="button" onClick={() => void openRow(row)} style={documentsLinkButton}>
                    {row.title}
                  </button>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>{row.detail}</span>
                  {row.chips.map((chip) => (
                    <span
                      key={chip.label}
                      style={{
                        ...testReportDocumentChipColors(chip.tone),
                        marginLeft: '0.4rem',
                        padding: '0.05rem 0.45rem',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {chip.label}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default JobDocumentsTestReports

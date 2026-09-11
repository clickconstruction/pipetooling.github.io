import { useState } from 'react'
import { TEST_REPORT_SAMPLE_JOB, TEST_REPORT_SAMPLE_LABELS, testReportSample, type TestReportSampleId } from '../../lib/jobs/testReportSample'
import { cachedTestReportSettings, fetchTestReportSettings } from '../../lib/jobs/testReportSettings'
import { buildTestReportPdfBlob } from '../../lib/jobsDocuments/testReportPdf'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Settings → What customers see → "Test report (sample)" (v2.3296): the paper
 * the test-report train produces, opened from invented data so the letterhead,
 * the certification block and the pagination get eyes before any job carries
 * one. Nothing here touches the database.
 */
export function TestReportSampleCard() {
  const [busy, setBusy] = useState<TestReportSampleId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = async (id: TestReportSampleId) => {
    setBusy(id)
    setError(null)
    try {
      const settings = await fetchTestReportSettings()
      const blob = await buildTestReportPdfBlob(testReportSample(id, todayYmdInAppTz()), TEST_REPORT_SAMPLE_JOB, settings)
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank', 'noopener')
      if (!win) setError('The browser blocked the new tab — allow pop-ups for this site and try again.')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the PDF.')
    } finally {
      setBusy(null)
    }
  }

  const ids: TestReportSampleId[] = ['sewer-pre-pass', 'supply-post-fail', 'pinpoint', 'gas']
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '0.75rem 1rem',
        margin: '0.75rem 0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem 1rem',
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 220 }}>
        <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Test report (sample)</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          The PDF a GC receives after a hydrostatic, pinpoint or gas test — built from {TEST_REPORT_SAMPLE_JOB.jobName}, certified by {cachedTestReportSettings().certifierName}.
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            disabled={busy != null}
            onClick={() => void open(id)}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              borderRadius: 999,
              padding: '0.3rem 0.8rem',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy && busy !== id ? 0.6 : 1,
            }}
          >
            {busy === id ? 'Building…' : TEST_REPORT_SAMPLE_LABELS[id]}
          </button>
        ))}
      </div>
      {error ? <div style={{ flexBasis: '100%', fontSize: 12.5, color: '#b42318' }}>{error}</div> : null}
    </div>
  )
}

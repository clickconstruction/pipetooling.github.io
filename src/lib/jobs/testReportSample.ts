import { emptyTestReportData, testReportPdfFilename, testReportShortLabel, type TestReportData, type TestReportJobInfo, type TestReportSettings } from './testReport'
import { buildTestReportEmail, type TestReportEmail } from './testReportEmail'

/**
 * Invented test reports for Settings → What customers see (and, later, the
 * portal's sample token). Nothing here exists in the database.
 */
export type TestReportSampleId = 'sewer-pre-pass' | 'supply-post-fail' | 'pinpoint' | 'gas'

export const TEST_REPORT_SAMPLE_LABELS: Record<TestReportSampleId, string> = {
  'sewer-pre-pass': 'Sewer pre-test · PASS',
  'supply-post-fail': 'Supply post-test · FAIL',
  pinpoint: 'Pinpoint test',
  gas: 'Gas test',
}

export const TEST_REPORT_SAMPLE_JOB: TestReportJobInfo = {
  jobNumber: '1014',
  jobName: 'Johnson Pretest',
  jobAddress: '112 Seidel St, Marion, TX 78124',
  customerName: 'Anna & Jeffrey Johnson',
  customerEmail: 'johnson@example.com',
  customerPhone: '(830) 555-0142',
  customerCompany: 'Done Right Foundation Repair',
}

export function testReportSample(id: TestReportSampleId, testDateYmd: string): TestReportData {
  switch (id) {
    case 'sewer-pre-pass':
      return { ...emptyTestReportData('pre_test', testDateYmd), system: 'sewer', result: 'pass', notes: 'PVC. No prior plumbing work by others. Toilets re-installed.' }
    case 'supply-post-fail':
      return {
        ...emptyTestReportData('post_test', testDateYmd),
        system: 'supply',
        result: 'fail',
        durationMinutes: 40,
        notes: 'Pressure fell from 60 to 42 PSI over the interval. Wet soil at the front hose bib; suspect the yard line. Copper.',
      }
    case 'pinpoint':
      return {
        ...emptyTestReportData('pinpoint', testDateYmd),
        pinpointLocation: 'Beneath the slab near the laundry room doorway, approximately 25–26 ft from the exterior clean-out.',
        pinpointMethod: '',
        pinpointFindings:
          'Testing revealed a major separation at the second wye fitting approximately 25–26 ft from the exterior clean-out. The break is large enough that base material is actively entering the pipe, and the system will not hold pressure past this point. Due to depth and location, repair will require interior access and tunneling approximately 25 ft from the garage-side clean-out.',
      }
    case 'gas':
      return {
        ...emptyTestReportData('gas', testDateYmd),
        gasPressurePsi: 0.5,
        gasFixtures: [
          { name: 'Furnace', btuPerHour: 100_000 },
          { name: 'Water Heater', btuPerHour: 40_000 },
          { name: 'Gas Range', btuPerHour: 65_000 },
        ],
        notes: 'Held for 30 minutes with no drop.',
      }
  }
}

/** The pay link a sample email carries (v2.3338) — a dead Stripe-shaped URL so the paragraph renders as the GC sees it. */
export const TEST_REPORT_SAMPLE_PAY = { url: 'https://invoice.stripe.com/i/sample/test-report', amountLabel: '$250.00' } as const

export const TEST_REPORT_SAMPLE_SUBJECT_PREFIX = '[Sample] '

/**
 * Everything "Email me this sample" needs (v2.3338): the invented report, the
 * sample job, the email exactly as the send sheet would build it from the
 * current Settings, and the attachment name — with the subject prefixed so a
 * dev's inbox never mistakes it for a real send.
 */
export function testReportSampleEmail(
  id: TestReportSampleId,
  settings: TestReportSettings,
  testDateYmd: string,
): { data: TestReportData; job: TestReportJobInfo; email: TestReportEmail; pdfFilename: string; reportLabel: string } {
  const data = testReportSample(id, testDateYmd)
  const job = TEST_REPORT_SAMPLE_JOB
  const reportLabel = testReportShortLabel(data.testType, data.system)
  const built = buildTestReportEmail({
    reportLabel,
    address: job.jobAddress,
    payUrl: TEST_REPORT_SAMPLE_PAY.url,
    amountLabel: TEST_REPORT_SAMPLE_PAY.amountLabel,
    companyName: settings.companyName,
    officePhone: settings.officePhone,
    bodyTemplate: settings.emailBodyTemplate,
  })
  return { data, job, email: { ...built, subject: `${TEST_REPORT_SAMPLE_SUBJECT_PREFIX}${built.subject}` }, pdfFilename: testReportPdfFilename(job, data), reportLabel }
}

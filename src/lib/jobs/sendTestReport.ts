import { supabase } from '../supabase'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../../utils/errorHandling'
import { buildTestReportPdfBlob, testReportPdfToBase64 } from '../jobsDocuments/testReportPdf'
import { buildTestReportEmail } from './testReportEmail'
import { testReportSampleEmail, type TestReportSampleId } from './testReportSample'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { testReportPdfFilename, testReportShortLabel, type TestReportData, type TestReportJobInfo, type TestReportSettings } from './testReport'

const MAX_PDF_BASE64_CHARS = 6_000_000

export type SendTestReportArgs = {
  reportId: string
  data: TestReportData
  job: TestReportJobInfo
  settings: TestReportSettings
  to: string[]
  cc: string[]
  subject: string
  bodyText: string
  payUrl: string | null
  amountLabel: string | null
  /** "Done Right Foundation Repair" — for the activity line. */
  recipientLabel: string | null
}

export type SendTestReportResult = { ok: true; sentTo: string[]; pdfVersion: number } | { ok: false; message: string }

/** Render the PDF in the browser, then hand everything to `send-test-report`. */
export async function sendTestReport(args: SendTestReportArgs): Promise<SendTestReportResult> {
  try {
    const { data: auth } = await supabase.auth.getSession()
    if (!auth.session?.access_token) return { ok: false, message: 'Not signed in' }
    const blob = await buildTestReportPdfBlob(args.data, args.job, args.settings)
    const pdfBase64 = await testReportPdfToBase64(blob)
    if (pdfBase64.length > MAX_PDF_BASE64_CHARS) return { ok: false, message: 'The PDF is too large to email' }
    const email = buildTestReportEmail({
      reportLabel: testReportShortLabel(args.data.testType, args.data.system),
      address: args.job.jobAddress,
      payUrl: args.payUrl,
      amountLabel: args.amountLabel,
      companyName: args.settings.companyName,
      officePhone: args.settings.officePhone,
      bodyTemplate: args.settings.emailBodyTemplate,
    })
    const { data: raw, error } = await supabase.functions.invoke('send-test-report', {
      body: {
        report_id: args.reportId,
        to: args.to,
        cc: args.cc,
        subject: args.subject,
        email_text: args.bodyText,
        // The HTML follows the edited text when the office changed the body; otherwise the builder's paragraphs.
        email_html: args.bodyText.trim() === email.text.trim() ? email.html : undefined,
        pdf_base64: pdfBase64,
        pdf_filename: testReportPdfFilename(args.job, args.data),
        pay_url: args.payUrl,
        certifier_name: args.settings.certifierName,
        certifier_license: args.settings.certifierLicense,
        report_label: testReportShortLabel(args.data.testType, args.data.system),
        recipient_label: args.recipientLabel,
      },
    })
    if (error) {
      const detail = await readEdgeFunctionErrorBody(error)
      return { ok: false, message: detail || formatErrorMessage(error, 'Could not send the report') }
    }
    const res = raw as { ok?: boolean; error?: string; pdf_version?: number } | null
    if (!res?.ok) return { ok: false, message: res?.error || 'Could not send the report' }
    return { ok: true, sentTo: args.to, pdfVersion: res.pdf_version ?? 1 }
  } catch (e) {
    return { ok: false, message: formatErrorMessage(e, 'Could not send the report') }
  }
}

export type SendTestReportSampleResult = { ok: true; sentTo: string } | { ok: false; message: string }

/**
 * "Email me this sample" (v2.3338, dev only): the sample paper and the send
 * sheet's email, built from the current Settings, to the signed-in dev's own
 * address. The function refuses anyone but a dev and any other recipient;
 * nothing is stored, stamped or posted.
 */
export async function sendTestReportSample(id: TestReportSampleId, settings: TestReportSettings): Promise<SendTestReportSampleResult> {
  try {
    const { data: auth } = await supabase.auth.getSession()
    if (!auth.session?.access_token) return { ok: false, message: 'Not signed in' }
    const sample = testReportSampleEmail(id, settings, todayYmdInAppTz())
    const blob = await buildTestReportPdfBlob(sample.data, sample.job, settings)
    const pdfBase64 = await testReportPdfToBase64(blob)
    if (pdfBase64.length > MAX_PDF_BASE64_CHARS) return { ok: false, message: 'The PDF is too large to email' }
    const { data: raw, error } = await supabase.functions.invoke('send-test-report', {
      body: {
        sample: true,
        subject: sample.email.subject,
        email_text: sample.email.text,
        email_html: sample.email.html,
        pdf_base64: pdfBase64,
        pdf_filename: sample.pdfFilename,
        report_label: sample.reportLabel,
      },
    })
    if (error) {
      const detail = await readEdgeFunctionErrorBody(error)
      return { ok: false, message: detail || formatErrorMessage(error, 'Could not send the sample') }
    }
    const res = raw as { ok?: boolean; error?: string; sent_to?: string } | null
    if (!res?.ok) return { ok: false, message: res?.error || 'Could not send the sample' }
    return { ok: true, sentTo: res.sent_to ?? auth.session.user.email ?? '' }
  } catch (e) {
    return { ok: false, message: formatErrorMessage(e, 'Could not send the sample') }
  }
}

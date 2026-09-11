/**
 * The test-report email (v2.3301) — what Taunya wrote by hand: "Attached is
 * the report for 112 Seidel St, Marion, TX 78124 and below is the invoice
 * link." Dependency-free so the Send sheet (preview), the edge function
 * (send) and vitest (src/lib/jobs/testReportEmail.test.ts) share one builder.
 * Mail-safe HTML: plain paragraphs, one link, light-only.
 */
export type TestReportEmailInput = {
  /** "Sewer Pre-Test Hydrostatic" · "Gas Test". */
  reportLabel: string
  /** The job address as the office writes it. */
  address: string
  /** The Stripe hosted pay link, when the email carries one. */
  payUrl: string | null
  /** "$250.00", shown after the link when known. */
  amountLabel: string | null
  companyName: string
  officePhone: string
  /**
   * Settings template for the body. Placeholders: {report} {address} {payLink}
   * {company} {phone}. A line that contains only {payLink} is dropped when there
   * is no link, and the words " and below is the invoice link" go with it.
   */
  bodyTemplate: string
}

export type TestReportEmail = { subject: string; text: string; html: string }

export const DEFAULT_TEST_REPORT_EMAIL_TEMPLATE =
  'Attached is the {report} report for {address} and below is the invoice link. Please let us know if you have any questions.\n\n{payLink}\n\n— {company} · {phone}'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function testReportEmailSubject(reportLabel: string, address: string): string {
  const street = address.split('\n')[0]?.split(',')[0]?.trim() ?? ''
  // "Gas Test" and "Pinpoint Test" already say Test; "Sewer Pre-Test Hydrostatic" does not (v2.3326).
  const title = /\bTest$/i.test(reportLabel.trim()) ? `${reportLabel.trim()} Report` : `${reportLabel.trim()} Test Report`
  return street ? `${title} — ${street}` : title
}

export function buildTestReportEmail(input: TestReportEmailInput): TestReportEmail {
  const template = input.bodyTemplate.trim() || DEFAULT_TEST_REPORT_EMAIL_TEMPLATE
  const payUrl = (input.payUrl ?? '').trim()
  const subject = testReportEmailSubject(input.reportLabel, input.address)

  // Text: fill placeholders line by line so a link-only line disappears cleanly.
  const lines = template.split('\n').map((line) => {
    let l = line
    if (!payUrl) {
      l = l.replace(/\s*and below is the invoice link/gi, '')
      if (l.trim() === '{payLink}') return null
      l = l.replace(/\{payLink\}/g, '')
    } else {
      l = l.replace(/\{payLink\}/g, input.amountLabel ? `${payUrl}\n(${input.amountLabel})` : payUrl)
    }
    return l
      .replace(/\{report\}/g, input.reportLabel)
      .replace(/\{address\}/g, input.address.replace(/\n+/g, ', '))
      .replace(/\{company\}/g, input.companyName)
      .replace(/\{phone\}/g, input.officePhone)
  })
  const text = collapseBlankRuns(lines.filter((l): l is string => l !== null).join('\n')).trim()

  // HTML: each text paragraph becomes <p>; the pay link becomes an anchor.
  const paragraphs = text.split(/\n{2,}/).map((p) => {
    const esc = escapeHtml(p).replace(/\n/g, '<br>')
    const linked = payUrl ? esc.replace(escapeHtml(payUrl), `<a href="${escapeHtml(payUrl)}" style="color:#2563eb">${escapeHtml(payUrl)}</a>`) : esc
    return `<p style="margin:0 0 14px;font:15px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c">${linked}</p>`
  })
  const html = `<div style="background:#ffffff;padding:20px 24px;max-width:640px">${paragraphs.join('')}</div>`
  return { subject, text, html }
}

function collapseBlankRuns(s: string): string {
  return s.replace(/\n{3,}/g, '\n\n')
}

/**
 * The pieces a test-report send shares between the office button
 * (send-test-report) and dial B (auto-send-test-reports), v2.3316: where the
 * PDF is filed, the Resend call with the attachment, and the activity line.
 * Dependency-free apart from fetch.
 */
export const TEST_REPORT_BUCKET = 'job-test-reports'

/** `<job_id>/<report_id>-v<n>.pdf` — a re-send is the next version, never an overwrite. */
export function testReportStoragePath(jobId: string, reportId: string, version: number): string {
  return `${jobId}/${reportId}-v${version}.pdf`
}

export function testReportActivityLine(args: { reportLabel: string; version: number; to: string[]; cc: string[]; recipientLabel: string | null; withPayLink: boolean; automatic: boolean }): string {
  const who = (args.recipientLabel ?? '').trim()
  return `${args.automatic ? 'Sent automatically: ' : 'Sent '}${args.reportLabel} report${args.version > 1 ? ` (v${args.version})` : ''} to ${who ? `${who} (${args.to.join(', ')})` : args.to.join(', ')}${args.cc.length ? `, cc ${args.cc.join(', ')}` : ''}${args.withPayLink ? ' with the invoice link' : ''}.`
}

export async function sendTestReportEmailViaResend(args: {
  resendApiKey: string
  from: string
  to: string[]
  cc: string[]
  subject: string
  text: string
  html: string
  pdfFilename: string
  pdfBase64: string
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string; status: number }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      ...(args.cc.length ? { cc: args.cc } : {}),
      subject: args.subject,
      html: args.html,
      text: args.text,
      attachments: [{ filename: args.pdfFilename, content: args.pdfBase64 }],
    }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({} as { message?: string }))
    return { ok: false, error: errorData.message || `Resend ${res.status}`, status: res.status }
  }
  const sent = (await res.json().catch(() => ({}))) as { id?: string }
  return { ok: true, id: sent.id ?? null }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

/**
 * The staff email for the Signed agreements stream (v2.2743): a customer accepted an estimate,
 * or a GC signed a bid-room proposal. Dependency-free so src/lib tests import it directly; the
 * app twin `src/lib/signedAgreementEmail.ts` must stay byte-identical (parity test).
 * Mail-safe on purpose: tables not flex, a bgcolor button, light-only color scheme.
 */
export type SignedAgreementEmailInput = {
  kind: 'estimate' | 'bid'
  estimateNumber: number
  /** Estimate title / proposal project name. */
  title: string
  projectAddress: string | null
  customerName: string | null
  signerName: string
  /** The option they chose, when there were options. */
  optionName: string | null
  totalCents: number
  /** "Sept 3, 2026 · 4:12 PM" in the company calendar zone. */
  signedAtLabel: string
  origin: string
  /** The job that exists for this agreement (auto-created or already linked), if any. */
  job: { id: string; hcpNumber: string } | null
  /** Whether the auto-create toggle for this kind is on (explains a missing job honestly). */
  autoCreateOn: boolean
}

export type SignedAgreementEmail = { subject: string; text: string; html: string }

function escapeHtmlForEmail(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function signedAgreementRecordLabel(kind: 'estimate' | 'bid', estimateNumber: number): string {
  return kind === 'bid' ? `Bid room proposal #${estimateNumber}` : `Estimate #${estimateNumber}`
}

export function buildSignedAgreementEmail(input: SignedAgreementEmailInput): SignedAgreementEmail {
  const origin = input.origin.replace(/\/$/, '')
  const title = input.title.trim() || (input.kind === 'bid' ? 'proposal' : 'estimate')
  const signer = input.signerName.trim() || 'The customer'
  const record = signedAgreementRecordLabel(input.kind, input.estimateNumber)
  const recordUrl = `${origin}/estimates/${input.estimateNumber}`
  const jobLabel = input.job ? `J${input.job.hcpNumber.replace(/^[jJ]\s*/, '')}` : null
  const jobUrl = input.job ? `${origin}/jobs?edit=${input.job.id}` : null
  const createJobUrl = `${recordUrl}?createJob=1`

  const subject = `Signed — ${title} — ${usdWhole.format(input.totalCents / 100)} (${record})`

  const what = input.kind === 'bid' ? 'signed the proposal for' : 'accepted the estimate for'
  const metaParts = [input.customerName, input.projectAddress, input.signedAtLabel].map((p) => (p ?? '').trim()).filter(Boolean)
  const jobLine = input.job
    ? `Job ${jobLabel} ${input.autoCreateOn ? 'was created automatically' : 'is linked'}.`
    : input.autoCreateOn
      ? 'No job yet — automatic creation did not run for this one; create it from the record.'
      : 'No job yet — create it from the record when the work is ready.'

  // ── text
  const text = [
    `${signer} ${what} ${title}.`,
    metaParts.join(' · '),
    '',
    `${input.optionName ? `Option: ${input.optionName} · ` : ''}Amount: ${usd.format(input.totalCents / 100)}`,
    '',
    `Open the signed record: ${recordUrl}`,
    jobLine,
    input.job ? `Open the job: ${jobUrl}` : `Create the job: ${createJobUrl}`,
    '',
    'You are on the Signed agreements list (Settings → Emails & reports).',
  ].join('\n')

  // ── html
  const e = escapeHtmlForEmail
  const ink = '#1c2430'
  const muted = '#5b6675'
  const faint = '#7b8794'
  const line = '#e3e7ec'
  const font = 'font-family:Helvetica,Arial,sans-serif;'
  const button = (href: string, label: string, color: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 8px 8px 0"><tr>` +
    `<td bgcolor="${color}" style="border-radius:6px"><a href="${e(href)}" style="${font}display:inline-block;padding:11px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border:1px solid ${color};border-radius:6px">${label}</a></td>` +
    `</tr></table>`
  const html =
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /><title>${e(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f5f7">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f3f5f7"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" bgcolor="#ffffff" style="max-width:560px;width:100%;background:#ffffff;border-radius:6px">` +
    `<tr><td style="padding:24px 30px 0">` +
    `<p style="${font}font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;margin:0 0 6px">Signed &middot; ${e(record)}</p>` +
    `<h1 style="${font}font-size:20px;font-weight:700;line-height:1.25;margin:0 0 4px;color:${ink}">${e(signer)} ${what} <span style="white-space:nowrap">${e(title)}</span></h1>` +
    `<p style="${font}font-size:13.5px;color:${muted};margin:0 0 18px">${metaParts.map(e).join(' &middot; ')}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 18px"><tr>` +
    `<td style="${font}font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${faint};padding:12px 0;border-top:1px solid ${line};border-bottom:1px solid ${line}">${input.optionName ? e(input.optionName) : 'Amount'}</td>` +
    `<td align="right" style="${font}font-size:26px;font-weight:700;color:${ink};padding:12px 0;border-top:1px solid ${line};border-bottom:1px solid ${line};white-space:nowrap">${usd.format(input.totalCents / 100)}</td>` +
    `</tr></table>` +
    `<p style="${font}font-size:14px;color:${ink};margin:0 0 14px">${e(jobLine)}</p>` +
    button(recordUrl, 'Open the signed record', '#3b82f6') +
    (input.job ? button(jobUrl!, `Open job ${jobLabel}`, '#16a34a') : button(createJobUrl, 'Create the job', '#ea580c')) +
    `</td></tr>` +
    `<tr><td style="${font}font-size:12px;color:#8593a1;background:#f7f9fb;border-top:1px solid ${line};padding:14px 30px 18px;border-radius:0 0 6px 6px">You are on the Signed agreements list &middot; Settings &rarr; Emails &amp; reports</td></tr>` +
    `</table></td></tr></table></body></html>`

  return { subject, text, html }
}

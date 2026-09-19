/**
 * The customer's service-agreement emails, as one builder for the sender and the browser
 * (v2.3510 — What customers see PR 2). `send-job-contract` and `remind-job-contracts` call
 * these; `src/lib/jobContractEmail.ts` re-exports them so Settings → What customers see renders
 * the same email over the sample. Pure: no Deno, no fetch, no env. The wording is the senders'
 * own, moved here verbatim.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type BuiltEmail = { subject: string; text: string; html: string }

export type JobContractSendEmailInput = {
  /** The recipient's name; the greeting uses the first word. */
  recipientName: string | null
  /** The office's own opening message, typed per send; '' falls back to the standard line. */
  message: string
  jobAddress: string | null
  /** "Service agreement for 100 Sample St" — the heading the page shows. */
  heading: string
  /** "1042" */
  jobNo: string
  /** "Contract amount: $1,850.00", or '' when the job has no fixed amount. */
  amountLine: string
  /** The signing link. */
  url: string
  /** The sender's name for the sign-off; '' for none. */
  senderName: string
}

/** The "Please sign" email — `send-job-contract`, mode `email`. */
export function buildJobContractSendEmail(i: JobContractSendEmailInput): BuiltEmail {
  const greeting = i.recipientName ? `Hi ${i.recipientName.split(' ')[0]},` : 'Hello,'
  const subject = `Please sign: ${i.heading} — Job #${i.jobNo}`
  const opening = i.message || `Here is your service agreement for ${i.jobAddress || 'your project'}. It takes about a minute to review and sign on your phone.`
  const text =
    `${greeting}\n\n` +
    `${opening}\n\n` +
    `${i.heading}\nJob #${i.jobNo}${i.amountLine ? `\n${i.amountLine}` : ''}\n\n` +
    `Review and sign here:\n${i.url}\n\n` +
    `Rather sign on paper? Reply to this email or call the office and we will bring a copy, no charge.\n\n` +
    `Questions? Just reply to this email.${i.senderName ? `\n\n— ${i.senderName}` : ''}\n`
  const html =
    `<p>${escapeHtml(greeting)}</p>` +
    `<p>${escapeHtml(opening).replace(/\n/g, '<br>')}</p>` +
    `<p><strong>${escapeHtml(i.heading)}</strong><br>Job #${escapeHtml(i.jobNo)}${i.amountLine ? `<br>${escapeHtml(i.amountLine)}` : ''}</p>` +
    `<p><a href="${escapeHtml(i.url)}" style="display:inline-block;background:#c2410c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Review &amp; sign</a></p>` +
    `<p style="color:#6b7280;font-size:13px">Or open this link: <a href="${escapeHtml(i.url)}">${escapeHtml(i.url)}</a></p>` +
    `<p style="color:#6b7280;font-size:13px">Rather sign on paper? Reply to this email or call the office and we will bring a copy, no charge.</p>` +
    `<p>Questions? Just reply to this email.${i.senderName ? `<br>— ${escapeHtml(i.senderName)}` : ''}</p>`
  return { subject, text, html }
}

export type JobContractSignedCopyEmailInput = {
  /** The name typed under the signature. */
  printedName: string
  heading: string
  jobNo: string
  /** "$1,850.00", or null when the job has no fixed amount. */
  amountLabel: string | null
  /** The signing link — the signed page stays at it. */
  url: string
  /** True when the signed PDF is attached. */
  hasPdf: boolean
}

/** The customer's signed copy, the moment they sign — `sign-job-contract` (v2.3617: one builder for the sender and the tab). */
export function buildJobContractSignedCopyEmail(i: JobContractSignedCopyEmailInput): BuiltEmail {
  const amountLine = i.amountLabel != null ? ` · ${i.amountLabel}` : ''
  const subject = `Signed: ${i.heading} — Job #${i.jobNo}`
  const copyLine = i.hasPdf ? 'Your signed copy is attached as a PDF, and it stays at this link any time:' : 'Your signed copy stays at this link any time:'
  const text = `Thank you, ${i.printedName}. Your agreement is signed.\n\n${i.heading}\nJob #${i.jobNo}${amountLine}\n\n${copyLine}\n${i.url}\n`
  const html =
    `<p>Thank you, ${escapeHtml(i.printedName)}. Your agreement is signed.</p>` +
    `<p><strong>${escapeHtml(i.heading)}</strong><br>Job #${escapeHtml(i.jobNo)}${escapeHtml(amountLine)}</p>` +
    `<p>${copyLine} <a href="${escapeHtml(i.url)}">${escapeHtml(i.url)}</a></p>`
  return { subject, text, html }
}

export type JobContractReminderEmailInput = {
  recipientName: string | null
  heading: string
  jobNo: string
  /** "$1,850.00", or null when the job has no fixed amount. */
  amountLabel: string | null
  url: string
  /** True on the last automatic reminder — the closing line changes. */
  last: boolean
}

/** The nudge an unsigned agreement gets — `remind-job-contracts`. */
export function buildJobContractReminderEmail(i: JobContractReminderEmailInput): BuiltEmail {
  const greeting = i.recipientName ? `Hi ${i.recipientName.split(' ')[0]},` : 'Hello,'
  const subject = `Reminder: please sign — ${i.heading} (Job #${i.jobNo})`
  const amountLine = i.amountLabel != null ? `Contract amount: ${i.amountLabel}\n` : ''
  const closing = i.last ? 'This is our last automatic reminder — reply to this email or call us if anything needs changing.' : 'Questions? Just reply to this email.'
  const text =
    `${greeting}\n\nA quick reminder that your service agreement is waiting for your signature. It takes about a minute on your phone.\n\n` +
    `${i.heading}\nJob #${i.jobNo}\n${amountLine}\nReview and sign here:\n${i.url}\n\n` +
    `${closing}\n`
  const html =
    `<p>${escapeHtml(greeting)}</p>` +
    `<p>A quick reminder that your service agreement is waiting for your signature. It takes about a minute on your phone.</p>` +
    `<p><strong>${escapeHtml(i.heading)}</strong><br>Job #${escapeHtml(i.jobNo)}${i.amountLabel != null ? `<br>Contract amount: ${escapeHtml(i.amountLabel)}` : ''}</p>` +
    `<p><a href="${escapeHtml(i.url)}" style="display:inline-block;background:#c2410c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Review &amp; sign</a></p>` +
    `<p style="color:#6b7280;font-size:13px">${escapeHtml(closing)}</p>`
  return { subject, text, html }
}

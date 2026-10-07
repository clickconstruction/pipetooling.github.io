/**
 * The question-about-the-plans email (GC mode, the real build, step 8b): the words the office
 * sends a project's architect, built once so the function that sends it and the sample on
 * Settings → What customers see read the same (`gc-plan-question-email`; `customerSampleEmails.ts`).
 */

export type GcPlanQuestionEmailInput = {
  architectName: string
  projectName: string
  projectAddress: string | null
  /** Who asked, as the office typed it; empty when the office asks for itself. */
  askedByName: string
  /** The sheets and the trade it is about ("S-101, S-102, Concrete"), or "the plans". */
  about: string
  /** The question as it was asked. */
  text: string
  /** The project manager, else the sender. */
  signer: string
  companyName: string
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildGcPlanQuestionEmail(input: GcPlanQuestionEmailInput): { subject: string; text: string; html: string } {
  const subject = `${input.projectName}: a question about ${input.about}`
  const lines = [
    `Hello ${input.architectName},`,
    '',
    `A question came in about ${input.about} on ${input.projectName}${input.projectAddress ? `, ${input.projectAddress}` : ''}${input.askedByName ? `, from ${input.askedByName}` : ''}:`,
    '',
    input.text.trim(),
    '',
    'Reply to this email with the answer. We will pass it to every company quoting the trade and carry it in the next set of plans.',
    '',
    'Thank you,',
    input.signer,
    input.companyName,
  ]
  const text = lines.join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${lines.map((l) => (l === '' ? '<br>' : `<p style="margin:0 0 4px">${escapeHtml(l)}</p>`)).join('')}</div>`
  return { subject, text, html }
}

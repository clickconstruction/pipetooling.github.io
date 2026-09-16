/**
 * The office's answer, as an email (Submittals stage 5a). Pure — no Deno imports — so the
 * TS twin test runs it; send-submittal-reply-email sends what this builds.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** The email in its own words: subject + plain text + html. */
export function buildSubmittalReplyEmail(args: { companyName: string; bidLabel: string; tags: string[]; askedBody: string; replyBody: string; personName: string; link: string; phone: string }): { subject: string; text: string; html: string } {
  const about = args.tags.length ? ` — ${args.tags.slice(0, 3).join(', ')}` : ''
  const subject = `${args.companyName} answered on ${args.bidLabel}${about}`
  const text = [
    `Hi ${args.personName},`,
    '',
    args.replyBody,
    '',
    `You asked: "${args.askedBody}"`,
    '',
    `The review, with the whole conversation: ${args.link}`,
    '',
    `${args.companyName}${args.phone ? ` · ${args.phone}` : ''}`,
  ].join('\n')
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a2330;max-width:600px">
  <p>Hi ${escapeHtml(args.personName)},</p>
  <p style="white-space:pre-wrap">${escapeHtml(args.replyBody)}</p>
  <p style="color:#5b6577;font-size:14px;border-left:3px solid #d6dbe3;padding-left:10px;white-space:pre-wrap">You asked: ${escapeHtml(args.askedBody)}</p>
  <p><a href="${escapeHtml(args.link)}" style="display:inline-block;background:#b0662f;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">Open the review</a></p>
  <p style="color:#5b6577;font-size:13px">${escapeHtml(args.companyName)}${args.phone ? ` · ${escapeHtml(args.phone)}` : ''}</p>
</div>`
  return { subject, text, html }
}


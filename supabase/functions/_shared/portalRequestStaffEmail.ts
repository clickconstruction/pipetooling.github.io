/**
 * The staff notice submit-portal-request sends when a customer asks for something from their
 * portal — dependency-free so Settings → What the team sees renders it on sample data
 * (punch list #60, v2.4142). Moved verbatim from the function: the lines become paragraphs.
 */
export type PortalRequestStaffEmailInput = {
  /** "request", "callback", … — the request kind as the portal labels it. */
  kindLabel: string
  customerName: string
  /** The plain lines the function assembled (who, what, the job, the link). */
  lines: readonly string[]
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

export function portalRequestStaffEmail(input: PortalRequestStaffEmailInput): { subject: string; text: string; html: string } {
  const subject = `Portal ${input.kindLabel} — ${input.customerName}`
  const text = input.lines.join('\n')
  const html = `<p>${input.lines.map(escapeHtmlText).join('</p><p>')}</p>`
  return { subject, text, html }
}

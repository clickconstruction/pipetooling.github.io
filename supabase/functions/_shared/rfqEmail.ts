/**
 * The supply-house price-request email, as one builder for the sender and the browser
 * (v2.3512 — What customers see PR 6). `send-rfq-email` calls it; `src/lib/rfqEmail.ts`
 * re-exports it so Settings → What customers see renders the same email over the sample.
 * Pure: the wording is the sender's own, moved here verbatim; the app origin is passed in.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function rfqNeededByWord(d: string | null): string {
  if (!d) return ''
  const dt = new Date(`${d}T12:00:00Z`)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
}

export type RfqEmailInput = {
  kind: 'request' | 'reminder'
  /** On a reminder: has the house opened the page already? */
  viewed: boolean
  bidLabel: string
  houseName: string
  itemCount: number
  /** YYYY-MM-DD, or null. */
  neededBy: string | null
  vendorNote: string | null
  senderName: string | null
  /** The scope as plain text, one fixture per line. */
  listText: string
  /** The RFQ token; the link is `${appOrigin}/q/${token}`. */
  token: string
  plansLink?: string | null
  /** "https://clicktooling.com" */
  appOrigin: string
}

export function buildRfqEmail(args: RfqEmailInput): { subject: string; text: string; html: string } {
  const link = `${args.appOrigin}/q/${args.token}`
  const due = args.neededBy ? ` · needed by ${rfqNeededByWord(args.neededBy)}` : ''
  const subject =
    args.kind === 'reminder'
      ? `Reminder — price request · ${args.bidLabel} · ${args.itemCount} items${due}`
      : `Price request · ${args.bidLabel} · ${args.itemCount} items${due}`
  const opener =
    args.kind === 'reminder'
      ? args.viewed
        ? 'Looks like you started on this one — just checking in before we order.'
        : 'Following up in case the first note got buried — did this reach you?'
      : 'Can you price these for us?'
  const noteLine = args.vendorNote?.trim() ? `From ${args.senderName ?? 'the estimator'}: “${args.vendorNote.trim()}”` : ''
  const text = [
    opener,
    '',
    `${args.bidLabel} · ${args.itemCount} items${due}.`,
    noteLine,
    '',
    `Price it here (takes minutes on a phone): ${link}`,
    ...(args.plansLink ? ['', `Job plans (cut sheets, details): ${args.plansLink}`] : []),
    '',
    'Or just reply to this email with your prices — either way works.',
    '',
    args.listText,
    '',
    `Sent by ClickTooling. This link is only for ${args.houseName} and stops working when the job closes.`,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
  const html = `
<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1c2434;line-height:1.6">
  <h2 style="font-size:18px;margin:18px 0 4px">${escapeHtml(opener)}</h2>
  <p style="color:#5b6577;font-size:14px;margin:0 0 14px">${escapeHtml(args.bidLabel)} · ${args.itemCount} items${escapeHtml(due)}.${noteLine ? ` ${escapeHtml(noteLine)}` : ''}</p>
  <p style="margin:18px 0 6px"><a href="${link}" style="background:#16a34a;color:#ffffff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">Price it here →</a></p>
  ${args.plansLink ? `<p style="margin:0 0 12px;font-size:14px"><a href="${args.plansLink}" style="color:#2563eb">Job plans (cut sheets, details) ↗</a></p>` : ''}
  <pre style="background:#eef1f6;border:1px solid #e0e5ee;border-radius:8px;padding:12px 14px;font:12px/1.6 ui-monospace,Menlo,monospace;color:#2a3550;white-space:pre-wrap">${escapeHtml(args.listText)}</pre>
  <p style="font-size:14px">Or just hit <b>Reply</b> with your prices — either way works.</p>
  <p style="color:#8b96ab;font-size:12px;margin-top:18px">Sent by ClickTooling. This link is only for ${escapeHtml(args.houseName)} and stops working when the job closes.</p>
</div>`
  return { subject, text, html }
}

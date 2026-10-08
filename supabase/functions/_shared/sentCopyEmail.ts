/**
 * Sent copies — an email's copy, pure (docs/SENT_COPIES.md, step 2). The owner's rule: keep
 * the email. This builds what is kept: the page the office opens (who it went to and the
 * subject, then the message as it was read), where each attachment lives in the
 * sent-documents bucket, and the `sent_documents` row. The fetches are `fileSentCopy.ts`.
 * No Deno API here: `src/lib/sent/sentCopyEmail.test.ts` runs it under vitest.
 */

/** What an email function says about the message it just sent. */
export type SentEmailFiling = {
  /** What it is, as the code names it: lower case, digits and underscores (`bill`, `lien_notice`). */
  kind: string
  /** What it is, as the office reads it. Left out, the subject line is the title. */
  title?: string | null
  /** Who it is addressed to by name, when the function knows. */
  recipientName?: string | null
  /** The jobs it is about: one, several, or none. */
  jobIds?: ReadonlyArray<string | null | undefined>
  customerId?: string | null
  bidId?: string | null
  personId?: string | null
  /** The record the email was drawn from, so its own row can link to the copy. */
  source?: { table: string; id: string | null | undefined } | null
  /** The signed-in user who pressed send; left out for a scheduled send. */
  sentBy?: string | null
}

/** The message as it went: what Resend was handed. */
export type SentEmailMessage = {
  to: ReadonlyArray<string>
  cc?: ReadonlyArray<string>
  from?: string | null
  subject: string
  html: string
  /** Base64 content, as Resend takes it. An inline image (`content_id`) is drawn into the kept page, not kept as a file. */
  attachments?: ReadonlyArray<{ filename: string; content: string; content_id?: string }>
  resendEmailId?: string | null
}

const KIND_SHAPE = /^[a-z][a-z0-9_]{1,60}$/
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const uuidOrNull = (v: string | null | undefined): string | null => (typeof v === 'string' && UUID_SHAPE.test(v.trim()) ? v.trim() : null)

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Each address once, trimmed, in the order given. */
export function sentEmailAddresses(list: ReadonlyArray<string> | undefined): string[] {
  const out: string[] = []
  for (const raw of list ?? []) {
    const e = typeof raw === 'string' ? raw.trim() : ''
    if (e && !out.some((x) => x.toLowerCase() === e.toLowerCase())) out.push(e)
  }
  return out
}

/** A file name the bucket takes: the name's own letters, digits, dots and dashes, never a path. */
export function sentAttachmentFileName(raw: string): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? ''
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '').slice(0, 80)
  return clean || 'attachment'
}

/** Where the nth attachment lives: `<row id>/<n>-<file>`; the number keeps two files of one name apart. */
export function sentAttachmentPath(rowId: string, index: number, filename: string): string {
  return `${rowId}/${index + 1}-${sentAttachmentFileName(filename)}`
}

const TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  csv: 'text/csv',
  txt: 'text/plain',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ics: 'text/calendar',
}

/** A file's type from its name. Anything unknown is plain bytes: a kept file is never served as a page. */
export function sentAttachmentType(filename: string): string {
  const ext = /\.([A-Za-z0-9]+)$/.exec(filename)?.[1]?.toLowerCase() ?? ''
  return TYPE_BY_EXT[ext] ?? 'application/octet-stream'
}

/**
 * The message as it is kept, by kind. The law firm's portal link (`legal_firm_link`) is a key to
 * the firm's portal: the filed copy shows the button with `?t=…`, never the token, because four
 * office roles read the filed copies (punch list #85, item 21). A trade partner's email (`gc_trade_email`) carries its
 * company's portal link, `/t/<token>`, which is kept as `/t/…` (GC mode's P3-a).
 */
export function sentCopyKeptHtml(kind: string, html: string): string {
  if (kind === 'gc_trade_email') return html.replace(/(\/t\/)[^"'&<\s/?#]+/g, '$1…')
  if (kind !== 'legal_firm_link') return html
  // The direct form (`/legal?t=<key>`) and, since v2.4750, the short address (`my.clickplumbing.com/<firm>-<tail>`).
  return html.replace(/([?&](?:amp;)?t=)[^"'&<\s]+/g, '$1…').replace(/(my\.clickplumbing\.com\/)[a-z0-9-]+/g, '$1…')
}

/**
 * The page the office opens for an email: a grey head (from, to, cc, subject, the attachments
 * by name), then the message as it was read. The head goes inside the message's own `<body>`
 * when it has one, so a full document stays one document.
 */
export function sentEmailCopyHtml(msg: SentEmailMessage): string {
  const line = (label: string, value: string): string => (value ? `<div><b>${label}</b> ${esc(value)}</div>` : '')
  const names = (msg.attachments ?? []).filter((a) => !a.content_id).map((a) => a.filename)
  const head =
    `<div style="font:13px/1.5 system-ui,sans-serif;color:#374151;background:#f3f4f6;border-bottom:1px solid #d1d5db;padding:10px 14px;margin:0 0 12px">` +
    line('From', (msg.from ?? '').trim()) +
    line('To', sentEmailAddresses(msg.to).join(', ')) +
    line('Cc', sentEmailAddresses(msg.cc).join(', ')) +
    line('Subject', msg.subject.trim()) +
    line('Attached', names.join(', ')) +
    `</div>`
  // An inline image rides in the email as `cid:<id>`; the kept page carries it in place so it still draws.
  let body = msg.html ?? ''
  for (const a of msg.attachments ?? []) {
    if (!a.content_id) continue
    const type = sentAttachmentType(a.filename)
    if (!type.startsWith('image/')) continue
    body = body.split(`cid:${a.content_id}`).join(`data:${type};base64,${a.content}`)
  }
  const open = /<body[^>]*>/i.exec(body)
  if (open) return body.slice(0, open.index + open[0].length) + head + body.slice(open.index + open[0].length)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(msg.subject.trim())}</title></head><body style="margin:0">${head}<div style="padding:0 14px 14px">${body}</div></body></html>`
}

export type SentEmailStoredAttachment = { name: string; path: string; type: string; bytes: number }

/**
 * The `sent_documents` row for an email, or null when the filing cannot be kept (a kind the
 * table would refuse). Ids that are not ids are dropped, never sent.
 */
export function sentEmailRow(
  id: string,
  filing: SentEmailFiling,
  msg: SentEmailMessage,
  stored: { copyPath: string | null; copyHash: string; copyBytes: number | null; attachments: ReadonlyArray<SentEmailStoredAttachment> },
): Record<string, unknown> | null {
  if (!KIND_SHAPE.test(filing.kind)) return null
  const jobIds = [...new Set((filing.jobIds ?? []).map(uuidOrNull).filter((x): x is string => !!x))]
  const subject = msg.subject.trim().slice(0, 500)
  return {
    id,
    kind: filing.kind,
    title: ((filing.title ?? '').trim() || subject || 'Email').slice(0, 300),
    how: 'email',
    recipient_name: (filing.recipientName ?? '').trim().slice(0, 300),
    recipient_emails: sentEmailAddresses([...msg.to, ...(msg.cc ?? [])]),
    subject,
    job_ids: jobIds,
    customer_id: uuidOrNull(filing.customerId),
    bid_id: uuidOrNull(filing.bidId),
    person_id: uuidOrNull(filing.personId),
    source_table: uuidOrNull(filing.source?.id) ? (filing.source?.table ?? '').trim() : '',
    source_id: uuidOrNull(filing.source?.id),
    copy_path: stored.copyPath,
    copy_type: stored.copyPath ? 'text/html' : '',
    copy_hash: stored.copyPath ? stored.copyHash : '',
    copy_bytes: stored.copyPath ? stored.copyBytes : null,
    attachments: stored.attachments.map((a) => ({ name: a.name, path: a.path, type: a.type, bytes: a.bytes })),
    resend_email_id: (msg.resendEmailId ?? '').trim() || null,
    sent_by: uuidOrNull(filing.sentBy),
  }
}

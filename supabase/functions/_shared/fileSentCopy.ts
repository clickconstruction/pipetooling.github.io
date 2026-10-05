/**
 * Sent copies — file an email that just went out (docs/SENT_COPIES.md, step 2). Keeps the
 * message as it was read and each attachment in the private sent-documents bucket, then
 * writes one `sent_documents` row, so the office finds it on the job's Documents tab.
 *
 * Best effort, as `logEmailSendBestEffort`: it never throws, and a send that already happened
 * never fails because its copy could not be kept. When the page cannot be stored the row is
 * still written, with no path. Raw REST with the service role: the bucket has no client
 * policy an edge function could use, and the row names the sender itself.
 *
 * What is built is `sentCopyEmail.ts` (pure, tested under vitest); this file is the fetches.
 */
import { type SentEmailFiling, type SentEmailMessage, type SentEmailStoredAttachment, sentAttachmentPath, sentAttachmentType, sentEmailCopyHtml, sentEmailRow } from './sentCopyEmail.ts'

export type { SentEmailFiling } from './sentCopyEmail.ts'

const BUCKET = 'sent-documents'
/** Attachments past this many bytes in all are named on the page but not kept as files. */
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function put(supabaseUrl: string, serviceKey: string, path: string, bytes: Uint8Array, type: string): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': type, 'x-upsert': 'false' },
    body: bytes,
  })
  return res.ok
}

/** File one email. Call it after the send succeeded; await it before the function answers. */
export async function fileSentEmailBestEffort(filing: SentEmailFiling, msg: SentEmailMessage): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return
    const id = crypto.randomUUID()
    if (!sentEmailRow(id, filing, msg, { copyPath: null, copyHash: '', copyBytes: null, attachments: [] })) return

    const page = new TextEncoder().encode(sentEmailCopyHtml(msg))
    const copyPath = `${id}/copy.html`
    const kept = await put(supabaseUrl, serviceKey, copyPath, page, 'text/html').catch(() => false)

    const attachments: SentEmailStoredAttachment[] = []
    let total = 0
    const files = (msg.attachments ?? []).filter((a) => !a.content_id)
    for (let i = 0; i < files.length; i++) {
      const a = files[i]
      try {
        const bytes = bytesFromBase64(a.content)
        total += bytes.length
        if (total > MAX_ATTACHMENT_BYTES) break
        const path = sentAttachmentPath(id, i, a.filename)
        const type = sentAttachmentType(a.filename)
        if (await put(supabaseUrl, serviceKey, path, bytes, type)) attachments.push({ name: a.filename, path, type, bytes: bytes.length })
      } catch {
        // one attachment that cannot be kept does not lose the rest
      }
    }

    const row = sentEmailRow(id, filing, msg, { copyPath: kept ? copyPath : null, copyHash: kept ? await sha256Hex(page) : '', copyBytes: kept ? page.length : null, attachments })
    if (!row) return
    await fetch(`${supabaseUrl}/rest/v1/sent_documents`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    })
  } catch {
    // best effort only
  }
}

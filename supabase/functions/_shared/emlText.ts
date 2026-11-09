/**
 * An email file's words (punch list #285, PR 1, v2.6714): a `.eml` on an evidence record or a matter's Evidence tab is
 * RFC 822 text — headers, then a body that is often MIME parts, each base64 or quoted-printable. Indexed raw, the
 * base64 of an attachment would fill the row with tokens no one searches for and the words a person wrote would sit
 * encoded. This reads the file the way a mail client shows it: who it is from and to, the date, the subject, then the
 * text parts decoded (plain text first; HTML stripped to its words when a part has no plain twin), and each attached
 * file named on a line of its own, so a search for the attachment's name finds the mail. Pure, no imports, so
 * `src/lib/documents/emlText.test.ts` reads it as the functions do.
 */

/** The headers the words keep, in this order. */
const KEPT_HEADERS = ['From', 'To', 'Cc', 'Date', 'Subject'] as const

interface Part {
  headers: Map<string, string>
  body: string
}

/** The headers (names lowercased, continuation lines unfolded) and the body, split at the first blank line. */
function splitPart(raw: string): Part {
  const text = raw.replace(/\r\n/g, '\n')
  const at = text.search(/\n\n/)
  const head = at < 0 ? text : text.slice(0, at)
  const body = at < 0 ? '' : text.slice(at + 2)
  const headers = new Map<string, string>()
  for (const line of head.replace(/\n[ \t]+/g, ' ').split('\n')) {
    const m = /^([!-9;-~]+):\s*(.*)$/.exec(line)
    if (m) headers.set((m[1] ?? '').toLowerCase(), (m[2] ?? '').trim())
  }
  return { headers, body }
}

/** A header's parameter: `charset="utf-8"` → `utf-8`. */
function param(value: string | undefined, name: string): string | null {
  if (!value) return null
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i').exec(value)
  return m ? (m[1] ?? m[2] ?? '').trim() : null
}

function decodeBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, '')
  try {
    const bin = atob(clean)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return new Uint8Array()
  }
}

function decodeQuotedPrintable(s: string): Uint8Array {
  const joined = s.replace(/=\r?\n/g, '')
  const out: number[] = []
  for (let i = 0; i < joined.length; i++) {
    const c = joined.charAt(i)
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
      out.push(parseInt(joined.slice(i + 1, i + 3), 16))
      i += 2
    } else out.push(c.charCodeAt(0) & 0xff)
  }
  return new Uint8Array(out)
}

function decodeText(bytes: Uint8Array, charset: string | null): string {
  const label = (charset ?? 'utf-8').toLowerCase()
  try {
    return new TextDecoder(label === 'us-ascii' ? 'utf-8' : label).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

/** A body's bytes as its transfer encoding says; 7bit, 8bit and binary are the text as it stands. */
function decodeBody(body: string, encoding: string | undefined, charset: string | null): string {
  const enc = (encoding ?? '').trim().toLowerCase()
  if (enc === 'base64') return decodeText(decodeBase64(body), charset)
  if (enc === 'quoted-printable') return decodeText(decodeQuotedPrintable(body), charset)
  return body
}

/** RFC 2047 encoded words in a header (`=?utf-8?B?...?=`, `=?utf-8?Q?...?=`) decoded; the rest as written. */
export function decodeHeaderWords(value: string): string {
  return value
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset: string, kind: string, text: string) => {
      const bytes = kind.toUpperCase() === 'B' ? decodeBase64(text) : decodeQuotedPrintable(text.replace(/_/g, ' '))
      return decodeText(bytes, charset)
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** HTML to its words: scripts and styles gone, tags gone, entities read, whitespace folded. */
export function htmlWords(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The words of one part: text parts decoded, multiparts walked, anything else named as a file. */
function partWords(part: Part, out: { plain: string[]; html: string[]; files: string[] }, depth: number): void {
  const type = (part.headers.get('content-type') ?? 'text/plain').toLowerCase()
  const mime = (type.split(';')[0] ?? '').trim()
  const charset = param(part.headers.get('content-type'), 'charset')
  const disposition = part.headers.get('content-disposition') ?? ''
  const fileName = param(disposition, 'filename') ?? param(part.headers.get('content-type'), 'name')
  if (mime.startsWith('multipart/') && depth < 8) {
    const boundary = param(part.headers.get('content-type'), 'boundary')
    if (!boundary) return
    const pieces = part.body.split(`--${boundary}`)
    // The first piece is the preamble, the last the epilogue after `--boundary--`; neither is a part.
    for (const piece of pieces.slice(1, -1)) {
      if (piece.startsWith('--')) break
      partWords(splitPart(piece.replace(/^\n/, '')), out, depth + 1)
    }
    return
  }
  if (/attachment/i.test(disposition) || (fileName && !mime.startsWith('text/'))) {
    out.files.push(decodeHeaderWords(fileName ?? 'file'))
    return
  }
  if (mime === 'message/rfc822') {
    partWords(splitPart(decodeBody(part.body, part.headers.get('content-transfer-encoding'), charset)), out, depth + 1)
    return
  }
  const text = decodeBody(part.body, part.headers.get('content-transfer-encoding'), charset)
  if (mime === 'text/html') out.html.push(htmlWords(text))
  else if (mime.startsWith('text/')) out.plain.push(text.trim())
  else if (fileName) out.files.push(decodeHeaderWords(fileName))
}

/**
 * An `.eml` as words: the kept headers one a line, a blank line, the text parts (plain; HTML stripped when a mail has
 * no plain part), then `File: <name>` for each attachment. A file with no headers at all is returned as it stands.
 */
export function emlToText(raw: string): string {
  const top = splitPart(raw)
  if (top.headers.size === 0) return raw.trim()
  const lines: string[] = []
  for (const h of KEPT_HEADERS) {
    const v = top.headers.get(h.toLowerCase())
    if (v) lines.push(`${h}: ${decodeHeaderWords(v)}`)
  }
  const out = { plain: [] as string[], html: [] as string[], files: [] as string[] }
  partWords(top, out, 0)
  const body = (out.plain.length > 0 ? out.plain : out.html).filter(Boolean).join('\n\n')
  const files = out.files.map((f) => `File: ${f}`)
  return [lines.join('\n'), body, files.join('\n')].filter(Boolean).join('\n\n').trim()
}

/** Whether a file is an email by its kind or its name. */
export function isEmlFile(f: { name: string; mimeType: string }): boolean {
  return f.mimeType === 'message/rfc822' || /\.eml$/i.test(f.name)
}

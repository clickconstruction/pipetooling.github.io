/**
 * Messages: the web addresses and the sender's bold marks in a line's plain-text words (v2.6508). The bids@ reader
 * keeps an email's words as text (`readGmailMessage` in the edge `emailIn/gmailMessage.ts`: the plain part, else the
 * HTML part read as text) and its links as `message_attachments` rows; the HTML part itself is kept nowhere, so the
 * words are the only place a link's place in the sentence and the sender's emphasis survive. Glenn Gelwin's invitation
 * of 2026-10-22 read `*Link to Plans*:` and then the address twice, `**https://…box.com/s/… <https://…box.com/s/…>*`,
 * the way Outlook writes a linked address into the plain part, and none of it was pressable.
 *
 * `bodyPieces` reads the words into what the viewer draws: text, and a link (the address once, the mail client's
 * doubled `url <url>` and a bare `<url>` folded to one), each bold or not. Bold is `*words*` as a mail client writes
 * it: the opening mark at a start or after a space, the closing one before a space or a sentence's punctuation, words
 * that hold no other mark and no blank line, so a `*` in arithmetic or a bullet's `* ` is never one. Markdown's
 * `**words**` reads the same. Pure; the thread's line, the message window and its print page all draw from it.
 */

export type BodyPiece = { kind: 'text'; text: string; bold: boolean } | { kind: 'link'; href: string; bold: boolean }

const URL_SOURCE = 'https?:\\/\\/[^\\s<>"\'`]+'
/** Punctuation that closes the sentence or the mark around an address, not the address itself. */
const URL_TRAIL_RE = /[.,;:!?)\]*'"]+$/
/** The same address again in angle brackets right after it: a mail client writing a link's words and its address. */
const DOUBLED_RE = /^\s*<\s*(https?:\/\/[^\s<>]+?)\s*>/
/**
 * A bold span: what stands before the opening mark (a start, a space, an opening bracket or quote), the mark (one or
 * two stars), the words, the closing mark, and what follows it (an end, a space, a sentence's punctuation, a closing
 * bracket or quote). The words hold no star; whether they end on a space or hold a blank line is checked by hand.
 */
const BOLD_RE = /(^|[\s(["'“])(\*{1,2})(?=[^\s*])([^*]{1,300}?)(\*{1,2})(?=$|[\s.,;:!?)\]"'”])/gm

const sameAddress = (a: string, b: string): boolean => a === b || a.replace(/\/$/, '') === b.replace(/\/$/, '')

/** The text's addresses as links and the words between them as text, every piece bold or not. */
function linkPieces(text: string, bold: boolean): BodyPiece[] {
  const out: BodyPiece[] = []
  const re = new RegExp(URL_SOURCE, 'g')
  let cursor = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let start = m.index
    let end = start + m[0].length
    let href = m[0]
    const trail = URL_TRAIL_RE.exec(href)?.[0] ?? ''
    if (trail) {
      href = href.slice(0, -trail.length)
      end -= trail.length
    }
    if (!/^https?:\/\/[^/]/.test(href)) {
      re.lastIndex = end
      continue
    }
    // The address alone in angle brackets: the brackets are the mail client's, not the sentence's.
    if (text[start - 1] === '<' && text[end] === '>') {
      start -= 1
      end += 1
    }
    const doubled = DOUBLED_RE.exec(text.slice(end))
    if (doubled && sameAddress(doubled[1]!, href)) end += doubled[0].length
    if (start > cursor) out.push({ kind: 'text', text: text.slice(cursor, start), bold })
    out.push({ kind: 'link', href, bold })
    cursor = end
    re.lastIndex = end
  }
  if (cursor < text.length) out.push({ kind: 'text', text: text.slice(cursor), bold })
  return out
}

/** The words as the viewer draws them: text and links, each bold where the sender's marks made it so. */
export function bodyPieces(body: string): BodyPiece[] {
  const out: BodyPiece[] = []
  const re = new RegExp(BOLD_RE.source, 'gm')
  let cursor = 0
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const openAt = m.index + m[1]!.length
    const words = m[3]!
    // Words that end on a space, or hold a blank line, are not one span: look again past this opening mark.
    if (/\s$/.test(words) || /\n[ \t]*\n/.test(words)) {
      re.lastIndex = openAt + 1
      continue
    }
    const wordsAt = openAt + m[2]!.length
    const closeEnd = wordsAt + words.length + m[4]!.length
    if (openAt > cursor) out.push(...linkPieces(body.slice(cursor, openAt), false))
    out.push(...linkPieces(words, true))
    cursor = closeEnd
    re.lastIndex = closeEnd
  }
  if (cursor < body.length) out.push(...linkPieces(body.slice(cursor), false))
  return out
}

/** Every address in the words, once each, in order. */
export function bodyLinks(body: string): string[] {
  const seen = new Set<string>()
  for (const p of bodyPieces(body)) if (p.kind === 'link' && !seen.has(p.href)) seen.add(p.href)
  return [...seen]
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch)

/** The words as HTML for the print page: each address a link that opens in a new tab, the bold in `<b>`. */
export function bodyHtml(body: string): string {
  return bodyPieces(body)
    .map((p) => {
      const inner = p.kind === 'link' ? `<a href="${esc(p.href)}" target="_blank" rel="noopener noreferrer">${esc(p.href)}</a>` : esc(p.text)
      return p.bold ? `<b>${inner}</b>` : inner
    })
    .join('')
}

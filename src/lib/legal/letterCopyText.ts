/**
 * The part of a text document that can be pasted into an email (v2.7683).
 *
 * A letter kept as markdown carries more than the letter: a draft banner at its top, internal notes at its
 * foot, and markdown marks an email shows as stray stars. `letterCopyText` reads the markdown and answers
 * the **pieces** to send as plain text, what it left out, and the bracketed blanks still open in each piece,
 * so the press that copies can warn before the paste. Pure: no clock, no io.
 *
 * The rules, in the order they run:
 *  1. An HTML comment is dropped. The read view never drew it.
 *  2. **The draft banner**: the first block of the document, when it is a heading or a paragraph that says
 *     `DRAFT` in capitals or opens with the word *draft*. The italic paragraphs right under it go with it.
 *  3. **Internal sections**: a heading of any size whose words open with *internal* drops itself and
 *     everything under it, up to the next heading of its own size or larger.
 *  4. **Pieces**: a `#` or `##` heading starts a piece and names it, and its own line is not part of the
 *     text. Words before the first such heading are a piece with no name. A smaller heading stays inside its
 *     piece as a plain line. A piece with no words under it is a title, and is not a piece.
 *  5. **Plain text**: no `**`, `*`, `_`, backticks, `#` or rule lines. A list keeps its dash, a numbered list
 *     its number, and a line break stays where it was written, since a signature block is lines.
 *     A bracketed blank such as `[DATE]` or `[counsel: confirm the day]` stays as written.
 */

/** A bracketed blank still in a piece, and how many times it stands there. */
export interface LetterBlank {
  text: string
  times: number
}

/** One piece to send: its heading (null for the words before the first heading), its text and its open blanks. */
export interface LetterPiece {
  heading: string | null
  text: string
  blanks: LetterBlank[]
  /** Every place a blank stands, a repeated blank counted each time. */
  blankCount: number
}

export interface LetterCopy {
  pieces: LetterPiece[]
  /** The whole document as plain text, the banner and the internal sections included. */
  everything: string
  /** The banner's words when one was left out, else null. */
  draftBanner: string | null
  /** The headings of the internal sections left out. */
  internalHeadings: string[]
}

const ESC_BASE = 0xe000
const RULE_LINE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/
const FENCE_LINE = /^\s*(```|~~~)/
const HEADING_LINE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/
const BLANK = /\[[^[\]\n]{1,200}\]/g

/** The marks inside one line: emphasis, code ticks, links and escapes. A bracketed blank is left alone. */
function plainInline(line: string): string {
  let s = line.replace(/\\([!-/:-@[-`{-~])/g, (_m, c: string) => String.fromCharCode(ESC_BASE + c.charCodeAt(0)))
  s = s.replace(/!?\[([^[\]\n]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_m, words: string, url: string) => (!words.trim() || words.trim() === url ? url : `${words} (${url})`))
  s = s.replace(/`+([^`\n]+)`+/g, '$1')
  s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1').replace(/\*\*([^*\n]+)\*\*/g, '$1')
  s = s.replace(/(^|[^*\w])\*(?=\S)([^*\n]*[^*\s])\*(?![*\w])/g, '$1$2')
  s = s.replace(/\*\*/g, '')
  s = s.replace(/(^|[^\w_])__(?=[^\s_])([^\n]*?[^\s_])__(?![\w_])/g, '$1$2')
  s = s.replace(/(^|[^\w_])_(?=[^\s_])([^_\n]*[^\s_])_(?![\w_])/g, '$1$2')
  s = s.replace(/~~([^~\n]+)~~/g, '$1')
  return s.replace(/[-]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - ESC_BASE))
}

/** One line of markdown as a line of plain text; null for a line that is only markup (a rule, a fence). */
function plainLine(line: string, inFence: boolean): string | null {
  if (inFence) return line.replace(/\s+$/, '')
  if (RULE_LINE.test(line)) return null
  let s = line.replace(/(\\|\s{2,})$/, '').replace(/\s+$/, '')
  const h = HEADING_LINE.exec(s)
  if (h) return plainInline(h[2]!)
  s = s.replace(/^(\s*)(?:>\s?)+/, '$1')
  // A star or plus bullet becomes a dash; a task box goes; a dash or a number stays as written.
  s = s.replace(/^(\s*)[*+]\s+/, '$1- ').replace(/^(\s*(?:-|\d+[.)])\s+)\[[ xX]\]\s+/, '$1')
  const lead = /^(\s*(?:-|\d+[.)])\s+|\s*)/.exec(s)![0]
  return lead + plainInline(s.slice(lead.length))
}

/** Plain lines joined: no blank line at either end, never two in a row. */
function joinPlain(lines: ReadonlyArray<string>): string {
  const out: string[] = []
  for (const l of lines) {
    if (l.trim() === '') {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
    } else out.push(l)
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}

/** Markdown lines as plain lines, fences kept as they were written. */
function plainLines(lines: ReadonlyArray<string>): string[] {
  const out: string[] = []
  let inFence = false
  for (const line of lines) {
    if (FENCE_LINE.test(line)) {
      inFence = !inFence
      continue
    }
    const p = plainLine(line, inFence)
    if (p !== null) out.push(p)
  }
  return out
}

/** A whole markdown document as plain email text. */
export function markdownToPlainText(markdown: string): string {
  return joinPlain(plainLines(stripComments(markdown).split('\n')))
}

function stripComments(markdown: string): string {
  return markdown.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '')
}

/** The bracketed blanks in a piece of plain text, in the order they first stand. A task box, a footnote and a bare number are not blanks. */
export function letterBlanks(text: string): LetterBlank[] {
  const seen = new Map<string, number>()
  for (const m of text.match(BLANK) ?? []) {
    const inner = m.slice(1, -1).trim()
    if (inner === '' || /^[xX]$/.test(inner) || /^\^/.test(inner) || /^\d+$/.test(inner)) continue
    seen.set(m, (seen.get(m) ?? 0) + 1)
  }
  return [...seen].map(([text, times]) => ({ text, times }))
}

const saysDraft = (plain: string) => /\bDRAFT\b/.test(plain) || /^\W*draft\b/i.test(plain)
const isItalicBlock = (block: ReadonlyArray<string>) => {
  const s = block.join(' ').trim().replace(/^(?:>\s?)+/, '')
  return /^([*_])(?!\1)[\s\S]*[^*_\s]\1$/.test(s)
}

/** The first block's end (exclusive) from `from`: one heading line, or the lines of one paragraph. */
function blockEnd(lines: ReadonlyArray<string>, from: number): number {
  if (HEADING_LINE.test(lines[from]!)) return from + 1
  let i = from
  while (i < lines.length && lines[i]!.trim() !== '' && (i === from || !HEADING_LINE.test(lines[i]!))) i++
  return i
}
const skipBlank = (lines: ReadonlyArray<string>, from: number) => {
  let i = from
  while (i < lines.length && (lines[i]!.trim() === '' || RULE_LINE.test(lines[i]!))) i++
  return i
}

/** The draft banner at the top: where the document goes on after it, and its words; null when there is none. */
function draftBannerOf(lines: ReadonlyArray<string>): { next: number; words: string } | null {
  const start = skipBlank(lines, 0)
  if (start >= lines.length || FENCE_LINE.test(lines[start]!)) return null
  let end = blockEnd(lines, start)
  const words = joinPlain(plainLines(lines.slice(start, end))).replace(/\n+/g, ' ')
  if (!saysDraft(words)) return null
  // The italic note under it, and any more of them.
  for (;;) {
    const at = skipBlank(lines, end)
    if (at >= lines.length || HEADING_LINE.test(lines[at]!) || FENCE_LINE.test(lines[at]!)) break
    const to = blockEnd(lines, at)
    if (!isItalicBlock(lines.slice(at, to))) break
    end = to
  }
  return { next: end, words }
}

/** Read a text document: the pieces to send, the whole as plain text, and what was left out of the pieces. */
export function letterCopyText(markdown: string): LetterCopy {
  const lines = stripComments(markdown).split('\n')
  const banner = draftBannerOf(lines)
  const internalHeadings: string[] = []
  const raw: Array<{ heading: string | null; lines: string[] }> = [{ heading: null, lines: [] }]
  let skipLevel: number | null = null
  let inFence = false
  for (const line of lines.slice(banner?.next ?? 0)) {
    if (FENCE_LINE.test(line)) {
      inFence = !inFence
      continue
    }
    const h = inFence ? null : HEADING_LINE.exec(line)
    if (h) {
      const level = h[1]!.length
      const words = plainInline(h[2]!).trim()
      if (skipLevel !== null && level > skipLevel) continue
      skipLevel = null
      if (/^\W*internal\b/i.test(words)) {
        skipLevel = level
        internalHeadings.push(words)
        continue
      }
      if (level <= 2) {
        raw.push({ heading: words, lines: [] })
        continue
      }
    }
    if (skipLevel !== null) continue
    const p = plainLine(line, inFence)
    if (p !== null) raw[raw.length - 1]!.lines.push(p)
  }
  const pieces: LetterPiece[] = []
  for (const r of raw) {
    const text = joinPlain(r.lines)
    if (text === '') continue
    const blanks = letterBlanks(text)
    pieces.push({ heading: r.heading, text, blanks, blankCount: blanks.reduce((n, b) => n + b.times, 0) })
  }
  return { pieces, everything: markdownToPlainText(markdown), draftBanner: banner?.words ?? null, internalHeadings }
}

/** True when the document holds words the letter leaves out: a draft banner or an internal section. */
export function letterLeavesWordsOut(copy: LetterCopy): boolean {
  return copy.draftBanner !== null || copy.internalHeadings.length > 0
}

/**
 * The press's label for a piece. One piece, or the nameless first one, is *the letter*; a named piece among
 * several is its heading in quotes. A draft says so on the press.
 */
export function letterPieceLabel(copy: LetterCopy, index: number, draft: boolean): string {
  const piece = copy.pieces[index]
  const named = piece?.heading && copy.pieces.length > 1 ? `“${piece.heading}”` : null
  if (named) return draft ? `Copy the draft ${named}` : `Copy ${named}`
  return draft ? 'Copy the draft letter' : 'Copy the letter'
}

/** What the toast says once a piece is on the clipboard. `warn` when blanks are still open in it. */
export function letterCopiedWords(copy: LetterCopy, index: number, draft: boolean): { words: string; warn: boolean } {
  const what = letterPieceLabel(copy, index, draft).replace(/^Copy /, '')
  const n = copy.pieces[index]?.blankCount ?? 0
  const open = n === 0 ? '' : n === 1 ? ' 1 blank is still open in it.' : ` ${n} blanks are still open in it.`
  return { words: `Copied ${what}.${open}`, warn: n > 0 }
}

/** One line on what the pieces leave out, or null when they leave nothing out. */
export function letterLeftOutWords(copy: LetterCopy): string | null {
  const parts: string[] = []
  if (copy.draftBanner !== null) parts.push('the draft note at the top')
  const n = copy.internalHeadings.length
  if (n === 1) parts.push(`the section “${copy.internalHeadings[0]}”`)
  else if (n > 1) parts.push(`${n} internal sections`)
  return parts.length ? `The copy leaves out ${parts.join(' and ')}.` : null
}

/** The blanks still open in a piece, as one line for the read view; null when none. Among several pieces it names the piece. */
export function letterBlanksWords(copy: LetterCopy, index: number): string | null {
  const piece = copy.pieces[index]
  if (!piece || piece.blankCount === 0) return null
  const where = copy.pieces.length > 1 ? ` in ${piece.heading ? `“${piece.heading}”` : 'the letter'}` : ''
  return `Still to fill${where}: ${piece.blanks.map((b) => (b.times > 1 ? `${b.text} ×${b.times}` : b.text)).join(' · ')}`
}

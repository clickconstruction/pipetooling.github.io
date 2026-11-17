/**
 * One sentence per line, for the shared docs that every PR on a surface amends.
 * Plain JS with no dependencies: ci.yml runs it right after `npm ci` through
 * scripts/codemods/doc-sentence-lines.mjs, and src/lib/docSentenceLines.test.ts pins it.
 *
 * Git merges by line. An entry written as one physical line of several thousand characters is one line to git,
 * so two PRs that amend different sentences of it conflict, and the merge queue drops the second one. Markdown
 * reads a line break inside a paragraph as a space, so breaking the entry after each sentence draws the same
 * page and lets git merge the two amendments.
 *
 * The rule is split only, never join: a line that already holds one sentence is left exactly as written, so a
 * second run changes nothing and a hand-made break is kept. A line is split only where that cannot change what
 * Markdown draws. Left whole: code fences, indented code, table rows (a GFM row is one line by definition),
 * headings, raw HTML and the YAML block at the top. Inside a line, a break never lands in a code span, a link's
 * address or an HTML tag, and never before words that would open a new block (a list marker, `#`, `>`, `|`).
 */

/** Words that end in a period without ending a sentence. Compared in lower case, without the period. */
const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'vs', 'cf', 'etc', 'mr', 'mrs', 'ms', 'dr', 'st', 'no', 'inc', 'co', 'corp', 'ltd', 'jr', 'sr',
  'approx', 'est', 'u.s', 'fig', 'sec', 'ch', 'p', 'pp', 'ex', 'ave', 'blvd', 'dept', 'misc', 'a.k.a', 'incl',
  // The Texas codes these docs cite: Tex. Prop. Code, Tex. Civ. Prac. & Rem. Code, Tex. Bus. & Com. Code.
  'tex', 'prop', 'civ', 'prac', 'rem', 'bus', 'com', 'gov', 'occ',
])

/** Characters that may sit between a sentence's end mark and the space after it. */
const CLOSERS = new Set([')', ']', '"', "'", '*', '_', '”', '’', '~'])

/** A continuation line that starts like this would open a new block, so no break goes in front of it. */
const OPENS_A_BLOCK = /^(?:[-+*](?:[ \t]|$)|\d{1,9}[.)](?:[ \t]|$)|#{1,6}(?:[ \t]|$)|>|\||<|`{3,}|~{3,}|=+[ \t]*$|-+[ \t]*$|(?:[*_-][ \t]*){3,}$|[ \t]|:)/

/** What a sentence may start with: a capital, a digit, or the opening of emphasis, code, a link or a quote. */
const STARTS_A_SENTENCE = /^(?:[\p{Lu}\p{N}*_`[("“‘'~]|v\d+\.\d)/u

/** `> ` prefixes, indent, then an optional list marker (with an optional task box). */
const LEAD = /^((?:[ \t]{0,3}>[ \t]?)*)([ \t]*)((?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?/

const FENCE = /^(?:[ \t]{0,3}>[ \t]?)*[ \t]*(`{3,}|~{3,})/

function widthOf(indent) {
  let w = 0
  for (const ch of indent) w += ch === '\t' ? 4 - (w % 4) : 1
  return w
}

/**
 * Where one line's words may break: the index of each sentence's first character after the first.
 * @param {string} text the words of one line, its prefix already removed
 * @returns {number[]}
 */
export function sentenceBreaks(text) {
  const out = []
  const n = text.length
  let i = 0
  while (i < n) {
    const ch = text[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '`') {
      // A code span closes on a run of exactly as many backticks; with no such run the backticks are plain text.
      let run = 1
      while (text[i + run] === '`') run++
      let j = i + run
      let close = -1
      while (j < n) {
        if (text[j] !== '`') {
          j++
          continue
        }
        let r = 1
        while (text[j + r] === '`') r++
        if (r === run) {
          close = j + r
          break
        }
        j += r
      }
      // Past the span, the scan goes on: a mark right behind it (`npm test`. Next) ends the sentence as usual.
      i = close === -1 ? i + run : close
      continue
    }
    if (ch === '[') {
      // A link or an image: its words, then its address and title, stay on one line.
      const end = closeOf(text, i, '[', ']')
      if (end !== -1 && (text[end + 1] === '(' || text[end + 1] === '[')) {
        const open = text[end + 1]
        const after = closeOf(text, end + 1, open, open === '(' ? ')' : ']')
        if (after !== -1) {
          i = after + 1
          continue
        }
      }
    }
    if (ch === '<' && /[A-Za-z/!]/.test(text[i + 1] ?? '')) {
      // An HTML tag or an autolink: no break inside it.
      const close = text.indexOf('>', i + 1)
      const nextOpen = text.indexOf('<', i + 1)
      if (close !== -1 && (nextOpen === -1 || close < nextOpen)) {
        i = close + 1
        continue
      }
    }
    if (ch === '.' || ch === '!' || ch === '?' || ch === ';') {
      const at = ch === ';' ? breakAfterClause(text, i) : breakAfter(text, i)
      if (at !== -1) {
        out.push(at)
        i = at
        continue
      }
    }
    i++
  }
  return out
}

/** The index of the bracket that closes the one at `from`, else -1. Escapes and code spans are stepped over. */
function closeOf(text, from, open, close) {
  let depth = 0
  for (let j = from; j < text.length; j++) {
    const c = text[j]
    if (c === '\\') j++
    else if (c === '`') {
      let run = 1
      while (text[j + run] === '`') run++
      const end = text.indexOf('`'.repeat(run), j + run)
      j = end === -1 ? j + run - 1 : end + run - 1
    } else if (c === open) depth++
    else if (c === close && --depth === 0) return j
  }
  return -1
}

/** The index where the next clause starts when the semicolon at `text[i]` is followed by a space, else -1. */
function breakAfterClause(text, i) {
  let s = i + 1
  if (text[s] !== ' ' && text[s] !== '\t') return -1
  while (s < text.length && (text[s] === ' ' || text[s] === '\t')) s++
  if (s >= text.length || OPENS_A_BLOCK.test(text.slice(s))) return -1
  return s
}

/** The index where the next sentence starts when the mark at `text[i]` ends one, else -1. */
function breakAfter(text, i) {
  const n = text.length
  // A run of marks ends the sentence once: `...`, `?!`.
  let j = i
  while (j + 1 < n && (text[j + 1] === '.' || text[j + 1] === '!' || text[j + 1] === '?')) j++
  let k = j + 1
  while (k < n && CLOSERS.has(text[k])) k++
  if (k >= n || (text[k] !== ' ' && text[k] !== '\t')) return -1
  let s = k
  while (s < n && (text[s] === ' ' || text[s] === '\t')) s++
  if (s >= n) return -1
  const rest = text.slice(s)
  if (!STARTS_A_SENTENCE.test(rest) || OPENS_A_BLOCK.test(rest)) return -1
  if (text[i] === '.' && j === i) {
    // The word the period closes: an abbreviation or a lone initial does not end a sentence.
    let w = i
    while (w > 0 && /[\p{L}\p{N}.]/u.test(text[w - 1])) w--
    const word = text.slice(w, i)
    if (ABBREVIATIONS.has(word.toLowerCase())) return -1
    if (/^\p{Lu}$/u.test(word)) return -1
  }
  return s
}

/**
 * One line as its sentences, each on its own line under the same quote marks and indent.
 * @returns {string[]} the line itself, alone, when it holds one sentence
 */
export function splitLine(line) {
  const m = LEAD.exec(line)
  const lead = m[0]
  const text = line.slice(lead.length)
  const breaks = sentenceBreaks(text)
  if (breaks.length === 0) return [line]
  const under = m[1] + m[2] + ' '.repeat((m[3] ?? '').length)
  const out = []
  let from = 0
  for (const at of breaks) {
    out.push((out.length === 0 ? lead : under) + text.slice(from, at).replace(/[ \t]+$/, ''))
    from = at
  }
  // The last piece keeps the line's own ending: two trailing spaces are a hard break.
  out.push(under + text.slice(from))
  return out
}

/**
 * Which lines of a document are prose that may be split. The rest are returned as written.
 * @returns {boolean[]} one flag per line
 */
export function proseLines(lines) {
  const flags = new Array(lines.length).fill(false)
  let fence = null // the fence run that opened the block we are inside
  let inTable = false
  let inHtml = false
  let listContent = -1 // the column a list item's words start at; -1 outside a list
  let yaml = 0 // 0 before the top block, 1 inside it, 2 after
  let seen = 0 // non-blank lines so far
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const blank = line.trim() === ''
    if (fence) {
      const f = FENCE.exec(line)
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim().replace(/^(?:>[ \t]?)*/, '') === f[1]) fence = null
      continue
    }
    const f = FENCE.exec(line)
    if (f) {
      fence = f[1]
      inTable = false
      continue
    }
    if (blank) {
      inTable = false
      inHtml = false
      continue
    }
    seen++
    // The YAML block these docs carry near the top: `---`, keys, `---`. Its readers match whole lines.
    if (yaml === 0 && line.trim() === '---' && seen <= 6) {
      yaml = 1
      continue
    }
    if (yaml === 1) {
      if (line.trim() === '---') yaml = 2
      continue
    }
    const m = LEAD.exec(line)
    const body = line.slice(m[1].length)
    const indent = widthOf(m[2])
    const bodyText = body.trimStart()
    if (inHtml) continue
    if (inTable) continue
    if (bodyText.startsWith('|')) {
      inTable = true
      continue
    }
    if (bodyText.startsWith('<')) {
      inHtml = true
      continue
    }
    if (m[3]) {
      // A list item: its words start past the marker, and the lines under it share that column.
      if (indent >= (listContent === -1 ? 0 : listContent) + 4) continue
      listContent = indent + m[3].length
    } else {
      // Four columns past where words may start is indented code, in a list item or out of one.
      if (indent >= (listContent === -1 ? 0 : listContent) + 4) continue
      // A paragraph at the margin after a blank line ends the list.
      if (indent === 0 && (i === 0 || lines[i - 1].trim() === '')) listContent = -1
    }
    if (/^#{1,6}(?:[ \t]|$)/.test(bodyText)) continue
    if (i + 1 < lines.length && /^[ \t]*(?:=+|-+)[ \t]*$/.test(lines[i + 1].slice(LEAD.exec(lines[i + 1])[1].length)) && lines[i + 1].trim() !== '') {
      // The next line underlines this one into a heading, or is a rule; either way leave the pair alone.
      continue
    }
    if (/^\[[^\]]+\]:\s/.test(bodyText)) continue // a link reference definition
    flags[i] = true
  }
  return flags
}

/**
 * The whole document with every prose line split at its sentences.
 * @returns {{ text: string, split: { line: number, pieces: number, starts: string }[] }}
 */
export function reflowDocument(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  const lines = source.split(eol)
  const flags = proseLines(lines)
  const out = []
  const split = []
  for (let i = 0; i < lines.length; i++) {
    if (!flags[i]) {
      out.push(lines[i])
      continue
    }
    const pieces = splitLine(lines[i])
    if (pieces.length > 1) split.push({ line: i + 1, pieces: pieces.length, starts: lines[i].slice(0, 70) })
    for (const p of pieces) out.push(p)
  }
  return { text: out.join(eol), split }
}

/**
 * Lines still longer than the cap after the split: one sentence, or a table row, that two PRs cannot both amend.
 * @param {string} source
 * @param {{ prose: number, table: number }} caps
 * @returns {{ line: number, length: number, kind: 'prose' | 'table', starts: string }[]}
 */
export function longLines(source, caps) {
  const lines = source.split(/\r?\n/)
  const flags = proseLines(lines)
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const length = lines[i].length
    const isTable = !flags[i] && lines[i].slice(LEAD.exec(lines[i])[1].length).trimStart().startsWith('|')
    if (flags[i] && length > caps.prose) out.push({ line: i + 1, length, kind: 'prose', starts: lines[i].slice(0, 70) })
    else if (isTable && length > caps.table) out.push({ line: i + 1, length, kind: 'table', starts: lines[i].slice(0, 70) })
  }
  return out
}

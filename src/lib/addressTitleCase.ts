/**
 * Title-casing for postal addresses (v2.2328): "11704 fm 1117 seguin tx" and
 * "823 ARION PARKWAY SAN ANTONIO" both become properly cased, while tokens
 * that are ALREADY mixed-case pass through untouched (McQueeney, O'Neil —
 * never mangle what a human deliberately typed). Address conventions:
 * road-system and directional abbreviations stay uppercase (FM, IH, TX, NE),
 * ordinals stay "5th" not "5Th", suite letters stay "200B", and connective
 * words stay small ("Ranch to Market Rd"). Used by the job-form normalizer
 * and (via vite-node) the data sweep, so entry and backlog agree.
 */

/** Abbreviations that stay ALL-CAPS wherever they appear. */
const KEEP_UPPER = new Set([
  'TX',
  'FM',
  'RM',
  'CR',
  'US',
  'IH',
  'SH',
  'PO',
  'NE',
  'NW',
  'SE',
  'SW',
  'I',
  'N',
  'S',
  'E',
  'W',
])

/** Connective words that stay lowercase mid-address ("Ranch to Market Rd"). */
const KEEP_LOWER = new Set(['to', 'of', 'the', 'and', 'at'])

const ORDINAL_RE = /^(\d+)(st|nd|rd|th)$/i
/** "fm1117", "i35", "tx29" — road-system prefix glued to its number. */
const GLUED_ROAD_RE = /^(fm|rm|cr|us|ih|sh|tx|i)(\d+[a-z]?)$/i
/** "200b", "498a" — leading digits with a short suite-letter tail. */
const DIGITS_LETTER_TAIL_RE = /^(\d+)([a-z]{1,2})$/i

function hasInternalUpper(word: string): boolean {
  return /[A-Z]/.test(word.slice(1))
}

function capFirst(word: string): string {
  if (!word) return word
  let out = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  // Mc names and letters after an apostrophe: McQueeney, O'Brien.
  out = out.replace(/^Mc(\w)/, (_, c: string) => `Mc${c.toUpperCase()}`)
  out = out.replace(/'(\w)/g, (_, c: string) => `'${c.toUpperCase()}`)
  return out
}

function casePart(part: string, isFirstToken: boolean): string {
  if (!/[A-Za-z]/.test(part)) return part
  const bare = part.replace(/[.,]/g, '')
  if (KEEP_UPPER.has(bare.toUpperCase())) return part.toUpperCase()
  const ord = ORDINAL_RE.exec(part)
  if (ord) return `${ord[1]}${(ord[2] ?? '').toLowerCase()}`
  const glued = GLUED_ROAD_RE.exec(part)
  if (glued) return `${(glued[1] ?? '').toUpperCase()}${(glued[2] ?? '').toUpperCase()}`
  const suite = DIGITS_LETTER_TAIL_RE.exec(part)
  if (suite) return `${suite[1]}${(suite[2] ?? '').toUpperCase()}`
  if (!isFirstToken && KEEP_LOWER.has(part.toLowerCase())) return part.toLowerCase()
  const isAllLower = part === part.toLowerCase()
  const isAllUpper = part === part.toUpperCase()
  if (!isAllLower && !isAllUpper && hasInternalUpper(part)) return part // deliberate mixed case
  return capFirst(part)
}

export function titleCaseAddress(address: string): string {
  let firstSeen = false
  return address
    .split(' ')
    .map((token) => {
      if (!token) return token
      // Process hyphen/slash-joined parts separately so "i-35" → "I-35".
      const cased = token
        .split(/([\/-])/)
        .map((piece) => (piece === '-' || piece === '/' ? piece : casePart(piece, !firstSeen)))
        .join('')
      if (/[A-Za-z0-9]/.test(token)) firstSeen = true
      return cased
    })
    .join(' ')
}

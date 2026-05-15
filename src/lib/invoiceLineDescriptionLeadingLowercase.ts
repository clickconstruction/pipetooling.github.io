/** First letter in the segment (after skipping leading non-letters); null if none. */
function firstLetterInSegment(segment: string): string | null {
  const s = segment.normalize('NFC')
  for (const ch of s) {
    if (/\p{L}/u.test(ch)) return ch
  }
  return null
}

/** True if the segment’s first letter is a Unicode lowercase letter. */
export function firstLetterLooksLowercase(segment: string): boolean {
  if (!segment.trim()) return false
  const first = firstLetterInSegment(segment.trim())
  if (first == null) return false
  return /\p{Ll}/u.test(first)
}

/** Split on newlines, trim, check each non-empty line. */
export function anyLineSegmentsStartWithLowercase(text: string): boolean {
  return text
    .split(/\r\n|\r|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .some((segment) => firstLetterLooksLowercase(segment))
}

export function invoiceDescriptionsNeedLowercaseLeadingHint(descriptions: string[]): boolean {
  for (const raw of descriptions) {
    const t = raw.trim()
    if (!t) continue
    if (anyLineSegmentsStartWithLowercase(t)) return true
  }
  return false
}

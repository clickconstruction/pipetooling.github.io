/**
 * Search-match highlighting for Pipeline rows (v2.1830): split display text
 * into plain/matched segments for the SAME single case-insensitive substring
 * the board matcher uses (`filterJobsByStagesSearch`) and the server search
 * ilikes — one query string, no tokenization, so a highlight can never claim
 * a match the filter didn't make.
 */

export type SearchMatchSegment = { text: string; match: boolean }

/**
 * All occurrences, case-insensitive. No query, blank text, or no hit →
 * a single non-match segment (callers render the string unchanged).
 */
export function splitTextByMatch(text: string, query: string | null | undefined): SearchMatchSegment[] {
  const q = (query ?? '').trim().toLowerCase()
  if (!text || !q) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const segments: SearchMatchSegment[] = []
  let pos = 0
  while (pos < text.length) {
    const hit = lower.indexOf(q, pos)
    if (hit === -1) {
      segments.push({ text: text.slice(pos), match: false })
      break
    }
    if (hit > pos) segments.push({ text: text.slice(pos, hit), match: false })
    segments.push({ text: text.slice(hit, hit + q.length), match: true })
    pos = hit + q.length
  }
  if (segments.length === 0) segments.push({ text, match: false })
  return segments.length > 1 || segments[0]!.match ? segments : [{ text, match: false }]
}

/** True when any segment matched — cheap "should we bother rendering marks" gate. */
export function textHasMatch(text: string | null | undefined, query: string | null | undefined): boolean {
  const q = (query ?? '').trim().toLowerCase()
  if (!text || !q) return false
  return text.toLowerCase().includes(q)
}

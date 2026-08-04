/**
 * Match highlighting for the "Add job to schedule" picker: split a display
 * string into segments so the parts matching the user's query render
 * emphasized. Case-insensitive, literal substring, every occurrence.
 */
export type HighlightSegment = { text: string; match: boolean }

export function splitTextForQueryHighlight(text: string, queryRaw: string): HighlightSegment[] {
  const query = queryRaw.trim()
  if (text === '') return []
  if (query === '') return [{ text, match: false }]
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const out: HighlightSegment[] = []
  let pos = 0
  for (;;) {
    const hit = lower.indexOf(q, pos)
    if (hit === -1) break
    if (hit > pos) out.push({ text: text.slice(pos, hit), match: false })
    out.push({ text: text.slice(hit, hit + q.length), match: true })
    pos = hit + q.length
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false })
  return out
}
